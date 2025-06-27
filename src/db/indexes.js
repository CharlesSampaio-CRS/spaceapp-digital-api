import { client } from './mongodb.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');
const spaceCollection = db.collection('spaces');
const applicationCollection = db.collection('applications');

export const createIndexes = async () => {
  try {
    console.log('Criando índices para otimização...');

    // ===== ÍNDICES PARA USERS =====
    // Índice único para UUID (campo principal de busca)
    await userCollection.createIndex(
      { uuid: 1 }, 
      { 
        unique: true, 
        name: 'users_uuid_unique_index',
        background: true 
      }
    );

    // Índice único para email (para validação de unicidade)
    await userCollection.createIndex(
      { email: 1 }, 
      { 
        unique: true, 
        name: 'users_email_unique_index',
        background: true,
        sparse: true // Permite documentos sem email
      }
    );

    // Índice composto para busca por plan e active
    await userCollection.createIndex(
      { plan: 1, active: 1 }, 
      { 
        name: 'users_plan_active_index',
        background: true 
      }
    );

    // Índice para updatedAt (para ordenação e filtros temporais)
    await userCollection.createIndex(
      { updatedAt: -1 }, 
      { 
        name: 'users_updatedAt_desc_index',
        background: true 
      }
    );

    // Índice para username (para buscas por nome)
    await userCollection.createIndex(
      { username: 1 }, 
      { 
        name: 'users_username_index',
        background: true 
      }
    );

    // ===== ÍNDICES PARA SPACES =====
    // Índice único para UUID
    await spaceCollection.createIndex(
      { uuid: 1 }, 
      { 
        unique: true, 
        name: 'spaces_uuid_unique_index',
        background: true 
      }
    );

    // Índice único para userUuid (um usuário por espaço)
    await spaceCollection.createIndex(
      { userUuid: 1 }, 
      { 
        unique: true, 
        name: 'spaces_userUuid_unique_index',
        background: true 
      }
    );

    // Índice para active (para filtrar espaços ativos/inativos)
    await spaceCollection.createIndex(
      { active: 1 }, 
      { 
        name: 'spaces_active_index',
        background: true 
      }
    );

    // Índice para updatedAt
    await spaceCollection.createIndex(
      { updatedAt: -1 }, 
      { 
        name: 'spaces_updatedAt_desc_index',
        background: true 
      }
    );

    // Índice composto para userUuid e active
    await spaceCollection.createIndex(
      { userUuid: 1, active: 1 }, 
      { 
        name: 'spaces_userUuid_active_index',
        background: true 
      }
    );

    // ===== ÍNDICES PARA APPLICATIONS =====
    // Índice único para UUID
    await applicationCollection.createIndex(
      { uuid: 1 }, 
      { 
        unique: true, 
        name: 'applications_uuid_unique_index',
        background: true 
      }
    );

    // Índice único para application (nome da aplicação)
    await applicationCollection.createIndex(
      { application: 1 }, 
      { 
        unique: true, 
        name: 'applications_name_unique_index',
        background: true 
      }
    );

    // Índice para active (para filtrar aplicações ativas/inativas)
    await applicationCollection.createIndex(
      { active: 1 }, 
      { 
        name: 'applications_active_index',
        background: true 
      }
    );

    // Índice para type (para filtrar por tipo de aplicação)
    await applicationCollection.createIndex(
      { type: 1 }, 
      { 
        name: 'applications_type_index',
        background: true 
      }
    );

    // Índice para popularity (para ordenação por popularidade)
    await applicationCollection.createIndex(
      { popularity: -1 }, 
      { 
        name: 'applications_popularity_desc_index',
        background: true 
      }
    );

    // Índice para updatedAt
    await applicationCollection.createIndex(
      { updatedAt: -1 }, 
      { 
        name: 'applications_updatedAt_desc_index',
        background: true 
      }
    );

    // Índice composto para active e type
    await applicationCollection.createIndex(
      { active: 1, type: 1 }, 
      { 
        name: 'applications_active_type_index',
        background: true 
      }
    );

    console.log('Índices criados com sucesso!');
  } catch (error) {
    console.error('Erro ao criar índices:', error);
    // Não falhar a aplicação se os índices já existirem
    if (error.code !== 85) { // Código 85 = índice já existe
      throw error;
    }
  }
};

export const getIndexInfo = async () => {
  try {
    const userIndexes = await userCollection.indexes();
    const spaceIndexes = await spaceCollection.indexes();
    const applicationIndexes = await applicationCollection.indexes();
    
    console.log('Índices de Users:', userIndexes.map(idx => idx.name));
    console.log('Índices de Spaces:', spaceIndexes.map(idx => idx.name));
    console.log('Índices de Applications:', applicationIndexes.map(idx => idx.name));
    
    return {
      users: userIndexes,
      spaces: spaceIndexes,
      applications: applicationIndexes
    };
  } catch (error) {
    console.error('Erro ao obter informações dos índices:', error);
    return { users: [], spaces: [], applications: [] };
  }
}; 