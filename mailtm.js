// mailtm.js
const axios = require('axios');
const crypto = require('crypto');

const api = axios.create({
  baseURL: 'https://api.mail.tm',
  timeout: 15000,
});

// Helper: random string
const randomString = (len = 10) => crypto.randomBytes(len).toString('hex').slice(0, len);

// Get random active domain
async function getRandomDomain() {
  const res = await api.get('/domains');
  const list = res.data['hydra:member'] || [];
  if (!list.length) throw new Error('No domains available from mail.tm');
  const activePublic = list.filter((d) => d.isActive && !d.isPrivate);
  const chosen = activePublic[0] || list[0];
  return chosen.domain;
}

// Create new account + token
async function createMailAccount() {
  const domain = await getRandomDomain();
  const username = 'tg' + randomString(7);
  const address = `${username}@${domain}`;
  const password = randomString(16);

  // Create account
  const accRes = await api.post('/accounts', { address, password });
  const mailtm_id = accRes.data.id;

  // Get token
  const tokenRes = await api.post('/token', { address, password });
  const token = tokenRes.data.token;

  return { address, password, mailtm_id, token };
}

// Authenticated client for specific email
function authClient(token) {
  return axios.create({
    baseURL: 'https://api.mail.tm',
    timeout: 15000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Fetch messages list (page 1)
async function fetchMessages(token, page = 1) {
  const client = authClient(token);
  const res = await client.get('/messages', { params: { page } });
  return res.data['hydra:member'] || [];
}

// Fetch full message by id (optional)
async function fetchMessageById(token, id) {
  const client = authClient(token);
  const res = await client.get(`/messages/${id}`);
  return res.data;
}

module.exports = {
  createMailAccount,
  fetchMessages,
  fetchMessageById,
};
