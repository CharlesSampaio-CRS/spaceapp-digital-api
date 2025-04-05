// src/controllers/authController.js
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../database/mongodb.js';
import fetch from 'node-fetch';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');

export const register = async (request, reply) => {
  const { username, email, password, plan = 'free', active = true } = request.body;

  try {
    const existingUser = await userCollection.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return reply.status(400).send({ error: 'Usuário ou e-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      uuid: uuidv4(),
      username,
      email,
      password: hashedPassword,
      plan,
      active,
      createdAt: new Date(),
      updatedAt: null,
      type: 'user',
      googleId: null
    };

    await userCollection.insertOne(newUser);

    return reply.code(201).send({
      message: 'Usuário registrado com sucesso',
      uuid: newUser.uuid
    });
  } catch (err) {
    return reply.status(500).send({
      error: 'Erro ao registrar usuário',
      details: err.message
    });
  }
};

export const login = async (request, reply) => {
  const { username, password } = request.body;

  try {
    const user = await userCollection.findOne({ username });

    if (!user) {
      return reply.status(401).send({ error: 'Usuário não encontrado' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Senha inválida' });
    }

    const token = await reply.jwtSign({
      uuid: user.uuid,
      username: user.username,
      email: user.email
    });

    return reply.send({ token });
  } catch (err) {
    return reply.status(500).send({
      error: 'Erro ao fazer login',
      details: err.message
    });
  }
};

export const loginWithGoogle = async (request, reply) => {
  try {
    const token = await request.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Google: ${response.statusText}`);
    }

    const googleUser = await response.json();

    if (!googleUser?.email) {
      return reply.status(400).send({ error: 'Não foi possível obter e-mail do Google.' });
    }

    // Verificar se o e-mail está verificado
    if (!googleUser.verified_email) {
      return reply.status(403).send({ error: 'E-mail do Google não verificado.' });
    }

    // Buscar usuário existente por e-mail ou googleId
    let user = await userCollection.findOne({ 
      $or: [
        { email: googleUser.email },
        { googleId: googleUser.sub }
      ]
    });

    // Se não existir, criar novo usuário
    if (!user) {
      const username = googleUser.name?.replace(/\s+/g, '_').toLowerCase() || 
                      googleUser.email.split('@')[0];

      user = {
        uuid: uuidv4(),
        username,
        email: googleUser.email,
        password: null,
        plan: 'free',
        active: true,
        createdAt: new Date(),
        updatedAt: null,
        type: 'user',
        googleId: googleUser.sub,
        picture: googleUser.picture
      };

      const result = await userCollection.insertOne(user);
      user._id = result.insertedId;
    }

    // Gerar token JWT
    const jwtToken = await reply.jwtSign({
      uuid: user.uuid,
      username: user.username,
      email: user.email,
      picture: user.picture
    });

    // Redirecionar para o frontend com o token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = new URL(`${frontendUrl}/auth/google`);
    redirectUrl.searchParams.append('token', jwtToken);

    return reply.redirect(redirectUrl.toString());

  } catch (err) {
    console.error('Erro no login com Google:', err);
    
    // Redirecionar para o frontend com erro
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorUrl = new URL(`${frontendUrl}/auth/google`);
    errorUrl.searchParams.append('error', 'google_auth_failed');
    
    return reply.redirect(errorUrl.toString());
  }
};

// Adicione esta função para iniciar o fluxo de login
export const startGoogleLogin = async (request, reply) => {
  // O próprio plugin @fastify/oauth2 irá lidar com o redirecionamento
  return reply.send({ 
    message: 'Redirecionando para o Google...',
    url: '/login/google' // Rota configurada no plugin OAuth2
  });
};