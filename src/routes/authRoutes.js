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
          name: { type: 'string', minLength: 2, example: 'João da Silva' },
          email: { type: 'string', format: 'email', example: 'joao@email.com' },
          password: { type: 'string', minLength: 6, example: 'senha123' },
          plan: { type: 'string', enum: ['free', 'basic', 'premium', 'enterprise'], example: 'free' },
          active: { type: 'boolean', example: true },
          googleId: { type: 'string', nullable: true, example: 'google-oauth-id' }
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
          email: { type: 'string', format: 'email', example: 'joao@email.com' },
          password: { type: 'string', example: 'senha123' }
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