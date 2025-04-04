import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../database/mongodb.js';

const db = client.db('cluster-db-atlas');
const userCollection = db.collection('users');

export const register = async (request, reply) => {
  const { username, email, password } = request.body;

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
      updatedAt: new Date()
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
