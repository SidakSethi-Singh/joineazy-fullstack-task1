// API client — talks to the Express backend.
// Local dev: Vite proxies /api -> http://localhost:4000 (see vite.config.ts).
// Production (Vercel): set VITE_API_URL to the deployed backend URL.
const BASE = (import.meta.env.VITE_API_URL as string) || '';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

export interface Assignment {
  id: number;
  title: string;
  subject: string;
  description: string;
  due_date: string;
  max_marks: number;
  created_by: number;
  created_by_name?: string;
}

export interface GroupMember {
  id: number;
  name: string;
  email?: string;
}

export interface Group {
  id: number;
  name: string;
  created_by: number;
  members: GroupMember[];
}

export type SubmissionStatus = 'submitted' | 'confirmed' | 'graded' | 'reopened';

export interface Submission {
  id: number;
  assignment_id: number;
  assignment_title: string;
  subject: string;
  due_date: string;
  max_marks: number;
  group_id: number | null;
  group_name: string | null;
  submitted_by: number;
  submitted_by_name: string;
  content: string;
  onedrive_link: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  confirmed_by: GroupMember[];
  group_members: GroupMember[];
  confirmed_count: number;
  member_count: number;
  all_confirmed: boolean;
  pending_confirmation: GroupMember[];
}

export interface Analytics {
  totals: {
    students: number;
    assignments: number;
    submissions: number;
    graded: number;
    awaiting_confirmation: number;
    awaiting_grading: number;
    reopened: number;
  };
  perAssignment: {
    id: number; title: string; subject: string; due_date: string; max_marks: number;
    submissions: number; confirmed: number; graded: number; students_covered: number;
    rate: number; overdue: boolean;
  }[];
  perGroup: {
    id: number; name: string; members: GroupMember[];
    submissions: { submission_id: number; assignment: string; status: string; confirmed: number; total: number; all_confirmed: boolean }[];
  }[];
  perStudent: {
    id: number; name: string; email: string;
    submitted: number; confirmed: number; graded: number; overdue_missing: number;
  }[];
  overdue: { id: number; title: string; subject: string; due_date: string; missing: string[] }[];
}

function getToken() {
  return localStorage.getItem('joineazy_token') || '';
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  students: () => api<GroupMember[]>('/api/auth/students'),
};

export const assignmentsApi = {
  list: () => api<Assignment[]>('/api/assignments'),
  create: (a: Partial<Assignment>) =>
    api<Assignment>('/api/assignments', { method: 'POST', body: JSON.stringify(a) }),
  update: (id: number, a: Partial<Assignment>) =>
    api<Assignment>(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify(a) }),
  remove: (id: number) => api<{ ok: boolean }>(`/api/assignments/${id}`, { method: 'DELETE' }),
};

export const groupsApi = {
  list: () => api<Group[]>('/api/groups'),
  create: (name: string, member_ids: number[]) =>
    api<Group>('/api/groups', { method: 'POST', body: JSON.stringify({ name, member_ids }) }),
  addMember: (id: number, student_id: number) =>
    api<Group>(`/api/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ student_id }) }),
  removeMember: (id: number, studentId: number) =>
    api<Group>(`/api/groups/${id}/members/${studentId}`, { method: 'DELETE' }),
  remove: (id: number) => api<{ ok: boolean }>(`/api/groups/${id}`, { method: 'DELETE' }),
};

export const submissionsApi = {
  list: (assignmentId?: number) =>
    api<Submission[]>(assignmentId ? `/api/submissions?assignmentId=${assignmentId}` : '/api/submissions'),
  submit: (assignmentId: number, groupId: number | null, content: string, onedriveLink: string) =>
    api<Submission>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, groupId, content, onedriveLink }),
    }),
  confirm: (id: number) => api<Submission>(`/api/submissions/${id}/confirm`, { method: 'POST' }),
  resubmit: (id: number, content: string, onedriveLink: string) =>
    api<Submission>(`/api/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content, onedriveLink }),
    }),
  grade: (id: number, grade: number, feedback: string) =>
    api<Submission>(`/api/submissions/${id}/grade`, {
      method: 'POST',
      body: JSON.stringify({ grade, feedback }),
    }),
  reopen: (id: number, feedback: string) =>
    api<Submission>(`/api/submissions/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),
};

export const analyticsApi = {
  overview: () => api<Analytics>('/api/analytics/overview'),
};
