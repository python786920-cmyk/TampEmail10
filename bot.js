// bot.js
const TelegramBot = require('node-telegram-bot-api');
const {
  TELEGRAM_BOT_TOKEN,
  POLL_INTERVAL_MS,
} = require('./config');

const {
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
} = require('./db');

const { createMailAccount, fetchMessages, fetchMessageById } = require('./mailtm');

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// ---------- Utils ----------

const mainReplyKeyboard = {
  keyboard: [
    [{ text: '✉️ ᴍʏ ᴇᴍᴀɪʟ' }],
    [{ text: '🌀 ɢᴇɴᴇʀᴀᴛᴇ ɴᴇᴡ' }, { text: '📥 ɪɴʙᴏx' }],
    [{ text: '♻️ ʀᴇᴄᴏᴠᴇʀ ᴇᴍᴀɪʟ' }],
  ],
  resize_keyboard: true,
};

function bold(text) {
  return `<b>${text}</b>`;
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------- /start ----------

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'User';

  getOrCreateUser(chatId, firstName);

  const text =
    '🌐 ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴛᴇᴍᴘ-ᴍᴀɪʟ ʙᴏᴛ 🚀\n' +
    'ʙᴜʏ & ᴍᴀɴᴀɢᴇ ɪɴꜱᴛᴀɴᴛ ᴇᴍᴀɪʟꜱ ꜰᴏʀ ᴏᴛᴘ / ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴ\n\n' +
    `👤 ɴᴀᴍᴇ: ${escapeHtml(firstName)}\n` +
    `🆔 ɪᴅ: ${chatId}\n\n` +
    '"ᴄʜᴏᴏꜱᴇ ᴀɴ ᴏᴘᴛɪᴏɴ ʙᴇʟᴏᴡ 👇"';

  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: mainReplyKeyboard,
  });
});

// ---------- Reply button handlers ----------

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  const user = getOrCreateUser(chatId, msg.from.first_name || '');

  if (text === '✉️ ᴍʏ ᴇᴍᴀɪʟ') {
    return handleMyEmail(chatId, user);
  }

  if (text === '🌀 ɢᴇɴᴇʀᴀᴛᴇ ɴᴇᴡ') {
    return handleGenerateNew(chatId, user);
  }

  if (text === '📥 ɪɴʙᴏx') {
    return handleInbox(chatId, user);
  }

  if (text === '♻️ ʀᴇᴄᴏᴠᴇʀ ᴇᴍᴀɪʟ') {
    return askRecoverEmail(chatId, user);
  }
});

// ---------- 1. My Email ----------

async function handleMyEmail(chatId, user) {
  const emails = getEmailsByUser(user.id);

  if (!emails.length) {
    return bot.sendMessage(
      chatId,
      'ʏᴏᴜ ᴅᴏ ɴᴏᴛ ʜᴀᴠᴇ ᴀɴʏ ᴇᴍᴀɪʟ ʏᴇᴛ.\nᴛᴀᴘ 🌀 ɢᴇɴᴇʀᴀᴛᴇ ɴᴇᴡ ᴛᴏ ᴄʀᴇᴀᴛᴇ ʏᴏᴜʀ ꜰɪʀꜱᴛ ᴇᴍᴀɪʟ.',
      { reply_markup: mainReplyKeyboard }
    );
  }

  const primary = getPrimaryEmail(user.id) || emails[0];
  const totalCount = emails.length;
  const globalOn = user.global_notify_all === 1;

  const msgText =
    'ʜᴇʀᴇ ɪꜱ ʏᴏᴜʀ ᴘʀɪᴍᴀʀʏ ᴇᴍᴀɪʟ 👇\n' +
    `📬 ᴇᴍᴀɪʟ ɪᴅ: ${escapeHtml(primary.address)}\n` +
    '🔔 ʀᴇᴀʟ-ᴛɪᴍᴇ ɴᴏᴛɪꜰʏ: ᴀʟᴡᴀʏꜱ ᴏɴ (ᴄᴀɴɴᴏᴛ ʙᴇ ᴛᴜʀɴᴇᴅ ᴏꜰꜰ)\n' +
    `📂 ᴛᴏᴛᴀʟ ᴇᴍᴀɪʟꜱ ᴄʀᴇᴀᴛᴇᴅ: ${totalCount}\n\n` +
    'ꜱᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ:';

  await bot.sendMessage(chatId, msgText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📜 ᴀʟʟ ᴍʏ ᴇᴍᴀɪʟꜱ', callback_data: 'list_emails' }],
        [
          {
            text: `🔔 ᴀʟʟ ɴᴏᴛɪꜰʏ: ${globalOn ? 'ON' : 'OFF'}`,
            callback_data: 'toggle_all_notify',
          },
        ],
      ],
    },
  });
}

