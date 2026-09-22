const { listMessages, clearMessages, handleAction } = require('./messages');

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function sendJson(res, status, data) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleMessages(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      sendJson(res, 200, await listMessages());
      return;
    }
    if (req.method === 'DELETE') {
      sendJson(res, 200, await clearMessages());
      return;
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return;
      }
      sendJson(res, 200, await handleAction(data));
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    sendJson(res, err.status || 500, { error: err.message });
  }
}

module.exports = { handleMessages };
