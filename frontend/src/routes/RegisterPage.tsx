import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@fitnesstracker/shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button, Callout, Field, Input } from "../components/ui";

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
    <AuthLayout
      title="Registrieren"
      footer={
        <>
          Schon ein Konto?{" "}
          <Link to="/login" className="text-accent hover:text-accent-hover">
            Anmelden
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="E-Mail" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}
        </Field>
        <Field label="Anzeigename (optional)" error={errors.displayName?.message}>
          {(p) => <Input {...p} type="text" autoComplete="nickname" {...register("displayName")} />}
        </Field>
        <Field label="Passwort" error={errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("password")} />}
        </Field>
        <Field label="Setup-Token" error={errors.setupToken?.message}>
          {(p) => <Input {...p} type="text" autoComplete="off" {...register("setupToken")} />}
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSubmitting}>
          Registrieren
        </Button>
      </form>
    </AuthLayout>
  );
}
