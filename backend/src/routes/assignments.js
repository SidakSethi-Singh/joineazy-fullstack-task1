const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

// GET /api/assignments — all assignments (both roles)
router.get('/', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS created_by_name
     FROM assignments a JOIN users u ON u.id = a.created_by
     ORDER BY a.due_date ASC`
  );
  res.json(rows);
});

// POST /api/assignments — admin only
router.post('/', authRequired, requireRole('admin'), async (req, res) => {
  const { title, subject, description, due_date, max_marks } = req.body || {};
  if (!title || !subject || !description || !due_date || !max_marks) {
    return res.status(400).json({ error: 'Title, subject, description, due date and max marks are required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO assignments (title, subject, description, due_date, max_marks, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, subject, description, due_date, max_marks, req.user.id]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/assignments/:id — admin only
router.put('/:id', authRequired, requireRole('admin'), async (req, res) => {
  const { title, subject, description, due_date, max_marks } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE assignments SET title = $1, subject = $2, description = $3, due_date = $4, max_marks = $5
     WHERE id = $6 RETURNING *`,
    [title, subject, description, due_date, max_marks, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Assignment not found' });
  res.json(rows[0]);
});

// DELETE /api/assignments/:id — admin only
router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM assignments WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ ok: true });
});

module.exports = router;
