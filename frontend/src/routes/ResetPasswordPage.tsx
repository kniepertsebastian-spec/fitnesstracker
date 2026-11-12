import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { resetPasswordSchema, type ResetPasswordInput } from "@fitnesstracker/shared";
import { resetPasswordRequest } from "../api/auth.api";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button, Callout, Field, Input } from "../components/ui";

// There is no mail delivery. Whoever runs the app (the holder of the reset token) resets a
// forgotten password here, for themselves or for a friend.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (data: ResetPasswordInput) => {
    setError(null);
    try {
      await resetPasswordRequest(data);
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Zurücksetzen fehlgeschlagen");
    }
  };

  return (
    <AuthLayout
      title="Passwort zurücksetzen"
      footer={
        <Link to="/login" className="text-accent-text hover:text-accent-text-hover">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-small text-text-subtle">
          Ohne E-Mail-Versand geht das mit dem Reset-Token des Servers. Alle bestehenden Anmeldungen des Kontos
          werden beendet.
        </p>
        <Field label="E-Mail" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}
        </Field>
        <Field label="Reset-Token" error={errors.resetToken?.message}>
          {(p) => <Input {...p} type="text" autoComplete="off" {...register("resetToken")} />}
        </Field>
        <Field label="Neues Passwort" error={errors.newPassword?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("newPassword")} />}
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSubmitting}>
          Passwort speichern
        </Button>
      </form>
    </AuthLayout>
  );
}
