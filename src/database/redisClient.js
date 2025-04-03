import { createClient } from 'redis';

const client = createClient({
  username: 'default',
  password: 'kr76VN4Fnsa7ZRJhfCq7JknLvkWtvQH7',
  socket: {
    host: 'localhost',
    port: 6379
  },
});

client.on('error', err => console.error('❌ Redis Client Error:', err));

const connectRedis = async () => {
  await client.connect();
  console.log('✅ Conectado ao Redis!');
};

export { client, connectRedis };
