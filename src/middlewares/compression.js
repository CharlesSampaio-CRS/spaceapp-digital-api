import { getConfig } from '../config/performance.js';
import zlib from 'zlib';
import { promisify } from 'util';

const config = getConfig();

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);

// Cache de compressão para evitar recompressão
const compressionCache = new Map();
const CACHE_SIZE = 1000;

export const compressionMiddleware = () => {
  return async (request, reply) => {
    if (!config.COMPRESSION.ENABLED) return;

    const acceptEncoding = request.headers['accept-encoding'] || '';
    const userAgent = request.headers['user-agent'] || '';
    
    // Verificar se o cliente suporta compressão
    const supportsGzip = acceptEncoding.includes('gzip');
    const supportsDeflate = acceptEncoding.includes('deflate');
    
    if (!supportsGzip && !supportsDeflate) return;

    // Pular compressão para bots e crawlers
    const isBot = /bot|crawler|spider|crawling/i.test(userAgent);
    if (isBot) return;

    const originalSend = reply.send;
    
    reply.send = async function(data) {
      try {
        // Verificar se deve comprimir
        const shouldCompress = shouldCompressResponse(data, reply.statusCode);
        
        if (!shouldCompress) {
          return originalSend.call(this, data);
        }

        // Serializar dados se necessário
        const serializedData = typeof data === 'string' ? data : JSON.stringify(data);
        
        // Verificar tamanho mínimo
        if (serializedData.length < config.COMPRESSION.THRESHOLD) {
          return originalSend.call(this, data);
        }

        // Gerar chave do cache
        const cacheKey = `${serializedData}:${supportsGzip}:${supportsDeflate}`;
        
        let compressedData, encoding;
        
        // Verificar cache
        if (compressionCache.has(cacheKey)) {
          const cached = compressionCache.get(cacheKey);
          compressedData = cached.data;
          encoding = cached.encoding;
        } else {
          // Comprimir dados
          if (supportsGzip) {
            compressedData = await gzip(serializedData, { level: config.COMPRESSION.LEVEL });
            encoding = 'gzip';
          } else if (supportsDeflate) {
            compressedData = await deflate(serializedData, { level: config.COMPRESSION.LEVEL });
            encoding = 'deflate';
          } else {
            return originalSend.call(this, data);
          }

          // Armazenar no cache
          if (compressionCache.size < CACHE_SIZE) {
            compressionCache.set(cacheKey, { data: compressedData, encoding });
          }
        }

        // Definir headers de compressão
        reply.header('Content-Encoding', encoding);
        reply.header('Vary', 'Accept-Encoding');
        reply.header('Content-Length', compressedData.length);

        // Log de economia (apenas em desenvolvimento)
        if (process.env.NODE_ENV === 'development') {
          const savings = ((serializedData.length - compressedData.length) / serializedData.length * 100).toFixed(1);
          console.log(`Compression: ${serializedData.length} -> ${compressedData.length} bytes (${savings}% savings)`);
        }

        return originalSend.call(this, compressedData);
      } catch (error) {
        console.error('Compression error:', error);
        // Em caso de erro, retornar dados originais
        return originalSend.call(this, data);
      }
    };
  };
};

// Função para determinar se deve comprimir
function shouldCompressResponse(data, statusCode) {
  // Não comprimir erros
  if (statusCode >= 400) return false;
  
  // Não comprimir respostas vazias
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return false;
  
  // Não comprimir dados binários
  if (Buffer.isBuffer(data)) return false;
  
  return true;
}

// Middleware para compressão específica de JSON
export const jsonCompressionMiddleware = () => {
  return async (request, reply) => {
    if (!config.COMPRESSION.ENABLED) return;

    const acceptEncoding = request.headers['accept-encoding'] || '';
    const supportsGzip = acceptEncoding.includes('gzip');
    
    if (!supportsGzip) return;

    const originalSend = reply.send;
    
    reply.send = async function(data) {
      try {
        // Aplicar apenas para JSON
        if (reply.getHeader('Content-Type')?.includes('application/json')) {
          const serializedData = JSON.stringify(data);
          
          if (serializedData.length >= config.COMPRESSION.THRESHOLD) {
            const compressedData = await gzip(serializedData, { level: config.COMPRESSION.LEVEL });
            
            reply.header('Content-Encoding', 'gzip');
            reply.header('Vary', 'Accept-Encoding');
            reply.header('Content-Length', compressedData.length);
            
            return originalSend.call(this, compressedData);
          }
        }
        
        return originalSend.call(this, data);
      } catch (error) {
        console.error('JSON compression error:', error);
        return originalSend.call(this, data);
      }
    };
  };
};

// Funções de gerenciamento
export const getCompressionStats = () => {
  return {
    cacheSize: compressionCache.size,
    maxCacheSize: CACHE_SIZE,
    enabled: config.COMPRESSION.ENABLED,
    threshold: config.COMPRESSION.THRESHOLD,
    level: config.COMPRESSION.LEVEL
  };
};

export const clearCompressionCache = () => {
  compressionCache.clear();
  console.log('Compression cache limpo');
};

// Limpeza periódica do cache
setInterval(() => {
  if (compressionCache.size > CACHE_SIZE * 0.8) {
    // Remover 20% dos itens mais antigos
    const keysToRemove = Array.from(compressionCache.keys()).slice(0, Math.floor(CACHE_SIZE * 0.2));
    keysToRemove.forEach(key => compressionCache.delete(key));
  }
}, 5 * 60 * 1000); // 5 minutos 