// src/routes/authRoutes.js
import { 
  register, 
  login
} from '../controllers/authController.js';

export default async function authRoutes(fastify, options) {
  fastify.post('/register', register);
  fastify.post('/login', login);
}