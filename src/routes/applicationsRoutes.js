import { 
  createApplications, 
  getAllApplications, 
  getApplicationByApplication, 
  updateApplication, 
  deleteApplication 
} from '../controllers/applicationsController.js';

export default async function applicationsRoutes(fastify) {
  fastify.post('/applications', { preHandler: [fastify.authenticate] }, createApplications);
  fastify.get('/applications', { preHandler: [fastify.authenticate] }, getAllApplications);
  fastify.get('/applications/:application', { preHandler: [fastify.authenticate] }, getApplicationByApplication);
  fastify.put('/applications/:uuid', { preHandler: [fastify.authenticate] }, updateApplication);
  fastify.delete('/applications/:uuid', { preHandler: [fastify.authenticate] }, deleteApplication);
}