import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db/mongodb.js';
import { isValidEmail, isValidPassword, isValidName } from '../utils/validators.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');
const spaceCollection = db.collection('spaces');
const applicationCollection = db.collection('applications');

// Projeção padrão para otimizar consultas
const DEFAULT_PROJECTION = {
  _id: 0,
  __v: 0
};

// Helpers internos
const validPlans = ['free', 'basic', 'premium', 'enterprise'];

function errorResponse(reply, status, error, details = undefined) {
  const resp = { error };
  if (details) resp.details = details;
  return reply.status(status).send(resp);
}

function successResponse(reply, status, data, message) {
  return reply.code(status).send({ success: true, data, message });
}

export const register = async (request, reply) => {
  const { name, email, password, plan = 'free', active = true, googleId } = request.body;

  // Validação de entrada
  if (!isValidName(name)) {
    return errorResponse(reply, 400, 'Nome deve ter pelo menos 2 caracteres');
  }
  if (!isValidEmail(email)) {
    return errorResponse(reply, 400, 'Email inválido');
  }
  if (!googleId && !isValidPassword(password)) {
    return errorResponse(reply, 400, 'Senha deve ter pelo menos 6 caracteres');
  }
  if (!validPlans.includes(plan)) {
    return errorResponse(reply, 400, 'Plano inválido. Deve ser: free, basic, premium ou enterprise');
  }

  try {
    // Verificar se usuário já existe
    const existingUser = await userCollection.findOne(
      { email },
      { projection: { uuid: 1, email: 1 } }
    );
    if (existingUser) {
      return errorResponse(reply, 409, 'Usuário ou email já registrado');
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

    return successResponse(reply, 201, {
      user: userResponse,
      space: {
        uuid: space.uuid,
        applicationsCount: space.applications.length
      }
    }, 'Usuário registrado com sucesso');
  } catch (err) {
    console.error('Error registering user:', err);
    return errorResponse(
      reply,
      500,
      'Erro ao registrar usuário',
      process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    );
  }
};

export const login = async (request, reply) => {
  const { email, password } = request.body;

  // Validação de entrada
  if (!isValidEmail(email)) {
    return errorResponse(reply, 400, 'Email inválido');
  }
  if (!password) {
    return errorResponse(reply, 400, 'Senha é obrigatória');
  }

  try {
    const user = await userCollection.findOne({
      email: email.toLowerCase().trim()
    });
    if (!user) {
      return errorResponse(reply, 401, 'Usuário não encontrado');
    }
    if (!user.active) {
      return errorResponse(reply, 401, 'Usuário desativado');
    }
    const hasGoogleId = !!user.googleId;
    let isPasswordValid = false;
    if (hasGoogleId) {
      isPasswordValid = true;
    } else {
      if (!user.password) {
        return errorResponse(reply, 401, 'Conta não configurada para login com senha');
      }
      isPasswordValid = await bcrypt.compare(password, user.password);
    }
    if (!isPasswordValid) {
      return errorResponse(reply, 401, 'Senha inválida');
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

    return successResponse(reply, 200, {
      token,
      user: {
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        plan: user.plan,
        type: user.type
      }
    }, 'Login realizado com sucesso');
  } catch (err) {
    console.error('Error during login:', err);
    return errorResponse(
      reply,
      500,
      'Erro no login',
      process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    );
  }
};
