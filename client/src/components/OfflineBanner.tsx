import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <span className="rise-in flex items-center gap-1.5 rounded-full bg-navy/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
        <WifiOff size={13} />
        Sin conexión — tus registros se guardan en este dispositivo
      </span>
    </div>
  );
}