// ---------- 2. Generate New ----------

async function handleGenerateNew(chatId, user) {
  try {
    await bot.sendChatAction(chatId, 'typing');
    const acc = await createMailAccount();

    const emailRow = addEmail(user.id, acc);

    const msgText =
      '♻️ ɴᴇᴡ ᴇᴍᴀɪʟ ɢᴇɴᴇʀᴀᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ✅\n\n' +
      `📬 ᴇᴍᴀɪʟ ɪᴅ: ${escapeHtml(emailRow.address)}\n` +
      '🔔 ʀᴇᴀʟ-ᴛɪᴍᴇ ɴᴏᴛɪꜰʏ: ᴏɴ\n' +
      'ℹ️ ᴛʜɪꜱ ᴇᴍᴀɪʟ ɪꜱ ɴᴏᴡ ʏᴏᴜʀ ᴘʀɪᴍᴀʀʏ ᴇᴍᴀɪʟ.';

    await bot.sendMessage(chatId, msgText, {
      parse_mode: 'HTML',
      reply_markup: mainReplyKeyboard,
    });
  } catch (err) {
    console.error('Generate new error:', err.message);
    await bot.sendMessage(
      chatId,
      '❌ ᴇʀʀᴏʀ ᴡʜɪʟᴇ ᴄʀᴇᴀᴛɪɴɢ ɴᴇᴡ ᴇᴍᴀɪʟ.\nᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ᴀꜰᴛᴇʀ ꜱᴏᴍᴇ ᴛɪᴍᴇ.'
    );
  }
}

// ---------- 3. Inbox (manual check) ----------

