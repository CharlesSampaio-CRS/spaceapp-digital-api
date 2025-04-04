import { client } from '../database/mongodb.js';
import { v4 as uuidv4 } from 'uuid';

const db = client.db('your_database');
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
    const spaces = await spaceCollection.find().toArray();
    return reply.send(spaces);
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching spaces', details: err.message });
  }
};

export const getSpaceById = async (request, reply) => {
  const { uuid } = request.params;
  try {
    const space = await spaceCollection.findOne({ uuid });
    if (!space) return reply.status(404).send({ error: 'Space not found!' });
    return reply.send(space);
  } catch (err) {
    return reply.status(500).send({ error: 'Error fetching space', details: err.message });
  }
};

export const updateSpace = async (request, reply) => {
  const { uuid } = request.params;
  const { userUuid, applicationsUuid, active } = request.body;

  try {
    const space = await spaceCollection.findOne({ uuid });
    if (!space) return reply.status(404).send({ error: 'Space not found!' });

    const updateData = { updatedAt: new Date().toISOString() };

    if (userUuid) updateData.userUuid = userUuid;
    if (active !== undefined) updateData.active = active;

    if (Array.isArray(applicationsUuid)) {
      const validApplications = await appCollection
        .find({ uuid: { $in: applicationsUuid } })
        .project({ uuid: 1 })
        .toArray();

      const validUuids = validApplications.map((app) => app.uuid);
      if (validUuids.length !== applicationsUuid.length) {
        return reply
          .status(404)
          .send({ error: 'One or more applications not found!' });
      }

      updateData.applications = applicationsUuid;
    }

    await spaceCollection.updateOne({ uuid }, { $set: updateData });
    const updatedSpace = await spaceCollection.findOne({ uuid });

    return reply.send({ message: 'Space updated!', space: updatedSpace });
  } catch (err) {
    return reply.status(500).send({ error: 'Error updating space', details: err.message });
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

export const flushDatabase = async (_request, reply) => {
  try {
    await Promise.all([
      spaceCollection.deleteMany({}),
      userCollection.deleteMany({}), // Optional: remove if not desired
      appCollection.deleteMany({}), // Optional: remove if not desired
    ]);
    return reply.send({ message: 'All data has been deleted successfully!' });
  } catch (err) {
    return reply.status(500).send({ error: 'Error deleting data', details: err.message });
  }
};
