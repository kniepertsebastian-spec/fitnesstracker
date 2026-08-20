import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@fitnesstracker/shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    setError(null);
    try {
      await registerUser(data);
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registrierung fehlgeschlagen");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Registrieren</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">E-Mail</label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Anzeigename (optional)</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="mt-1 text-sm text-red-400">{errors.displayName.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Passwort</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Setup-Token</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            {...register("setupToken")}
          />
          {errors.setupToken && (
            <p className="mt-1 text-sm text-red-400">{errors.setupToken.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-violet-500 px-4 py-2 font-medium text-slate-950 hover:bg-violet-400 disabled:opacity-50"
        >
          Registrieren
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Schon ein Konto?{" "}
        <Link to="/login" className="text-violet-400 hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