async function handleInbox(chatId, user) {
  const emails = getEmailsByUser(user.id).filter((e) => e.is_active === 1);
  if (!emails.length) {
    return bot.sendMessage(
      chatId,
      'ʏᴏᴜ ᴅᴏ ɴᴏᴛ ʜᴀᴠᴇ ᴀɴʏ ᴀᴄᴛɪᴠᴇ ᴇᴍᴀɪʟ.\nᴛᴀᴘ 🌀 ɢᴇɴᴇʀᴀᴛᴇ ɴᴇᴡ ᴛᴏ ᴄʀᴇᴀᴛᴇ ᴏɴᴇ.',
      { reply_markup: mainReplyKeyboard }
    );
  }

  await bot.sendMessage(
    chatId,
    '🔍 ᴄʜᴇᴄᴋɪɴɢ ɴᴇᴡ ᴍᴀɪʟꜱ ꜰᴏʀ ᴀʟʟ ᴀᴄᴛɪᴠᴇ ᴇᴍᴀɪʟꜱ...'
  );

  let totalNew = 0;

  for (const email of emails) {
    try {
      const list = await fetchMessages(email.token);
      // sort by createdAt
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastTime = email.last_message_created_at
        ? new Date(email.last_message_created_at)
        : null;

      const newOnes = list.filter((m) => !lastTime || new Date(m.createdAt) > lastTime);

      for (const mail of newOnes) {
        totalNew++;
        await sendMailToUser(chatId, email, mail, false);
        updateLastMessageTime(email.id, mail.createdAt);
      }
    } catch (err) {
      console.error('Inbox fetch error:', err.message);
    }
  }

  if (!totalNew) {
    await bot.sendMessage(
      chatId,
      'ɴᴏ ɴᴇᴡ ᴍᴀɪʟꜱ ꜰᴏʀ ʏᴏᴜʀ ᴀᴄᴛɪᴠᴇ ᴇᴍᴀɪʟꜱ.\nᴡᴀɪᴛ ꜰᴏʀ ᴏᴛᴘ / ᴍᴀɪʟ ᴛʜᴇɴ ᴛᴀᴘ 📥 ɪɴʙᴏx ᴀɢᴀɪɴ\n(ᴏʀ ʟᴇᴛ ʀᴇᴀʟ-ᴛɪᴍᴇ ɴᴏᴛɪꜰʏ ᴅᴏ ᴛʜᴇ ᴍᴀɢɪᴄ).'
    );
  } else {
    await bot.sendMessage(chatId, '✅ ᴀʟʟ ɴᴇᴡ ᴍᴀɪʟꜱ ʜᴀᴠᴇ ʙᴇᴇɴ ꜰᴏʀᴡᴀʀᴅᴇᴅ.\n\n"ᴡᴇʙꜱᴏᴄᴋᴇᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ ⚡\nᴋᴀʙʜɪ ᴋᴀʙʜɪ ᴛᴏ ɪᴛɴᴀ ꜰᴀꜱᴛ ᴀʏᴇɢᴀ\nᴋɪ ᴛᴜᴍʜᴇ 📥 ɪɴʙᴏx ᴅᴀʙᴀɴᴇ ᴋᴀ ᴍᴏǫᴀ ʙʜɪ ɴᴀʜɪ ᴍɪʟᴇɢᴀ 😆"');
  }
}

// Send mail in chat
async function sendMailToUser(chatId, emailRow, mail, realtime) {
  const fromName = mail.from?.name || '';
  const fromAddr = mail.from?.address || '';
  const intro = mail.intro || '';

  const text =
    `${realtime ? '⏱ ʀᴇᴀʟ-ᴛɪᴍᴇ ɴᴏᴛɪꜰʏ\n\n' : ''}` +
    '📩 ɴᴇᴡ ᴍᴀɪʟ ʀᴇᴄᴇɪᴠᴇᴅ 🪧\n\n' +
    `📬 ᴇᴍᴀɪʟ: ${escapeHtml(emailRow.address)}\n` +
    `📇 ꜰʀᴏᴍ: ${escapeHtml(fromName || fromAddr)}\n` +
    `🗒️ ꜱᴜʙᴊᴇᴄᴛ: ${escapeHtml(mail.subject || '(no subject)')}\n` +
    `💬 ᴛᴇxᴛ: ${escapeHtml(intro || '(no preview)')}\n\n` +
    '(ꜰᴜʟʟ ʙᴏᴅʏ ᴍᴀʏ ʙᴇ ꜱᴇɴᴛ ᴀꜱ ᴇxᴛʀᴀ ᴍᴇꜱꜱᴀɢᴇ ɪꜰ ʟᴀʀɢᴇ)';

  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🗑 ᴅᴇʟᴇᴛᴇ ᴍᴀɪʟ', callback_data: `delete_mail:${mail.id}` },
          { text: '📥 ᴏᴘᴇɴ ꜰᴜʟʟ', callback_data: `open_mail:${mail.id}` },
        ],
      ],
    },
  });
}

// ---------- 4. Recover Email ----------

const recoverState = new Map(); // chatId -> waiting boolean

