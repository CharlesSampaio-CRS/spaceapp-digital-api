import {
  getAllUsers,
  getUserByIdUuid,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';

export default async function usersRoutes(fastify) {
  fastify.get('/users', { preHandler: [fastify.authenticate] }, getAllUsers);
  fastify.get('/users/:uuid', { preHandler: [fastify.authenticate] }, getUserByIdUuid);
  fastify.put('/users/:uuid', { preHandler: [fastify.authenticate] }, updateUser);
  fastify.delete('/users/:uuid', { preHandler: [fastify.authenticate] }, deleteUser);
}
