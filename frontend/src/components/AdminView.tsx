import { useEffect, useMemo, useState } from 'react';
import {
  assignmentsApi, submissionsApi, analyticsApi,
  type Analytics, type Assignment, type Submission,
} from '../lib/api';
import { ConfirmDialog, Modal, StatCard, StatusBadge, btnPrimary, btnSecondary, inputCls, useToast } from './ui';

type Tab = 'overview' | 'assignments' | 'submissions' | 'analytics';

export default function AdminView() {
  const { toast, el } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [a, s, an] = await Promise.all([
        assignmentsApi.list(),
        submissionsApi.list(),
        analyticsApi.overview(),
      ]);
      setAssignments(a);
      setSubs(s);
      setAnalytics(an);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'analytics', label: 'Analytics' },
  ];

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      {el}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'bg-[#007aff] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && analytics && <Overview analytics={analytics} subs={subs} />}
      {tab === 'assignments' && <AssignmentManager assignments={assignments} onDone={load} toast={toast} />}
      {tab === 'submissions' && <SubmissionsPanel assignments={assignments} subs={subs} onDone={load} toast={toast} />}
      {tab === 'analytics' && analytics && <AnalyticsPanel analytics={analytics} />}
    </div>
  );
}

function Overview({ analytics, subs }: { analytics: Analytics; subs: Submission[] }) {
  const t = analytics.totals;
  const recent = [...subs].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total assignments" value={t.assignments} />
        <StatCard label="Submissions received" value={t.submissions} />
        <StatCard label="Awaiting grading" value={t.awaiting_grading} sub={`${t.awaiting_confirmation} still awaiting confirmation`} />
        <StatCard label="Graded" value={t.graded} />
      </div>
      <div className="mac-window p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Recent submissions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No submissions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{s.submitted_by_name}</span>
                  {s.group_name ? ` · ${s.group_name}` : ''} — {s.assignment_title}
                </span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AssignmentManager({ assignments, onDone, toast }: {
  assignments: Assignment[];
  onDone: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [form, setForm] = useState({ title: '', subject: '', description: '', due_date: '', max_marks: '' });
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(a: Assignment) {
    setEditing(a);
    setForm({ title: a.title, subject: a.subject, description: a.description, due_date: a.due_date.slice(0, 10), max_marks: String(a.max_marks) });
  }
  function resetForm() {
    setEditing(null);
    setForm({ title: '', subject: '', description: '', due_date: '', max_marks: '' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.subject || !form.description || !form.due_date || !form.max_marks) {
      toast('Fill in all fields.');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, max_marks: Number(form.max_marks) };
      if (editing) {
        await assignmentsApi.update(editing.id, payload);
        toast('Assignment updated.');
      } else {
        await assignmentsApi.create(payload);
        toast('Assignment created.');
      }
      resetForm();
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed');
    } finally { setBusy(false); }
  }

  async function doDelete() {
    if (!deleting) return;
    try {
      await assignmentsApi.remove(deleting.id);
      toast('Assignment deleted.');
      setDeleting(null);
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-3 mac-window p-4">
        <h2 className="font-semibold text-slate-900">{editing ? 'Edit assignment' : 'Create assignment'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className={inputCls} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <input className={inputCls} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <input className={inputCls} type="number" min={1} placeholder="Max marks" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} />
        </div>
        <textarea className={inputCls} rows={3} placeholder="Description / instructions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={busy}>{editing ? 'Save changes' : 'Create assignment'}</button>
          {editing && <button type="button" className={btnSecondary} onClick={resetForm}>Cancel</button>}
        </div>
      </form>

      <div className="overflow-x-auto mac-window p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Title</th>
              <th className="py-2 pr-2">Subject</th>
              <th className="py-2 pr-2">Due</th>
              <th className="py-2 pr-2">Marks</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2 pr-2 font-medium">{a.title}</td>
                <td className="py-2 pr-2">{a.subject}</td>
                <td className="py-2 pr-2">{a.due_date.slice(0, 10)}</td>
                <td className="py-2 pr-2">{a.max_marks}</td>
                <td className="py-2">
                  <button className="mr-3 text-[#007aff] hover:underline" onClick={() => startEdit(a)}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => setDeleting(a)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          message={`Delete "${deleting.title}"? Its submissions will be deleted too.`}
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function SubmissionsPanel({ assignments, subs, onDone, toast }: {
  assignments: Assignment[];
  subs: Submission[];
  onDone: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const [grading, setGrading] = useState<Submission | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? subs : subs.filter((s) => s.assignment_id === Number(filter))),
    [subs, filter]
  );

  async function reopen(s: Submission) {
    const feedback = window.prompt('Why does this need revision? (shown to the student)', s.feedback || '');
    if (feedback === null) return;
    try {
      await submissionsApi.reopen(s.id, feedback);
      toast('Sent back for revision.');
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reopen failed');
    }
  }

  return (
    <div className="mac-window p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-slate-900">Submissions</h2>
        <select className={inputCls + ' max-w-xs'} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All assignments</option>
          {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No submissions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">Student / Group</th>
                <th className="py-2 pr-2">Assignment</th>
                <th className="py-2 pr-2">Work</th>
                <th className="py-2 pr-2">Confirmed</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Grade</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b align-top">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{s.submitted_by_name}</div>
                    {s.group_name && <div className="text-xs text-slate-500">{s.group_name}</div>}
                  </td>
                  <td className="py-2 pr-2">{s.assignment_title}</td>
                  <td className="max-w-[220px] py-2 pr-2">
                    <div className="line-clamp-2">{s.content}</div>
                    {s.onedrive_link && (
                      <a className="break-all text-xs text-[#007aff] hover:underline" href={s.onedrive_link} target="_blank" rel="noreferrer">
                        OneDrive link
                      </a>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {s.confirmed_count}/{s.member_count}
                    {!s.all_confirmed && s.status === 'submitted' && (
                      <div className="text-xs text-slate-500">waiting: {s.pending_confirmation.map((m) => m.name).join(', ')}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2"><StatusBadge status={s.status} /></td>
                  <td className="py-2 pr-2">
                    {s.status === 'graded' ? `${s.grade} / ${s.max_marks}` : '—'}
                    {s.feedback && <div className="max-w-[160px] text-xs text-slate-500">{s.feedback}</div>}
                  </td>
                  <td className="py-2">
                    {s.status === 'confirmed' && (
                      <button className="mr-3 text-[#007aff] hover:underline" onClick={() => setGrading(s)}>Grade</button>
                    )}
                    {(s.status === 'confirmed' || s.status === 'graded') && (
                      <button className="text-red-600 hover:underline" onClick={() => reopen(s)}>Reopen</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {grading && <GradeModal submission={grading} onClose={() => setGrading(null)} onDone={onDone} toast={toast} />}
    </div>
  );
}

function GradeModal({ submission, onClose, onDone, toast }: {
  submission: Submission;
  onClose: () => void;
  onDone: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (grade === '' || Number(grade) < 0 || Number(grade) > submission.max_marks) {
      toast(`Marks must be between 0 and ${submission.max_marks}.`);
      return;
    }
    setBusy(true);
    try {
      await submissionsApi.grade(submission.id, Number(grade), feedback);
      toast('Graded — the student can see it now.');
      await onDone();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Grading failed');
    } finally { setBusy(false); }
  }

  return (
    <Modal title={`Grade — ${submission.submitted_by_name} (${submission.assignment_title})`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="rounded-lg bg-white/70 p-3 text-slate-700">{submission.content}</p>
        <div>
          <label className="mb-1 block font-medium">Marks (out of {submission.max_marks})</label>
          <input className={inputCls} type="number" min={0} max={submission.max_marks} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block font-medium">Feedback</label>
          <textarea className={inputCls} rows={3} placeholder="What was good, what to improve…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
        <button className={btnPrimary} onClick={save} disabled={busy}>Save grade</button>
      </div>
    </Modal>
  );
}

function AnalyticsPanel({ analytics }: { analytics: Analytics }) {
  return (
    <div className="space-y-6">
      <div className="mac-window p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Submission rate per assignment</h2>
        <div className="space-y-3">
          {analytics.perAssignment.map((a) => (
            <div key={a.id}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{a.title} <span className="text-slate-500">({a.subject})</span></span>
                <span>{a.students_covered}/{analytics.totals.students} students · {a.rate}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-[#007aff]" style={{ width: `${a.rate}%` }} />
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {a.submissions} submission(s) · {a.confirmed} confirmed · {a.graded} graded
                {a.overdue ? ' · overdue' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mac-window p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Group confirmation status</h2>
        {analytics.perGroup.map((g) => (
          <div key={g.id} className="mb-3 border-b border-slate-100 pb-3 last:border-0">
            <div className="font-medium">{g.name} <span className="text-sm font-normal text-slate-500">({g.members.map((m) => m.name).join(', ')})</span></div>
            {g.submissions.length === 0 ? (
              <p className="text-sm text-slate-500">No submissions yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {g.submissions.map((s) => (
                  <li key={s.submission_id} className="flex justify-between gap-2">
                    <span>{s.assignment}</span>
                    <span>{s.status === 'graded' ? 'Graded' : s.all_confirmed ? 'All confirmed' : `${s.confirmed}/${s.total} confirmed`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto mac-window p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Per-student status</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Student</th>
              <th className="py-2 pr-2">Submitted</th>
              <th className="py-2 pr-2">Confirmed</th>
              <th className="py-2 pr-2">Graded</th>
              <th className="py-2">Overdue missing</th>
            </tr>
          </thead>
          <tbody>
            {analytics.perStudent.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2 pr-2 font-medium">{s.name}</td>
                <td className="py-2 pr-2">{s.submitted}</td>
                <td className="py-2 pr-2">{s.confirmed}</td>
                <td className="py-2 pr-2">{s.graded}</td>
                <td className={`py-2 ${s.overdue_missing > 0 ? 'font-medium text-red-600' : ''}`}>{s.overdue_missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mac-window p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Overdue — students who have not submitted</h2>
        {analytics.overdue.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing overdue. 🎉</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {analytics.overdue.map((o) => (
              <li key={o.id}>
                <span className="font-medium">{o.title}</span> (due {o.due_date}) — missing: {o.missing.join(', ')}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
