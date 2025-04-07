import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db/mongodb.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');

export const register = async (request, reply) => {
  const { name, email, password, plan = 'free', active = true } = request.body;

  try {
    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      return reply.status(409).send({ error: 'User or email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      uuid: uuidv4(),
      name,
      email,
      password: hashedPassword,
      plan,
      active,
      createdAt: new Date(),
      updatedAt: null,
      type: 'user',
      googleId: null
    };

    await userCollection.insertOne(newUser);

    return reply.code(201).send({
      message: 'User registered successfully.',
      uuid: newUser.uuid
    });
  } catch (err) {
    return reply.status(500).send({
      error: 'Failed to register user.',
      details: err.message
    });
  }
};

export const login = async (request, reply) => {
  const { email, password } = request.body;

  try {
    const user = await userCollection.findOne({ email });

    if (!user) {
      return reply.status(401).send({ error: 'User not found.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Invalid password.' });
    }

    const token = await reply.jwtSign({
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      plan: user.plan,
      type: user.type,
      googleId: user.googleId
    });

    return reply.send({ token });
  } catch (err) {
    return reply.status(500).send({
      error: 'Login failed.',
      details: err.message
    });
  }
};