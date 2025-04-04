import {
    createSpace,
    getAllSpaces,
    getSpaceById,
    updateSpace,
    deactivateSpace,
    flushDatabase
} from '../controllers/spacesController.js';

export default async function spaceRoutes(fastify) {
    fastify.post('/spaces', createSpace);
    fastify.get('/spaces', getAllSpaces);
    fastify.get('/spaces/:uuid', getSpaceById);
    fastify.put('/spaces/:uuid', updateSpace);
    fastify.delete('/spaces/:uuid', deactivateSpace);
    fastify.delete('/database/flush', flushDatabase);
}
