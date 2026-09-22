const http = require('http');
const os = require('os');
const { config, initDb } = require('./lib/db');
const { handleMessages } = require('./lib/api');
const { serveStatic } = require('./lib/static');

const PORT = config.PORT || 8080;

initDb().catch(console.error);

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/client-config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end('window.CHAT_CONFIG = ' + JSON.stringify({ CHAT_PASSWORD: config.CHAT_PASSWORD || '' }) + ';');
    return;
  }

  if (urlPath === '/api/messages') {
    handleMessages(req, res);
    return;
  }

  serveStatic(req, res, urlPath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('server up on port ' + PORT);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log('Network: http://' + net.address + ':' + PORT);
      }
    }
  }
});
