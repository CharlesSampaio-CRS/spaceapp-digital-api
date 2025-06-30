import { 
  register, 
  login
} from '../controllers/authController.js';

export default async function authRoutes(fastify, options) {
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Registrar novo usuário',
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          plan: { type: 'string', enum: ['free', 'basic', 'premium', 'enterprise'] },
          active: { type: 'boolean' },
          googleId: { type: 'string', nullable: true }
        }
      },
      response: {
        201: {
          description: 'Usuário registrado com sucesso',
          type: 'object'
        }
      }
    }
  }, register);

  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login do usuário',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          description: 'Login realizado com sucesso',
          type: 'object'
        }
      }
    }
  }, login);
}