import { getConfig } from '../config/performance.js';

const config = getConfig();

// Rate Limiter otimizado em memória
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, config.RATE_LIMIT.WINDOW_MS);
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - config.RATE_LIMIT.WINDOW_MS;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const userRequests = this.requests.get(identifier);
    
    // Remover requests antigos
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= config.RATE_LIMIT.MAX_REQUESTS) {
      return false;
    }
    
    // Adicionar novo request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  getRemaining(identifier) {
    const now = Date.now();
    const windowStart = now - config.RATE_LIMIT.WINDOW_MS;
    
    if (!this.requests.has(identifier)) {
      return config.RATE_LIMIT.MAX_REQUESTS;
    }
    
    const userRequests = this.requests.get(identifier);
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, config.RATE_LIMIT.MAX_REQUESTS - validRequests.length);
  }

  getResetTime(identifier) {
    const now = Date.now();
    const windowStart = now - config.RATE_LIMIT.WINDOW_MS;
    
    if (!this.requests.has(identifier)) {
      return now + config.RATE_LIMIT.WINDOW_MS;
    }
    
    const userRequests = this.requests.get(identifier);
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length === 0) {
      return now + config.RATE_LIMIT.WINDOW_MS;
    }
    
    return Math.min(...validRequests) + config.RATE_LIMIT.WINDOW_MS;
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - config.RATE_LIMIT.WINDOW_MS;
    
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

const rateLimiter = new RateLimiter();

export const rateLimitMiddleware = (options = {}) => {
  const {
    windowMs = config.RATE_LIMIT.WINDOW_MS,
    maxRequests = config.RATE_LIMIT.MAX_REQUESTS,
    skipSuccessfulRequests = config.RATE_LIMIT.SKIP_SUCCESSFUL_REQUESTS,
    identifierGenerator = (request) => {
      // Usar IP + userUuid se disponível
      const ip = request.ip || request.connection?.remoteAddress || 'unknown';
      const userUuid = request.user?.uuid || 'anonymous';
      return `${ip}:${userUuid}`;
    }
  } = options;

  return async (request, reply) => {
    const identifier = identifierGenerator(request);
    
    if (!rateLimiter.isAllowed(identifier)) {
      const remaining = rateLimiter.getRemaining(identifier);
      const resetTime = rateLimiter.getResetTime(identifier);
      
      return reply.status(429).send({
        error: 'Muitas requisições',
        message: 'Limite de requisições excedido. Tente novamente mais tarde.',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        limit: maxRequests,
        remaining: 0,
        reset: new Date(resetTime).toISOString()
      });
    }

    // Adicionar headers de rate limit
    const remaining = rateLimiter.getRemaining(identifier);
    const resetTime = rateLimiter.getResetTime(identifier);
    
    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', new Date(resetTime).toISOString());

    // Interceptar resposta para pular requests bem-sucedidos se configurado
    if (skipSuccessfulRequests) {
      const originalSend = reply.send;
      reply.send = function(data) {
        if (reply.statusCode >= 200 && reply.statusCode < 300) {
          // Request bem-sucedido - não contar no rate limit
          // (implementação específica se necessário)
        }
        return originalSend.call(this, data);
      };
    }
  };
};

// Rate limit específico para endpoints pesados
export const heavyEndpointRateLimit = rateLimitMiddleware({
  windowMs: 5 * 60 * 1000, // 5 minutos
  maxRequests: 20, // Apenas 20 requests por 5 minutos
  identifierGenerator: (request) => {
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const userUuid = request.user?.uuid || 'anonymous';
    return `heavy:${ip}:${userUuid}`;
  }
});

// Rate limit para autenticação
export const authRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 5, // Apenas 5 tentativas de login por 15 minutos
  identifierGenerator: (request) => {
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    return `auth:${ip}`;
  }
});

// Funções de gerenciamento
export const getRateLimitStats = () => {
  return {
    activeUsers: rateLimiter.requests.size,
    totalRequests: Array.from(rateLimiter.requests.values())
      .reduce((total, requests) => total + requests.length, 0)
  };
};

export const clearRateLimit = () => {
  rateLimiter.requests.clear();
  console.log('Rate limit limpo');
};

// Cleanup ao finalizar aplicação
process.on('SIGINT', () => {
  rateLimiter.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rateLimiter.destroy();
  process.exit(0);
}); 