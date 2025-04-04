import { client } from '../database/mongodb.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');

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
