import {
    createSpace,
    getAllSpaces,
    getSpaceByUserUuid,
    updateSpace,
    deactivateSpace
  } from '../controllers/spacesController.js';
  
  export default async function spaceRoutes(fastify) {
    fastify.post('/spaces', { preHandler: [fastify.authenticate] }, createSpace);
    fastify.get('/spaces', { preHandler: [fastify.authenticate] }, getAllSpaces);
    fastify.get('/spaces/:userUuid', { preHandler: [fastify.authenticate] }, getSpaceByUserUuid);
    fastify.put('/spaces/:uuid', { preHandler: [fastify.authenticate] }, updateSpace);
    fastify.delete('/spaces/:uuid', { preHandler: [fastify.authenticate] }, deactivateSpace);
  }
  