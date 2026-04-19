"use client";

import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { publicBookAction, type PublicBookActionState } from "@/actions/appointments";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import {
  normalizeAvailabilitySlotRow,
  rpcJsonbToArray,
  type PublicAvailabilitySlotDto,
} from "@/lib/public/availability-normalize";

export type PublicBookLocation = { id: string; name: string };

type SlotRow = PublicAvailabilitySlotDto;

function localDateISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PublicBookExperience({
  companyId,
  companyName,
  locations,
}: {
  companyId: string;
  companyName: string;
  locations: PublicBookLocation[];
}) {
  const initialDay = localDateISO(new Date());
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [day, setDay] = useState(initialDay);
  const [dateDraft, setDateDraft] = useState(initialDay);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<SlotRow | null>(null);
  const listAnchorRef = useRef<HTMLDivElement>(null);

  const locationLabel = useMemo(() => {
    const l = locations.find((x) => x.id === locationId);
    return l?.name ?? "";
  }, [locations, locationId]);

  const loadSlots = useCallback(async () => {
    if (!locationId || !day) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const qs = new URLSearchParams({
        companyId,
        locationId,
        date: day,
      });
      const r = await fetch(`/api/public/availability?${qs.toString()}`, { cache: "no-store" });
      const j = (await r.json()) as { slots?: unknown; error?: string };
      if (!r.ok) {
        setLoadErr(j.error ?? "Errore caricamento slot");
        setSlots([]);
        return;
      }
      const list = rpcJsonbToArray(j.slots)
        .map((x) => normalizeAvailabilitySlotRow(x))
        .filter((s): s is SlotRow => s !== null);
      setSlots(list);
    } catch {
      setLoadErr("Rete non disponibile");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, locationId, day]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadSlots();
    }, 0);
    return () => clearTimeout(t);
  }, [loadSlots]);

  const [state, formAction] = useActionState(publicBookAction, null as PublicBookActionState);

  useEffect(() => {
    if (!state?.done) return;
    const t = setTimeout(() => {
      setModal(null);
      void loadSlots();
    }, 0);
    return () => clearTimeout(t);
  }, [state?.done, loadSlots]);

  const headline = locationLabel ? `${companyName} · ${locationLabel}` : companyName;
  const dayTitle = day ? format(parseISO(`${day}T12:00:00`), "EEEE d MMMM yyyy", { locale: it }) : "";

  function onVai() {
    setDay(dateDraft);
    requestAnimationFrame(() => {
      listAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (!locationId) {
    return (
      <p className="text-center text-sm text-zinc-400">
        Nessuna filiale disponibile per le prenotazioni. Contatta il negozio.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141313] shadow-xl">
      <header className="border-b border-white/10 bg-[#1C1B1B] px-5 pb-6 pt-7 text-center sm:px-8">
        <p className="font-[family-name:var(--font-headline)] text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#E9C349]">
          BarberHub Pro
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-headline)] text-2xl font-black tracking-tight text-[#E5E2E1] sm:text-3xl">
          {companyName}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">{headline}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
          La richiesta arriva in <span className="text-[#E5E2E1]">pending</span> e la squadra la conferma in negozio.
        </p>
        <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2">
          <span className="rounded-full bg-red-900/40 px-5 py-2.5 text-sm font-bold text-[#E5E2E1] ring-1 ring-red-600/50">
            Prenota ora
          </span>
          <Link
            href={`/book/${companyId}/area-personale`}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-[#E5E2E1]"
          >
            Le mie prenotazioni
          </Link>
        </div>
      </header>

      <div className="bg-[#0F0F0F] px-4 pb-10 pt-5 text-[#E5E2E1] sm:px-6">
        {locations.length > 1 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">←</span>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cambia sede</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-xl border border-white/10 bg-[#353534] px-3 py-2.5 text-sm text-[#E5E2E1] outline-none ring-red-700/30 focus:ring-2"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vai alla data</label>
            <input
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#353534] px-3 py-2.5 text-sm text-[#E5E2E1] outline-none ring-red-700/30 focus:ring-2"
            />
          </div>
          <button
            type="button"
            onClick={onVai}
            className="rounded-xl bg-[#B91C1C] px-5 py-2.5 text-sm font-bold text-[#E5E2E1] shadow transition hover:bg-red-700"
          >
            Vai
          </button>
        </div>

        {loadErr ? <p className="mb-3 text-sm text-red-300">{loadErr}</p> : null}
        {state?.error ? <p className="mb-3 text-sm text-red-300">{state.error}</p> : null}
        {state?.done ? (
          <p className="mb-4 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
            Richiesta inviata. Ti aspettiamo in negozio per confermare l&apos;appuntamento.
          </p>
        ) : null}

        <div ref={listAnchorRef} id="prenota-slot">
          <h2 className="mb-4 font-[family-name:var(--font-headline)] text-xl font-bold capitalize text-[#E5E2E1] sm:text-2xl">
            {dayTitle}
          </h2>

          {loading && slots.length > 0 ? (
            <p className="mb-2 text-center text-xs text-zinc-500">Aggiornamento orari…</p>
          ) : null}

          <div className={cn("space-y-3", loading && slots.length > 0 && "pointer-events-none opacity-60")}>
            {loading && slots.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">Caricamento slot…</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-[#1C1B1B] py-12 text-center text-sm text-zinc-500">
                Nessuno slot libero in questa data.
              </p>
            ) : (
              <ul className="space-y-3">
                {slots.map((s, i) => {
                  const at = parseISO(s.at);
                  const dur = s.durationMins ?? 60;
                  const seats = typeof s.seatsLeft === "number" ? s.seatsLeft : 1;
                  return (
                    <li
                      key={`${s.at}-${s.barberId ?? "x"}-${i}`}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#1C1B1B] p-4 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <CalendarDaysIcon className="h-9 w-9 shrink-0 text-red-600 max-sm:mx-auto" aria-hidden />
                      <div className="min-w-0 flex-1 max-sm:text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#E9C349]">
                          {format(at, "EEE d MMM", { locale: it })}
                        </p>
                        <p className="font-[family-name:var(--font-headline)] text-2xl font-black text-[#E5E2E1]">
                          {format(at, "HH:mm", { locale: it })}
                        </p>
                        <p className="text-sm text-zinc-400">
                          <span className="font-bold text-zinc-300">{dur} min</span>
                          <span className="text-zinc-600"> · </span>
                          <span>{s.barberName}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 max-sm:w-full sm:items-end">
                        <span className="rounded-full bg-red-950/50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-red-200 ring-1 ring-red-800/50">
                          {seats === 1 ? "1 posto" : `${seats} posti`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setModal(s)}
                          className="rounded-full bg-[#B91C1C] px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#E5E2E1] transition hover:bg-red-700"
                        >
                          Prenota
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#201F1F] p-5 text-[#E5E2E1] shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold">Richiesta</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {format(parseISO(modal.at), "d MMM yyyy HH:mm", { locale: it })} · {modal.barberName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg px-2 py-1 text-xl leading-none text-zinc-500 hover:bg-white/10 hover:text-[#E5E2E1]"
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="date" value={modal.at} />
              <input type="hidden" name="slotMinutes" value={String(modal.durationMins ?? 30)} />
              {modal.barberId ? <input type="hidden" name="barberId" value={modal.barberId} /> : null}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Nome</label>
                <input
                  name="clientName"
                  required
                  className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm outline-none ring-red-700/40 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Telefono</label>
                <input
                  name="clientPhone"
                  required
                  className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm outline-none ring-red-700/40 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Servizio</label>
                <input
                  name="serviceName"
                  required
                  placeholder="Taglio, barba, fade…"
                  className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm outline-none ring-red-700/40 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Note</label>
                <textarea
                  name="clientNotes"
                  rows={2}
                  className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm outline-none ring-red-700/40 focus:ring-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Annulla
                </Button>
                <Button type="submit">Invia richiesta</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