function askRecoverEmail(chatId, user) {
  recoverState.set(chatId, true);
  return bot.sendMessage(
    chatId,
    'ᴇɴᴛᴇʀ ʏᴏᴜʀ ᴇᴍᴀɪʟ ᴀᴅᴅʀᴇꜱꜱ ᴛᴏ ʀᴇᴄᴏᴠᴇʀ 👇\n(ᴏɴʟʏ ᴇᴍᴀɪʟꜱ ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴛʜɪꜱ ʙᴏᴛ ᴄᴀɴ ʙᴇ ʀᴇᴄᴏᴠᴇʀᴇᴅ)'
  );
}

// extra handler (already have general .on('message'), so we intercept here)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  if (!recoverState.get(chatId)) return;
  // This message is email to recover
  recoverState.delete(chatId);

  const user = getOrCreateUser(chatId, msg.from.first_name || '');
  const allEmails = getActiveEmails(); // includes all users

  const emailRow = allEmails.find((e) => e.address === text);

  if (!emailRow) {
    return bot.sendMessage(
      chatId,
      '❌ ᴛʜɪꜱ ᴇᴍᴀɪʟ ᴡᴀꜱ ɴᴏᴛ ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴛʜɪꜱ ʙᴏᴛ.\nᴏɴʟʏ ʙᴏᴛ-ɢᴇɴᴇʀᴀᴛᴇᴅ ᴇᴍᴀɪʟꜱ ᴄᴀɴ ʙᴇ ʀᴇᴄᴏᴠᴇʀᴇᴅ.'
    );
  }

  if (String(emailRow.telegram_id) !== String(chatId)) {
    return bot.sendMessage(
      chatId,
      '❌ ᴛʜɪꜱ ᴇᴍᴀɪʟ ɪꜱ ʟɪɴᴋᴇᴅ ᴛᴏ ᴀɴᴏᴛʜᴇʀ ᴀᴄᴄᴏᴜɴᴛ.\nʏᴏᴜ ᴄᴀɴɴᴏᴛ ʀᴇᴄᴏᴠᴇʀ ꜱᴏᴍᴇᴏɴᴇ ᴇʟꜱᴇ\'ꜱ ᴇᴍᴀɪʟ.'
    );
  }

  // Email belongs to this user; ensure it's listed under his account
  const emailsForUser = getEmailsByUser(user.id);
  const hasIt = emailsForUser.find((e) => e.address === emailRow.address);

  if (!hasIt) {
    // link back by inserting row for this user
    addEmail(user.id, {
      address: emailRow.address,
      password: emailRow.password,
      mailtm_id: emailRow.mailtm_id,
      token: emailRow.token,
    });
  }

  const status = emailRow.is_active ? 'ᴀᴄᴛɪᴠᴇ' : 'ᴇxᴘɪʀᴇᴅ';
  const notify = emailRow.notify_on ? 'ON' : 'OFF';

  await bot.sendMessage(
    chatId,
    `✅ ʀᴇᴄᴏᴠᴇʀʏ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ\n\n📬 ᴇᴍᴀɪʟ: ${escapeHtml(emailRow.address)}\nꜱᴛᴀᴛᴜꜱ: ${status}\n🔔 ɴᴏᴛɪꜰʏ: ${notify}\n\nʏᴏᴜ ᴄᴀɴ ᴍᴀɴᴀɢᴇ ɪᴛ ᴜɴᴅᴇʀ:\n✉️ ᴍʏ ᴇᴍᴀɪʟ → 📜 ᴀʟʟ ᴍʏ ᴇᴍᴀɪʟꜱ`,
    { parse_mode: 'HTML', reply_markup: mainReplyKeyboard }
  );
});

// ---------- Inline callback handlers ----------

