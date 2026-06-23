"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

const storageKey = (companyId: string) => `bh_book_identity_${companyId}`;

type SavedIdentity = { fullName: string; contact: string };

export type PublicAreaLocation = { id: string; name: string };

type BookingRow = {
  id: string;
  at: string;
  status: string;
  service: string;
  location: string;
};

function readSaved(companyId: string): SavedIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const fullName = String((j as { fullName?: unknown }).fullName ?? "").trim();
    const contact = String((j as { contact?: unknown }).contact ?? "").trim();
    if (!fullName || !contact) return null;
    return { fullName, contact };
  } catch {
    return null;
  }
}

function parseBookingList(raw: unknown): BookingRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BookingRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = String(o.id ?? "");
    const at = String(o.at ?? "");
    if (!id || !at) continue;
    out.push({
      id,
      at,
      status: String(o.status ?? ""),
      service: String(o.service ?? ""),
      location: String(o.location ?? ""),
    });
  }
  return out;
}

function statusLabel(s: string): string {
  if (s === "pending") return "In attesa di conferma";
  if (s === "confirmed") return "Confermato";
  if (s === "completed") return "Completato";
  return s;
}

const MOUNT_NOW = Date.now();

export function PublicAreaPersonale({
  companyId,
  companyName,
  locations,
}: {
  companyId: string;
  companyName: string;
  locations: PublicAreaLocation[];
}) {
  const defaultLocId = locations[0]?.id ?? "";
  const [locationId, setLocationId] = useState(defaultLocId);
  const [saved, setSaved] = useState<SavedIdentity | null>(() => readSaved(companyId));
  const [fullName, setFullName] = useState(() => readSaved(companyId)?.fullName ?? "");
  const [contact, setContact] = useState(() => readSaved(companyId)?.contact ?? "");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [dbClientName, setDbClientName] = useState<string | null>(null);

  const { upcoming, history } = useMemo(() => {
    if (!bookings) {
      return { upcoming: [] as BookingRow[], history: [] as BookingRow[] };
    }
    const nowMs = MOUNT_NOW;
    const upcomingList: BookingRow[] = [];
    const historyList: BookingRow[] = [];
    for (const b of bookings) {
      if (b.status === "completed") {
        historyList.push(b);
        continue;
      }
      const t = new Date(b.at).getTime();
      const active = b.status === "pending" || b.status === "confirmed";
      if (active && t >= nowMs - 60_000) {
        upcomingList.push(b);
      } else {
        historyList.push(b);
      }
    }
    upcomingList.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    historyList.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { upcoming: upcomingList, history: historyList };
  }, [bookings]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const fn = fullName.trim();
      const ct = contact.trim();
      if (!fn || !ct || !locationId) return;
      setLookupErr(null);
      setLookupLoading(true);
      setBookings(null);
      setDbClientName(null);
      try {
        const r = await fetch("/api/public/my-bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            locationId,
            fullName: fn,
            contact: ct,
          }),
        });
        const j = (await r.json()) as {
          found?: boolean;
          clientName?: string | null;
          appointments?: unknown;
          error?: string;
        };
        if (!r.ok) {
          setLookupErr(j.error ?? "Richiesta non riuscita");
          setLookupLoading(false);
          return;
        }
        const list = parseBookingList(j.appointments);
        if (!j.found) {
          setLookupErr(
            "Non abbiamo trovato un cliente con questi dati su questa sede. Controlla nome, email/telefono e filiale.",
          );
          setLookupLoading(false);
          return;
        }
        window.localStorage.setItem(storageKey(companyId), JSON.stringify({ fullName: fn, contact: ct }));
        setSaved({ fullName: fn, contact: ct });
        setDbClientName(typeof j.clientName === "string" && j.clientName ? j.clientName : fn);
        setBookings(list);
      } catch {
        setLookupErr("Rete non disponibile");
      } finally {
        setLookupLoading(false);
      }
    },
    [companyId, contact, fullName, locationId],
  );

  const onClear = useCallback(() => {
    window.localStorage.removeItem(storageKey(companyId));
    setSaved(null);
    setFullName("");
    setContact("");
    setBookings(null);
    setDbClientName(null);
    setLookupErr(null);
  }, [companyId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141313] shadow-xl">
      <header className="border-b border-white/10 bg-[#1C1B1B] px-5 pb-6 pt-7 text-center sm:px-8">
        <p className="font-[family-name:var(--font-headline)] text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#E9C349]">
          BarberHub Pro
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-headline)] text-2xl font-black tracking-tight text-[#E5E2E1] sm:text-3xl">
          Area personale
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Pianifica la tua prossima sessione e conferma in pochi secondi.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs text-zinc-500">
          Inserisci gli stessi dati usati nella prenotazione online: cerchiamo il tuo profilo su questa sede e ti mostriamo
          le richieste registrate.
        </p>
      </header>

      <div className="space-y-6 bg-[#0F0F0F] px-5 py-8 text-[#E5E2E1] sm:px-8">
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#E5E2E1]">
            Le mie prenotazioni
          </h2>
          {!saved && bookings === null ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Non abbiamo trovato i tuoi dati salvati su questo dispositivo.
              <br />
              Dopo il primo accesso con successo li memorizziamo qui per la prossima volta.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {dbClientName ? (
                <>
                  Ciao <span className="text-[#E5E2E1]">{dbClientName}</span>. Le richieste dal link pubblico restano in{" "}
                  <span className="text-[#E5E2E1]">pending</span> finché il negozio non le conferma.
                </>
              ) : (
                <>
                  Dati salvati su questo dispositivo per <span className="text-[#E5E2E1]">{saved?.fullName}</span> (
                  {saved?.contact}). Le richieste dal link pubblico restano in{" "}
                  <span className="text-[#E5E2E1]">pending</span> finché il negozio non le conferma.
                </>
              )}
            </p>
          )}
        </div>

        <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4">
          {locations.length > 1 ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sede</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/30 focus:ring-2"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Nome e cognome</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Es. Mario Rossi"
              required
              autoComplete="name"
              className="w-full rounded-xl border border-white/10 bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/30 focus:ring-2"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Email o telefono</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email o cellulare"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-white/10 bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/30 focus:ring-2"
            />
          </div>
          {lookupErr ? <p className="text-sm text-red-300">{lookupErr}</p> : null}
          <Button type="submit" className="w-full" disabled={lookupLoading || !locationId}>
            {lookupLoading ? "Ricerca…" : "Accedi con i tuoi dati"}
          </Button>
        </form>

        {bookings !== null ? (
          <div className="space-y-8 border-t border-white/10 pt-6">
            <section>
              <h3 className="font-[family-name:var(--font-headline)] text-base font-bold text-[#E9C349]">
                Le tue prossime sessioni
              </h3>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nessuna sessione futura in calendario.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {upcoming.map((b) => {
                    const when = parseISO(b.at);
                    return (
                      <li
                        key={b.id}
                        className="rounded-xl border border-white/10 bg-[#1C1B1B] px-4 py-3 text-sm text-zinc-300"
                      >
                        <p className="font-semibold capitalize text-[#E5E2E1]">
                          {format(when, "EEEE d MMMM yyyy", { locale: it })}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {companyName} · {b.location}
                        </p>
                        <p className="mt-1 font-[family-name:var(--font-headline)] text-xl font-black text-[#E5E2E1]">
                          {format(when, "HH:mm", { locale: it })}
                        </p>
                        <p className="mt-1 text-zinc-400">{b.service}</p>
                        <p className="mt-1 text-xs text-amber-200/90">{statusLabel(b.status)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="font-[family-name:var(--font-headline)] text-base font-bold text-zinc-400">
                Storico sessioni recenti
              </h3>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nessuno storico da mostrare.</p>
              ) : (
                <ul className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {history.map((b) => {
                    const when = parseISO(b.at);
                    return (
                      <li
                        key={b.id}
                        className="rounded-lg border border-white/5 bg-[#1C1B1B]/80 px-3 py-2 text-xs text-zinc-400"
                      >
                        <span className="font-medium text-zinc-300">
                          {format(when, "d MMM yyyy HH:mm", { locale: it })}
                        </span>
                        <span className="text-zinc-600"> · </span>
                        <span>{b.service}</span>
                        <span className="text-zinc-600"> · </span>
                        <span>{statusLabel(b.status)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/book/${companyId}`}
            className="text-center text-sm font-semibold text-[#E9C349] underline-offset-2 hover:underline sm:text-left"
          >
            ← Torna a prenotare su {companyName}
          </Link>
          {saved || bookings !== null ? (
            <button
              type="button"
              onClick={onClear}
              className="text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
            >
              Cancella dati e risultati
            </button>
          ) : null}
        </div>

        <p className="border-t border-white/10 pt-4 text-center text-[0.7rem] text-zinc-600">
          Sei dello staff?{" "}
          <Link href="/login" className="text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline">
            Accedi dalla console
          </Link>{" "}
          (non da questa pagina pubblica).
        </p>
      </div>
    </div>
  );
}
