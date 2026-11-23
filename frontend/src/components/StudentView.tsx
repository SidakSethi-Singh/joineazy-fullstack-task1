import { useEffect, useMemo, useState } from 'react';
import {
  assignmentsApi, groupsApi, submissionsApi, authApi,
  type Assignment, type Group, type GroupMember, type Submission, type User,
} from '../lib/api';
import { Modal, StatCard, StatusBadge, btnPrimary, btnSecondary, inputCls, useToast } from './ui';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentView({ user }: { user: User }) {
  const { toast, el } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<GroupMember[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [a, s, g, st] = await Promise.all([
        assignmentsApi.list(),
        submissionsApi.list(),
        groupsApi.list(),
        authApi.students(),
      ]);
      setAssignments(a);
      setSubs(s);
      setGroups(g);
      setStudents(st);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const subFor = (assignmentId: number) =>
    subs.find((s) => s.assignment_id === assignmentId);

  const stats = useMemo(() => {
    const today = todayStr();
    let pending = 0, submitted = 0, graded = 0, overdue = 0;
    for (const a of assignments) {
      const s = subFor(a.id);
      if (!s) {
        pending++;
        if (a.due_date < today) overdue++;
      } else if (s.status === 'graded') graded++;
      else submitted++;
    }
    return { pending, submitted, graded, overdue };
  }, [assignments, subs]);

  const dueSoon = useMemo(
    () =>
      assignments
        .filter((a) => !subFor(a.id) && a.due_date >= todayStr())
        .sort((x, y) => x.due_date.localeCompare(y.due_date))
        .slice(0, 3),
    [assignments, subs]
  );

  const subjects = useMemo(() => [...new Set(assignments.map((a) => a.subject))], [assignments]);

  const filtered = assignments.filter((a) => {
    const s = subFor(a.id);
    const status = s ? s.status : a.due_date < todayStr() ? 'overdue' : 'not-started';
    if (search && !`${a.title} ${a.subject}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (subjectFilter !== 'all' && a.subject !== subjectFilter) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      {el}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Submitted" value={stats.submitted} sub="awaiting confirmation / grading" />
        <StatCard label="Graded" value={stats.graded} />
        <StatCard label="Overdue" value={stats.overdue} />
      </div>

      <div className="mac-window p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Due soon</h2>
          <button className={btnSecondary} onClick={() => setShowGroups(true)}>
            My Groups ({groups.length})
          </button>
        </div>
        {dueSoon.length === 0 ? (
          <p className="text-sm text-slate-500">No overdue assignments — nice!</p>
        ) : (
          <ul className="space-y-2">
            {dueSoon.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <button className="text-left font-medium text-[#007aff] hover:underline" onClick={() => setSelected(a)}>
                  {a.title}
                </button>
                <span className={a.due_date === todayStr() ? 'font-medium text-amber-600' : 'text-slate-500'}>
                  Due {a.due_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mac-window p-4">
        <h2 className="mb-3 font-semibold text-slate-900">My Assignments</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={inputCls + ' max-w-xs'} placeholder="Search assignments…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={inputCls + ' max-w-[180px]'} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="not-started">Not started</option>
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
            <option value="graded">Graded</option>
            <option value="reopened">Needs revision</option>
            <option value="overdue">Overdue</option>
          </select>
          <select className={inputCls + ' max-w-[180px]'} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="all">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">No assignments match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Title</th>
                  <th className="py-2 pr-2">Subject</th>
                  <th className="py-2 pr-2">Due</th>
                  <th className="py-2 pr-2">Marks</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const s = subFor(a.id);
                  const status = s ? s.status : a.due_date < todayStr() ? 'overdue' : 'not-started';
                  return (
                    <tr key={a.id} className="cursor-pointer border-b hover:bg-white/60" onClick={() => setSelected(a)}>
                      <td className="py-2 pr-2 font-medium text-[#007aff]">{a.title}</td>
                      <td className="py-2 pr-2">{a.subject}</td>
                      <td className={`py-2 pr-2 ${a.due_date < todayStr() && !s ? 'font-medium text-red-600' : a.due_date === todayStr() ? 'font-medium text-amber-600' : ''}`}>
                        {a.due_date}
                      </td>
                      <td className="py-2 pr-2">{a.max_marks}</td>
                      <td className="py-2"><StatusBadge status={status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <AssignmentDetail
          assignment={selected}
          submission={subFor(selected.id)}
          groups={groups}
          user={user}
          onClose={() => setSelected(null)}
          onDone={async () => { await load(); }}
          toast={toast}
        />
      )}
      {showGroups && (
        <GroupsModal
          groups={groups}
          students={students}
          user={user}
          onClose={() => setShowGroups(false)}
          onDone={async () => { await load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function AssignmentDetail({ assignment, submission, groups, user, onClose, onDone, toast }: {
  assignment: Assignment;
  submission?: Submission;
  groups: Group[];
  user: User;
  onClose: () => void;
  onDone: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [mode, setMode] = useState<'individual' | number>('individual');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const myPendingConfirm =
    submission && submission.status === 'submitted' &&
    submission.pending_confirmation.some((m) => m.id === user.id);

  async function submit() {
    if (!content.trim()) { toast('Write your answer first.'); return; }
    setBusy(true);
    try {
      await submissionsApi.submit(assignment.id, mode === 'individual' ? null : mode, content, link);
      toast('Submitted! Step 2: every member must confirm it.');
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Submit failed');
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!submission) return;
    setBusy(true);
    try {
      const s = await submissionsApi.confirm(submission.id);
      toast(s.status === 'confirmed' ? 'All members confirmed — sent for grading.' : 'Confirmed. Waiting for other members.');
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Confirm failed');
    } finally { setBusy(false); }
  }

  async function resubmit() {
    if (!submission || !content.trim()) { toast('Write your revised answer first.'); return; }
    setBusy(true);
    try {
      await submissionsApi.resubmit(submission.id, content, link);
      toast('Resubmitted! Members need to confirm it again.');
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Resubmit failed');
    } finally { setBusy(false); }
  }

  return (
    <Modal title={assignment.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white/70 px-2 py-0.5">{assignment.subject}</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5">Due {assignment.due_date}</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5">Max marks {assignment.max_marks}</span>
        </div>
        <p className="text-slate-700">{assignment.description}</p>

        {submission ? (
          <div className="mac-inner p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-900">My submission</span>
              <StatusBadge status={submission.status} />
            </div>
            <p className="text-slate-700">{submission.content}</p>
            {submission.onedrive_link && (
              <p className="mt-1 break-all">
                OneDrive: <a className="text-[#007aff] hover:underline" href={submission.onedrive_link} target="_blank" rel="noreferrer">{submission.onedrive_link}</a>
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Submitted by {submission.submitted_by_name}
              {submission.group_name ? ` for ${submission.group_name}` : ' (individual)'}
              {' · '}Confirmation: {submission.confirmed_count}/{submission.member_count} members
              {submission.pending_confirmation.length > 0 && (
                <> — waiting on {submission.pending_confirmation.map((m) => m.name).join(', ')}</>
              )}
            </p>
            {submission.status === 'graded' && (
              <div className="mt-3 rounded-lg bg-green-50 p-3">
                <div className="font-medium text-green-800">Marks: {submission.grade} / {submission.max_marks}</div>
                {submission.feedback && <p className="mt-1 text-green-900">Feedback: {submission.feedback}</p>}
              </div>
            )}
            {submission.status === 'reopened' && submission.feedback && (
              <div className="mt-3 rounded-lg bg-red-50 p-3">
                <div className="font-medium text-red-800">Professor asked for revision</div>
                <p className="mt-1 text-red-900">{submission.feedback}</p>
              </div>
            )}
            {myPendingConfirm && (
              <button className={btnPrimary + ' mt-3'} onClick={confirm} disabled={busy}>
                Step 2: Confirm this submission
              </button>
            )}
            {submission.status === 'reopened' && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <h3 className="font-medium text-slate-900">Resubmit revised work</h3>
                <textarea className={inputCls} rows={4} placeholder="Your revised answer…" value={content} onChange={(e) => setContent(e.target.value)} />
                <input className={inputCls} placeholder="OneDrive link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
                <button className={btnPrimary} onClick={resubmit} disabled={busy}>Resubmit</button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 mac-inner p-4">
            <h3 className="font-medium text-slate-900">Submit your work</h3>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" checked={mode === 'individual'} onChange={() => setMode('individual')} /> Individual
              </label>
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-1 text-sm">
                  <input type="radio" checked={mode === g.id} onChange={() => setMode(g.id)} /> {g.name}
                </label>
              ))}
            </div>
            <textarea className={inputCls} rows={4} placeholder="Write your answer here…" value={content} onChange={(e) => setContent(e.target.value)} />
            <input className={inputCls} placeholder="OneDrive link to your document (e.g. https://1drv.ms/...)" value={link} onChange={(e) => setLink(e.target.value)} />
            <p className="text-xs text-slate-500">
              Step 1 is submit. Step 2: every group member must confirm the submission before the professor can grade it.
            </p>
            <button className={btnPrimary} onClick={submit} disabled={busy}>Submit (Step 1)</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function GroupsModal({ groups, students, user, onClose, onDone, toast }: {
  groups: Group[];
  students: GroupMember[];
  user: User;
  onClose: () => void;
  onDone: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) { toast('Give the group a name.'); return; }
    setBusy(true);
    try {
      await groupsApi.create(name, picked);
      toast('Group created.');
      setName(''); setPicked([]);
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create group');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="My Groups" onClose={onClose}>
      <div className="space-y-4 text-sm">
        {groups.length === 0 && <p className="text-slate-500">You are not in any group yet. Create one below.</p>}
        {groups.map((g) => (
          <GroupCard key={g.id} group={g} students={students} user={user} onDone={onDone} toast={toast} />
        ))}
        <div className="space-y-2 mac-inner p-4">
          <h3 className="font-medium text-slate-900">Create a new group</h3>
          <input className={inputCls} placeholder="Group name (e.g. Group Gamma)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {students.filter((s) => s.id !== user.id).map((s) => (
              <label key={s.id} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1">
                <input
                  type="checkbox"
                  checked={picked.includes(s.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))}
                />
                {s.name}
              </label>
            ))}
          </div>
          <button className={btnPrimary} onClick={create} disabled={busy}>Create group</button>
        </div>
      </div>
    </Modal>
  );
}

function GroupCard({ group, students, user, onDone, toast }: {
  group: Group;
  students: GroupMember[];
  user: User;
  onDone: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [addId, setAddId] = useState('');
  const others = students.filter((s) => !group.members.some((m) => m.id === s.id));

  async function add() {
    if (!addId) return;
    try {
      await groupsApi.addMember(group.id, Number(addId));
      toast('Member added.');
      setAddId('');
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to add member');
    }
  }

  async function remove(studentId: number, studentName: string) {
    try {
      await groupsApi.removeMember(group.id, studentId);
      toast(`${studentName} removed.`);
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to remove member');
    }
  }

  return (
    <div className="mac-inner p-4">
      <div className="mb-2 font-medium text-slate-900">{group.name}</div>
      <ul className="space-y-1">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between">
            <span>{m.name}{m.id === user.id ? ' (you)' : ''}</span>
            {m.id !== user.id && (
              <button className="text-xs text-red-600 hover:underline" onClick={() => remove(m.id, m.name)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select className={inputCls} value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Add a member…</option>
            {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className={btnSecondary} onClick={add}>Add</button>
        </div>
      )}
    </div>
  );
}
