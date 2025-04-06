import { MongoClient, ServerApiVersion } from 'mongodb';
import { config } from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.dev' : '.env.dev';

config({ path: envFile });

const uri = process.env.MONGO_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

export { client };
