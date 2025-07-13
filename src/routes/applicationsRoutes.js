import { 
  createApplications, 
  getAllApplications, 
  getApplicationByApplication, 
  updateApplication, 
  deleteApplication 
} from '../controllers/applicationsController.js';

export default async function applicationsRoutes(fastify) {
  // Rotas de leitura com cache
  fastify.get('/applications', { 
    preHandler: [fastify.authenticate] 
  }, getAllApplications);
  
  fastify.get('/applications/:application', { 
    preHandler: [fastify.authenticate] 
  }, getApplicationByApplication);
  
  // Rotas de escrita sem cache
  fastify.post('/applications', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Applications'],
      summary: 'Criar aplicações em lote',
      body: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['application', 'url', 'active', 'icon', 'type'],
          properties: {
            application: { type: 'string', minLength: 2 },
            url: { type: 'string' },
            active: { type: 'boolean' },
            icon: { type: 'string' },
            type: { type: 'string' },
            base: { type: 'string', nullable: true },
            popularity: { type: 'integer' }
          }
        }
      },
      response: {
        201: {
          description: 'Aplicações criadas',
          type: 'object'
        }
      }
    }
  }, createApplications);
  
  fastify.put('/applications/:uuid', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Applications'],
      summary: 'Atualizar aplicação',
      body: {
        type: 'object',
        properties: {
          application: { type: 'string', minLength: 2 },
          url: { type: 'string' },
          active: { type: 'boolean' },
          icon: { type: 'string' },
          type: { type: 'string' },
          base: { type: 'string', nullable: true },
          popularity: { type: 'integer' }
        }
      },
      response: {
        200: {
          description: 'Aplicação atualizada',
          type: 'object'
        }
      }
    }
  }, updateApplication);
  
  fastify.delete('/applications/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, deleteApplication);
}