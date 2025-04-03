import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000), 
  },
});

client.on('error', err => console.error('❌ Redis Client Error:', err));

const connectRedis = async () => {
  await client.connect();
  console.log('✅ Conectado ao Redis!');
};

export { client, connectRedis };
