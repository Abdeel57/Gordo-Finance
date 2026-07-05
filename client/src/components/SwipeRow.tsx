import { useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";

const TRIGGER = 72; // px de arrastre para disparar la acción

/**
 * Gestos móviles: deslizar a la izquierda elimina, a la derecha edita.
 * En escritorio se usan los botones visibles del propio elemento.
 */
export function SwipeRow({
  onEdit,
  onDelete,
  children,
}: {
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const decided = useRef<"drag" | "scroll" | null>(null);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
    decided.current = null;
    setDragging(true);
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0];
    if (!t || !start.current) return;
    const rawX = t.clientX - start.current.x;
    const rawY = t.clientY - start.current.y;
    if (decided.current === null) {
      if (Math.abs(rawX) > 10 && Math.abs(rawX) > Math.abs(rawY)) {
        decided.current = "drag";
      } else if (Math.abs(rawY) > 10) {
        decided.current = "scroll";
      }
    }
    if (decided.current !== "drag") return;
    setDx(Math.max(-110, Math.min(110, rawX)));
  }

  function onTouchEnd() {
    if (decided.current === "drag") {
      if (dx <= -TRIGGER) onDelete();
      else if (dx >= TRIGGER) onEdit();
    }
    setDx(0);
    setDragging(false);
    start.current = null;
    decided.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0 flex items-center justify-start bg-navy pl-5 text-white"
        style={{ opacity: dx > 0 ? Math.min(dx / TRIGGER, 1) : 0 }}
        aria-hidden
      >
        <Pencil size={20} />
      </div>
      <div
        className="absolute inset-0 flex items-center justify-end bg-expense pr-5 text-white"
        style={{ opacity: dx < 0 ? Math.min(-dx / TRIGGER, 1) : 0 }}
        aria-hidden
      >
        <Trash2 size={20} />
      </div>
      <div
        className="relative"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
