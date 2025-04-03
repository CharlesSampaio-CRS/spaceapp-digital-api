import { client } from '../database/redisClient.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

export default async function routes(fastify) {
  fastify.post('/users', async (request, reply) => {
    const { username, email, password, plan, active } = request.body;

    if (!username || !email || !password || !plan || active === undefined) {
      return reply.status(400).send({ error: 'All fields are required!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const uuid = uuidv4();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const newUser = {
      uuid,
      username,
      email,
      password: hashedPassword,
      plan,
      active,
      createdAt,
      updatedAt
    };

    try {
      const existingUser = await client.get(`user:${email}`);
      if (existingUser) {
        return reply.status(409).send({ error: 'Email already registered!' });
      }

      await client.set(`user:${uuid}`, JSON.stringify(newUser));
      await client.set(`user:${email}`, uuid);

      return reply.status(201).send(newUser);
    } catch (err) {
      return reply.status(500).send({ error: 'Error creating user', details: err.message });
    }
  });

  fastify.get('/users', async (_request, reply) => {
    try {
      const keys = await client.keys('user:*');
      if (!keys.length) {
        return reply.send([]);
      }

      const users = await Promise.all(
        keys.map(async (key) => {
          const user = await client.get(key);
          if (!user) return null;
          try {
            return JSON.parse(user);
          } catch (error) {
            console.error(`Invalid JSON for key ${key}:`, user);
            return null;
          }
        })
      );

      return reply.send(users.filter(Boolean));
    } catch (err) {
      return reply.status(500).send({ error: 'Error fetching users', details: err.message });
    }
  });


  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const user = await client.get(`user:${id}`);
      if (!user) {
        return reply.status(404).send({ error: 'User not found!' });
      }
      return reply.send(JSON.parse(user));
    } catch (err) {
      return reply.status(500).send({ error: 'Error fetching user', details: err.message });
    }
  });

  fastify.put('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const { username, email, plan, active } = request.body;

    try {
      const user = await client.get(`user:${id}`);
      if (!user) {
        return reply.status(404).send({ error: 'User not found!' });
      }
      const updatedAt = new Date().toISOString();
      const updatedUser = { ...JSON.parse(user), username, email, plan, active, updatedAt };

      await client.set(`user:${id}`, JSON.stringify(updatedUser));
      return reply.send(updatedUser);
    } catch (err) {
      return reply.status(500).send({ error: 'Error updating user', details: err.message });
    }
  });

  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const user = await client.get(`user:${id}`);
      if (!user) {
        return reply.status(404).send({ error: 'User not found!' });
      }

      const parsedUser = JSON.parse(user);
      await client.del(`user:${id}`);
      await client.del(`user:${parsedUser.email}`);

      return reply.send({ message: 'User successfully deleted!' });
    } catch (err) {
      return reply.status(500).send({ error: 'Error deleting user', details: err.message });
    }
  });
}