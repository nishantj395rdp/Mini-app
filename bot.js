require('dotenv').config();
console.log("BOT_TOKEN from env:", process.env.BOT_TOKEN); // Debug line

const { Telegraf } = require('telegraf');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const db = new sqlite3.Database('growsparkai_users.db');

// DB Setup
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

// Start Command
bot.start((ctx) => {
  const userId = ctx.from.id;
  db.run('INSERT OR IGNORE INTO users (telegram_id, username, created_at) VALUES (?, ?, ?)',
    [userId, ctx.from.username || 'Unknown', new Date().toISOString()]);
  ctx.reply('Welcome to Grow Spark AI! 🚀\n/farm - Earn points\n/referral - Invite friends\n/missions - Complete tasks\n/game - Play drop game', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Launch Mining Game', web_app: { url: process.env.WEB_APP_URL + '/game' } }]]
    }
  });
});

// Farm Points (8-hour cooldown)
bot.command('farm', (ctx) => {
  const userId = ctx.from.id;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, row) => {
    if (row) {
      const now = new Date();
      const lastFarm = row.last_farm ? new Date(row.last_farm) : new Date(0);
      if (now - lastFarm < 8 * 60 * 60 * 1000) {
        return ctx.reply(`⏰ Wait ${Math.ceil((8 * 3600 - (now - lastFarm) / 1000) / 3600)} hours to farm again!`);
      }
      const pointsEarned = Math.floor(Math.random() * 100) + 50;
      const newPoints = row.points + pointsEarned;
      db.run('UPDATE users SET points = ?, last_farm = ? WHERE telegram_id = ?', [newPoints, now.toISOString(), userId]);
      ctx.reply(`🎉 Farmed ${pointsEarned} Grow Spark Points! Total: ${newPoints}`);
    } else {
      ctx.reply('Start with /start');
    }
  });
});

// Referral System
bot.command('referral', (ctx) => {
  const userId = ctx.from.id;
  db.get('SELECT referrals FROM users WHERE telegram_id = ?', [userId], (err, row) => {
    ctx.reply(`Your link: t.me/${ctx.botInfo.username}?start=${userId}\nReferrals: ${row?.referrals || 0}\nEarn 10% of friends' points!`);
  });
});

bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/start ') && ctx.message.text.split(' ')[1]) {
    const referrerId = ctx.message.text.split(' ')[1];
    db.get('SELECT points FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
      if (row) {
        const bonus = Math.floor(row.points * 0.1);
        db.run('UPDATE users SET points = points + ?, referrals = referrals + 1 WHERE telegram_id = ?', [bonus, referrerId]);
      }
    });
  }
});

// Missions
bot.command('missions', (ctx) => {
  ctx.reply('📋 Missions:\n1. Join Channel - /claim1 (200 points)\n2. Watch Video - /claim2 (150 points)');
});

bot.command('claim1', (ctx) => claimMission(ctx, 200));
bot.command('claim2', (ctx) => claimMission(ctx, 150));

function claimMission(ctx, points) {
  const userId = ctx.from.id;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, row) => {
    if (row) {
      const newPoints = row.points + points;
      db.run('UPDATE users SET points = ? WHERE telegram_id = ?', [newPoints, userId]);
      ctx.reply(`✅ Claimed ${points} points! Total: ${newPoints}`);
    } else {
      ctx.reply('Start with /start');
    }
  });
}

// Game
bot.command('game', (ctx) => {
  ctx.reply('🎮 Launch Drop Game!', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Play Mining Game', web_app: { url: process.env.WEB_APP_URL + '/game' } }]]
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
        ctx.reply(`🎮 Claimed ${data.points} points from game! Total: ${newPoints}`);
      }
    });
  }
});

// Admin Command
bot.command('admin', (ctx) => {
  if (ctx.from.id === 123456789) { // Replace with your Telegram ID
    ctx.reply('Admin Panel: http://localhost:3001/admin');
  } else {
    ctx.reply('Unauthorized');
  }
});

// Express Routes
app.use(express.static('public'));
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.listen(3000, () => console.log('Mini App on http://localhost:3000'));

// Start Bot
bot.launch();
console.log('Grow Spark AI (@GrowSparkbot) running...');