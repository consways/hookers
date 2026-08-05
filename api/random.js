const { fetchRandomEntry } = require('./lib/mongo');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const entry = await fetchRandomEntry();

    if (!entry) {
      return res.status(200).json({
        message: 'No documents were found in the collection yet.',
        entry: null,
      });
    }

    return res.status(200).json({
      message: 'Random entry selected successfully.',
      entry,
    });
  } catch (error) {
    console.error('MongoDB random entry error:', error);

    return res.status(500).json({
      error: error.message || 'Unable to load a random entry.',
    });
  }
};
