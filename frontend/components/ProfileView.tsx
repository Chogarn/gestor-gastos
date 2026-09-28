"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, Profile, api, isUnauthorized } from "@/lib/api";
import { CURRENCIES } from "@/lib/currencies";
import { useUser } from "@/lib/user-context";
import PasswordInput from "./PasswordInput";

const card = "rounded-xl border border-zinc-200 p-5 dark:border-zinc-800";
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const primaryButton =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";

const formatDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(iso),
      )
    : "—";

export default function ProfileView() {
  const router = useRouter();
  const { setUser } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .profile()
      .then(setProfile)
      .catch((err) => {
        if (isUnauthorized(err)) router.replace("/login");
        else setLoadError("No se pudo cargar tu perfil. ¿Está el backend en marcha?");
      });
  }, [router]);

  // Al guardar el nombre se actualiza también el avatar y el menú de la cabecera
  function handleSaved(updated: Profile) {
    setProfile(updated);
    setUser(updated);
  }

  if (loadError) return <p className="p-6 text-sm text-red-600">{loadError}</p>;
  if (!profile) return <p className="p-6 text-sm text-zinc-500">Cargando…</p>;

  const displayName = profile.name || profile.email;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>

      <section className={card}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-2xl font-semibold text-white"
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{displayName}</p>
            {profile.name && <p className="truncate text-sm text-zinc-500">{profile.email}</p>}
            <p className="text-sm text-zinc-500">
              Miembro desde {formatDate(profile.created_at)}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[
            ["Gastos", profile.stats.expenses],
            ["Ingresos", profile.stats.incomes],
            ["Categorías", profile.stats.categories],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              <dt className="text-xs text-zinc-500">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <NameForm profile={profile} onSaved={handleSaved} onUnauthorized={() => router.replace("/login")} />
      <PasswordForm onUnauthorized={() => router.replace("/login")} />
    </main>
  );
}

function NameForm({
  profile,
  onSaved,
  onUnauthorized,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
  onUnauthorized: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name"));
    const currency = String(data.get("currency"));
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      onSaved(await api.updateProfile(name, currency));
      setSaved(true);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="mb-4 font-medium">Datos personales</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          Nombre
          <input
            name="name"
            defaultValue={profile.name ?? ""}
            maxLength={80}
            autoComplete="name"
            placeholder="Cómo quieres que te llamemos"
            onChange={() => setSaved(false)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            value={profile.email}
            readOnly
            disabled
            className={`${inputClass} mt-1 opacity-60`}
          />
        </label>
        <label className="block text-sm">
          Moneda
          <select
            name="currency"
            defaultValue={profile.currency}
            onChange={() => setSaved(false)}
            className={`${inputClass} mt-1`}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-zinc-500">
            Solo cambia cómo se muestran los montos; no convierte los que ya cargaste.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            Cambios guardados.
          </p>
        )}
        <button type="submit" disabled={saving} className={primaryButton}>
          Guardar cambios
        </button>
      </form>
    </section>
  );
}

function PasswordForm({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const current = String(data.get("current"));
    const next = String(data.get("next"));

    setDone(false);
    if (next !== String(data.get("confirm"))) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api.changePassword(current, next);
      form.reset();
      setDone(true);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="mb-1 font-medium">Cambiar contraseña</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Al cambiarla se cerrará la sesión en tus otros dispositivos.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          Contraseña actual
          <PasswordInput
            name="current"
            required
            maxLength={128}
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Contraseña nueva
          <PasswordInput
            name="next"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-zinc-500">Mínimo 8 caracteres.</span>
        </label>
        <label className="block text-sm">
          Repite la contraseña nueva
          <PasswordInput
            name="confirm"
            required
            maxLength={128}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            Contraseña actualizada.
          </p>
        )}
        <button type="submit" disabled={saving} className={primaryButton}>
          Cambiar contraseña
        </button>
      </form>
    </section>
  );
}
