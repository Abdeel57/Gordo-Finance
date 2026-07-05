import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { startSyncLoop } from "./lib/sync";
import { ToastProvider } from "./components/toast";
import { BottomNav } from "./components/BottomNav";
import { OfflineBanner } from "./components/OfflineBanner";
import Home from "./pages/Home";
import Movements from "./pages/Movements";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

function Shell() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) startSyncLoop();
  }, [user]);

  if (!user) return <Login />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <OfflineBanner />
      <main className="px-4 pb-32 pt-3">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movimientos" element={<Movements />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
