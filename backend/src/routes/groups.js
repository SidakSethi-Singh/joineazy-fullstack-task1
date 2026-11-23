const express = require('express');
const pool = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();

async function groupWithMembers(groupId) {
  const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!rows.length) return null;
  const group = rows[0];
  const { rows: members } = await pool.query(
    `SELECT u.id, u.name, u.email FROM group_members gm
     JOIN users u ON u.id = gm.student_id WHERE gm.group_id = $1 ORDER BY u.name`,
    [groupId]
  );
  return { ...group, members };
}

// GET /api/groups — students see groups they belong to; admins see all
router.get('/', authRequired, async (req, res) => {
  let q, params;
  if (req.user.role === 'admin') {
    q = 'SELECT * FROM groups ORDER BY id';
    params = [];
  } else {
    q = `SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.student_id = $1 ORDER BY g.id`;
    params = [req.user.id];
  }
  const { rows } = await pool.query(q, params);
  const out = [];
  for (const g of rows) out.push(await groupWithMembers(g.id));
  res.json(out);
});

// POST /api/groups — student creates a group (creator is added automatically)
router.post('/', authRequired, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students form groups' });
  const { name, member_ids = [] } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });
  const ids = [...new Set([req.user.id, ...member_ids.map(Number).filter(Boolean)])];
  // only real students may be members
  const placeholders = ids.map((_, i) => '$' + (i + 1)).join(', ');
  const { rows: valid } = await pool.query(
    `SELECT id FROM users WHERE role = 'student' AND id IN (${placeholders})`, ids
  );
  const validIds = valid.map((r) => r.id);
  if (!validIds.includes(req.user.id)) return res.status(400).json({ error: 'Invalid members' });
  const { rows } = await pool.query(
    'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id',
    [name.trim(), req.user.id]
  );
  for (const id of validIds) {
    await pool.query('INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)', [rows[0].id, id]);
  }
  res.status(201).json(await groupWithMembers(rows[0].id));
});

// POST /api/groups/:id/members — add a member (creator or member only)
router.post('/:id/members', authRequired, async (req, res) => {
  const group = await groupWithMembers(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const isMember = group.members.some((m) => m.id === req.user.id);
  if (req.user.role !== 'admin' && !isMember) return res.status(403).json({ error: 'Only group members can add people' });
  const { student_id } = req.body || {};
  const { rows: st } = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'student'", [student_id]);
  if (!st.length) return res.status(400).json({ error: 'That student does not exist' });
  await pool.query(
    'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [group.id, student_id]
  );
  res.json(await groupWithMembers(group.id));
});

// DELETE /api/groups/:id/members/:studentId — remove a member
router.delete('/:id/members/:studentId', authRequired, async (req, res) => {
  const group = await groupWithMembers(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const isMember = group.members.some((m) => m.id === req.user.id);
  if (req.user.role !== 'admin' && !isMember) return res.status(403).json({ error: 'Only group members can remove people' });
  await pool.query('DELETE FROM group_members WHERE group_id = $1 AND student_id = $2', [group.id, req.params.studentId]);
  res.json(await groupWithMembers(group.id));
});

// DELETE /api/groups/:id — creator or admin
router.delete('/:id', authRequired, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Group not found' });
  if (req.user.role !== 'admin' && rows[0].created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only the group creator can delete it' });
  }
  await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
