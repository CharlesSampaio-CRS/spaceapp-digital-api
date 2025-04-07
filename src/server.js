import Fastify from 'fastify';
import { config } from 'dotenv';
import { client } from './db/mongodb.js';
import applicationsRoutes from './routes/applicationsRoutes.js';
import spacesRoutes from './routes/spacesRoutes.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyJwt from '@fastify/jwt';

config();

const fastify = Fastify({ 
  logger: true,
  trustProxy: true
});

fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Minha API Fastify',
      description: 'Documentação gerada automaticamente com Swagger',
      version: '1.0.0',
    },
    host: `${process.env.HOST}:${process.env.PORT}`,
    schemes: [process.env.NODE_ENV === 'production' ? 'https' : 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
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

fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Token inválido ou expirado' });
  }
});

const startServer = async () => {
  try {
    await client.connect();

    fastify.register(applicationsRoutes);
    fastify.register(spacesRoutes);
    fastify.register(authRoutes);
    fastify.register(usersRoutes);

    await fastify.listen({
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0'
    });

    console.log(`Servidor rodando em ${fastify.server.address().port}`);
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
};

startServer();
