import { 
  createApplication, 
  getAllApplications, 
  getApplicationById, 
  updateApplication, 
  deleteApplication 
} from '../controllers/applicationsController.js';

export default async function applicationsRoutes(fastify) {
  fastify.post('/applications', createApplication);
  fastify.get('/applications', getAllApplications);
  fastify.get('/applications/:uuid', getApplicationById);
  fastify.put('/applications/:uuid', updateApplication);
  fastify.delete('/applications/:uuid', deleteApplication);
}
