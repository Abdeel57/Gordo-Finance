import { useEffect } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ——— Botón ———

type ButtonVariant = "primary" | "income" | "expense" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white active:bg-navy-2 dark:bg-raised dark:text-ink",
  income: "bg-income text-white active:bg-income-deep",
  expense: "bg-expense text-white active:bg-expense-deep",
  outline: "border border-line bg-card text-ink",
  ghost: "text-ink-soft",
  danger: "bg-expense-tint text-expense-text",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 gap-1.5 rounded-xl px-4 text-[13px]",
  md: "h-12 gap-2 rounded-2xl px-5 text-[15px]",
  lg: "h-14 gap-2 rounded-2xl px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        "pressable inline-flex select-none items-center justify-center font-semibold",
        "disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        full && "w-full",
        className
      )}
    />
  );
}

// ——— Tarjeta ———

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-line/60 bg-card p-5",
        "shadow-[0_1px_2px_rgba(13,20,44,0.05),0_10px_28px_-14px_rgba(13,20,44,0.14)]",
        className
      )}
    >
      {children}
    </div>
  );
}

// ——— Campos ———

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] text-ink",
        "placeholder:text-ink-faint focus:border-ink-faint focus:outline-none",
        className
      )}
    />
  );
}

// ——— Control segmentado ———

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-2xl border border-line/70 bg-card p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cx(
            "h-9 flex-1 rounded-xl text-[13px] font-semibold transition-colors",
            opt.value === value
              ? "bg-navy text-white shadow-sm dark:bg-raised dark:text-ink"
              : "text-ink-soft"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ——— Hoja inferior (bottom sheet) ———

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fade-in-fast absolute inset-0 bg-navy/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="sheet-up absolute inset-x-0 bottom-0 mx-auto max-w-lg">
        <div className="safe-bottom max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-6 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink-soft"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ——— Diálogo de confirmación ———

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        className="fade-in-fast absolute inset-0 bg-navy/55 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="rise-in relative w-full max-w-xs rounded-3xl bg-card p-6 text-center">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{message}</p>
        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" full onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="expense" full onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ——— Estado vacío ———

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-card text-ink-faint">
        {icon}
      </div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-[260px] text-[13px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}
