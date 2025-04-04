import { client } from '../database/mongodb.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const db = client.db('your_database');
const userCollection = db.collection('users');

export const createUser = async (request, reply) => {
  const { username, email, password, plan, active } = request.body;

  if (!username || !email || !password || !plan || active === undefined) {
    return reply.status(400).send({ error: 'All fields are required!' });
  }

  try {
    const existingUser = await userCollection.findOne({ email });
    if (existingUser) {
      return reply.status(409).send({ error: 'Email already registered!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const uuid = uuidv4();
    const createdAt = new Date().toISOString();

    const newUser = {
      uuid,
      username,
      email,
      password: hashedPassword,
      plan,
      active,
      createdAt,
      updatedAt: null,
    };

    await userCollection.insertOne(newUser);
    return reply.status(201).send(newUser);
  } catch (err) {
    return reply.status(500).send({ error: 'Error creating user', details: err.message });
  }
};

export const getAllUsers = async (_request, reply) => {
  try {
    const users = await userCollection.find().toArray();
    return reply.send(users);
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching users', details: err.message });
  }
};

export const getUserById = async (request, reply) => {
  const { id } = request.params;
  try {
    const user = await userCollection.findOne({ uuid: id });
    if (!user) {
      return reply.status(404).send({ error: 'User not found!' });
    }
    return reply.send(user);
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching user', details: err.message });
  }
};

export const updateUser = async (request, reply) => {
  const { id } = request.params;
  const { username, email, plan, active } = request.body;

  try {
    const user = await userCollection.findOne({ uuid: id });
    if (!user) {
      return reply.status(404).send({ error: 'User not found!' });
    }

    const updatedAt = new Date().toISOString();

    const updateFields = {
      ...(username && { username }),
      ...(email && { email }),
      ...(plan && { plan }),
      ...(active !== undefined && { active }),
      updatedAt,
    };

    await userCollection.updateOne({ uuid: id }, { $set: updateFields });
    const updatedUser = await userCollection.findOne({ uuid: id });

    return reply.send(updatedUser);
  } catch (err) {
    return reply.status(500).send({ error: 'Error updating user', details: err.message });
  }
};

export const deleteUser = async (request, reply) => {
  const { id } = request.params;
  try {
    const result = await userCollection.deleteOne({ uuid: id });

    if (result.deletedCount === 0) {
      return reply.status(404).send({ error: 'User not found!' });
    }

    return reply.send({ message: 'User successfully deleted!' });
  } catch (err) {
    return reply.status(500).send({ error: 'Error deleting user', details: err.message });
  }
};
