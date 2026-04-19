import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";

export default async function NoProfilePage() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const uid = await authService.getSessionUserId(supabase);
  if (!uid) {
    redirect("/login");
  }

  const profile = await authService.getProfileForUser(supabase, uid);
  if (profile.ok) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0F0F0F] px-4 py-16 text-[#E5E2E1]">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profilo non ancora collegato</CardTitle>
            <CardDescription>
              Sei autenticato con Supabase Auth, ma nella tabella <code className="text-[#E9C349]">profiles</code>{" "}
              non c&apos;è ancora un record con il tuo stesso <code className="text-zinc-400">id</code> utente.
            </CardDescription>
          </CardHeader>
          <div className="space-y-4 px-6 pb-6 text-sm text-zinc-300">
            <p>Per sbloccare la dashboard:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Su database già creati: esegui in SQL Editor{" "}
                <code className="text-xs text-[#E9C349]">supabase/auth_profile_trigger.sql</code> così i nuovi utenti
                Auth ricevono automaticamente un profilo.
              </li>
              <li>
                Oppure inserimento manuale: <code className="text-xs text-[#E9C349]">supabase/link-user-profile.sql</code>{" "}
                (sostituisci <code className="text-xs">AUTH_USER_UUID</code>).
              </li>
            </ul>
            <p className="text-xs text-zinc-500">
              Dettaglio: {profile.error}
            </p>
          </div>
        </Card>
        <div className="flex flex-col gap-3">
          <form action={logoutAction}>
            <Button type="submit" variant="primary" className="w-full">
              Esci e prova con un altro account
            </Button>
          </form>
          <p className="text-center text-xs text-zinc-500">
            <Link href="/setup" className="text-[#E9C349] underline">
              Variabili ambiente
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
