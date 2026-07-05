import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error";
}

const ToastContext = createContext<{
  show: (message: string, kind?: "success" | "error") => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: "success" | "error" = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rise-in flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-xl dark:bg-raised dark:text-ink"
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={17} className="shrink-0 text-[#43d492]" />
            ) : (
              <XCircle size={17} className="shrink-0 text-[#fb8a5c]" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
