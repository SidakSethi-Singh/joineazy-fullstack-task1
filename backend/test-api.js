/* API smoke test — run while the server is up: node test-api.js */
const BASE = 'http://localhost:4000/api';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra); }
}
async function req(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
async function login(email) {
  const r = await req('POST', '/auth/login', null, { email, password: 'password123' });
  check('login ' + email, r.status === 200 && !!r.data.token, JSON.stringify(r.data));
  return r.data.token;
}
(async () => {
  const admin = await login('anita.sharma@joineazy.in');
  const aarav = await login('aarav.mehta@joineazy.in');
  const diya = await login('diya.kapoor@joineazy.in');
  const arjun = await login('arjun.singh@joineazy.in');

  // wrong password rejected
  const bad = await req('POST', '/auth/login', null, { email: 'aarav.mehta@joineazy.in', password: 'nope' });
  check('wrong password -> 401', bad.status === 401);
  // no token rejected
  const anon = await req('GET', '/assignments');
  check('no token -> 401', anon.status === 401);

  // assignments visible to student
  const asg = await req('GET', '/assignments', aarav);
  check('student lists 5 assignments', asg.status === 200 && asg.data.length === 5, JSON.stringify(asg.data.length));

  // student cannot create assignment
  const forb = await req('POST', '/assignments', aarav, { title: 'x', subject: 'x', description: 'x', due_date: '2026-12-01', max_marks: 10 });
  check('student create assignment -> 403', forb.status === 403);

  // admin creates assignment
  const created = await req('POST', '/assignments', admin, { title: 'Test Assignment', subject: 'Test', description: 'created by smoke test', due_date: '2026-12-05', max_marks: 10 });
  check('admin creates assignment', created.status === 201 && created.data.id, JSON.stringify(created.data));
  const newAsgId = created.data.id;

  // groups for Aarav (Group Alpha)
  const groups = await req('GET', '/groups', aarav);
  check('aarav sees Group Alpha', groups.status === 200 && groups.data.length === 1 && groups.data[0].members.length === 3, JSON.stringify(groups.data));

  // Aarav submits CS assignment (id 2) as Group Alpha — step 1
  const sub = await req('POST', '/submissions', aarav, { assignmentId: 2, groupId: 1, content: 'Group Alpha REST API solution.', onedriveLink: 'https://1drv.ms/w/s!alpha-cs-api' });
  check('group submit step 1 -> submitted', sub.status === 201 && sub.data.status === 'submitted', JSON.stringify(sub.data));
  const subId = sub.data.id;

  // duplicate submit blocked
  const dup = await req('POST', '/submissions', diya, { assignmentId: 2, groupId: 1, content: 'dup', onedriveLink: '' });
  check('duplicate group submit -> 409', dup.status === 409);

  // admin cannot grade before confirmation
  const early = await req('POST', `/submissions/${subId}/grade`, admin, { grade: 25, feedback: 'too early' });
  check('grade before confirm -> 400', early.status === 400, JSON.stringify(early.data));

  // step 2: Diya confirms (2/3), Arjun confirms (3/3 -> confirmed)
  const c1 = await req('POST', `/submissions/${subId}/confirm`, diya);
  check('diya confirms, still submitted', c1.status === 200 && c1.data.status === 'submitted' && c1.data.confirmed_count === 2, JSON.stringify(c1.data));
  const c2 = await req('POST', `/submissions/${subId}/confirm`, arjun);
  check('arjun confirms -> all confirmed', c2.status === 200 && c2.data.status === 'confirmed' && c2.data.all_confirmed, JSON.stringify(c2.data));

  // admin grades
  const g = await req('POST', `/submissions/${subId}/grade`, admin, { grade: 27, feedback: 'Clean routes, good error handling.' });
  check('admin grades -> graded 27', g.status === 200 && g.data.status === 'graded' && g.data.grade === 27, JSON.stringify(g.data));

  // admin reopens the graded submission; student resubmits (confirmations reset)
  const re = await req('POST', `/submissions/${subId}/reopen`, admin, { feedback: 'Add auth middleware and resubmit.' });
  check('admin reopens', re.status === 200 && re.data.status === 'reopened', JSON.stringify(re.data));
  const resub = await req('PUT', `/submissions/${subId}`, aarav, { content: 'Resubmitted with auth middleware.', onedriveLink: 'https://1drv.ms/w/s!alpha-cs-api-v2' });
  check('student resubmits -> submitted, only resubmitter confirmed', resub.status === 200 && resub.data.status === 'submitted' && resub.data.confirmed_count === 1, JSON.stringify(resub.data));

  // student creates a new group and adds a member
  const ng = await req('POST', '/groups', aarav, { name: 'Group Gamma', member_ids: [4] });
  check('student creates group', ng.status === 201 && ng.data.members.length === 2, JSON.stringify(ng.data));
  const add = await req('POST', `/groups/${ng.data.id}/members`, aarav, { student_id: 5 });
  check('add member to group', add.status === 200 && add.data.members.length === 3, JSON.stringify(add.data));

  // analytics as admin
  const an = await req('GET', '/analytics/overview', admin);
  check('analytics overview', an.status === 200 && an.data.totals.students === 5 && an.data.perAssignment.length === 6 && an.data.perGroup.length === 3, JSON.stringify(an.data && an.data.totals));
  check('analytics has overdue list', an.status === 200 && Array.isArray(an.data.overdue));

  // analytics forbidden for student
  const anF = await req('GET', '/analytics/overview', aarav);
  check('student analytics -> 403', anF.status === 403);

  // admin deletes the test assignment
  const del = await req('DELETE', `/assignments/${newAsgId}`, admin);
  check('admin deletes assignment', del.status === 200);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
