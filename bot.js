require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize bot & app
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Database setup (SQLite)
const dbPath = path.join(__dirname, 'growsparkai_users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE,
    username TEXT,
    points INTEGER DEFAULT 0,
    referrals INTEGER DEFAULT 0,
    last_farm TEXT,
    created_at TEXT
  )`);
});

// --- Telegram Bot Commands ---

// Start Command
bot.start((ctx) => {
  const userId = ctx.from.id;
  db.run(
    'INSERT OR IGNORE INTO users (telegram_id, username, created_at) VALUES (?, ?, ?)',
    [userId, ctx.from.username || 'Unknown', new Date().toISOString()]
  );

  ctx.reply('Welcome to Grow Spark AI! 🚀\nLaunch the 3D Mining World to start earning points!', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Launch 3D Mining Game',
            web_app: { url: process.env.WEB_APP_URL + '/3d-game' }
          }
        ]
      ]
    }
  });
});

// Farm Points
bot.command('farm', (ctx) => {
  const userId = ctx.from.id;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, row) => {
    if (row) {
      const now = new Date();
      const lastFarm = row.last_farm ? new Date(row.last_farm) : new Date(0);

      if (now - lastFarm < 8 * 60 * 60 * 1000) {
        return ctx.reply(
          `⏰ Wait ${Math.ceil(
            (8 * 3600 - (now - lastFarm) / 1000) / 3600
          )} hours to farm again! Launch the 3D game for bonus mining.`
        );
      }

      const pointsEarned = Math.floor(Math.random() * 100) + 50;
      const newPoints = row.points + pointsEarned;

      db.run('UPDATE users SET points = ?, last_farm = ? WHERE telegram_id = ?', [
        newPoints,
        now.toISOString(),
        userId
      ]);

      ctx.reply(`🎉 Farmed ${pointsEarned} Grow Spark Points! Total: ${newPoints}. Launch 3D game for more!`);
    } else {
      ctx.reply('Start with /start to launch the 3D mining world!');
    }
  });
});

// Referral System
bot.command('referral', (ctx) => {
  const userId = ctx.from.id;
  db.get('SELECT referrals FROM users WHERE telegram_id = ?', [userId], (err, row) => {
    ctx.reply(
      `Your link: t.me/${ctx.botInfo.username}?start=${userId}\nReferrals: ${
        row?.referrals || 0
      }\nEarn 10% of friends' points! Share in the 3D mining world.`
    );
  });
});

bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/start ') && ctx.message.text.split(' ')[1]) {
    const referrerId = ctx.message.text.split(' ')[1];
    db.get('SELECT points FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
      if (row) {
        const bonus = Math.floor(row.points * 0.1);
        db.run('UPDATE users SET points = points + ?, referrals = referrals + 1 WHERE telegram_id = ?', [
          bonus,
          referrerId
        ]);
      }
    });
  }
});

// Missions
bot.command('missions', (ctx) => {
  ctx.reply(
    '📋 Missions:\n1. Join Channel - /claim1 (200 points)\n2. Watch Video - /claim2 (150 points)\nComplete in the 3D mining world for bonus sparks!'
  );
});

bot.command('claim1', (ctx) => claimMission(ctx, 200));
bot.command('claim2', (ctx) => claimMission(ctx, 150));

function claimMission(ctx, points) {
  const userId = ctx.from.id;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, row) => {
    if (row) {
      const newPoints = row.points + points;
      db.run('UPDATE users SET points = ? WHERE telegram_id = ?', [newPoints, userId]);
      ctx.reply(`✅ Claimed ${points} points! Total: ${newPoints}. Head to the 3D game for more!`);
    } else {
      ctx.reply('Start with /start to enter the 3D mining world!');
    }
  });
}

// Launch Game
bot.command('game', (ctx) => {
  ctx.reply('🎮 Launch 3D Mining World!', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Enter 3D Mining Realm',
            web_app: { url: process.env.WEB_APP_URL + '/3d-game' }
          }
        ]
      ]
    }
  });
});

// Handle Web App Data
bot.on('web_app_data', (ctx) => {
  const data = JSON.parse(ctx.webAppData.data);
  if (data.action === 'claim') {
    const userId = ctx.from.id;
    db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, row) => {
      if (row) {
        const newPoints = row.points + data.points;
        db.run('UPDATE users SET points = ? WHERE telegram_id = ?', [newPoints, userId]);
        ctx.reply(`🌟 Claimed ${data.points} points from 3D mining! Total: ${newPoints}`);
      }
    });
  }
});

// Admin Command
bot.command('admin', (ctx) => {
  if (ctx.from.id === 123456789) {
    ctx.reply(`Admin Panel: ${process.env.WEB_APP_URL}/admin`);
  } else {
    ctx.reply('Unauthorized');
  }
});

// --- Express Server for 3D Game ---
app.use(express.static('public'));

app.get('/3d-game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', '3d-game.html'));
});

// Use Render’s dynamic port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`3D Mini App running on port ${PORT}`));

// Start Bot
bot.launch();
console.log('Grow Spark AI Bot running...');
