"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Accesso…" : "Entra"}
    </Button>
  );
}

export function LoginForm() {
  const [error, formAction] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Password</label>
        <PasswordInput
          name="password"
          required
          autoComplete="current-password"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Submit />
    </form>
  );
}
