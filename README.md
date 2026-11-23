# Joineazy — Full Stack Task 1: Student, Group & Assignment Management System

A full-stack assignment platform for Joineazy's Full Stack Intern Round 1.
Students form groups, submit assignments with OneDrive links, and confirm
submissions in **two steps** (submit → confirm). Professors post assignments,
track group/student confirmations, grade work, and see analytics.

Built by **Sidak Singh** — B.Tech CSE (2028), UIT, Himachal Pradesh University.

## Features

- **JWT login** — professors and students; every demo account logs in with one tap.
- **Students**
  - Dashboard stats (pending / submitted / graded / overdue) + "Due soon" list
  - Search, filter by status/subject, sort by due date
  - Submit work with a text answer + OneDrive link, as an individual or as a group
  - **Two-step verification:** after submitting, every group member must confirm
    the submission before a professor can grade it (the submitter confirms
    automatically by submitting)
  - Grades + professor feedback; resubmit when a submission is reopened
- **Professors**
  - Create / edit / delete assignments
  - Submissions table with confirmation progress (x/y members confirmed)
  - Grade with marks + feedback; reopen for revision
  - **Analytics:** submission rate per assignment, confirmation status per group,
    per-student status, overdue students
- **Groups** — students create groups, add/remove members
- **Data isolation** — students only ever see their own submissions and groups

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL 16 |
| Auth | JWT (bcrypt password hashing) |
| Dev / test | Docker Compose, pg-mem (in-memory Postgres for API tests) |

## How to run

### Option A — Docker (recommended for reviewers)

```bash
docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:4000/api/health
- The backend seeds the demo data automatically on first start.

### Option B — Local dev

```bash
# 1. Start PostgreSQL 16 and create the database
createdb joineazy   # user/password joineazy (see backend/.env.example)

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run seed        # creates tables + demo data (safe to re-run with --force)
npm run dev         # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173 (API is proxied to :4000)
```

### API tests (no Postgres needed)

```bash
cd backend
npm install
node test-api.js    # 24 checks, runs against in-memory Postgres (USE_PG_MEM=1)
```

## Demo accounts

Every account uses password **`password123`**.

| Name | Role | Email |
|---|---|---|
| Prof. Anita Sharma | Professor | anita.sharma@joineazy.in |
| Prof. Rahul Verma | Professor | rahul.verma@joineazy.in |
| Aarav Mehta | Student | aarav.mehta@joineazy.in |
| Diya Kapoor | Student | diya.kapoor@joineazy.in |
| Arjun Singh | Student | arjun.singh@joineazy.in |
| Ananya Iyer | Student | ananya.iyer@joineazy.in |
| Kabir Malhotra | Student | kabir.malhotra@joineazy.in |

Seed data: 5 assignments (1 overdue, 1 due today, 3 upcoming), 2 groups
(Group Alpha: Aarav, Diya, Arjun · Group Beta: Ananya, Kabir), and 5
submissions in mixed states (graded, confirmed, awaiting confirmation, reopened).

## API endpoints

| Method | Endpoint | Role | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{email, password}` → JWT + user |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/auth/students` | any | Student list (group picker) |
| GET | `/api/assignments` | any | List assignments |
| POST | `/api/assignments` | admin | Create assignment |
| PUT | `/api/assignments/:id` | admin | Edit assignment |
| DELETE | `/api/assignments/:id` | admin | Delete assignment |
| GET | `/api/groups` | any | Own groups (student) / all (admin) |
| POST | `/api/groups` | student | Create group (+ members) |
| POST | `/api/groups/:id/members` | member | Add a member |
| DELETE | `/api/groups/:id/members/:studentId` | member | Remove a member |
| DELETE | `/api/groups/:id` | creator/admin | Delete group |
| GET | `/api/submissions` | any | Own/group submissions (student) / all (admin); `?assignmentId=` filters |
| POST | `/api/submissions` | student | **Step 1** — submit (individual or group, with OneDrive link) |
| POST | `/api/submissions/:id/confirm` | member | **Step 2** — confirm; status becomes `confirmed` when all members confirm |
| PUT | `/api/submissions/:id` | member | Resubmit after reopen (confirmations reset) |
| POST | `/api/submissions/:id/grade` | admin | Grade a `confirmed` submission (marks + feedback) |
| POST | `/api/submissions/:id/reopen` | admin | Send back for revision |
| GET | `/api/analytics/overview` | admin | Rates, group confirmation, per-student, overdue |

Submission status flow:

```
submit ──► submitted ──► confirmed ──► graded
              ▲  (all members confirm)      │
              └──── reopened ◄──────────────┘
                    (resubmit → submitted)
```

## ER diagram

```
users ──< assignments        (created_by)
users ──< groups             (created_by)
users >──< group_members     (group_id, student_id)
groups ──< submissions       (group_id, nullable = individual)
assignments ──< submissions  (assignment_id)
users ──< submissions        (submitted_by, graded_by)
submissions >──< submission_confirmations (submission_id, student_id)

users         (id, name, email UNIQUE, password_hash, role)
assignments   (id, title, subject, description, due_date, max_marks, created_by)
groups        (id, name, created_by)
group_members (group_id, student_id)          PK (group_id, student_id)
submissions   (id, assignment_id, group_id NULL, submitted_by, content,
               onedrive_link, status, submitted_at, grade, feedback,
               graded_by, graded_at)
submission_confirmations (submission_id, student_id, confirmed_at)
               PK (submission_id, student_id)
```

## Architecture notes

- **One repo, two deployables:** `frontend/` is a static Vite build, `backend/`
  is a stateless Express API. The frontend never talks to the database; every
  request goes through the API with a JWT.
- **Why two-step confirmation:** a group submission only becomes gradable when
  every member has confirmed it, so nobody's name goes on work they never saw.
  The submitter confirms implicitly by submitting; the other members confirm
  from the assignment detail view. Professors see the live x/y progress.
- **Why rules, not just trust:** grading is blocked server-side until status is
  `confirmed` — the frontend cannot bypass it.
- **Data isolation** is enforced in SQL (`WHERE submitted_by = $1 OR group_id IN
  (SELECT …)`), not just by hiding UI elements.

## Project structure

```
joineazy-fullstack-app/
├── docker-compose.yml      # postgres + backend + frontend
├── frontend/               # React + Vite + Tailwind
│   ├── src/lib/api.ts      # typed API client
│   ├── src/components/     # Login, StudentView, AdminView, ui
│   └── Dockerfile + nginx.conf
├── backend/                # Node.js + Express + PostgreSQL
│   ├── src/server.js       # entrypoint
│   ├── src/db.js           # pg pool (USE_PG_MEM=1 for in-memory tests)
│   ├── src/auth.js         # JWT helpers + middleware
│   ├── src/seed.js         # schema + demo data
│   ├── src/routes/         # auth, assignments, groups, submissions, analytics
│   └── test-api.js         # 24 API checks (in-memory Postgres)
└── README.md
```
