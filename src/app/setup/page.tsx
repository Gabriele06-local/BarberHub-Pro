import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function SetupPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0F0F0F] px-4 py-16 text-[#E5E2E1]">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E9C349]">
            Configura Supabase
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Mancano le variabili d&apos;ambiente pubbliche del progetto Supabase.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Passi rapidi</CardTitle>
            <CardDescription>Nella cartella del progetto `barberhub-pro`.</CardDescription>
          </CardHeader>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-300">
            <li>
              Copia il file{" "}
              <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5 text-[#E9C349]">.env.example</code> in{" "}
              <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5 text-[#E9C349]">.env.local</code>.
            </li>
            <li>
              Da Supabase (Settings → API) incolla{" "}
              <code className="text-xs text-zinc-400">Project URL</code> in{" "}
              <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>.
            </li>
            <li>
              Incolla la chiave <code className="text-xs text-zinc-400">anon public</code> in{" "}
              <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </li>
            <li>
              Per inviti admin/team aggiungi anche{" "}
              <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code> (solo
              server, mai nel client).
            </li>
            <li>
              In Supabase: Authentication → URL configuration → aggiungi tra i Redirect URLs l&apos;indirizzo{" "}
              <code className="break-all rounded bg-[#2A2A2A] px-1.5 py-0.5 text-[#E9C349]">
                http://localhost:3000/auth/callback
              </code>{" "}
              (e in produzione lo stesso path sul tuo dominio). Senza questo, il link nell&apos;email di invito non
              completa l&apos;accesso.
            </li>
            <li>
              Opzionale: <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5">NEXT_PUBLIC_SITE_URL</code> con
              l&apos;URL pubblico dell&apos;app (es. <code className="text-xs">https://tuo-dominio.vercel.app</code>)
              così gli inviti puntano al dominio giusto.
            </li>
            <li>Ferma e riavvia <code className="rounded bg-[#2A2A2A] px-1.5 py-0.5">npm run dev</code>.</li>
          </ol>
        </Card>
        <p className="text-center text-sm text-zinc-500">
          Poi torna al{" "}
          <Link href="/login" className="text-[#E9C349] underline">
            login
          </Link>{" "}
          o alla{" "}
          <Link href="/" className="text-[#E9C349] underline">
            home
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
