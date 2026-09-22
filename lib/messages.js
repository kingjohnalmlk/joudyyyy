const { db, table, initDb } = require('./db');

async function listMessages() {
  await initDb();
  const rs = await db.execute(
    `SELECT id, sender, text, time, seen_by, msg_type, file_data, file_name FROM ${table} ORDER BY id ASC`
  );
  return rs.rows;
}

async function clearMessages() {
  await initDb();
  await db.execute(`DELETE FROM ${table}`);
  return { success: true };
}

async function markSeen(id, seenBy) {
  await initDb();
  await db.execute({
    sql: `UPDATE ${table} SET seen_by = ? WHERE id = ? AND (seen_by IS NULL OR seen_by = '')`,
    args: [seenBy, id]
  });
  return { success: true };
}

async function createMessage(data) {
  await initDb();
  if (!data.text && !data.file_data) {
    const err = new Error('Content required');
    err.status = 400;
    throw err;
  }
  await db.execute({
    sql: `INSERT INTO ${table} (sender, text, time, seen_by, msg_type, file_data, file_name) VALUES (?, ?, ?, '', ?, ?, ?)`,
    args: [
      data.sender || 'مجهول',
      data.text || '',
      data.time || '',
      data.msg_type || 'text',
      data.file_data || '',
      data.file_name || ''
    ]
  });
  return { success: true };
}

async function handleAction(data) {
  if (data.action === 'seen') return markSeen(data.id, data.seen_by);
  return createMessage(data);
}

module.exports = {
  listMessages,
  clearMessages,
  markSeen,
  createMessage,
  handleAction
};
