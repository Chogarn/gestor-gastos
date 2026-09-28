"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import PasswordInput from "./PasswordInput";

type Props = { mode: "login" | "register" };

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

const COPY = {
  login: {
    title: "Iniciar sesión",
    submit: "Entrar",
    switchText: "¿No tienes cuenta?",
    switchLink: "Regístrate",
    switchHref: "/register",
  },
  register: {
    title: "Crear cuenta",
    submit: "Crear cuenta",
    switchText: "¿Ya tienes cuenta?",
    switchLink: "Inicia sesión",
    switchHref: "/login",
  },
} as const;

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const copy = COPY[mode];
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Si ya hay una sesión válida, ir directamente al panel
  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/dashboard"))
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));

    if (mode === "register" && password !== String(data.get("confirm"))) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await (mode === "login" ? api.login(email, password) : api.register(email, password));
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <Link href="/" className="text-2xl font-semibold hover:opacity-80">
          Gestor de gastos
        </Link>
        <p className="text-sm text-zinc-500">{copy.title}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <PasswordInput
            name="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            maxLength={128}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={inputClass}
          />
          {mode === "register" && (
            <span className="mt-1 block text-xs text-zinc-500">Mínimo 8 caracteres.</span>
          )}
        </label>
        {mode === "register" && (
          <label className="block text-sm">
            Repite la contraseña
            <PasswordInput
              name="confirm"
              required
              maxLength={128}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {copy.submit}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="text-emerald-700 hover:underline dark:text-emerald-400">
          {copy.switchLink}
        </Link>
      </p>
    </main>
  );
}
