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
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
      {msg}
    </div>
  ) : null;
  return { toast, el };
}

/** macOS traffic-light window controls. Red closes when onClose is given. */
export function TrafficLights({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        disabled={!onClose}
        className="h-3 w-3 rounded-full border border-black/10 bg-[#ff5f57] hover:brightness-95 disabled:cursor-default"
      />
      <span className="h-3 w-3 rounded-full border border-black/10 bg-[#febc2e]" />
      <span className="h-3 w-3 rounded-full border border-black/10 bg-[#28c840]" />
    </div>
  );
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
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-black/5 ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="mac-window p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white/90 p-5 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mac-titlebar mb-4">
          <TrafficLights onClose={onClose} />
          <h2 className="ml-1 text-base font-semibold text-slate-900">{title}</h2>
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
        <button onClick={onCancel} className="rounded-full border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-medium hover:bg-white">
          Cancel
        </button>
        <button onClick={onConfirm} className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Delete
        </button>
      </div>
    </Modal>
  );
}

export const inputCls =
  'w-full rounded-lg border border-slate-300/80 bg-white/80 px-3 py-2 text-sm shadow-inner focus:border-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30';
export const btnPrimary =
  'rounded-full bg-[#007aff] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0066d6] disabled:opacity-50';
export const btnSecondary =
  'rounded-full border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur hover:bg-white disabled:opacity-50';
