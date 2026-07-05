import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button, Field, Segmented, TextInput } from "../components/ui";

type Mode = "login" | "register";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name.trim() || undefined);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar. Revisa tu conexión a internet."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="rise-in flex flex-col items-center text-center">
        <img
          src="/logo.png"
          alt="Gordo Finance"
          className="logo-adaptive h-auto w-[min(250px,64vw)]"
        />
        <p className="mt-3 text-[14.5px] text-ink-soft">
          Tu dinero, claro y en segundos
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rise-in mt-8 space-y-4 rounded-[28px] border border-line/60 bg-card p-6 shadow-[0_14px_40px_-18px_rgba(13,20,44,0.25)]"
        style={{ animationDelay: "80ms" }}
      >
        <Segmented<Mode>
          options={[
            { value: "login", label: "Entrar" },
            { value: "register", label: "Crear cuenta" },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError("");
          }}
        />

        {mode === "register" && (
          <Field label="Tu nombre (opcional)">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamamos?"
              autoComplete="name"
              maxLength={60}
            />
          </Field>
        )}

        <Field label="Correo electrónico">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Contraseña">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        </Field>

        {error && (
          <p className="rounded-2xl bg-expense-tint px-4 py-3 text-[13.5px] font-medium text-expense-text">
            {error}
          </p>
        )}

        <Button type="submit" variant="income" size="lg" full disabled={loading}>
          {loading
            ? "Un momento…"
            : mode === "login"
              ? "Entrar"
              : "Crear mi cuenta"}
        </Button>

        {mode === "register" && (
          <p className="text-center text-[12.5px] leading-relaxed text-ink-faint">
            Te crearemos la cuenta "Efectivo" y las categorías más comunes para
            que empieces a registrar de inmediato.
          </p>
        )}
      </form>
    </div>
  );
}
