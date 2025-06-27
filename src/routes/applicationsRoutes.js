import { 
  createApplications, 
  getAllApplications, 
  getApplicationByApplication, 
  updateApplication, 
  deleteApplication 
} from '../controllers/applicationsController.js';
import { cacheMiddleware } from '../middlewares/cache.js';

export default async function applicationsRoutes(fastify) {
  // Rotas de leitura com cache
  fastify.get('/applications', { 
    preHandler: [fastify.authenticate, cacheMiddleware()] 
  }, getAllApplications);
  
  fastify.get('/applications/:application', { 
    preHandler: [fastify.authenticate, cacheMiddleware()] 
  }, getApplicationByApplication);
  
  // Rotas de escrita sem cache
  fastify.post('/applications', { 
    preHandler: [fastify.authenticate] 
  }, createApplications);
  
  fastify.put('/applications/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, updateApplication);
  
  fastify.delete('/applications/:uuid', { 
    preHandler: [fastify.authenticate] 
  }, deleteApplication);
}