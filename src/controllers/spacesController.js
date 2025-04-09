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
    const spaces = await spaceCollection.aggregate([
      {
        $lookup: {
          from: 'applications',
          localField: 'applicationsUuid',
          foreignField: 'applicationsUuid',
          as: 'applications'
        }
      }
    ]).toArray();

    return reply.send(spaces);
  } catch (err) {
    return reply.status(500).send({
      error: 'Error fetching spaces with applications',
      details: err.message
    });
  }
};

export const getSpaceByUserUuid = async (request, reply) => {
  const { userUuid } = request.params;

  try {
    const result = await spaceCollection.aggregate([
      {
        $match: { userUuid }
      },
      {
        $lookup: {
          from: 'applications',
          localField: 'applications',
          foreignField: 'uuid',
          as: 'applications'
        }
      },
      {
        $project: {
          _id: 1, 
          uuid: 1,           // UUID do espaço
          userUuid: 1,       // UUID do usuário
          applications: 1    // Lista de aplicações completas
        }
      }
    ]).toArray();

    if (result.length === 0 || !result[0].applications.length) {
      return reply.status(404).send({ error: 'No applications found for this user.' });
    }

    return reply.send(result[0]);
  } catch (err) {
    return reply.status(500).send({
      error: 'Error fetching applications by userUuid',
      details: err.message
    });
  }
};

export const updateSpaceByUserUuid = async (request, reply) => {
  const { userUuid } = request.params;
  const { applicationsUuid, active } = request.body;

  try {
    const space = await spaceCollection.findOne({ userUuid });
    if (!space) return reply.status(404).send({ error: 'Space not found!' });

    const updateData = { updatedAt: new Date().toISOString() };

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

    await spaceCollection.updateOne({ userUuid }, { $set: updateData });
    const updatedSpace = await spaceCollection.findOne({ userUuid });

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

