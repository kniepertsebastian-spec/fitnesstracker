import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@fitnesstracker/shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button, Callout, Field, Input } from "../components/ui";

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
    <AuthLayout
      title="Anmelden"
      footer={
        <>
          Noch kein Konto?{" "}
          <Link to="/register" className="text-accent hover:text-accent-hover">
            Registrieren
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="E-Mail" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}
        </Field>
        <Field label="Passwort" error={errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register("password")} />}
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSubmitting}>
          Anmelden
        </Button>
      </form>
    </AuthLayout>
  );
}
