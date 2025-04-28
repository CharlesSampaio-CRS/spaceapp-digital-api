import { client } from '../db/mongodb.js';
import { v4 as uuidv4 } from 'uuid';

const db = client.db('cluster-db-atlas');
const spaceCollection = db.collection('spaces');
const userCollection = db.collection('users');
const appCollection = db.collection('applications');

export const createSpace = async (request, reply) => {
  const { userUuid, applicationsUuid } = request.body;

  if (!userUuid || !Array.isArray(applicationsUuid)) {
    return reply.status(400).send({
      error: 'All fields are required, and applicationsUuid must be an array!',
    });
  }

  try {
    const [userExists, existingSpaceByUser, validApplications] = await Promise.all([
      userCollection.findOne({ uuid: userUuid }),
      spaceCollection.findOne({ userUuid }),
      appCollection
        .find({ uuid: { $in: applicationsUuid } })
        .project({ uuid: 1 })
        .toArray(),
    ]);

    if (!userExists) {
      return reply.status(404).send({ error: 'User not found!' });
    }

    if (existingSpaceByUser) {
      return reply.status(409).send({ error: 'User already has a space!' });
    }

    const validUuids = validApplications.map((app) => app.uuid);
    if (validUuids.length !== applicationsUuid.length) {
      return reply
        .status(404)
        .send({ error: 'One or more applications not found!' });
    }

    const uuid = uuidv4();
    const createdAt = new Date().toISOString();

    const newSpace = {
      uuid,
      userUuid,
      applications: applicationsUuid,
      active: true,
      createdAt,
      updatedAt: null,
    };

    await spaceCollection.insertOne(newSpace);
    return reply.status(201).send(newSpace);
  } catch (err) {
    return reply
      .status(500)
      .send({ error: 'Error creating space', details: err.message });
  }
};

export const getAllSpaces = async (_request, reply) => {
  try {
    const spaces = await spaceCollection.find().toArray(); // <--- Aqui, faltava o .toArray()

    return reply.send(spaces);
  } catch (err) {
    return reply.status(500).send({
      error: 'Error fetching spaces',
      details: err.message
    });
  }
};

export const getSpaceByUserUuid = async (request, reply) => {
  const { userUuid } = request.params;

  try {
    const space = await spaceCollection.findOne({ userUuid });

    if (!space) {
      return reply.status(404).send({ error: 'Space not found for this user.' });
    }

    return reply.send(space);
  } catch (err) {
    return reply.status(500).send({
      error: 'Error fetching space by userUuid',
      details: err.message
    });
  }
};


export const updateSpaceByUserUuid = async (request, reply) => {
  const { userUuid, applications } = request.body;

  try {
    const space = await spaceCollection.findOne({ userUuid });

    if (!space) {
      return reply.status(404).send({ error: 'Space not found for this userUuid.' });
    }

    // Atualiza apenas o active dos aplicativos que chegaram
    const updatedApplications = space.applications.map(existingApp => {
      const incomingApp = applications.find(app => app.uuid === existingApp.uuid);
      if (incomingApp) {
        return {
          ...existingApp,
          active: incomingApp.active
        };
      }
      return existingApp;
    });

    spaceCollection.updateOne(
      { userUuid },
      {
        $set: {
          applications: updatedApplications,
          updatedAt: new Date()
        }
      }
    );

    return reply.send({ message: 'Space updated successfully.' });
  } catch (err) {
    return reply.status(500).send({
      error: 'Failed to update space.',
      details: err.message
    });
  }
};


export const deactivateSpace = async (request, reply) => {
  const { uuid } = request.params;

  try {
    const space = await spaceCollection.findOne({ uuid });
    if (!space) return reply.status(404).send({ error: 'Space not found!' });

    const updatedAt = new Date().toISOString();
    await spaceCollection.updateOne(
      { uuid },
      { $set: { active: false, updatedAt } }
    );

    const updatedSpace = await spaceCollection.findOne({ uuid });
    return reply.send({ message: 'Space deactivated!', space: updatedSpace });
  } catch (err) {
    return reply.status(500).send({ error: 'Error deactivating space', details: err.message });
  }
};

