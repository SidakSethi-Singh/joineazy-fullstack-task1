import { useEffect, useState } from 'react';
import Login from './components/Login';
import StudentView from './components/StudentView';
import AdminView from './components/AdminView';
import type { User } from './lib/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('joineazy_user');
    const token = localStorage.getItem('joineazy_token');
    if (saved && token) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  function logout() {
    localStorage.removeItem('joineazy_token');
    localStorage.removeItem('joineazy_user');
    setUser(null);
  }

  if (!user) return <Login onLogin={(u) => setUser(u)} />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div>
            <div className="text-lg font-bold text-slate-900">Joineazy</div>
            <div className="text-xs text-slate-500">Assignment &amp; Review Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{user.role === 'admin' ? 'Professor' : 'Student'}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Switch user
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {user.role === 'admin' ? <AdminView /> : <StudentView user={user} />}
      </main>
    </div>
  );
}
