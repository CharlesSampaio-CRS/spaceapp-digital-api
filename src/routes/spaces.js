import {
    createSpace,
    getAllSpaces,
    getSpaceById,
    updateSpace,
    deactivateSpace,
    flushDatabase
  } from '../controllers/spacesController.js';
  
  export default async function spaceRoutes(fastify) {
    fastify.post('/spaces', { preHandler: [fastify.authenticate] }, createSpace);
    fastify.get('/spaces', { preHandler: [fastify.authenticate] }, getAllSpaces);
    fastify.get('/spaces/:uuid', { preHandler: [fastify.authenticate] }, getSpaceById);
    fastify.put('/spaces/:uuid', { preHandler: [fastify.authenticate] }, updateSpace);
    fastify.delete('/spaces/:uuid', { preHandler: [fastify.authenticate] }, deactivateSpace);
    fastify.delete('/database/flush', { preHandler: [fastify.authenticate] }, flushDatabase);
  }
  