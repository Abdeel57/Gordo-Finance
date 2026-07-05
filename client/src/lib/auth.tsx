import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { api, clearSession, getStoredUser, setSession } from "./api";
import { resetLocalData } from "./db";
import { syncNow } from "./sync";
import type { User } from "./types";

interface AuthValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const LAST_USER_KEY = "cc_last_user";

async function beginSession(token: string, user: User): Promise<void> {
  // Si entra un usuario distinto al anterior, se limpia la base local
  // para no mezclar datos entre cuentas.
  const lastUser = localStorage.getItem(LAST_USER_KEY);
  if (lastUser && lastUser !== user.id) {
    await resetLocalData();
  }
  localStorage.setItem(LAST_USER_KEY, user.id);
  setSession(token, user);
  await syncNow();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await beginSession(data.token, data.user);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const data = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    await beginSession(data.token, data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    clearSession();
    await resetLocalData();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
