import { NavLink } from "react-router-dom";
import { House, ReceiptText, ChartPie, Settings } from "lucide-react";
import { cx } from "./ui";

const items = [
  { to: "/", label: "Inicio", icon: House, end: true },
  { to: "/movimientos", label: "Movimientos", icon: ReceiptText, end: false },
  { to: "/reportes", label: "Reportes", icon: ChartPie, end: false },
  { to: "/ajustes", label: "Ajustes", icon: Settings, end: false },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-lg px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="grid grid-cols-4 rounded-[26px] border border-line/70 bg-card/90 p-1.5 shadow-[0_14px_36px_-14px_rgba(9,15,35,0.4)] backdrop-blur-xl">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "pressable flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold",
                  isActive
                    ? "bg-navy text-white dark:bg-raised dark:text-ink"
                    : "text-ink-faint"
                )
              }
            >
              <Icon size={20} strokeWidth={2.1} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
