const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

// GET /api/analytics/overview — admin only
// Submission rate per assignment, confirmation status per group, overdue list,
// per-student confirmation status.
router.get('/overview', authRequired, requireRole('admin'), async (req, res) => {
  const { rows: students } = await pool.query(
    "SELECT id, name, email FROM users WHERE role = 'student' ORDER BY name"
  );
  const { rows: assignments } = await pool.query('SELECT * FROM assignments ORDER BY due_date');
  const { rows: subs } = await pool.query(
    `SELECT s.*, u.name AS submitted_by_name, g.name AS group_name
     FROM submissions s JOIN users u ON u.id = s.submitted_by
     LEFT JOIN groups g ON g.id = s.group_id`
  );
  const { rows: confs } = await pool.query(
    'SELECT submission_id, COUNT(*)::int AS n FROM submission_confirmations GROUP BY submission_id'
  );
  const confMap = Object.fromEntries(confs.map((c) => [c.submission_id, c.n]));
  const { rows: groups } = await pool.query('SELECT * FROM groups ORDER BY id');

  // group id -> member list
  const groupMembers = {};
  for (const g of groups) {
    const { rows } = await pool.query(
      'SELECT u.id, u.name FROM group_members gm JOIN users u ON u.id = gm.student_id WHERE gm.group_id = $1 ORDER BY u.name',
      [g.id]
    );
    groupMembers[g.id] = rows;
  }

  // which students a submission covers
  function coveredBy(s) {
    if (s.group_id) return groupMembers[s.group_id] || [];
    return [{ id: s.submitted_by, name: s.submitted_by_name }];
  }

  const today = new Date().toISOString().slice(0, 10);
  const totalStudents = students.length;

  const perAssignment = assignments.map((a) => {
    const list = subs.filter((x) => x.assignment_id === a.id);
    const coveredIds = new Set();
    list.forEach((s) => coveredBy(s).forEach((m) => coveredIds.add(m.id)));
    return {
      id: a.id, title: a.title, subject: a.subject, due_date: a.due_date, max_marks: a.max_marks,
      submissions: list.length,
      confirmed: list.filter((s) => s.status === 'confirmed' || s.status === 'graded').length,
      graded: list.filter((s) => s.status === 'graded').length,
      students_covered: coveredIds.size,
      rate: totalStudents ? Math.round((coveredIds.size / totalStudents) * 100) : 0,
      overdue: a.due_date < today && coveredIds.size < totalStudents,
    };
  });

  const perGroup = groups.map((g) => {
    const members = groupMembers[g.id];
    const detail = subs
      .filter((s) => s.group_id === g.id)
      .map((s) => {
        const a = assignments.find((x) => x.id === s.assignment_id);
        const confirmedN = confMap[s.id] || 0;
        return {
          submission_id: s.id,
          assignment: a ? a.title : '',
          status: s.status,
          confirmed: confirmedN,
          total: members.length,
          all_confirmed: members.length > 0 && confirmedN >= members.length,
        };
      });
    return { id: g.id, name: g.name, members, submissions: detail };
  });

  const perStudent = students.map((st) => {
    const mine = subs.filter((s) => coveredBy(s).some((m) => m.id === st.id));
    const overdueMissing = assignments.filter(
      (a) => a.due_date < today && !mine.some((s) => s.assignment_id === a.id)
    ).length;
    return {
      id: st.id, name: st.name, email: st.email,
      submitted: mine.length,
      confirmed: mine.filter((s) => s.status === 'confirmed' || s.status === 'graded').length,
      graded: mine.filter((s) => s.status === 'graded').length,
      overdue_missing: overdueMissing,
    };
  });

  const overdue = assignments
    .filter((a) => a.due_date < today)
    .map((a) => {
      const coveredIds = new Set();
      subs.filter((x) => x.assignment_id === a.id)
        .forEach((s) => coveredBy(s).forEach((m) => coveredIds.add(m.id)));
      return {
        id: a.id, title: a.title, subject: a.subject, due_date: a.due_date,
        missing: students.filter((st) => !coveredIds.has(st.id)).map((st) => st.name),
      };
    })
    .filter((o) => o.missing.length > 0);

  res.json({
    totals: {
      students: totalStudents,
      assignments: assignments.length,
      submissions: subs.length,
      graded: subs.filter((s) => s.status === 'graded').length,
      awaiting_confirmation: subs.filter((s) => s.status === 'submitted').length,
      awaiting_grading: subs.filter((s) => s.status === 'confirmed').length,
      reopened: subs.filter((s) => s.status === 'reopened').length,
    },
    perAssignment,
    perGroup,
    perStudent,
    overdue,
  });
});

module.exports = router;
