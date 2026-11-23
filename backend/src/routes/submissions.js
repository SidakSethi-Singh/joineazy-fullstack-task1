const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

/* One submission row, enriched with submitter + group + confirmation state. */
async function enrich(sub) {
  const { rows: conf } = await pool.query(
    `SELECT u.id, u.name FROM submission_confirmations sc
     JOIN users u ON u.id = sc.student_id WHERE sc.submission_id = $1 ORDER BY u.name`,
    [sub.id]
  );
  let members = [];
  if (sub.group_id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.name FROM group_members gm JOIN users u ON u.id = gm.student_id
       WHERE gm.group_id = $1 ORDER BY u.name`, [sub.group_id]
    );
    members = rows;
  } else {
    members = [{ id: sub.submitted_by, name: sub.submitted_by_name }];
  }
  const confirmedIds = conf.map((c) => c.id);
  const pending = members.filter((m) => !confirmedIds.includes(m.id));
  return {
    ...sub,
    confirmed_by: conf,
    group_members: members,
    confirmed_count: confirmedIds.length,
    member_count: members.length,
    all_confirmed: members.length > 0 && pending.length === 0,
    pending_confirmation: pending,
  };
}

const SUB_SELECT = `
  SELECT s.*, a.title AS assignment_title, a.subject, a.due_date, a.max_marks,
         u.name AS submitted_by_name, g.name AS group_name
  FROM submissions s
  JOIN assignments a ON a.id = s.assignment_id
  JOIN users u ON u.id = s.submitted_by
  LEFT JOIN groups g ON g.id = s.group_id`;

// GET /api/submissions — admin: all (optional ?assignmentId=). Student: own + own groups'.
router.get('/', authRequired, async (req, res) => {
  const { assignmentId } = req.query;
  let rows;
  if (req.user.role === 'admin') {
    const q = assignmentId
      ? SUB_SELECT + ' WHERE s.assignment_id = $1 ORDER BY s.submitted_at DESC'
      : SUB_SELECT + ' ORDER BY s.submitted_at DESC';
    ({ rows } = await pool.query(q, assignmentId ? [assignmentId] : []));
  } else {
    const q = assignmentId
      ? SUB_SELECT + ` WHERE s.assignment_id = $1 AND (s.submitted_by = $2 OR s.group_id IN
          (SELECT group_id FROM group_members WHERE student_id = $2)) ORDER BY s.submitted_at DESC`
      : SUB_SELECT + ` WHERE s.submitted_by = $1 OR s.group_id IN
          (SELECT group_id FROM group_members WHERE student_id = $1) ORDER BY s.submitted_at DESC`;
    ({ rows } = await pool.query(q, assignmentId ? [assignmentId, req.user.id] : [req.user.id]));
  }
  const out = [];
  for (const s of rows) out.push(await enrich(s));
  res.json(out);
});

// POST /api/submissions — student submits (step 1). Body: assignmentId, groupId?, content, onedriveLink?
router.post('/', authRequired, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students submit work' });
  const { assignmentId, groupId, content, onedriveLink } = req.body || {};
  if (!assignmentId || !content || !content.trim()) {
    return res.status(400).json({ error: 'Assignment and your work (text answer) are required' });
  }
  const { rows: a } = await pool.query('SELECT id FROM assignments WHERE id = $1', [assignmentId]);
  if (!a.length) return res.status(404).json({ error: 'Assignment not found' });

  if (groupId) {
    // group submission: must be a member; one submission per group per assignment
    const { rows: mem } = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2', [groupId, req.user.id]
    );
    if (!mem.length) return res.status(403).json({ error: 'You are not a member of this group' });
    const { rows: dup } = await pool.query(
      'SELECT id, status FROM submissions WHERE assignment_id = $1 AND group_id = $2', [assignmentId, groupId]
    );
    if (dup.length) return res.status(409).json({ error: 'This group already submitted for this assignment', submission: dup[0] });
  } else {
    const { rows: dup } = await pool.query(
      'SELECT id, status FROM submissions WHERE assignment_id = $1 AND submitted_by = $2 AND group_id IS NULL',
      [assignmentId, req.user.id]
    );
    if (dup.length) return res.status(409).json({ error: 'You already submitted for this assignment', submission: dup[0] });
  }

  const { rows } = await pool.query(
    `INSERT INTO submissions (assignment_id, group_id, submitted_by, content, onedrive_link, status)
     VALUES ($1, $2, $3, $4, $5, 'submitted') RETURNING *`,
    [assignmentId, groupId || null, req.user.id, content.trim(), onedriveLink || null]
  );
  // The submitter's own confirmation counts automatically (submitting IS step 2 for them);
  // the other members still have to confirm.
  await pool.query(
    'INSERT INTO submission_confirmations (submission_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [rows[0].id, req.user.id]
  );
  const { rows: full } = await pool.query(SUB_SELECT + ' WHERE s.id = $1', [rows[0].id]);
  res.status(201).json(await enrich(full[0]));
});

// POST /api/submissions/:id/confirm — step 2: a member confirms the submission.
// When every member has confirmed, status becomes 'confirmed'.
router.post('/:id/confirm', authRequired, async (req, res) => {
  const { rows } = await pool.query(SUB_SELECT + ' WHERE s.id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Submission not found' });
  const sub = rows[0];
  if (sub.status === 'graded') return res.status(400).json({ error: 'Already graded — nothing to confirm' });
  if (sub.status === 'confirmed') return res.status(400).json({ error: 'Already confirmed by everyone' });
  if (sub.status === 'reopened') return res.status(400).json({ error: 'Resubmit first — this submission was reopened' });

  // who may confirm: group members, or the individual submitter
  let allowed = sub.submitted_by === req.user.id;
  if (sub.group_id) {
    const { rows: mem } = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2', [sub.group_id, req.user.id]
    );
    allowed = !!mem.length;
  }
  if (!allowed) return res.status(403).json({ error: 'Only a member of this submission can confirm it' });

  await pool.query(
    'INSERT INTO submission_confirmations (submission_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [sub.id, req.user.id]
  );
  const enriched = await enrich(sub);
  if (enriched.all_confirmed) {
    await pool.query("UPDATE submissions SET status = 'confirmed' WHERE id = $1", [sub.id]);
    enriched.status = 'confirmed';
  }
  res.json(enriched);
});

// PUT /api/submissions/:id — student resubmits after reopen (content/link), confirmations reset
router.put('/:id', authRequired, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Submission not found' });
  const sub = rows[0];
  if (sub.status !== 'reopened') return res.status(400).json({ error: 'Only a reopened submission can be edited' });
  const isOwner = sub.submitted_by === req.user.id;
  let isMember = false;
  if (sub.group_id) {
    const { rows: mem } = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2', [sub.group_id, req.user.id]
    );
    isMember = !!mem.length;
  }
  if (!isOwner && !isMember) return res.status(403).json({ error: 'Only a member of this submission can resubmit it' });
  const { content, onedriveLink } = req.body || {};
  await pool.query(
    `UPDATE submissions SET content = $1, onedrive_link = $2, status = 'submitted', submitted_at = NOW()
     WHERE id = $3`, [content || sub.content, onedriveLink !== undefined ? onedriveLink : sub.onedrive_link, sub.id]
  );
  await pool.query('DELETE FROM submission_confirmations WHERE submission_id = $1', [sub.id]);
  // the person resubmitting confirms again by resubmitting; other members must re-confirm
  await pool.query(
    'INSERT INTO submission_confirmations (submission_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [sub.id, req.user.id]
  );
  const { rows: full } = await pool.query(SUB_SELECT + ' WHERE s.id = $1', [sub.id]);
  res.json(await enrich(full[0]));
});

// POST /api/submissions/:id/grade — admin grades a confirmed submission
router.post('/:id/grade', authRequired, requireRole('admin'), async (req, res) => {
  const { grade, feedback } = req.body || {};
  const { rows } = await pool.query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Submission not found' });
  const sub = rows[0];
  if (sub.status !== 'confirmed' && sub.status !== 'graded') {
    return res.status(400).json({ error: 'Grade only after every member confirms (status must be confirmed)' });
  }
  if (grade === undefined || grade === null || grade === '' || isNaN(Number(grade))) {
    return res.status(400).json({ error: 'Marks are required' });
  }
  await pool.query(
    `UPDATE submissions SET grade = $1, feedback = $2, status = 'graded', graded_by = $3, graded_at = NOW() WHERE id = $4`,
    [Number(grade), feedback || null, req.user.id, sub.id]
  );
  const { rows: full } = await pool.query(SUB_SELECT + ' WHERE s.id = $1', [sub.id]);
  res.json(await enrich(full[0]));
});

// POST /api/submissions/:id/reopen — admin asks for revision
router.post('/:id/reopen', authRequired, requireRole('admin'), async (req, res) => {
  const { feedback } = req.body || {};
  const { rows } = await pool.query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Submission not found' });
  await pool.query(
    `UPDATE submissions SET status = 'reopened', feedback = $1, grade = NULL WHERE id = $2`,
    [feedback || rows[0].feedback, req.params.id]
  );
  const { rows: full } = await pool.query(SUB_SELECT + ' WHERE s.id = $1', [req.params.id]);
  res.json(await enrich(full[0]));
});

module.exports = router;
