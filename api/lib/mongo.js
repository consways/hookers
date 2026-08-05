const { MongoClient } = require('mongodb');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function cleanEnv(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function getMongoConfig() {
  const uri = cleanEnv(process.env.MONGODB_URI);
  const dbName = cleanEnv(process.env.MONGODB_DB) || 'Hook';
  const collectionName = cleanEnv(process.env.MONGODB_COLLECTION) || 'Hook';

  return { uri, dbName, collectionName };
}

let cachedClient = null;
let cachedDb = null;
let lastConnectedAt = 0;

async function closeConnection() {
  if (!cachedClient) {
    return;
  }

  try {
    await cachedClient.close();
  } catch (error) {
    console.warn('MongoDB close warning:', error.message || error);
  } finally {
    cachedClient = null;
    cachedDb = null;
    lastConnectedAt = 0;
  }
}

async function connectIfNeeded(force = false) {
  const { uri, dbName, collectionName } = getMongoConfig();

  if (!uri) {
    throw new Error('MONGODB_URI is missing. Add your MongoDB connection string in your Vercel environment variables.');
  }

  const shouldReconnect = force || !cachedClient || !cachedDb || Date.now() - lastConnectedAt >= ONE_DAY_MS;

  if (shouldReconnect && cachedClient) {
    await closeConnection();
  }

  if (!cachedClient || !cachedDb) {
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
    cachedClient = client;
    cachedDb = client.db(dbName);
    lastConnectedAt = Date.now();
  }

  return {
    client: cachedClient,
    db: cachedDb,
    collection: cachedDb.collection(collectionName),
  };
}

async function fetchAllEntries() {
  const { collection } = await connectIfNeeded();

  try {
    return await collection.find({}).sort({ _id: -1 }).toArray();
  } finally {
    await closeConnection();
  }
}

async function fetchRandomEntry() {
  const { collection } = await connectIfNeeded();

  try {
    const total = await collection.countDocuments({});
    if (total === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * total);
    const docs = await collection.find({}).skip(randomIndex).limit(1).toArray();
    return docs[0] || null;
  } finally {
    await closeConnection();
  }
}

module.exports = {
  ONE_DAY_MS,
  cleanEnv,
  getMongoConfig,
  connectIfNeeded,
  closeConnection,
  fetchAllEntries,
  fetchRandomEntry,
};
