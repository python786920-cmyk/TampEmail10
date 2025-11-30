// db.js
const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

const db = new Database(DB_PATH);

// Tables create
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE,
  first_name TEXT,
  global_notify_all INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  address TEXT,
  password TEXT,
  mailtm_id TEXT,
  token TEXT,
  is_primary INTEGER DEFAULT 0,
  notify_on INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  last_message_created_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

// USERS
const getOrCreateUser = (telegramId, firstName) => {
  let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) {
    db.prepare(
      'INSERT INTO users (telegram_id, first_name, global_notify_all) VALUES (?, ?, 1)'
    ).run(String(telegramId), firstName || '');
    user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  }
  return user;
};

const setGlobalNotify = (userId, value) => {
  db.prepare('UPDATE users SET global_notify_all = ? WHERE id = ?').run(value ? 1 : 0, userId);
};

const getUserById = (userId) =>
  db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// EMAILS
const addEmail = (userId, { address, password, mailtm_id, token }) => {
  // make existing primary=0
  db.prepare('UPDATE emails SET is_primary = 0 WHERE user_id = ?').run(userId);

  const info = db
    .prepare(
      `INSERT INTO emails 
       (user_id, address, password, mailtm_id, token, is_primary, notify_on, is_active)
       VALUES (:user_id, :address, :password, :mailtm_id, :token, 1, 1, 1)`
    )
    .run({ user_id: userId, address, password, mailtm_id, token });

  return db.prepare('SELECT * FROM emails WHERE id = ?').get(info.lastInsertRowid);
};

const getEmailsByUser = (userId) =>
  db.prepare('SELECT * FROM emails WHERE user_id = ? ORDER BY created_at DESC').all(userId);

const getPrimaryEmail = (userId) =>
  db.prepare('SELECT * FROM emails WHERE user_id = ? AND is_primary = 1').get(userId);

const setPrimaryEmail = (userId, emailId) => {
  const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
  if (!email) return false;
  db.prepare('UPDATE emails SET is_primary = 0 WHERE user_id = ?').run(userId);
  db.prepare('UPDATE emails SET is_primary = 1 WHERE id = ?').run(emailId);
  return true;
};

const setEmailNotify = (userId, emailId, value) => {
  const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
  if (!email) return false;
  db.prepare('UPDATE emails SET notify_on = ? WHERE id = ?').run(value ? 1 : 0, emailId);
  return true;
};

const deleteEmail = (userId, emailId) => {
  const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
  if (!email) return false;
  db.prepare('DELETE FROM emails WHERE id = ?').run(emailId);
  return true;
};

const updateLastMessageTime = (emailId, createdAt) => {
  db.prepare('UPDATE emails SET last_message_created_at = ? WHERE id = ?').run(createdAt, emailId);
};

const getActiveEmails = () =>
  db.prepare('SELECT e.*, u.telegram_id, u.global_notify_all FROM emails e JOIN users u ON e.user_id = u.id WHERE e.is_active = 1').all();

module.exports = {
  db,
  getOrCreateUser,
  setGlobalNotify,
  getUserById,
  addEmail,
  getEmailsByUser,
  getPrimaryEmail,
  setPrimaryEmail,
  setEmailNotify,
  deleteEmail,
  updateLastMessageTime,
  getActiveEmails,
};
