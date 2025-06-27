import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db/mongodb.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');
const spaceCollection = db.collection('spaces');
const applicationCollection = db.collection('applications');

// Projeção padrão para otimizar consultas
const DEFAULT_PROJECTION = {
  _id: 0,
  __v: 0
};

// Validação de email básica
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validação de senha básica
const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// Validação de nome básica
const isValidName = (name) => {
  return name && name.trim().length >= 2;
};

export const register = async (request, reply) => {
  const { name, email, password, plan = 'free', active = true, googleId } = request.body;

  // Validação de entrada
  if (!isValidName(name)) {
    return reply.status(400).send({ 
      error: 'Nome deve ter pelo menos 2 caracteres' 
    });
  }

  if (!isValidEmail(email)) {
    return reply.status(400).send({ 
      error: 'Email inválido' 
    });
  }

  if (!googleId && !isValidPassword(password)) {
    return reply.status(400).send({ 
      error: 'Senha deve ter pelo menos 6 caracteres' 
    });
  }

  // Validar plano
  const validPlans = ['free', 'basic', 'premium', 'enterprise'];
  if (!validPlans.includes(plan)) {
    return reply.status(400).send({ 
      error: 'Plano inválido. Deve ser: free, basic, premium ou enterprise' 
    });
  }

  try {
    // Verificar se usuário já existe
    const existingUser = await userCollection.findOne(
      { email }, 
      { projection: { uuid: 1, email: 1 } }
    );

    if (existingUser) {
      return reply.status(409).send({ error: 'Usuário ou email já registrado' });
    }

    const hashedPassword = googleId ? null : await bcrypt.hash(password, 10);
    const uuid = uuidv4();
    const createdAt = new Date().toISOString();

    const newUser = {
      uuid,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      plan,
      active,
      createdAt,
      updatedAt: null,
      type: 'user',
      googleId
    };

    // Buscar aplicações ativas em paralelo com a criação do usuário
    const [applications] = await Promise.all([
      applicationCollection.find({ active: true }).project({ 
        uuid: 1, 
        application: 1, 
        icon: 1, 
        url: 1, 
        active: 1 
      }).toArray(),
      userCollection.insertOne(newUser)
    ]);

    // Criar espaço do usuário
    const space = {
      uuid: uuidv4(),
      userUuid: newUser.uuid,
      applications: applications.map(app => ({
        uuid: app.uuid,
        application: app.application,
        icon: app.icon,
        active: app.active,
        url: app.url
      })),
      active: true,
      createdAt,
      updatedAt: null
    };

    await spaceCollection.insertOne(space);

    // Retornar dados sem informações sensíveis
    const userResponse = {
      uuid: newUser.uuid,
      name: newUser.name,
      email: newUser.email,
      plan: newUser.plan,
      active: newUser.active,
      type: newUser.type,
      createdAt: newUser.createdAt
    };

    return reply.code(201).send({
      success: true,
      data: {
        user: userResponse,
        space: {
          uuid: space.uuid,
          applicationsCount: space.applications.length
        }
      },
      message: 'Usuário registrado com sucesso'
    });
  } catch (err) {
    console.error('Error registering user:', err);
    return reply.status(500).send({
      error: 'Erro ao registrar usuário',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

export const login = async (request, reply) => {
  const { email, password } = request.body;

  // Validação de entrada
  if (!isValidEmail(email)) {
    return reply.status(400).send({ 
      error: 'Email inválido' 
    });
  }

  if (!password) {
    return reply.status(400).send({ 
      error: 'Senha é obrigatória' 
    });
  }

  try {
    const user = await userCollection.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!user) {
      return reply.status(401).send({ error: 'Usuário não encontrado' });
    }

    if (!user.active) {
      return reply.status(401).send({ error: 'Usuário desativado' });
    }

    const hasGoogleId = !!user.googleId;
    let isPasswordValid = false;

    if (hasGoogleId) {
      // Para usuários Google, aceitar qualquer senha (ou implementar lógica específica)
      isPasswordValid = true;
    } else {
      if (!user.password) {
        return reply.status(401).send({ error: 'Conta não configurada para login com senha' });
      }
      isPasswordValid = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Senha inválida' });
    }

    // Buscar aplicações e espaço em paralelo
    const [allApplications, userSpace] = await Promise.all([
      applicationCollection.find({ active: true }).project({ 
        uuid: 1, 
        application: 1, 
        icon: 1, 
        url: 1, 
        active: 1 
      }).toArray(),
      spaceCollection.findOne({ userUuid: user.uuid }, { projection: DEFAULT_PROJECTION })
    ]);

    // Atualizar aplicações do usuário se necessário
    if (userSpace && allApplications.length > 0) {
      const userAppNames = userSpace.applications.map(app => app.application);
      const missingApps = allApplications.filter(app =>
        !userAppNames.includes(app.application)
      );

      if (missingApps.length > 0) {
        const updatedApplications = [
          ...userSpace.applications,
          ...missingApps.map(app => ({
            uuid: app.uuid,
            application: app.application,
            icon: app.icon,
            url: app.url,
            active: app.active
          }))
        ];

        await spaceCollection.updateOne(
          { userUuid: user.uuid },
          { $set: { applications: updatedApplications, updatedAt: new Date().toISOString() } }
        );
      }
    }

    // Gerar token JWT
    const token = await reply.jwtSign({
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      plan: user.plan,
      type: user.type,
      googleId: user.googleId
    }, {
      expiresIn: '2h' 
    });

    return reply.send({
      success: true,
      data: {
        token,
        user: {
          uuid: user.uuid,
          name: user.name,
          email: user.email,
          plan: user.plan,
          type: user.type
        }
      },
      message: 'Login realizado com sucesso'
    });
  } catch (err) {
    console.error('Error during login:', err);
    return reply.status(500).send({
      error: 'Erro no login',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};
