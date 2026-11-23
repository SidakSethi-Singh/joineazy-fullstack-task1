const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signToken, authRequired } = require('../auth');

const router = express.Router();

// POST /api/auth/login — { email, password } -> { token, user }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'No account with this email' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(safe), user: safe });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

// GET /api/auth/students — list of students (for group member picker)
router.get('/students', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, email FROM users WHERE role = 'student' ORDER BY name"
  );
  res.json(rows);
});

module.exports = router;