bot.on('callback_query', async (cq) => {
  const chatId = cq.message.chat.id;
  const data = cq.data;
  const user = getOrCreateUser(chatId, cq.from.first_name || '');

  if (data === 'list_emails') {
    await sendAllEmailsList(chatId, user);
  } else if (data === 'toggle_all_notify') {
    await handleToggleAllNotify(chatId, user, cq);
  } else if (data.startsWith('toggle_notify:')) {
    const id = Number(data.split(':')[1]);
    await handleToggleSingleNotify(chatId, user, id, cq);
  } else if (data.startsWith('set_primary:')) {
    const id = Number(data.split(':')[1]);
    await handleSetPrimary(chatId, user, id, cq);
  } else if (data.startsWith('delete_email:')) {
    const id = Number(data.split(':')[1]);
    await handleDeleteEmail(chatId, user, id, cq);
  } else if (data.startsWith('delete_mail:')) {
    // OPTIONAL: implement delete mail from mail.tm if needed
    await bot.answerCallbackQuery(cq.id, { text: 'Delete mail not implemented yet.' });
  } else if (data.startsWith('open_mail:')) {
    const id = data.split(':')[1];
    await handleOpenMail(chatId, id, cq);
  }
});

// All my emails list
async function sendAllEmailsList(chatId, user) {
  const emails = getEmailsByUser(user.id);
  if (!emails.length) {
    return bot.sendMessage(chatId, 'ɴᴏ ꜱᴀᴠᴇᴅ ᴇᴍᴀɪʟꜱ ꜰᴏᴜɴᴅ.', { reply_markup: mainReplyKeyboard });
  }

  let text = 'ʏᴏᴜʀ ꜱᴀᴠᴇᴅ ᴇᴍᴀɪʟꜱ:\n\n';
  const chunks = [];

  for (const e of emails) {
    const status = e.is_active ? 'ᴀᴄᴛɪᴠᴇ' : 'ᴇxᴘɪʀᴇᴅ';
    const notify = e.notify_on ? 'ON' : 'OFF';
    const isPrimary = e.is_primary ? ' (PRIMARY ⭐)' : '';

    text =
      `ᴇᴍᴀɪʟ: ${escapeHtml(e.address)}${isPrimary}\n` +
      `ꜱᴛᴀᴛᴜꜱ: ${status}\n` +
      `ɴᴏᴛɪꜰʏ: ${notify}\n`;

    const inlineKeyboard = [
      [
        {
          text: '🔔 ᴛᴏɢɢʟᴇ ɴᴏᴛɪꜰʏ',
          callback_data: `toggle_notify:${e.id}`,
        },
      ],
    ];

    if (e.is_active) {
      inlineKeyboard.push([
        {
          text: '⭐ ꜱᴇᴛ ᴀꜱ ᴘʀɪᴍᴀʀʏ',
          callback_data: `set_primary:${e.id}`,
        },
      ]);
    }

    if (!e.is_active) {
      inlineKeyboard.push([
        {
          text: '🗑 ᴅᴇʟᴇᴛᴇ',
          callback_data: `delete_email:${e.id}`,
        },
      ]);
    }

    chunks.push({ text, inlineKeyboard });
  }

  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: chunk.inlineKeyboard },
    });
  }
}

// Global toggle
async function handleToggleAllNotify(chatId, user, cq) {
  const newValue = user.global_notify_all ? 0 : 1;
  setGlobalNotify(user.id, newValue);

  // Update label
  await bot.editMessageReplyMarkup(
    {
      inline_keyboard: [
        [{ text: '📜 ᴀʟʟ ᴍʏ ᴇᴍᴀɪʟꜱ', callback_data: 'list_emails' }],
        [
          {
            text: `🔔 ᴀʟʟ ɴᴏᴛɪꜰʏ: ${newValue ? 'ON' : 'OFF'}`,
            callback_data: 'toggle_all_notify',
          },
        ],
      ],
    },
    {
      chat_id: chatId,
      message_id: cq.message.message_id,
    }
  );

  if (newValue) {
    await bot.answerCallbackQuery(cq.id, {
      text:
        'ᴀʟʟ ᴀᴄᴛɪᴠᴇ ᴇᴍᴀɪʟꜱ ᴡɪʟʟ ꜱᴇɴᴅ ɪɴꜱᴛᴀɴᴛ ᴄʜᴀᴛ ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴꜱ.',
      show_alert: true,
    });
  } else {
    await bot.answerCallbackQuery(cq.id, {
      text:
        'ᴏɴʟʏ ᴘʀɪᴍᴀʀʏ ᴇᴍᴀɪʟ ᴡɪʟʟ ꜱᴇɴᴅ ɪɴꜱᴛᴀɴᴛ ᴄʜᴀᴛ ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴꜱ.',
      show_alert: true,
    });
  }
}

