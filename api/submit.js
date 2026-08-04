const { MongoClient } = require('mongodb');

const rawUri = process.env.MONGODB_URI;
const uri = rawUri ? rawUri.trim().replace(/^['"]|['"]$/g, '') : '';
const rawDbName = process.env.MONGODB_DB;
const dbName = rawDbName ? rawDbName.trim().replace(/^['"]|['"]$/g, '') : 'Hook';
const rawCollectionName = process.env.MONGODB_COLLECTION;
const collectionName = rawCollectionName ? rawCollectionName.trim().replace(/^['"]|['"]$/g, '') : 'Hook';
const debug = process.env.DEBUG || process.env.NODE_ENV !== 'production';

let cachedClient = null;
let cachedDb = null;

function ensureTlsOnSrv(uriString) {
  try {
    const url = new URL(uriString);
    if (url.protocol === 'mongodb+srv:' && !url.searchParams.has('tls')) {
      url.searchParams.set('tls', 'true');
      return url.toString();
    }
  } catch (err) {
    // ignore invalid URL parsing; the driver will handle it
  }
  return uriString;
}

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };

  if (!uri || !uri.trim()) {
    throw new Error('MONGODB_URI environment variable is not set or is empty. Set it in Vercel project settings.');
  }

  const connectionString = ensureTlsOnSrv(uri);
  const isSrv = connectionString.startsWith('mongodb+srv://');
  const clientOptions = {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  };

  if (isSrv) {
    clientOptions.tls = true;
  }

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
