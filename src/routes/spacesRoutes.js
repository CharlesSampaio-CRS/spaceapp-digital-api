import {
    createSpace,
    getAllSpaces,
    getSpaceByUserUuid,
    updateSpaceByUserUuid,
    deactivateSpace
  } from '../controllers/spacesController.js';
import { cacheMiddleware } from '../middlewares/cache.js';
  
export default async function spaceRoutes(fastify) {
  // Rotas de leitura com cache
  fastify.get('/spaces', { 
    preHandler: [fastify.authenticate, cacheMiddleware()] 
  }, getAllSpaces);
  
  fastify.get('/spaces/:userUuid', { 
    preHandler: [fastify.authenticate, cacheMiddleware()] 
  }, getSpaceByUserUuid);
  
  // Rotas de escrita sem cache
  fastify.post('/spaces', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Spaces'],
      summary: 'Criar espaço',
      body: {
        type: 'object',
        required: ['userUuid', 'applicationsUuid'],
        properties: {
          userUuid: { type: 'string', format: 'uuid' },
          applicationsUuid: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1
          }
        }
      },
      response: {
        201: {
          description: 'Espaço criado',
          type: 'object'
        }
      }
    }
  }, createSpace);
  
  fastify.put('/spaces', { 
    preHandler: [fastify.authenticate] 
  }, updateSpaceByUserUuid);
  
  fastify.delete('/spaces/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, deactivateSpace);
}
  