/* Seed script: creates the schema and loads demo data.
   Run: npm run seed   (needs DATABASE_URL, see .env.example)
   Safe to re-run — it drops and recreates the tables. */
const bcrypt = require('bcryptjs');
const pool = require('./db');

const PASSWORD = 'password123';

const USERS = [
  // admins (professors)
  { name: 'Prof. Anita Sharma', email: 'anita.sharma@joineazy.in', role: 'admin' },
  { name: 'Prof. Rahul Verma', email: 'rahul.verma@joineazy.in', role: 'admin' },
  // students
  { name: 'Aarav Mehta', email: 'aarav.mehta@joineazy.in', role: 'student' },
  { name: 'Diya Kapoor', email: 'diya.kapoor@joineazy.in', role: 'student' },
  { name: 'Arjun Singh', email: 'arjun.singh@joineazy.in', role: 'student' },
  { name: 'Ananya Iyer', email: 'ananya.iyer@joineazy.in', role: 'student' },
  { name: 'Kabir Malhotra', email: 'kabir.malhotra@joineazy.in', role: 'student' },
];

// Due dates are relative to the 23 Nov 2026 demo week: 1 overdue, 1 due today, 3 upcoming.
const ASSIGNMENTS = [
  { title: 'Quadratic Equations Problem Set', subject: 'Mathematics', description: 'Solve all 10 problems on quadratic equations: factorisation, completing the square and the quadratic formula. Show full working for each question.', due_date: '2026-11-20', max_marks: 20, created_by: 1 },
  { title: 'Build a REST API with Node.js', subject: 'Computer Science', description: 'Build a small REST API with Node.js and Express: CRUD endpoints for a todo list, JSON responses, and proper HTTP status codes. Submit your GitHub repo link and a short README.', due_date: '2026-11-23', max_marks: 30, created_by: 2 },
  { title: "Newton's Laws Lab Report", subject: 'Physics', description: 'Write a lab report on the verification of Newton\'s second law using the trolley experiment. Include aim, apparatus, observations table, graph and conclusion.', due_date: '2026-11-25', max_marks: 25, created_by: 1 },
  { title: 'Essay: The Future of AI in Education', subject: 'English', description: 'Write a 600–800 word essay on how AI is changing education. Give real examples, discuss one risk honestly, and end with your own opinion.', due_date: '2026-11-27', max_marks: 15, created_by: 2 },
  { title: 'ER Diagram & Normalization Exercise', subject: 'DBMS', description: 'Draw an ER diagram for a library management system (books, members, loans) and normalize the tables up to 3NF. Explain each normal form in one line.', due_date: '2026-11-30', max_marks: 20, created_by: 1 },
];

const GROUPS = [
  { name: 'Group Alpha', created_by: 3, members: [3, 4, 5] }, // Aarav, Diya, Arjun
  { name: 'Group Beta', created_by: 6, members: [6, 7] }, // Ananya, Kabir
];

