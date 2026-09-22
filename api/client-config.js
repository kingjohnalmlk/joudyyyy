const { config } = require('../lib/db');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(
    'window.CHAT_CONFIG = ' +
    JSON.stringify({ CHAT_PASSWORD: config.CHAT_PASSWORD || '' }) +
    ';'
  );
};
