import { getConfig } from '../config/performance.js';

const config = getConfig();

// Cache LRU (Least Recently Used) otimizado
class LRUCache {
  constructor(maxSize = config.CACHE.MAX_SIZE) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (this.cache.has(key)) {
      // Mover para o final (mais recente)
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      // Atualizar existente
      this.cache.set(key, value);
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    } else {
      // Adicionar novo
      if (this.cache.size >= this.maxSize) {
        // Remover o item menos usado
        const oldestKey = this.accessOrder.shift();
        this.cache.delete(oldestKey);
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }
}

// Cache principal com TTL
const cache = new LRUCache();
const CACHE_TTL = config.CACHE.TTL;

export const cacheMiddleware = (ttl = CACHE_TTL) => {
  return async (request, reply) => {
    // Pular cache se TTL for 0
    if (ttl === 0) return;

    const cacheKey = `${request.method}:${request.url}:${JSON.stringify(request.query || {})}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      // Cache hit - retornar imediatamente
      return reply.send(cached.data);
    }
    
    // Cache miss - interceptar resposta
    const originalSend = reply.send;
    reply.send = function(data) {
      // Armazenar no cache apenas se for sucesso
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      return originalSend.call(this, data);
    };
  };
};

// Cache específico por usuário (para dados personalizados)
const userCache = new LRUCache(500); // Cache menor para dados de usuário

export const userCacheMiddleware = (ttl = CACHE_TTL) => {
  return async (request, reply) => {
    if (ttl === 0) return;

    const userUuid = request.user?.uuid;
    if (!userUuid) return;

    const cacheKey = `user:${userUuid}:${request.method}:${request.url}`;
    const cached = userCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return reply.send(cached.data);
    }
    
    const originalSend = reply.send;
    reply.send = function(data) {
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        userCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      return originalSend.call(this, data);
    };
  };
};

// Funções de gerenciamento
export const clearCache = () => {
  cache.clear();
  userCache.clear();
  console.log('Cache limpo');
};

export const getCacheStats = () => {
  return {
    mainCache: {
      size: cache.size(),
      keys: cache.keys().slice(0, 10), // Primeiros 10 para não sobrecarregar
      maxSize: config.CACHE.MAX_SIZE
    },
    userCache: {
      size: userCache.size(),
      keys: userCache.keys().slice(0, 10),
      maxSize: 500
    }
  };
};

// Limpeza automática otimizada
let cleanupInterval;

export const startCacheCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    // Limpar cache principal
    for (const key of cache.keys()) {
      const item = cache.get(key);
      if (item && now - item.timestamp > CACHE_TTL) {
        cache.delete(key);
        cleaned++;
      }
    }

    // Limpar cache de usuário
    for (const key of userCache.keys()) {
      const item = userCache.get(key);
      if (item && now - item.timestamp > CACHE_TTL) {
        userCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cache cleanup: ${cleaned} items removed`);
    }
  }, config.CACHE.CLEANUP_INTERVAL);
};

export const stopCacheCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Iniciar limpeza automática
startCacheCleanup(); 