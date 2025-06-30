import { client } from '../db/mongodb.js';
import { v4 as uuidv4 } from 'uuid';

const collection = client.db('cluster-db-atlas').collection('applications');

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

// Validação de URL básica
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Validação de aplicação
const validateApplication = (app) => {
  const errors = [];
  
  if (!app.application || app.application.trim().length < 2) {
    errors.push('Nome da aplicação deve ter pelo menos 2 caracteres');
  }
  
  if (!app.url || !isValidUrl(app.url)) {
    errors.push('URL inválida');
  }
  
  if (app.active === undefined || typeof app.active !== 'boolean') {
    errors.push('Campo active deve ser um boolean');
  }
  
  if (!app.icon || app.icon.trim().length === 0) {
    errors.push('Ícone é obrigatório');
  }
  
  if (!app.type || app.type.trim().length === 0) {
    errors.push('Tipo é obrigatório');
  }
  
  return errors;
};

export const createApplications = async (request, reply) => {
  const applications = request.body;

  if (!Array.isArray(applications) || applications.length === 0) {
    return reply.status(400).send({ 
      error: 'Lista de aplicações deve ser um array não vazio' 
    });
  }

  if (applications.length > 100) {
    return reply.status(400).send({ 
      error: 'Máximo de 100 aplicações por requisição' 
    });
  }

  const newApplications = [];
  const duplicates = [];
  const errors = [];

  // Processar aplicações em lotes para melhor performance
  for (const app of applications) {
    const validationErrors = validateApplication(app);
    
    if (validationErrors.length > 0) {
      errors.push({ 
        application: app.application || 'N/A', 
        errors: validationErrors 
      });
      continue;
    }

    const normalizedApp = {
      application: app.application.trim(),
      url: app.url.trim(),
      active: app.active,
      icon: app.icon.trim(),
      type: app.type.trim(),
      base: app.base || null,
      popularity: app.popularity || 0
    };

    // Verificar se aplicação já existe
    const existing = await collection.findOne({ 
      application: normalizedApp.application 
    }, { projection: { uuid: 1 } });
    
    if (existing) {
      duplicates.push({ 
        application: normalizedApp.application, 
        error: 'Aplicação já existe' 
      });
      continue;
    }

    newApplications.push({
      uuid: uuidv4(),
      ...normalizedApp,
      createdAt: new Date().toISOString(),
      updatedAt: null
    });
  }

  try {
    if (newApplications.length > 0) {
      await collection.insertMany(newApplications);
    }

    // Retornar diretamente o objeto esperado
    return reply.status(201).send({
      created: newApplications.length,
      skipped: duplicates.length,
      errors: errors.length,
      details: {
        created: newApplications.map(app => ({ 
          uuid: app.uuid, 
          application: app.application 
        })),
        skipped: duplicates,
        errors
      }
    });
  } catch (err) {
    console.error('Error inserting applications:', err);
    return reply.status(500).send({ 
      error: 'Erro ao inserir aplicações', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const getAllApplications = async (_request, reply) => {
  try {
    const applications = await collection
      .find({}, { projection: DEFAULT_PROJECTION })
      .toArray();
    
    return reply.send({
      success: true,
      data: applications,
      count: applications.length
    });
  } catch (err) {
    console.error('Error fetching applications:', err);
    return reply.status(500).send({ 
      error: 'Erro ao buscar aplicações', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const getApplicationByApplication = async (request, reply) => {
  const { application } = request.params;

  if (!application || application.trim().length === 0) {
    return reply.status(400).send({ 
      error: 'Nome da aplicação é obrigatório' 
    });
  }

  try {
    const app = await collection.findOne(
      { application: { $regex: `^${application.trim()}$`, $options: 'i' } },
      { projection: DEFAULT_PROJECTION }
    );
    
    if (!app) {
      return reply.status(404).send({ 
        error: 'Aplicação não encontrada' 
      });
    }
    
    return reply.send({
      success: true,
      data: app
    });
  } catch (err) {
    console.error('Error fetching application:', err);
    return reply.status(500).send({ 
      error: 'Erro ao buscar aplicação', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const updateApplication = async (request, reply) => {
  const { uuid } = request.params;
  const data = request.body;

  // Validação de entrada
  if (!uuid || !isValidUuid(uuid)) {
    return reply.status(400).send({ 
      error: 'UUID inválido' 
    });
  }

  if (!data || Object.keys(data).length === 0) {
    return reply.status(400).send({ 
      error: 'Dados para atualização são obrigatórios' 
    });
  }

  // Validar campos se fornecidos
  const validationErrors = [];
  
  if (data.application !== undefined && data.application.trim().length < 2) {
    validationErrors.push('Nome da aplicação deve ter pelo menos 2 caracteres');
  }
  
  if (data.url !== undefined && !isValidUrl(data.url)) {
    validationErrors.push('URL inválida');
  }
  
  if (data.active !== undefined && typeof data.active !== 'boolean') {
    validationErrors.push('Campo active deve ser um boolean');
  }
  
  if (data.icon !== undefined && data.icon.trim().length === 0) {
    validationErrors.push('Ícone não pode estar vazio');
  }
  
  if (data.type !== undefined && data.type.trim().length === 0) {
    validationErrors.push('Tipo não pode estar vazio');
  }

  if (validationErrors.length > 0) {
    return reply.status(400).send({ 
      error: 'Dados inválidos',
      details: validationErrors
    });
  }

  try {
    // Verificar se aplicação existe
    const existingApp = await collection.findOne({ uuid });
    if (!existingApp) {
      return reply.status(404).send({ 
        error: 'Aplicação não encontrada' 
      });
    }

    // Verificar se novo nome já existe (se estiver sendo alterado)
    if (data.application && data.application !== existingApp.application) {
      const nameExists = await collection.findOne({ 
        application: data.application.trim(),
        uuid: { $ne: uuid }
      });
      if (nameExists) {
        return reply.status(409).send({ 
          error: 'Nome da aplicação já está em uso' 
        });
      }
    }

    const updatedAt = new Date().toISOString();
    
    // Limpar e normalizar dados
    const updateData = {};
    if (data.application !== undefined) updateData.application = data.application.trim();
    if (data.url !== undefined) updateData.url = data.url.trim();
    if (data.active !== undefined) updateData.active = data.active;
    if (data.icon !== undefined) updateData.icon = data.icon.trim();
    if (data.type !== undefined) updateData.type = data.type.trim();
    if (data.base !== undefined) updateData.base = data.base;
    if (data.popularity !== undefined) updateData.popularity = data.popularity;
    updateData.updatedAt = updatedAt;

    const updateResult = await collection.updateOne(
      { uuid },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return reply.status(404).send({ 
        error: 'Aplicação não encontrada' 
      });
    }

    const updatedApp = await collection.findOne(
      { uuid }, 
      { projection: DEFAULT_PROJECTION }
    );
    
    // Retornar diretamente o objeto atualizado
    return reply.send(updatedApp);
  } catch (err) {
    console.error('Error updating application:', err);
    return reply.status(500).send({ 
      error: 'Erro ao atualizar aplicação', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const deleteApplication = async (request, reply) => {
  const { uuid } = request.params;

  // Validação de entrada
  if (!uuid || !isValidUuid(uuid)) {
    return reply.status(400).send({ 
      error: 'UUID inválido' 
    });
  }

  try {
    // Verificar se aplicação existe antes de deletar
    const existingApp = await collection.findOne({ uuid });
    if (!existingApp) {
      return reply.status(404).send({ 
        error: 'Aplicação não encontrada' 
      });
    }

    const deleteResult = await collection.deleteOne({ uuid });

    if (deleteResult.deletedCount === 0) {
      return reply.status(404).send({ 
        error: 'Aplicação não encontrada' 
      });
    }

    return reply.send({
      success: true,
      data: {
        uuid: existingApp.uuid,
        application: existingApp.application
      },
      message: 'Aplicação removida com sucesso'
    });
  } catch (err) {
    console.error('Error deleting application:', err);
    return reply.status(500).send({ 
      error: 'Erro ao deletar aplicação', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};
