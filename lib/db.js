const { createClient } = require('@libsql/client');
const { loadConfig } = require('./config');

const config = loadConfig();
const table = (config.TABLE_NAME || 'standalone_messages').replace(/[^a-zA-Z0-9_]/g, '');

const db = createClient({
  url: config.TURSO_DATABASE_URL,
  authToken: config.TURSO_AUTH_TOKEN
});

let inited = false;

async function initDb() {
  if (inited) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      text TEXT,
      time TEXT,
      seen_by TEXT DEFAULT '',
      msg_type TEXT DEFAULT 'text',
      file_data TEXT DEFAULT '',
      file_name TEXT DEFAULT ''
    )
  `);
  inited = true;
}

module.exports = { db, table, config, initDb };
