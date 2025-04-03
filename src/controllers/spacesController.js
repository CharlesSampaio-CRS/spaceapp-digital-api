import { client } from '../database/redisClient.js';
import { v4 as uuidv4 } from 'uuid';

export const createSpace = async (request, reply) => {
    const { userUuid, applicationsUuid } = request.body;

    if (!userUuid || !Array.isArray(applicationsUuid)) {
        return reply.status(400).send({ error: 'All fields are required, and applicationsUuid must be an array!' });
    }

    try {
        const [userExists, existingSpaceByUser, applications] = await Promise.all([
            client.get(`user:${userUuid}`),
            client.get(`space:user:${userUuid}`),
            Promise.all(applicationsUuid.map(async (appUuid) => {
                const appData = await client.get(`application:${appUuid}`);
                return appData ? appUuid : null;
            }))
        ]);

        if (!userExists) {
            return reply.status(404).send({ error: 'User not found!' });
        }

        if (existingSpaceByUser) {
            return reply.status(409).send({ error: 'User already has a space!' });
        }

        if (applications.includes(null)) {
            return reply.status(404).send({ error: 'One or more applications not found!' });
        }

        const uuid = uuidv4();
        const createdAt = new Date().toISOString();

        const newSpace = {
            uuid,
            userUuid,
            applications: applicationsUuid,
            active: true,
            createdAt,
            updatedAt: null
        };

        await Promise.all([
            client.set(`space:${uuid}`, JSON.stringify(newSpace)),
            client.set(`space:user:${userUuid}`, uuid)
        ]);

        return reply.status(201).send(newSpace);
    } catch (err) {
        return reply.status(500).send({ error: 'Error creating space', details: err.message });
    }
};

export const getAllSpaces = async (_request, reply) => {
    try {
        const keys = await client.keys('space:*');
        const spaces = await Promise.all(
            keys.map(async (key) => {
                const spaceData = await client.get(key);
                try {
                    return JSON.parse(spaceData);
                } catch (err) {
                    console.warn(`Skipping non-JSON key: ${key}`);
                    return null;
                }
            })
        );

        return reply.send(spaces.filter(Boolean));
    } catch (err) {
        return reply.status(500).send({ error: 'Error fetching spaces', details: err.message });
    }
};


export const getSpaceById = async (request, reply) => {
    const { uuid } = request.params;
    try {
        const spaceData = await client.get(`space:${uuid}`);
        if (!spaceData) {
            return reply.status(404).send({ error: 'Space not found!' });
        }

        const space = JSON.parse(spaceData);
        return reply.send(space);
    } catch (err) {
        return reply.status(500).send({ error: 'Error fetching space', details: err.message });
    }
};

export const updateSpace = async (request, reply) => {
    const { uuid } = request.params;
    const { userUuid, applicationsUuid, active } = request.body;

    try {
        const spaceData = await client.get(`space:${uuid}`);
        if (!spaceData) {
            return reply.status(404).send({ error: 'Space not found!' });
        }

        let space = JSON.parse(spaceData);

        if (userUuid) space.userUuid = userUuid;
        if (active !== undefined) space.active = active;
        if (Array.isArray(applicationsUuid)) {
            const applications = await Promise.all(
                applicationsUuid.map(async (appUuid) => {
                    const appData = await client.get(`application:${appUuid}`);
                    return appData ? appUuid : null;
                })
            );

            if (applications.includes(null)) {
                return reply.status(404).send({ error: 'One or more applications not found!' });
            }

            space.applications = applications;
        }

        space.updatedAt = new Date().toISOString();
        await client.set(`space:${uuid}`, JSON.stringify(space));

        return reply.send({ message: 'Space updated!', space });
    } catch (err) {
        return reply.status(500).send({ error: 'Error updating space', details: err.message });
    }
};


export const deactivateSpace = async (request, reply) => {
    const { uuid } = request.params;

    try {
        const space = await client.get(`space:${uuid}`);
        if (!space) {
            return reply.status(404).send({ error: 'Space not found!' });
        }

        const updatedSpace = {
            ...JSON.parse(space),
            active: false,
            updatedAt: new Date().toISOString()
        };

        await client.set(`space:${uuid}`, JSON.stringify(updatedSpace));
        return reply.send({ message: 'Space deactivated!', space: updatedSpace });
    } catch (err) {
        return reply.status(500).send({ error: 'Error deactivating space', details: err.message });
    }
};

export const flushRedis = async (_request, reply) => {
    try {
        await client.flushAll();
        return reply.send({ message: 'All Redis data has been deleted successfully!' });
    } catch (err) {
        return reply.status(500).send({ error: 'Error deleting Redis data', details: err.message });
    }
};
