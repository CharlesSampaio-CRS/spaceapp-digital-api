import {
    createSpace,
    getAllSpaces,
    getSpaceByUserUuid,
    updateSpaceByUserUuid,
    deactivateSpace
  } from '../controllers/spacesController.js';
  
  export default async function spaceRoutes(fastify) {
    fastify.post('/spaces', { preHandler: [fastify.authenticate] }, createSpace);
    fastify.get('/spaces', { preHandler: [fastify.authenticate] }, getAllSpaces);
    fastify.get('/spaces/:userUuid', { preHandler: [fastify.authenticate] }, getSpaceByUserUuid);
    fastify.put('/spaces', { preHandler: [fastify.authenticate] }, updateSpaceByUserUuid);
    fastify.delete('/spaces/:uuid', { preHandler: [fastify.authenticate] }, deactivateSpace);
  }
  