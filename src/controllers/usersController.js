import { client } from '../db/mongodb.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');

// Projeção padrão para otimizar consultas - exclui campos desnecessários
const DEFAULT_PROJECTION = {
  _id: 0,
  __v: 0
};

// Validação de UUID básica
const isValidUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Validação de email básica
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const getAllUsers = async (_request, reply) => {
  try {
    // Usar projeção para retornar apenas campos necessários
    const users = await userCollection
      .find({}, { projection: DEFAULT_PROJECTION })
      .toArray();
    
    return reply.send({
      success: true,
      data: users,
      count: users.length
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return reply.status(500).send({ 
      error: 'Erro ao buscar usuários', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const getUserByIdUuid = async (request, reply) => {
  const { uuid } = request.params;
  
  // Validação de entrada
  if (!uuid || !isValidUuid(uuid)) {
    return reply.status(400).send({ 
      error: 'UUID inválido fornecido' 
    });
  }

  try {
    const user = await userCollection.findOne(
      { uuid }, 
      { projection: DEFAULT_PROJECTION }
    );
    
    if (!user) {
      return reply.status(404).send({ 
        error: 'Usuário não encontrado' 
      });
    }
    
    return reply.send({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Error fetching user by UUID:', err);
    return reply.status(500).send({ 
      error: 'Erro ao buscar usuário', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const updateUser = async (request, reply) => {
  const { id } = request.params;
  const { username, email, plan, active } = request.body;

  // Validação de entrada
  if (!id || !isValidUuid(id)) {
    return reply.status(400).send({ 
      error: 'ID inválido fornecido' 
    });
  }

  // Validação de email se fornecido
  if (email && !isValidEmail(email)) {
    return reply.status(400).send({ 
      error: 'Email inválido fornecido' 
    });
  }

  // Validação de plan se fornecido
  if (plan && !['basic', 'premium', 'enterprise'].includes(plan)) {
    return reply.status(400).send({ 
      error: 'Plano inválido. Deve ser: basic, premium ou enterprise' 
    });
  }

  try {
    // Verificar se usuário existe primeiro
    const existingUser = await userCollection.findOne({ uuid: id });
    if (!existingUser) {
      return reply.status(404).send({ 
        error: 'Usuário não encontrado' 
      });
    }

    // Verificar se email já existe (se estiver sendo atualizado)
    if (email && email !== existingUser.email) {
      const emailExists = await userCollection.findOne({ 
        email, 
        uuid: { $ne: id } 
      });
      if (emailExists) {
        return reply.status(409).send({ 
          error: 'Email já está em uso por outro usuário' 
        });
      }
    }

    const updatedAt = new Date().toISOString();

    // Construir objeto de atualização apenas com campos fornecidos
    const updateFields = {};
    if (username !== undefined) updateFields.username = username;
    if (email !== undefined) updateFields.email = email;
    if (plan !== undefined) updateFields.plan = plan;
    if (active !== undefined) updateFields.active = active;
    updateFields.updatedAt = updatedAt;

    // Se não há campos para atualizar, retornar usuário atual
    if (Object.keys(updateFields).length === 1) { // apenas updatedAt
      return reply.send({
        success: true,
        data: existingUser,
        message: 'Nenhum campo foi atualizado'
      });
    }

    // Atualizar usuário
    const result = await userCollection.updateOne(
      { uuid: id }, 
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ 
        error: 'Usuário não encontrado' 
      });
    }

    // Buscar usuário atualizado
    const updatedUser = await userCollection.findOne(
      { uuid: id }, 
      { projection: DEFAULT_PROJECTION }
    );

    return reply.send({
      success: true,
      data: updatedUser,
      message: 'Usuário atualizado com sucesso'
    });
  } catch (err) {
    console.error('Error updating user:', err);
    return reply.status(500).send({ 
      error: 'Erro ao atualizar usuário', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const deleteUser = async (request, reply) => {
  const { id } = request.params;
  
  // Validação de entrada
  if (!id || !isValidUuid(id)) {
    return reply.status(400).send({ 
      error: 'ID inválido fornecido' 
    });
  }

  try {
    // Verificar se usuário existe antes de deletar
    const existingUser = await userCollection.findOne({ uuid: id });
    if (!existingUser) {
      return reply.status(404).send({ 
        error: 'Usuário não encontrado' 
      });
    }

    const result = await userCollection.deleteOne({ uuid: id });

    if (result.deletedCount === 0) {
      return reply.status(404).send({ 
        error: 'Usuário não encontrado' 
      });
    }

    return reply.send({ 
      success: true,
      message: 'Usuário deletado com sucesso',
      deletedUser: {
        uuid: existingUser.uuid,
        username: existingUser.username,
        email: existingUser.email
      }
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    return reply.status(500).send({ 
      error: 'Erro ao deletar usuário', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};
