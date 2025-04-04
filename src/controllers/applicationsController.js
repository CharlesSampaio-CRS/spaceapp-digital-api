import { client } from '../database/mongodb.js'; // Assume que você exporta o MongoClient e a conexão já está feita
import { v4 as uuidv4 } from 'uuid';

const collection = client.db('your_database').collection('applications');

export const createApplication = async (request, reply) => {
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
    const existing = await collection.findOne({ application });
    if (existing) {
      return reply.status(409).send({ error: 'Application already registered!' });
    }

    await collection.insertOne(newApplication);
    return reply.status(201).send(newApplication);
  } catch (err) {
    return reply.status(500).send({ error: 'Error creating application', details: err.message });
  }
};

export const getAllApplications = async (_request, reply) => {
  try {
    const applications = await collection.find().toArray();
    return reply.send(applications);
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching applications', details: err.message });
  }
};

export const getApplicationById = async (request, reply) => {
  const { uuid } = request.params;

  try {
    const app = await collection.findOne({ uuid });
    if (!app) return reply.status(404).send({ error: 'Application not found' });
    return reply.send(app);
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching application', details: err.message });
  }
};

export const updateApplication = async (request, reply) => {
  const { uuid } = request.params;
  const data = request.body;

  try {
    const updatedAt = new Date().toISOString();
    const updateResult = await collection.updateOne(
      { uuid },
      { $set: { ...data, updatedAt } }
    );

    if (updateResult.matchedCount === 0) {
      return reply.status(404).send({ error: 'Application not found' });
    }

    const updatedApp = await collection.findOne({ uuid });
    return reply.send({ message: 'Application updated!', app: updatedApp });
  } catch (err) {
    return reply.status(500).send({ error: 'Error updating application', details: err.message });
  }
};

export const deleteApplication = async (request, reply) => {
  const { uuid } = request.params;

  try {
    const deleteResult = await collection.deleteOne({ uuid });

    if (deleteResult.deletedCount === 0) {
      return reply.status(404).send({ error: 'Application not found' });
    }

    return reply.send({ message: 'Application removed!', uuid });
  } catch (err) {
    return reply.status(500).send({ error: 'Error deleting application', details: err.message });
  }
};
