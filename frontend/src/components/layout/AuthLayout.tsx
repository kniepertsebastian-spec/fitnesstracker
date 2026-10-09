import type { ReactNode } from "react";
import { Card } from "../ui";
import { Logo } from "./Logo";

// Centered card with the logo tile for login and registration.
export function AuthLayout({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="w-full max-w-sm lg:p-6">
        <h1 className="mb-4 text-h1 text-text">{title}</h1>
        {children}
      </Card>
      <p className="mt-4 text-small text-text-subtle">{footer}</p>
    </div>
  );
}
