// apps/web/src/components/ui/Toast.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { X } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (toast: Omit<ToastMessage, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: Omit<ToastMessage, "id">) => {
    const id =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    setToasts((current) => [
      ...current.slice(-2),
      {
        id,
        ...message,
      },
    ]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <ToastStack toasts={toasts} setToasts={setToasts} />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastStack({
  toasts,
  setToasts,
}: {
  toasts: ToastMessage[];
  setToasts: Dispatch<SetStateAction<ToastMessage[]>>;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border bg-surface p-4 shadow-modal ${
            toast.variant === "error"
              ? "border-danger/20"
              : toast.variant === "warning"
              ? "border-warning/20"
              : "border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                toast.variant === "success"
                  ? "bg-success"
                  : toast.variant === "error"
                  ? "bg-danger"
                  : toast.variant === "warning"
                  ? "bg-warning"
                  : "bg-brand"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-sm text-text-2">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((current) =>
                  current.filter((entry) => entry.id !== toast.id),
                )
              }
              className="rounded-full p-1 text-text-3 transition hover:bg-surface-2 hover:text-text-2"
              aria-label="Dismiss toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

export function ToastViewport() {
  return null;
}
