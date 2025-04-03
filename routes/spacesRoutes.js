import { client } from '../database/redisClient.js';
import { v4 as uuidv4 } from 'uuid';

export default async function routes(fastify) {

    fastify.post('/spaces', async (request, reply) => {
        const { userUuid, applicationsUuid } = request.body;
    
        if (!userUuid || !Array.isArray(applicationsUuid)) {
          return reply.status(400).send({ error: 'All fields are required, and applicationsUuid must be an array!' });
        }
    
        const uuid = uuidv4();
        const createdAt = new Date().toISOString();
    
        const newSpace = {
          uuid,
          userUuid,
          applicationsUuid,
          active: true,
          createdAt,
          updatedAt: createdAt
        };
    
        try {
          const userExists = await client.get(`user:${userUuid}`);
          if (!userExists) {
            return reply.status(404).send({ error: 'User not found!' });
          }

          const applicationsExist = await Promise.all(
            applicationsUuid.map(async (appUuid) => {
              const app = await client.get(`application:${appUuid}`);
              return app ? true : false;
            })
          );
    
          if (applicationsExist.includes(false)) {
            return reply.status(404).send({ error: 'One or more applications not found!' });
          }
    
          const existingSpaceByUser = await client.get(`space:user:${userUuid}`);
          if (existingSpaceByUser) {
            return reply.status(409).send({ error: 'User already has a space!' });
          }
    

          await client.set(`space:${uuid}`, JSON.stringify(newSpace));
          await client.set(`space:user:${userUuid}`, uuid); 
    
          return reply.status(201).send(newSpace);
        } catch (err) {
          return reply.status(500).send({ error: 'Error creating space', details: err.message });
        }
      });


      fastify.get('/spaces', async (_request, reply) => {
        try {
            const keys = await client.keys('space:*');
            const spaces = await Promise.all(
                keys.map(async (key) => {
                    const space = await client.get(key);
    
                    try {
                        return JSON.parse(space);
                    } catch (err) {
                        console.warn(`Skipping non-JSON key: ${key}`);
                        return null;
                    }
                })
            );
    
            return reply.send(spaces.filter(Boolean)); 
        } catch (err) {
            return reply.status(500).send({ error: 'Error fetching spaces', details: err.message });
        }
    });

    fastify.get('/spaces/:uuid', async (request, reply) => {
        const { uuid } = request.params;

        try {
            const space = await client.get(`space:${uuid}`);
            if (!space) {
                return reply.status(404).send({ error: 'Space not found!' });
            }
            return reply.send(JSON.parse(space));
        } catch (err) {
            return reply.status(500).send({ error: 'Error fetching space', details: err.message });
        }
    });

    fastify.put('/spaces/:uuid', async (request, reply) => {
        const { uuid } = request.params;
        const { userUuid, applicationsUuid, active } = request.body;

        try {
            const space = await client.get(`space:${uuid}`);
            if (!space) {
                return reply.status(404).send({ error: 'Space not found!' });
            }

            const updatedAt = new Date().toISOString();
            const updatedSpace = {
                ...JSON.parse(space),
                userUuid: userUuid || JSON.parse(space).userUuid,
                applicationsUuid: applicationsUuid || JSON.parse(space).applicationsUuid,
                active: active !== undefined ? active : JSON.parse(space).active,
                updatedAt
            };

            await client.set(`space:${uuid}`, JSON.stringify(updatedSpace));

            return reply.send({ message: 'Space updated!', space: updatedSpace });
        } catch (err) {
            return reply.status(500).send({ error: 'Error updating space', details: err.message });
        }
    });

    fastify.delete('/spaces/:uuid', async (request, reply) => {
        const { uuid } = request.params;

        try {
            const space = await client.get(`space:${uuid}`);
            if (!space) {
                return reply.status(404).send({ error: 'Space not found!' });
            }

            const updatedSpace = {
                ...JSON.parse(space),
                active: false,
                updatedAt: new Date().toISOString()
            };

            await client.set(`space:${uuid}`, JSON.stringify(updatedSpace));

            return reply.send({ message: 'Space deactivated!', space: updatedSpace });
        } catch (err) {
            return reply.status(500).send({ error: 'Error deactivating space', details: err.message });
        }
    });

}
