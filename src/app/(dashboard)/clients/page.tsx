import { redirect } from "next/navigation";
import { deleteClientAction, saveClientAction } from "@/actions/clients";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as clientService from "@/lib/services/client.service";

type Search = Promise<{ error?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  if (profile.data.role !== "ADMIN" && profile.data.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const clients = await clientService.listClients(supabase, profile.data, profile.data.company_id);
  if (!clients.ok) {
    return <p className="text-sm text-red-300">{clients.error}</p>;
  }

  const cid = profile.data.company_id ?? "";

  return (
    <div className="space-y-8">
      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
          Clienti
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Anagrafica isolata per company (RLS + services).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuovo cliente</CardTitle>
          <CardDescription>Telefono univoco per sede.</CardDescription>
        </CardHeader>
        <form action={saveClientAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="companyId" value={cid} />
          <input
            name="name"
            required
            placeholder="Nome"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <input
            name="email"
            type="email"
            placeholder="Email (opzionale)"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <input
            name="phone"
            required
            placeholder="Telefono"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <input
            name="notes"
            placeholder="Note"
            className="md:col-span-2 rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <Button type="submit" className="md:col-span-2">
            Salva
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <Tr>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Telefono</Th>
              <Th>Note</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {clients.data.map((c) => (
              <Tr key={c.id}>
                <Td>{c.name}</Td>
                <Td className="text-sm text-zinc-400">{c.email ?? "—"}</Td>
                <Td>{c.phone}</Td>
                <Td className="max-w-xs truncate text-xs text-zinc-400">{c.notes ?? "—"}</Td>
                <Td className="space-x-2 text-right">
                  <form action={deleteClientAction} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="companyId" value={c.company_id} />
                    <Button type="submit" variant="ghost" className="text-xs text-red-300">
                      Elimina
                    </Button>
                  </form>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
