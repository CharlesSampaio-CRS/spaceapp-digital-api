// server.js
import Fastify from 'fastify';
import { config } from 'dotenv';
import { client } from './database/mongodb.js';
import applicationsRoutes from './routes/applications.js';
import usersRoutes from './routes/users.js';
import spacesRoutes from './routes/spaces.js';
import authRoutes from './routes/authRoutes.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyJwt from '@fastify/jwt';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import fastifyOauth2 from '@fastify/oauth2';

const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.dev';
config({ path: envFile });

const fastify = Fastify({ 
  logger: true,
  trustProxy: true // Importante para produção
});

// Configuração do Swagger
fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Minha API Fastify',
      description: 'Documentação gerada automaticamente com Swagger',
      version: '1.0.0',
    },
    host: `${process.env.HOST}:${process.env.PORT}`,
    schemes: [process.env.NODE_ENV === 'production' ? 'https' : 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
  },
});

fastify.register(swaggerUi, {
  routePrefix: '/docs',
  staticCSP: true,
  transformSpecificationClone: true,
});

// Configuração do JWT
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
  sign: {
    expiresIn: '1h'
  }
});

// Configuração do OAuth2 do Google
fastify.register(fastifyOauth2, {
  name: 'googleOAuth2',
  credentials: {
    client: {
      id: process.env.GOOGLE_CLIENT_ID,
      secret: process.env.GOOGLE_CLIENT_SECRET
    },
    auth: fastifyOauth2.GOOGLE_CONFIGURATION
  },
  scope: ['profile', 'email'],
  startRedirectPath: '/auth/google', // Rota para iniciar o fluxo
  callbackUri: 'http://localhost:3000/auth/google/callback',
  checkStateFunction: (providedState, callback) => {
    callback(null, true);
  },
  generateStateFunction: (request) => {
    return 'state-' + uuidv4(); // Gera um state único
  },
  checkStateFunction: (state, callback) => {
    if (state.startsWith('state-')) {
      callback();
    } else {
      callback(new Error('Invalid state'));
    }
  }
});

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');

// Rota de callback do Google
fastify.get('/auth/google/callback', async (request, reply) => {
  try {
    const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const googleUser = await response.json();


    if (!googleUser?.email) {
      return reply.status(400).send({ error: 'Não foi possível obter e-mail do Google.' });
    }

    if (!googleUser.verified_email) {
      return reply.status(403).send({ error: 'E-mail do Google não verificado.' });
    }

    // Buscar usuário existente
    let user = await userCollection.findOne({ 
      $or: [
        { email: googleUser.email },
        { googleId: googleUser.id }
      ]
    });

    // Criar novo usuário se não existir
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
        googleId: googleUser.id,
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
    return reply.redirect(`${frontendUrl}/auth/success?token=${jwtToken}`);

  } catch (err) {
    console.error('Google OAuth error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return reply.redirect(`${frontendUrl}/auth/error?message=google_auth_failed`);
  }
});

// Middleware de autenticação
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Token inválido ou expirado' });
  }
});

const startServer = async () => {
  try {
    await client.connect();
    
    // Registrar rotas
    fastify.register(applicationsRoutes);
    fastify.register(usersRoutes);
    fastify.register(spacesRoutes);
    fastify.register(authRoutes);

    await fastify.listen({
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0'
    });

    console.log(`Servidor rodando em ${fastify.server.address().port}`);
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
};

startServer();