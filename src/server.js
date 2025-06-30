import Fastify from 'fastify';
import { config } from 'dotenv';
import { client } from './db/mongodb.js';
import { createIndexes } from './db/indexes.js';
import { getConfig } from './config/performance.js';
import { compressionMiddleware } from './middlewares/compression.js';
import { rateLimitMiddleware } from './middlewares/rateLimit.js';
import applicationsRoutes from './routes/applicationsRoutes.js';
import spacesRoutes from './routes/spacesRoutes.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyJwt from '@fastify/jwt';
import cors from '@fastify/cors';

config();

const performanceConfig = getConfig();

// Configuração otimizada do Fastify
const fastify = Fastify({ 
  logger: {
    level: performanceConfig.LOGGING.LEVEL,
    prettyPrint: process.env.NODE_ENV === 'development'
  },
  trustProxy: true,
  // Configurações de performance
  connectionTimeout: 30000,
  keepAliveTimeout: 65000,
  maxRequestsPerSocket: 100,
  // Configurações de memória
  bodyLimit: 1048576, // 1MB
  // Configurações de compressão
  disableRequestLogging: process.env.NODE_ENV === 'production'
});

// Registrar plugins otimizados
fastify.register(swagger, {
  swagger: {
    info: {
      title: 'API SpaceHub',
      description: 'API SpaceHub apps and flows',
      version: '1.0.0',
    },
    host: process.env.HOST ? `${process.env.HOST}:${process.env.PORT}` : undefined,
    schemes: [process.env.NODE_ENV === 'production' ? 'https' : 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      BearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Insira o token JWT no formato: Bearer <token>'
      }
    }
  },
});

fastify.register(swaggerUi, {
  routePrefix: '/docs',
  staticCSP: true,
  transformSpecificationClone: true,
});

fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
  sign: {
    expiresIn: '1h'
  }
});

// Middleware de compressão global
fastify.addHook('onRequest', compressionMiddleware());

// Middleware de rate limiting global
fastify.addHook('onRequest', rateLimitMiddleware());

// Middleware de autenticação
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Token inválido ou expirado' });
  }
});

// Middleware de monitoramento de performance
fastify.addHook('onResponse', (request, reply, done) => {
  const responseTime = reply.getResponseTime();
  
  // Log de performance apenas para requests lentos ou em desenvolvimento
  if (responseTime > 1000 || process.env.NODE_ENV === 'development') {
    console.log(`${request.method} ${request.url} - ${responseTime}ms`);
  }
  
  // Adicionar headers de performance
  reply.header('X-Response-Time', `${responseTime}ms`);
  reply.header('X-Powered-By', 'Fastify-Optimized');
  
  done();
});

// Middleware de tratamento de erros otimizado
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  
  // Log detalhado apenas em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }
  
  // Resposta de erro otimizada
  const errorResponse = {
    error: true,
    message: statusCode === 500 ? 'Erro interno do servidor' : error.message,
    statusCode
  };
  
  // Adicionar detalhes apenas em desenvolvimento
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.stack = error.stack;
  }
  
  reply.status(statusCode).send(errorResponse);
});

// Middleware de not found otimizado
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: true,
    message: 'Endpoint não encontrado',
    path: request.url,
    method: request.method
  });
});

fastify.addSchema({
  $id: 'HealthResponse',
  type: 'object',
  properties: {
    status: { type: 'string', example: 'ok' },
    timestamp: { type: 'string', format: 'date-time' },
    uptime: { type: 'number', example: 123.45 },
    responseTime: { type: 'string', example: '10ms' },
    database: { type: 'string', example: 'connected' },
    environment: { type: 'string', example: 'development' },
    version: { type: 'string', example: '1.0.0' }
  }
});

const startServer = async () => {
  try {
    // Conectar ao MongoDB com configurações otimizadas
    await client.connect();
    
    // Criar índices para otimização
    await createIndexes();
    
    // Registrar rotas
    fastify.register(applicationsRoutes);
    fastify.register(spacesRoutes);
    fastify.register(authRoutes);
    fastify.register(usersRoutes);

    // Rota de health check otimizada
    fastify.get('/health', {
      schema: {
        description: 'Verifica o status de saúde da API e do banco de dados',
        tags: ['Health'],
        response: {
          200: { $ref: 'HealthResponse#' }
        }
      }
    }, async (request, reply) => {
      const startTime = Date.now();
      // Verificar conectividade com MongoDB
      const dbStatus = await client.db('admin').admin().ping();
      const responseTime = Date.now() - startTime;
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        database: dbStatus.ok ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV,
        version: '1.0.0'
      });
    });

    // Rota de documentação (redireciona para o Swagger UI)
    fastify.get('/docs/ui', {
      schema: {
        description: 'Interface de documentação Swagger da API',
        tags: ['Docs'],
        response: {
          302: {
            description: 'Redireciona para a interface Swagger UI',
            type: 'null'
          }
        }
      }
    }, async (request, reply) => {
      return reply.redirect('/docs/');
    });

    // Rota de métricas de performance
    fastify.get('/metrics', {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retorna métricas de performance da API (requer autenticação JWT)',
        tags: ['Metrics'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              cache: { type: 'object' },
              rateLimit: { type: 'object' },
              compression: { type: 'object' },
              memory: { type: 'object' },
              uptime: { type: 'number' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { getCacheStats } = await import('./middlewares/cache.js');
      const { getRateLimitStats } = await import('./middlewares/rateLimit.js');
      const { getCompressionStats } = await import('./middlewares/compression.js');
      return reply.send({
        cache: getCacheStats(),
        rateLimit: getRateLimitStats(),
        compression: getCompressionStats(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
      });
    });

    await fastify.register(cors, {
      origin: true,
      credentials: true
    });

    await fastify.listen({
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0'
    });

    console.log(`🚀 Servidor otimizado rodando em ${fastify.server.address().port}`);
    console.log(`📊 Configurações de performance aplicadas`);
    console.log(`💾 Cache: ${performanceConfig.CACHE.MAX_SIZE} itens máximo`);
    console.log(`⚡ Rate Limit: ${performanceConfig.RATE_LIMIT.MAX_REQUESTS} requests/${performanceConfig.RATE_LIMIT.WINDOW_MS/60000}min`);
    console.log(`🗜️  Compressão: ${performanceConfig.COMPRESSION.ENABLED ? 'Ativada' : 'Desativada'}`);
    
  } catch (err) {
    console.error('❌ Erro ao iniciar servidor:', err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Recebido ${signal}. Iniciando shutdown graceful...`);
  
  try {
    await fastify.close();
    await client.close();
    console.log('✅ Servidor fechado com sucesso');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro durante shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Monitoramento de memória
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    if (heapUsed > 100) { // Alertar se usar mais de 100MB
      console.log(`⚠️  Uso de memória: ${heapUsed}MB / ${heapTotal}MB`);
    }
  }, 30000); // Verificar a cada 30 segundos
}

startServer();
