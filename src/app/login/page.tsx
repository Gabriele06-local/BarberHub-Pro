import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type LoginSearch = Promise<{ error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams?: LoginSearch }) {
  const sp = searchParams ? await searchParams : {};
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-dvh min-h-full items-center justify-center bg-[#0F0F0F] px-3 py-12 sm:px-4 sm:py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Supabase non configurato</CardTitle>
            <CardDescription>
              Aggiungi <code className="text-[#E9C349]">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code className="text-[#E9C349]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
              <code className="text-[#E9C349]">.env.local</code>, poi riavvia <code>npm run dev</code>.
            </CardDescription>
          </CardHeader>
          <p className="px-6 pb-6 text-center text-sm">
            <Link href="/setup" className="text-[#E9C349] underline">
              Guida passo-passo
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const uid = await authService.getSessionUserId(supabase);
  if (uid) {
    const profile = await authService.getProfileForUser(supabase, uid);
    if (profile.ok) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-h-dvh min-h-full items-center justify-center bg-[#0F0F0F] px-3 py-12 sm:px-4 sm:py-16">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-headline)] text-2xl font-black tracking-tight text-red-600 sm:text-3xl">
            BarberHub Pro
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Accedi alla tua console operativa.</p>
        </div>
        <Card className="premium-gradient">
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>
          {sp.error ? (
            <p className="mb-4 rounded-xl bg-red-950/50 px-4 py-3 text-sm text-red-200">{sp.error}</p>
          ) : null}
          <p className="mb-4 text-xs leading-relaxed text-zinc-400">
            Usa l&apos;email e la password iniziale che ti ha comunicato l&apos;amministratore della piattaforma o del
            tuo barber shop.
          </p>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
