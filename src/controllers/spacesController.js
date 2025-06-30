import { client } from '../db/mongodb.js';
import { v4 as uuidv4 } from 'uuid';

const db = client.db('cluster-db-atlas');
const spaceCollection = db.collection('spaces');
const userCollection = db.collection('users');
const appCollection = db.collection('applications');

// Projeção padrão para otimizar consultas
const DEFAULT_PROJECTION = {
  _id: 0,
  __v: 0
};

// Validação de UUID básica
const isValidUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const createSpace = async (request, reply) => {
  const { userUuid, applicationsUuid } = request.body;

  // Validação de entrada
  if (!userUuid || !isValidUuid(userUuid)) {
    return reply.status(400).send({
      error: 'UUID do usuário inválido ou não fornecido'
    });
  }

  if (!Array.isArray(applicationsUuid) || applicationsUuid.length === 0) {
    return reply.status(400).send({
      error: 'Lista de aplicações deve ser um array não vazio'
    });
  }

  // Validar UUIDs das aplicações
  const invalidUuids = applicationsUuid.filter(uuid => !isValidUuid(uuid));
  if (invalidUuids.length > 0) {
    return reply.status(400).send({
      error: 'UUIDs de aplicações inválidos',
      invalidUuids
    });
  }

  try {
    // Executar verificações em paralelo para melhor performance
    const [userExists, existingSpaceByUser, validApplications] = await Promise.all([
      userCollection.findOne({ uuid: userUuid }, { projection: { uuid: 1 } }),
      spaceCollection.findOne({ userUuid }, { projection: { uuid: 1 } }),
      appCollection
        .find({ uuid: { $in: applicationsUuid } })
        .project({ uuid: 1, application: 1, icon: 1, url: 1, active: 1 })
        .toArray(),
    ]);

    if (!userExists) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    if (existingSpaceByUser) {
      return reply.status(409).send({ error: 'Usuário já possui um espaço' });
    }

    const validUuids = validApplications.map((app) => app.uuid);
    if (validUuids.length !== applicationsUuid.length) {
      const missingUuids = applicationsUuid.filter(uuid => !validUuids.includes(uuid));
      return reply.status(404).send({ 
        error: 'Uma ou mais aplicações não encontradas',
        missingUuids
      });
    }

    const uuid = uuidv4();
    const createdAt = new Date().toISOString();

    const newSpace = {
      uuid,
      userUuid,
      applications: validApplications.map(app => ({
        uuid: app.uuid,
        application: app.application,
        icon: app.icon,
        url: app.url,
        active: app.active
      })),
      active: true,
      createdAt,
      updatedAt: null,
    };

    await spaceCollection.insertOne(newSpace);
    
    // Retornar diretamente o objeto criado
    return reply.status(201).send(newSpace);
  } catch (err) {
    console.error('Error creating space:', err);
    return reply.status(500).send({ 
      error: 'Erro ao criar espaço', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const getAllSpaces = async (_request, reply) => {
  try {
    const spaces = await spaceCollection
      .find({}, { projection: DEFAULT_PROJECTION })
      .toArray();

    return reply.send({
      success: true,
      data: spaces,
      count: spaces.length
    });
  } catch (err) {
    console.error('Error fetching spaces:', err);
    return reply.status(500).send({
      error: 'Erro ao buscar espaços',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const getSpaceByUserUuid = async (request, reply) => {
  const { userUuid } = request.params;

  // Validação de entrada
  if (!userUuid || !isValidUuid(userUuid)) {
    return reply.status(400).send({
      error: 'UUID do usuário inválido'
    });
  }

  try {
    const space = await spaceCollection.findOne(
      { userUuid }, 
      { projection: DEFAULT_PROJECTION }
    );

    if (!space) {
      return reply.status(404).send({ error: 'Espaço não encontrado para este usuário' });
    }

    return reply.send({
      success: true,
      data: space
    });
  } catch (err) {
    console.error('Error fetching space by userUuid:', err);
    return reply.status(500).send({
      error: 'Erro ao buscar espaço por usuário',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const updateSpaceByUserUuid = async (request, reply) => {
  const { userUuid } = request.params;
  const { applications } = request.body;

  // Validação de entrada
  if (!userUuid || !isValidUuid(userUuid)) {
    return reply.status(400).send({
      error: 'UUID do usuário inválido'
    });
  }

  if (!Array.isArray(applications) || applications.length === 0) {
    return reply.status(400).send({
      error: 'Lista de aplicações deve ser um array não vazio'
    });
  }

  // Validar estrutura das aplicações
  const invalidApps = applications.filter(app => !app.uuid || !isValidUuid(app.uuid));
  if (invalidApps.length > 0) {
    return reply.status(400).send({
      error: 'Aplicações com UUIDs inválidos',
      invalidApps
    });
  }

  try {
    const space = await spaceCollection.findOne({ userUuid });
    if (!space) {
      return reply.status(404).send({ error: 'Espaço não encontrado para este usuário' });
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

    const updatedAt = new Date().toISOString();
    
    const result = await spaceCollection.updateOne(
      { userUuid },
      {
        $set: {
          applications: updatedApplications,
          updatedAt
        }
      }
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ error: 'Espaço não encontrado' });
    }

    // Buscar espaço atualizado
    const updatedSpace = await spaceCollection.findOne(
      { userUuid }, 
      { projection: DEFAULT_PROJECTION }
    );

    return reply.send({
      success: true,
      data: updatedSpace,
      message: 'Espaço atualizado com sucesso'
    });
  } catch (err) {
    console.error('Error updating space:', err);
    return reply.status(500).send({
      error: 'Erro ao atualizar espaço',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const deactivateSpace = async (request, reply) => {
  const { uuid } = request.params;

  // Validação de entrada
  if (!uuid || !isValidUuid(uuid)) {
    return reply.status(400).send({
      error: 'UUID do espaço inválido'
    });
  }

  try {
    const space = await spaceCollection.findOne({ uuid });
    if (!space) {
      return reply.status(404).send({ error: 'Espaço não encontrado' });
    }

    if (!space.active) {
      return reply.status(400).send({ 
        error: 'Espaço já está desativado',
        data: space
      });
    }

    const updatedAt = new Date().toISOString();
    const result = await spaceCollection.updateOne(
      { uuid },
      { $set: { active: false, updatedAt } }
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ error: 'Espaço não encontrado' });
    }

    const updatedSpace = await spaceCollection.findOne(
      { uuid }, 
      { projection: DEFAULT_PROJECTION }
    );

    return reply.send({
      success: true,
      data: updatedSpace,
      message: 'Espaço desativado com sucesso'
    });
  } catch (err) {
    console.error('Error deactivating space:', err);
    return reply.status(500).send({ 
      error: 'Erro ao desativar espaço', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};



