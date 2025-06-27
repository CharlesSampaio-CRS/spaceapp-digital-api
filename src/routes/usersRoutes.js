import {
  getAllUsers,
  getUserByIdUuid,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';
import { cacheMiddleware } from '../middlewares/cache.js';

export default async function usersRoutes(fastify) {
  // Rotas de leitura com cache
  fastify.get('/users', { 
    preHandler: [fastify.authenticate, cacheMiddleware()] 
  }, getAllUsers);
  
  fastify.get('/users/:uuid', { 
    preHandler: [fastify.authenticate, cacheMiddleware()] 
  }, getUserByIdUuid);
  
  // Rotas de escrita sem cache
  fastify.put('/users/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, updateUser);
  
  fastify.delete('/users/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, deleteUser);
}
