const { MongoClient } = require('mongodb');

function cleanEnv(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

const uri = cleanEnv(process.env.MONGODB_URI);
const dbName = cleanEnv(process.env.MONGODB_DB) || 'Hook';
const collectionName = cleanEnv(process.env.MONGODB_COLLECTION) || 'Hook';
const debug = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
    throw new Error('MONGODB_URI is missing. Add your MongoDB Atlas connection string in Vercel env settings.');
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
    maxPoolSize: 10,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 20000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const { name, serverIP, url } = body;

  if (!name || !serverIP || !url) {
    return res.status(400).json({ error: 'name, serverIP, and url are required.' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(collectionName);

    const result = await collection.insertOne({
      name: String(name).trim(),
      serverIP: String(serverIP).trim(),
      url: String(url).trim(),
      createdAt: new Date(),
    });

    return res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('MongoDB error:', error);

    const response = {
      error: error.message || 'Unable to save data.',
    };

    if (debug && error.stack) {
      response.stack = error.stack;
    }

    return res.status(500).json(response);
  }
};
