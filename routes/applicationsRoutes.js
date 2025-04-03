import { client } from '../database/redisClient.js';
import { v4 as uuidv4 } from 'uuid';

export default async function routes(fastify) {

  fastify.post('/applications', async (request, reply) => {
    const { application, url, active, icon, type } = request.body;

    if (!application || !url || active === undefined || !icon || !type) {
      return reply.status(400).send({ error: 'All fields are required!' });
    }

    const uuid = uuidv4();
    const createdAt = new Date().toISOString();

    const newApplication = {
      uuid,
      application,
      url,
      active,
      icon,
      type,
      createdAt,
      updatedAt: null
    };

    try {
      const existingApplication = await client.get(`application:${application}`);
      if (existingApplication) {
        return reply.status(409).send({ error: 'Application already registered!' });
      }

      await client.set(`application:${uuid}`, JSON.stringify(newApplication));
      await client.set(`application:${application}`, uuid);

      return reply.status(201).send(newApplication);
    } catch (err) {
      return reply.status(500).send({ error: 'Error creating application', details: err.message });
    }
  });

fastify.get('/applications', async (_request, reply) => {
  try {
    const keys = await client.keys('application:*');

    if (!keys.length) {
      return reply.send([]); 
    }

    const applications = await Promise.all(
      keys.map(async (key) => {
        const app = await client.get(key);
        try {
          return app ? JSON.parse(app) : null;
        } catch (parseError) {
          console.error(`Error parsing application data for key ${key}:`, parseError);
          return null;
        }
      })
    );

    return reply.send(applications.filter(Boolean)); 
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching applications', details: err.message });
  }
});

  fastify.get('/applications/:uuid', async (request, reply) => {
    const { uuid } = request.params;

    try {
      const app = await client.get(`application:${uuid}`);
      if (!app) return reply.status(404).send({ error: 'Application not found' });
      return reply.send(JSON.parse(app));
    } catch (err) {
      return reply.status(500).send({ error: 'Error fetching application', details: err.message });
    }
  });

  fastify.put('/applications/:uuid', async (request, reply) => {
    const { uuid } = request.params;
    const data = request.body;

    try {
      const app = await client.get(`application:${uuid}`);
      if (!app) return reply.status(404).send({ error: 'Application not found' });
      
      const updatedAt = new Date().toISOString();
      const updatedApp = { ...JSON.parse(app), ...data, updatedAt };
      
      await client.set(`application:${uuid}`, JSON.stringify(updatedApp));
      return reply.send({ message: 'Application updated!', app: updatedApp });
    } catch (err) {
      return reply.status(500).send({ error: 'Error updating application', details: err.message });
    }
  });

  fastify.delete('/applications/:uuid', async (request, reply) => {
    const { uuid } = request.params;

    try {
      const app = await client.get(`application:${uuid}`);
      if (!app) return reply.status(404).send({ error: 'Application not found' });
      
      await client.del(`application:${uuid}`);
      return reply.send({ message: 'Application removed!', uuid });
    } catch (err) {
      return reply.status(500).send({ error: 'Error deleting application', details: err.message });
    }
  });
}
