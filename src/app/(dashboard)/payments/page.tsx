import { format } from "date-fns";
import { redirect } from "next/navigation";
import { deletePaymentAction, savePaymentAction } from "@/actions/payments";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as clientService from "@/lib/services/client.service";
import * as paymentService from "@/lib/services/payment.service";

type Search = Promise<{ error?: string }>;

export default async function PaymentsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  if (profile.data.role !== "ADMIN" && profile.data.role !== "MANAGER") {
    redirect("/dashboard");
  }
  if (!profile.data.company_id) {
    redirect("/dashboard");
  }

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCMilliseconds(-1);

  const payments = await paymentService.listPaymentsInRange(supabase, profile.data, {
    companyId: profile.data.company_id,
    from: start.toISOString(),
    to: end.toISOString(),
  });
  if (!payments.ok) {
    return <p className="text-sm text-red-300">{payments.error}</p>;
  }

  const clients = await clientService.listClients(supabase, profile.data, profile.data.company_id);
  if (!clients.ok) {
    return <p className="text-sm text-red-300">{clients.error}</p>;
  }

  const defaultWhen = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  return (
    <div className="space-y-8">
      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
          Pagamenti
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Metodo: contanti, SRL o privato.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuovo pagamento</CardTitle>
          <CardDescription>La sede è quella del cliente (anagrafica).</CardDescription>
        </CardHeader>
        <form action={savePaymentAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="companyId" value={profile.data.company_id} />
          <select
            name="clientId"
            required
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          >
            <option value="">Cliente</option>
            {clients.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Importo"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <input
            name="category"
            required
            placeholder="Categoria"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <select
            name="method"
            required
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          >
            <option value="cash">Contanti</option>
            <option value="srl">SRL</option>
            <option value="privato">Privato</option>
          </select>
          <input
            name="date"
            type="datetime-local"
            required
            defaultValue={defaultWhen}
            className="md:col-span-2 rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
          />
          <Button type="submit" className="md:col-span-2">
            Registra pagamento
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimenti mese corrente</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <Tr>
              <Th>Cliente</Th>
              <Th>Sede</Th>
              <Th>Importo</Th>
              <Th>Metodo</Th>
              <Th>Data</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {payments.data.map((p) => (
              <Tr key={p.id}>
                <Td>{p.client?.name ?? "—"}</Td>
                <Td>{p.location?.name ?? "—"}</Td>
                <Td>€ {Number(p.amount).toFixed(2)}</Td>
                <Td className="uppercase">{p.method}</Td>
                <Td className="text-xs text-zinc-400">{new Date(p.date).toLocaleString("it-IT")}</Td>
                <Td className="text-right">
                  <form action={deletePaymentAction} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="companyId" value={p.company_id} />
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
