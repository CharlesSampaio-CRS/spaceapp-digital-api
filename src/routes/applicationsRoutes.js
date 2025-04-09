import { 
  createApplications, 
  getAllApplications, 
  getApplicationById, 
  updateApplication, 
  deleteApplication 
} from '../controllers/applicationsController.js';

export default async function applicationsRoutes(fastify) {
  fastify.post('/applications', { preHandler: [fastify.authenticate] }, createApplications);
  fastify.get('/applications', { preHandler: [fastify.authenticate] }, getAllApplications);
  fastify.get('/applications/:uuid', { preHandler: [fastify.authenticate] }, getApplicationById);
  fastify.put('/applications/:uuid', { preHandler: [fastify.authenticate] }, updateApplication);
  fastify.delete('/applications/:uuid', { preHandler: [fastify.authenticate] }, deleteApplication);
}