// Single email notify toggle
async function handleToggleSingleNotify(chatId, user, emailId, cq) {
  const emails = getEmailsByUser(user.id);
  const e = emails.find((x) => x.id === emailId);
  if (!e) return bot.answerCallbackQuery(cq.id, { text: 'Email not found.' });

  const newVal = e.notify_on ? 0 : 1;
  setEmailNotify(user.id, emailId, newVal);

  await bot.answerCallbackQuery(cq.id, {
    text: `Notify set to ${newVal ? 'ON' : 'OFF'} for this email.`,
    show_alert: false,
  });
}

// Set primary
async function handleSetPrimary(chatId, user, emailId, cq) {
  const ok = setPrimaryEmail(user.id, emailId);
  await bot.answerCallbackQuery(cq.id, {
    text: ok ? 'Primary email updated.' : 'Failed to set primary.',
    show_alert: false,
  });
}

// Delete email (only expired/unused ideally)
async function handleDeleteEmail(chatId, user, emailId, cq) {
  const ok = deleteEmail(user.id, emailId);
  await bot.answerCallbackQuery(cq.id, {
    text: ok ? 'Email deleted from your list.' : 'Unable to delete email.',
    show_alert: false,
  });
}

// Open full mail
async function handleOpenMail(chatId, mailId, cq) {
  await bot.answerCallbackQuery(cq.id);
  // We need to find which email token to use
  const activeEmails = getActiveEmails();
  for (const e of activeEmails) {
    try {
      const mail = await fetchMessageById(e.token, mailId);
      if (mail && mail.id) {
        const bodyText =
          mail.text || mail.html || '(no body text / maybe HTML only)';
        const trimmed =
          bodyText.length > 3500 ? bodyText.slice(0, 3500) + '\n\n...[truncated]...' : bodyText;

        return bot.sendMessage(
          chatId,
          `📥 ꜰᴜʟʟ ᴍᴀɪʟ ʙᴏᴅʏ:\n\n${escapeHtml(trimmed)}`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (e1) {
      continue;
    }
  }

  await bot.sendMessage(chatId, '❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ꜰɪɴᴅ ᴛʜᴀᴛ ᴍᴀɪʟ ʀɪɢʜᴛ ɴᴏᴡ.');
}

// ---------- "Realtime" polling loop ----------

async function pollingLoop() {
  try {
    const activeEmails = getActiveEmails();

    for (const email of activeEmails) {
      const chatId = email.telegram_id;
      const user = getUserById(email.user_id);
      if (!user) continue;

      const primaryOnlyMode = user.global_notify_all === 0;
      if (primaryOnlyMode && !email.is_primary) {
        continue; // only primary allowed to push
      }

      if (!email.notify_on) continue;

      try {
        const list = await fetchMessages(email.token);
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const lastTime = email.last_message_created_at
          ? new Date(email.last_message_created_at)
          : null;
        const newOnes = list.filter((m) => !lastTime || new Date(m.createdAt) > lastTime);

        for (const mail of newOnes) {
          await sendMailToUser(chatId, email, mail, true);
          updateLastMessageTime(email.id, mail.createdAt);
        }
      } catch (err) {
        console.error('Realtime polling error:', err.message);
      }
    }
  } catch (err) {
    console.error('Polling loop top-level error:', err.message);
  }
}

setInterval(pollingLoop, POLL_INTERVAL_MS);

console.log('Temp-mail Telegram bot started...');
