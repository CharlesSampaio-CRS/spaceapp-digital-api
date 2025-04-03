import Fastify from 'fastify';
import { connectRedis } from '../src/database/redisClient.js';
import applicationsRoutes from '../src/routes/applications.js';
import usersRoutes from '../src/routes/users.js';
import spacesRoutes from '../src/routes/spaces.js';

const fastify = Fastify({ logger: true });


const startServer = async () => {
  try {
    await connectRedis(); 
    fastify.register(applicationsRoutes);
    fastify.register(usersRoutes);
    fastify.register(spacesRoutes);
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Servidor rodando em http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();
