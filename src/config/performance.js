// Configurações de Performance Avançadas
export const PERFORMANCE_CONFIG = {
  // Cache
  CACHE: {
    TTL: 5 * 60 * 1000, // 5 minutos
    MAX_SIZE: 1000, // Máximo de itens no cache
    CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutos
  },
  
  // Database
  DATABASE: {
    MAX_POOL_SIZE: 10, // Pool de conexões otimizado
    MIN_POOL_SIZE: 2,
    MAX_IDLE_TIME: 30000, // 30 segundos
    CONNECT_TIMEOUT: 10000, // 10 segundos
    SOCKET_TIMEOUT: 45000, // 45 segundos
  },
  
  // Paginação
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    DEFAULT_PAGE: 1,
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 1000000, // 100 requests por janela
    SKIP_SUCCESSFUL_REQUESTS: true,
  },
  
  // Compression
  COMPRESSION: {
    ENABLED: true,
    THRESHOLD: 1024, // Comprimir apenas acima de 1KB
    LEVEL: 6, // Nível de compressão balanceado
  },
  
  // Logging
  LOGGING: {
    LEVEL: process.env.NODE_ENV === 'production' ? 'error' : 'info',
    MAX_FILES: 5,
    MAX_SIZE: '10m',
  },
  
  // Memory Management
  MEMORY: {
    GC_INTERVAL: 5 * 60 * 1000, // 5 minutos
    MAX_HEAP_SIZE: '512MB',
    WARN_THRESHOLD: 0.8, // 80% de uso
  }
};

// Configurações específicas por ambiente
export const ENV_CONFIG = {
  development: {
    CACHE_TTL: 2 * 60 * 1000, // 2 minutos
    LOG_LEVEL: 'debug',
    COMPRESSION_ENABLED: false,
  },
  production: {
    CACHE_TTL: 10 * 60 * 1000, // 10 minutos
    LOG_LEVEL: 'error',
    COMPRESSION_ENABLED: true,
  },
  test: {
    CACHE_TTL: 0, // Sem cache
    LOG_LEVEL: 'silent',
    COMPRESSION_ENABLED: false,
  }
};

// Função para obter configuração baseada no ambiente
export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return {
    ...PERFORMANCE_CONFIG,
    ...ENV_CONFIG[env]
  };
}; 