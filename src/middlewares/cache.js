// Cache simples em memória para otimizar consultas
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em millisegundos

export const cacheMiddleware = (ttl = CACHE_TTL) => {
  return async (request, reply) => {
    const cacheKey = `${request.method}:${request.url}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return reply.send(cached.data);
    }
    
    // Armazenar resposta original
    const originalSend = reply.send;
    reply.send = function(data) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      return originalSend.call(this, data);
    };
  };
};

export const clearCache = () => {
  cache.clear();
  console.log('Cache limpo');
};

export const getCacheStats = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
};

// Limpar cache periodicamente para evitar vazamento de memória
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, CACHE_TTL); 