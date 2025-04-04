import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = "mongodb+srv://userspaceappapi:ghx4b0Hs29l7Oi68@cluster-db-atlas.dr5xk8i.mongodb.net/?appName=cluster-db-atlas";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

export { client };
