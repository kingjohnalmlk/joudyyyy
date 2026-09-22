function loadConfig() {
  let local = {};
  try { local = require('../config'); } catch (e) {}

  return {
    CHAT_PASSWORD: process.env.CHAT_PASSWORD || local.CHAT_PASSWORD || '',
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || local.TURSO_DATABASE_URL || '',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || local.TURSO_AUTH_TOKEN || '',
    TABLE_NAME: process.env.TABLE_NAME || local.TABLE_NAME || 'standalone_messages',
    PORT: Number(process.env.PORT || local.PORT || 8080)
  };
}

module.exports = { loadConfig };
