import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';

export default async function usersRoutes(fastify) {
  fastify.get('/users', { preHandler: [fastify.authenticate] }, getAllUsers);
  fastify.get('/users/:id', { preHandler: [fastify.authenticate] }, getUserById);
  fastify.put('/users/:id', { preHandler: [fastify.authenticate] }, updateUser);
  fastify.delete('/users/:id', { preHandler: [fastify.authenticate] }, deleteUser);
}