// status flow: submitted (step 1) -> confirmed (step 2, all members confirmed) -> graded
//              reopened -> resubmit -> submitted ...
const SUBMISSIONS = [
  // Maths (overdue): Group Alpha submitted, 2 of 3 members confirmed
  { assignment_id: 1, group_id: 1, submitted_by: 3, content: 'Solved all 10 problems. Working shown step by step in the attached OneDrive document.', onedrive_link: 'https://1drv.ms/w/s!alpha-maths-quadratic', status: 'submitted', submitted_at: '2026-11-19 10:15:00', grade: null, feedback: null, confirmations: [3, 4] },
  // CS (due today): Ananya, individual, confirmed — awaiting grading
  { assignment_id: 2, group_id: null, submitted_by: 6, content: 'REST API built with Express. All 5 CRUD endpoints working, tested with Postman.', onedrive_link: 'https://1drv.ms/w/s!ananya-rest-api', status: 'confirmed', submitted_at: '2026-11-22 18:40:00', grade: null, feedback: null, confirmations: [6] },
  // Physics: Group Beta submitted, all confirmed — awaiting grading
  { assignment_id: 3, group_id: 2, submitted_by: 6, content: 'Lab report with observations table and acceleration graph. Conclusion: F = ma verified within 4% error.', onedrive_link: 'https://1drv.ms/w/s!beta-physics-lab', status: 'confirmed', submitted_at: '2026-11-22 09:05:00', grade: null, feedback: null, confirmations: [6, 7] },
  // English: Aarav, individual, graded with feedback
  { assignment_id: 4, group_id: null, submitted_by: 3, content: 'Essay on AI in education (720 words) with examples from classroom tools and one honest risk discussed.', onedrive_link: 'https://1drv.ms/w/s!aarav-ai-essay', status: 'graded', submitted_at: '2026-11-21 14:20:00', grade: 12, feedback: 'Well argued with good real examples. Work on tighter paragraph openings.', confirmations: [3] },
  // DBMS: Arjun, individual, reopened for revision
  { assignment_id: 5, group_id: null, submitted_by: 5, content: 'ER diagram for library system and tables normalized to 3NF.', onedrive_link: 'https://1drv.ms/w/s!arjun-er-diagram', status: 'reopened', submitted_at: '2026-11-21 11:00:00', grade: null, feedback: 'Good start, but the many-to-many between Books and Members is not resolved. Fix the loan table and resubmit.', confirmations: [5] },
];

async function main() {
  const force = process.argv.includes('--force');
  // Idempotent: if the database is already seeded, do nothing (unless --force).
  // This makes `node src/seed.js` safe as a container start command.
  const hasTables = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
  ).catch(() => ({ rows: [] }));
  if (hasTables.rows.length && !force) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n > 0) {
      console.log('Database already seeded — skipping. Use --force to re-seed.');
      return;
    }
  }

  await pool.query(`
    DROP TABLE IF EXISTS submission_confirmations;
    DROP TABLE IF EXISTS submissions;
    DROP TABLE IF EXISTS group_members;
    DROP TABLE IF EXISTS groups;
    DROP TABLE IF EXISTS assignments;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE assignments (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date DATE NOT NULL,
      max_marks INT NOT NULL,
      created_by INT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by INT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE group_members (
      group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, student_id)
    );

    CREATE TABLE submissions (
      id SERIAL PRIMARY KEY,
      assignment_id INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      group_id INT REFERENCES groups(id) ON DELETE SET NULL,
      submitted_by INT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      onedrive_link TEXT,
      status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'confirmed', 'graded', 'reopened')),
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      grade INT,
      feedback TEXT,
      graded_by INT REFERENCES users(id),
      graded_at TIMESTAMPTZ
    );

    CREATE TABLE submission_confirmations (
      submission_id INT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      confirmed_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (submission_id, student_id)
    );
  `);

  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const u of USERS) {
    await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [u.name, u.email, hash, u.role]);
  }
  for (const a of ASSIGNMENTS) {
    await pool.query(
      'INSERT INTO assignments (title, subject, description, due_date, max_marks, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [a.title, a.subject, a.description, a.due_date, a.max_marks, a.created_by]
    );
  }
  for (const g of GROUPS) {
    const { rows } = await pool.query('INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id', [g.name, g.created_by]);
    for (const m of g.members) {
      await pool.query('INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)', [rows[0].id, m]);
    }
  }
  for (const s of SUBMISSIONS) {
    const { rows } = await pool.query(
      `INSERT INTO submissions (assignment_id, group_id, submitted_by, content, onedrive_link, status, submitted_at, grade, feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [s.assignment_id, s.group_id, s.submitted_by, s.content, s.onedrive_link, s.status, s.submitted_at, s.grade, s.feedback]
    );
    for (const c of s.confirmations) {
      await pool.query('INSERT INTO submission_confirmations (submission_id, student_id) VALUES ($1, $2)', [rows[0].id, c]);
    }
  }

  console.log('Seed complete: 7 users, 5 assignments, 2 groups, 5 submissions.');
  console.log('Demo password for every account: password123');
}

if (require.main === module) {
  main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = main;
