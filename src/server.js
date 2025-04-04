import Fastify from 'fastify';
import { client } from '../src/database/mongodb.js';
import applicationsRoutes from '../src/routes/applications.js';
import usersRoutes from '../src/routes/users.js';
import spacesRoutes from '../src/routes/spaces.js';
import authRoutes from './routes/authRoutes.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyJwt from '@fastify/jwt';

const fastify = Fastify({ logger: true });

fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Minha API Fastify',
      description: 'Documentação gerada automaticamente com Swagger',
      version: '1.0.0',
    },
    host: 'localhost:3000',
    schemes: ['http'],
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
  secret: '@@__SPACE__@@'
});


fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Token inválido' });
  }
});

const startServer = async () => {
  try {
    await client.connect();
    fastify.register(applicationsRoutes);
    fastify.register(usersRoutes);
    fastify.register(spacesRoutes);
    fastify.register(authRoutes);
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Servidor rodando em http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();
