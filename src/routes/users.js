import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';

export default async function usersRoutes(fastify) {
  fastify.post('/users', createUser);
  fastify.get('/users', getAllUsers);
  fastify.get('/users/:id', getUserById);
  fastify.put('/users/:id', updateUser);
  fastify.delete('/users/:id', deleteUser);
}
