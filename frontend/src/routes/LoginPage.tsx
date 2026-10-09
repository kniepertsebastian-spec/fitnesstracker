import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@fitnesstracker/shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      await login(data);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Anmeldung fehlgeschlagen");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Anmelden</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-text-subtle">E-Mail</label>
          <input
            type="email"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2"
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-sm text-danger-text">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-subtle">Passwort</label>
          <input
            type="password"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-danger-text">{errors.password.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          Anmelden
        </button>
      </form>
      <p className="mt-4 text-sm text-text-subtle">
        Noch kein Konto?{" "}
        <Link to="/register" className="text-accent hover:underline">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
