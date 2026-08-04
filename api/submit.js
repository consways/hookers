import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'Hook';
const collectionName = process.env.MONGODB_COLLECTION || 'Hook';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  const db = client.db(dbName);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { Name, ServerIP, URL } = req.body;

  if (!Name || !ServerIP || !URL) {
    return res.status(400).json({ error: 'Name, ServerIP, and URL are required.' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(collectionName);
    const result = await collection.insertOne({ Name, ServerIP, URL, createdAt: new Date() });
    return res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({ error: 'Unable to save data.' });
  }
}
