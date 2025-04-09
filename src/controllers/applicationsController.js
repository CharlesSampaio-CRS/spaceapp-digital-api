import { client } from '../db/mongodb.js';
import { v4 as uuidv4 } from 'uuid';

const collection = client.db('cluster-db-atlas').collection('applications');

import { v4 as uuidv4 } from 'uuid';

export const createApplications = async (request, reply) => {
  const applications = request.body;

  if (!Array.isArray(applications) || applications.length === 0) {
    return reply.status(400).send({ error: 'An array of applications is required!' });
  }

  const newApplications = [];
  const duplicates = [];

  for (const app of applications) {
    const { application, url, active, icon, type, base, popularity } = app;

    if (!application || !url || active === undefined || !icon || !type) {
      duplicates.push({ application, error: 'Missing required fields' });
      continue;
    }

    const existing = await collection.findOne({ application });
    if (existing) {
      duplicates.push({ application, error: 'Application already exists' });
      continue;
    }

    newApplications.push({
      uuid: uuidv4(),
      application,
      url,
      active,
      icon,
      type,
      base,
      popularity,
      createdAt: new Date().toISOString(),
      updatedAt: null
    });
  }

  try {
    if (newApplications.length > 0) {
      await collection.insertMany(newApplications);
    }

    return reply.status(201).send({
      created: newApplications,
      skipped: duplicates
    });
  } catch (err) {
    return reply.status(500).send({ error: 'Error inserting applications', details: err.message });
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
