import {
  getAllUsers,
  getUserByIdUuid,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';


export default async function usersRoutes(fastify) {
  // Rotas de leitura com cache
  fastify.get('/users', { 
    preHandler: [fastify.authenticate] 
  }, getAllUsers);
  
  fastify.get('/users/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, getUserByIdUuid);
  
  // Rotas de escrita sem cache
  fastify.put('/users/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, updateUser);
  
  fastify.delete('/users/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, deleteUser);
}
