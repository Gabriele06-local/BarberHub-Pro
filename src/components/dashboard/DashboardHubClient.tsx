"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { deleteClientAction, saveClientAction } from "@/actions/clients";
import { deletePaymentAction, savePaymentAction } from "@/actions/payments";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { ClientWithLastBooking } from "@/lib/services/client.service";
import type { PaymentListRow } from "@/lib/services/payment.service";

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hub-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#201F1F] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:rounded-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="hub-modal-title" className="font-[family-name:var(--font-headline)] text-xl font-bold text-[#E5E2E1]">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-zinc-400 transition hover:bg-white/10 hover:text-[#E5E2E1]"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PlusCircleButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#B91C1C] text-xl font-bold leading-none text-[#E5E2E1] shadow-md transition hover:scale-105 active:scale-95"
    >
      +
    </button>
  );
}

export function DashboardHubClient({
  companyId,
  clients,
  recentPayments,
  error,
}: {
  companyId: string;
  clients: ClientWithLastBooking[];
  recentPayments: PaymentListRow[];
  error?: string;
}) {
  const [modal, setModal] = useState<"none" | "newClient" | "newPayment" | "edit">("none");
  const [paymentClientPreset, setPaymentClientPreset] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<ClientWithLastBooking | null>(null);

  const closeAll = useCallback(() => {
    setModal("none");
    setPaymentClientPreset(null);
    setEditClient(null);
  }, []);

  const openNewClient = useCallback(() => {
    setEditClient(null);
    setPaymentClientPreset(null);
    setModal("newClient");
  }, []);

  const openNewPayment = useCallback(
    (clientId: string | null) => {
      if (clients.length === 0) {
        openNewClient();
        return;
      }
      setEditClient(null);
      setPaymentClientPreset(clientId);
      setModal("newPayment");
    },
    [clients.length, openNewClient],
  );

  const openEdit = useCallback((c: ClientWithLastBooking) => {
    setPaymentClientPreset(null);
    setEditClient(c);
    setModal("edit");
  }, []);

  const anyModal = modal !== "none";

  useEffect(() => {
    if (!anyModal) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAll();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [anyModal, closeAll]);

  const defaultWhen = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Clienti</CardTitle>
            <CardDescription>Nome, email, telefono, ultima prenotazione e azioni rapide.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={openNewClient}>
              Nuovo cliente
            </Button>
            {clients.length > 0 ? (
              <PlusCircleButton
                label="Nuovo pagamento (scegli cliente nel modulo)"
                onClick={() => openNewPayment(null)}
              />
            ) : null}
          </div>
        </CardHeader>
        <div className="overflow-x-auto px-0 pb-4 sm:px-2 sm:pb-6">
          <Table>
            <THead>
              <Tr>
                <Th>Nome</Th>
                <Th>Email</Th>
                <Th>Telefono</Th>
                <Th>Ultima prenotazione</Th>
                <Th className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>Azioni</span>
                    {clients.length > 0 ? (
                      <PlusCircleButton label="Nuovo pagamento" onClick={() => openNewPayment(null)} />
                    ) : null}
                  </div>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {clients.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="py-12">
                    <div className="flex flex-col items-center justify-center gap-4 text-center">
                      <p className="text-sm text-zinc-500">Nessun cliente ancora.</p>
                      <PlusCircleButton label="Aggiungi cliente" onClick={openNewClient} />
                      <p className="text-xs text-zinc-600">Tocca + per aprire il modulo.</p>
                    </div>
                  </Td>
                </Tr>
              ) : (
                clients.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium text-[#E5E2E1]">{c.name}</Td>
                    <Td className="text-sm text-zinc-300">{c.email ?? "—"}</Td>
                    <Td>{c.phone}</Td>
                    <Td className="max-w-[200px] text-xs text-zinc-400">
                      {c.lastBookingAt ? (
                        <span className="flex flex-col gap-1">
                          <span>
                            {new Date(c.lastBookingAt).toLocaleString("it-IT", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <Link href="/calendar" className="text-[#E9C349] hover:underline">
                            Calendario
                          </Link>
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-xs font-semibold text-[#E9C349] hover:underline"
                        >
                          Modifica
                        </button>
                        <PlusCircleButton label={`Pagamento per ${c.name}`} onClick={() => openNewPayment(c.id)} />
                        <form action={deleteClientAction} className="inline">
                          <input type="hidden" name="returnTo" value="dashboard" />
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="companyId" value={c.company_id} />
                          <Button type="submit" variant="ghost" className="h-auto p-0 text-xs text-red-300 hover:text-red-200">
                            Elimina
                          </Button>
                        </form>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ultimi pagamenti</CardTitle>
          <CardDescription>Movimenti recenti della sede.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto px-0 pb-4 sm:px-2 sm:pb-6">
          <Table>
            <THead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Sede</Th>
                <Th>Importo</Th>
                <Th>Metodo</Th>
                <Th>Data</Th>
                <Th className="text-right" />
              </Tr>
            </THead>
            <TBody>
              {recentPayments.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-sm text-zinc-500">
                    Nessun pagamento registrato.
                  </Td>
                </Tr>
              ) : (
                recentPayments.map((p) => (
                  <Tr key={p.id}>
                    <Td>{p.client?.name ?? "—"}</Td>
                    <Td className="text-sm">{p.location?.name ?? "—"}</Td>
                    <Td>€ {Number(p.amount).toFixed(2)}</Td>
                    <Td className="text-xs uppercase text-zinc-400">{p.method}</Td>
                    <Td className="text-xs text-zinc-400">
                      {new Date(p.date).toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td className="text-right">
                      <form action={deletePaymentAction} className="inline">
                        <input type="hidden" name="returnTo" value="dashboard" />
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="companyId" value={p.company_id} />
                        <Button type="submit" variant="ghost" className="text-xs text-red-300">
                          Elimina
                        </Button>
                      </form>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      {modal === "newClient" ? (
        <ModalShell
          title="Nuovo cliente"
          description="Aggiungi anagrafica alla sede. Telefono univoco per sede."
          onClose={closeAll}
        >
          <form action={saveClientAction} className="space-y-3">
            <input type="hidden" name="returnTo" value="dashboard" />
            <input type="hidden" name="companyId" value={companyId} />
            <input
              name="name"
              required
              placeholder="Nome"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="email"
              type="email"
              placeholder="Email (opzionale)"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="phone"
              required
              placeholder="Telefono"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="notes"
              placeholder="Note"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeAll}>
                Annulla
              </Button>
              <Button type="submit">Aggiungi cliente</Button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {modal === "newPayment" ? (
        <ModalShell
          title="Nuovo pagamento"
          description="Il pagamento è registrato sulla sede del cliente selezionato."
          onClose={closeAll}
        >
          <form
            action={savePaymentAction}
            className="grid gap-3 md:grid-cols-2"
            key={`pay-${paymentClientPreset ?? "none"}`}
          >
            <input type="hidden" name="returnTo" value="dashboard" />
            <input type="hidden" name="companyId" value={companyId} />
            <select
              name="clientId"
              required
              defaultValue={paymentClientPreset ?? ""}
              className="md:col-span-2 rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            >
              <option value="">Cliente</option>
              {clients.map((c) => (
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
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button type="button" variant="ghost" onClick={closeAll}>
                Annulla
              </Button>
              <Button type="submit">Registra pagamento</Button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {modal === "edit" && editClient ? (
        <ModalShell title="Modifica cliente" description="Aggiorna anagrafica o note." onClose={closeAll}>
          <form action={saveClientAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="returnTo" value="dashboard" />
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="id" value={editClient.id} />
            <input
              name="name"
              required
              defaultValue={editClient.name}
              placeholder="Nome"
              className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="email"
              type="email"
              defaultValue={editClient.email ?? ""}
              placeholder="Email"
              className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="phone"
              required
              defaultValue={editClient.phone}
              placeholder="Telefono"
              className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="notes"
              defaultValue={editClient.notes ?? ""}
              placeholder="Note"
              className="md:col-span-2 rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button type="button" variant="ghost" onClick={closeAll}>
                Annulla
              </Button>
              <Button type="submit">Salva modifiche</Button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
