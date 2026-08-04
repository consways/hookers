const { MongoClient } = require('mongodb');

function normalizeEnvValue(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

const rawUri = process.env.MONGODB_URI;
const uri = normalizeEnvValue(rawUri);
const rawDbName = process.env.MONGODB_DB;
const dbName = normalizeEnvValue(rawDbName) || 'Hook';
const rawCollectionName = process.env.MONGODB_COLLECTION;
const collectionName = normalizeEnvValue(rawCollectionName) || 'Hook';
const debug = process.env.DEBUG || process.env.NODE_ENV !== 'production';

let cachedClient = null;
let cachedDb = null;

function buildClientOptions(connectionString) {
  const clientOptions = {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  };

  try {
    const parsedUrl = new URL(connectionString);
    const hasExplicitTls = parsedUrl.searchParams.has('tls') || parsedUrl.searchParams.has('ssl');

    if (!hasExplicitTls && (parsedUrl.protocol === 'mongodb+srv:' || parsedUrl.hostname.includes('mongodb.net'))) {
      clientOptions.tls = true;
    }
  } catch (error) {
    // Leave the MongoDB driver to validate the URI if it is malformed.
  }

  return clientOptions;
}

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };

  if (!uri || !uri.trim()) {
    throw new Error('MONGODB_URI environment variable is not set or is empty. Set it in Vercel project settings.');
  }

  let connectionString = uri;
  try {
    const parsedUrl = new URL(uri);
    const hasExplicitTls = parsedUrl.searchParams.has('tls') || parsedUrl.searchParams.has('ssl');

    if (parsedUrl.protocol === 'mongodb+srv:' && !hasExplicitTls) {
      connectionString = parsedUrl.toString();
    }
  } catch (error) {
    // Ignore URL parsing errors and let the MongoDB driver validate the raw URI.
  }

  const clientOptions = buildClientOptions(connectionString);
  const client = new MongoClient(connectionString, clientOptions);

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

  const { name, serverIP, url } = req.body;

  if (!name || !serverIP || !url) {
    return res.status(400).json({ error: 'name, serverIP, and url are required.' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(collectionName);
    const result = await collection.insertOne({ name, serverIP, url, createdAt: new Date() });
    return res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('MongoDB error:', error);
    const response = { error: error.message || 'Unable to save data.' };
    if (debug && error.stack) {
      response.stack = error.stack;
    }
    return res.status(500).json(response);
  }
};
