import { useState } from 'react';
import { authApi, type User } from '../lib/api';
import { btnPrimary, inputCls } from './ui';

const DEMO_ACCOUNTS: { name: string; email: string; role: string }[] = [
  { name: 'Prof. Anita Sharma', email: 'anita.sharma@joineazy.in', role: 'Professor' },
  { name: 'Prof. Rahul Verma', email: 'rahul.verma@joineazy.in', role: 'Professor' },
  { name: 'Aarav Mehta', email: 'aarav.mehta@joineazy.in', role: 'Student' },
  { name: 'Diya Kapoor', email: 'diya.kapoor@joineazy.in', role: 'Student' },
  { name: 'Arjun Singh', email: 'arjun.singh@joineazy.in', role: 'Student' },
  { name: 'Ananya Iyer', email: 'ananya.iyer@joineazy.in', role: 'Student' },
  { name: 'Kabir Malhotra', email: 'kabir.malhotra@joineazy.in', role: 'Student' },
];

export default function Login({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(e?: React.FormEvent, presetEmail?: string) {
    e?.preventDefault();
    const em = presetEmail ?? email;
    if (!em || !password) { setError('Email and password are required.'); return; }
    setBusy(true);
    setError('');
    try {
      const { token, user } = await authApi.login(em, password);
      localStorage.setItem('joineazy_token', token);
      localStorage.setItem('joineazy_user', JSON.stringify(user));
      onLogin(user, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Joineazy</h1>
          <p className="mt-1 text-sm text-slate-600">Student, Group &amp; Assignment Management System</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Log in</h2>
          <p className="mb-4 text-sm text-slate-500">
            Tap a demo account below to log in instantly. Every account uses password{' '}
            <code className="rounded bg-slate-100 px-1">password123</code>.
          </p>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => doLogin(undefined, a.email)}
                disabled={busy}
                className="rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
              >
                <div className="text-sm font-medium text-slate-900">{a.name}</div>
                <div className="text-xs text-slate-500">
                  {a.role} · {a.email}
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={(e) => doLogin(e)} className="space-y-3 border-t border-slate-100 pt-4">
            <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className={btnPrimary + ' w-full'} disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
