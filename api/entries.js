const { fetchAllEntries } = require('./lib/mongo');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const entries = await fetchAllEntries();
    return res.status(200).json(entries);
  } catch (error) {
    console.error('MongoDB read error:', error);

    return res.status(500).json({
      error: error.message || 'Unable to load entries.',
    });
  }
};
