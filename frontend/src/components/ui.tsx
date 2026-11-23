import { useEffect, useState, type ReactNode } from 'react';
import type { SubmissionStatus } from '../lib/api';

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = (m: string) => setMsg(m);
  const el = msg ? (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
      {msg}
    </div>
  ) : null;
  return { toast, el };
}

const STATUS_STYLE: Record<SubmissionStatus | 'not-started' | 'overdue', string> = {
  submitted: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  graded: 'bg-green-100 text-green-800',
  reopened: 'bg-red-100 text-red-800',
  'not-started': 'bg-slate-100 text-slate-600',
  overdue: 'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<SubmissionStatus | 'not-started' | 'overdue', string> = {
  submitted: 'Submitted — awaiting confirmation',
  confirmed: 'Confirmed — awaiting grading',
  graded: 'Graded',
  reopened: 'Needs revision',
  'not-started': 'Not started',
  overdue: 'Overdue',
};

export function StatusBadge({ status }: { status: SubmissionStatus | 'not-started' | 'overdue' }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title="Are you sure?" onClose={onCancel}>
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Delete
        </button>
      </div>
    </Modal>
  );
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
export const btnPrimary =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
export const btnSecondary =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50';
