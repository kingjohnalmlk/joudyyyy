const { listMessages, clearMessages, handleAction } = require('../lib/messages');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      res.status(200).json(await listMessages());
      return;
    }

    if (req.method === 'DELETE') {
      res.status(200).json(await clearMessages());
      return;
    }

    if (req.method === 'POST') {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      res.status(200).json(await handleAction(data));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
