"use client";

/**
 * Système de toast + dialogue de confirmation pour l'espace admin.
 *
 * Exports :
 *   ToastProvider    — à placer autour de la page admin (wraps children)
 *   useToast()       — { success, error, warning, info }
 *   useConfirm()     — confirmFn(message, opts?) → Promise<boolean>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ToastKind = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
}

interface ConfirmState {
  open: boolean;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
}

// ── Contexts ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastApi | null>(null);
const ConfirmCtx = createContext<((msg: string, opts?: ConfirmOpts) => Promise<boolean>) | null>(null);

export interface ConfirmOpts {
  confirmLabel?: string;
  danger?: boolean;
}

// ── Toast styles ──────────────────────────────────────────────────────────────

const STYLES: Record<ToastKind, { bg: string; border: string; text: string; icon: React.FC<{ className?: string }> }> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    icon: CheckCircle2,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: XCircle,
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: Info,
  },
};

const DURATION: Record<ToastKind, number> = {
  success: 3000,
  error: 5000,
  warning: 4500,
  info: 3500,
};

// ── ToastContainer ─────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const s = STYLES[t.kind];
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-md text-sm font-medium ${s.bg} ${s.border} ${s.text}`}
            >
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => onDismiss(t.id)}
                className="opacity-50 hover:opacity-100 transition shrink-0 mt-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({ state, onResolve }: { state: ConfirmState; onResolve: (ok: boolean) => void }) {
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <p className="text-sm text-black/80 leading-relaxed mb-5">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onResolve(false)}
            className="px-4 py-2 text-sm rounded-lg border border-black/10 hover:bg-black/5 transition font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => onResolve(true)}
            className={`px-4 py-2 text-sm rounded-lg font-semibold transition text-white ${
              state.danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-black/80"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    message: "",
    confirmLabel: "Confirmer",
    danger: false,
    resolve: null,
  });
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => dismiss(id), DURATION[kind]);
  }, [dismiss]);

  const toast: ToastApi = {
    success: (msg) => push("success", msg),
    error: (msg) => push("error", msg),
    warning: (msg) => push("warning", msg),
    info: (msg) => push("info", msg),
  };

  const confirmFn = useCallback(
    (message: string, opts: ConfirmOpts = {}): Promise<boolean> =>
      new Promise((resolve) => {
        setConfirm({
          open: true,
          message,
          confirmLabel: opts.confirmLabel ?? "Confirmer",
          danger: opts.danger ?? false,
          resolve,
        });
      }),
    []
  );

  const handleConfirmResolve = (ok: boolean) => {
    confirm.resolve?.(ok);
    setConfirm((s) => ({ ...s, open: false, resolve: null }));
  };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirmFn}>
        {children}
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        <ConfirmDialog state={confirm} onResolve={handleConfirmResolve} />
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function useConfirm(): (msg: string, opts?: ConfirmOpts) => Promise<boolean> {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ToastProvider>");
  return ctx;
}
