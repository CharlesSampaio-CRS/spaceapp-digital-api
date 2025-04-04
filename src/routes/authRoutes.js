import { login , register } from '../controllers/authController.js';

export default async function authRoutes(fastify) {
    fastify.post('/login', login);
    fastify.post('/register', register); 
  }