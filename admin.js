const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');

const adminApp = express();
const db = new sqlite3.Database('growsparkai_users.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

adminApp.use(express.static('public'));
adminApp.use(express.urlencoded({ extended: true }));
adminApp.use(session({ secret: 'growsparkai-secret', resave: false, saveUninitialized: true }));
adminApp.set('view engine', 'ejs');
adminApp.set('views', path.join(__dirname, 'views'));

adminApp.get('/admin', (req, res) => {
  if (req.session.loggedIn) return res.redirect('/admin/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

adminApp.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin?error=invalid');
  }
});

adminApp.get('/admin/dashboard', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.send('Error');
    res.render('dashboard', { users: rows });
  });
});

adminApp.post('/admin/auto-farm/:userId', (req, res) => {
  const userId = req.params.userId;
  const points = 1000;
  db.run('UPDATE users SET points = points + ? WHERE telegram_id = ?', [points, userId]);
  res.redirect('/admin/dashboard');
});

adminApp.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

adminApp.listen(3001, () => console.log('Admin on http://localhost:3001'));