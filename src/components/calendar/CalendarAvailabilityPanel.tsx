"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAppointmentPanelAction,
  loadCalendarPanelAppointmentsAction,
  updateAppointmentStatusPanelAction,
} from "@/actions/appointments";
import {
  deletePublicSlotIdsAction,
  insertPublicSlotRowsAction,
  loadLocationOpenSlotsRangeAction,
} from "@/actions/location-open-slots";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { expandPublicSlotRows, parseHHMM, type PublicTimeBlock } from "@/lib/booking/expand-public-slots";
import { romeYmdAndMinsFromInstant } from "@/lib/booking/rome-calendar";
import { formatRomeSlotMinutes, ROME_OPEN_SLOT_MINUTES } from "@/lib/booking/rome-open-slots";
import type { CalendarPanelAppointmentRow } from "@/lib/services/appointment.service";
import type { LocationOpenSlotRow } from "@/lib/services/location-open-slots.service";
import { cn } from "@/lib/utils/cn";

const WD: { k: number; l: string }[] = [
  { k: 1, l: "Lun" },
  { k: 2, l: "Mar" },
  { k: 3, l: "Mer" },
  { k: 4, l: "Gio" },
  { k: 5, l: "Ven" },
  { k: 6, l: "Sab" },
  { k: 0, l: "Dom" },
];

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

type CalendarGridLayout = "day" | "3days" | "week" | "month";

function computeVisibleRange(anchorYmd: string, gridLayout: CalendarGridLayout) {
  const anchor = parseISO(`${anchorYmd}T12:00:00`);
  if (gridLayout === "day") {
    return {
      rangeStart: ymd(anchor),
      rangeEnd: ymd(anchor),
      visibleDays: [anchor],
    };
  }
  if (gridLayout === "3days") {
    return {
      rangeStart: ymd(anchor),
      rangeEnd: ymd(addDays(anchor, 2)),
      visibleDays: [0, 1, 2].map((i) => addDays(anchor, i)),
    };
  }
  if (gridLayout === "week") {
    const ws = startOfWeek(anchor, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return {
      rangeStart: ymd(ws),
      rangeEnd: ymd(addDays(ws, 6)),
      visibleDays: days,
    };
  }
  const ms = startOfMonth(anchor);
  const me = endOfMonth(anchor);
  return {
    rangeStart: ymd(ms),
    rangeEnd: ymd(me),
    visibleDays: eachDayOfInterval({ start: ms, end: me }),
  };
}

/** Valore per `datetime-local`: data/ora dello slot (calendario sede, stesso uso della griglia). */
function slotToDatetimeLocalValue(slot: LocationOpenSlotRow): string {
  const h = Math.floor(slot.slot_mins / 60);
  const m = slot.slot_mins % 60;
  return `${slot.slot_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function CalendarAvailabilityPanel({
  companyId,
  locations,
  defaultLocationId,
  barbers,
  clients,
  weekAnchorDay,
}: {
  companyId: string;
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  barbers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  weekAnchorDay: string;
}) {
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [displayView, setDisplayView] = useState<"grid" | "list">("grid");
  const [gridLayout, setGridLayout] = useState<CalendarGridLayout>("week");
  const [anchorDate, setAnchorDate] = useState(weekAnchorDay);
  const [rows, setRows] = useState<LocationOpenSlotRow[]>([]);
  const [appointments, setAppointments] = useState<CalendarPanelAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [apptErr, setApptErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{
    slot: LocationOpenSlotRow;
    appointments: CalendarPanelAppointmentRow[];
  } | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [newApptFormOpen, setNewApptFormOpen] = useState(false);
  const [createClientId, setCreateClientId] = useState("");
  const [createBarberId, setCreateBarberId] = useState("");
  const [createService, setCreateService] = useState("");
  const [createWhen, setCreateWhen] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createFormErr, setCreateFormErr] = useState<string | null>(null);
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [sgModalOpen, setSgModalOpen] = useState(false);
  const [deleteSlotMode, setDeleteSlotMode] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
  /** Modale rapido dalla griglia: un solo slot (ora + durata), senza “blocco” multiplo. */
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDay, setQuickDay] = useState("");
  const [quickMins, setQuickMins] = useState(9 * 60);
  const [quickDur, setQuickDur] = useState(60);
  const [quickBarber, setQuickBarber] = useState("");
  const [quickSeats, setQuickSeats] = useState(1);
  const [quickShowName, setQuickShowName] = useState(true);
  const [quickBusy, setQuickBusy] = useState(false);

  const { rangeStart, rangeEnd, visibleDays } = useMemo(
    () => computeVisibleRange(anchorDate, gridLayout),
    [anchorDate, gridLayout],
  );

  const rangeLabel = useMemo(() => {
    const rs = parseISO(`${rangeStart}T12:00:00`);
    const re = parseISO(`${rangeEnd}T12:00:00`);
    if (gridLayout === "month") {
      return format(rs, "LLLL yyyy", { locale: it });
    }
    if (rangeStart === rangeEnd) {
      return format(rs, "EEEE d MMMM yyyy", { locale: it });
    }
    return `${format(rs, "d MMM", { locale: it })} – ${format(re, "d MMM yyyy", { locale: it })}`;
  }, [gridLayout, rangeStart, rangeEnd]);

  const gridMinWidthPx = useMemo(() => Math.max(520, visibleDays.length * 56), [visibleDays.length]);

  const navPrev = useCallback(() => {
    setAnchorDate((prev) => {
      const a = parseISO(`${prev}T12:00:00`);
      if (gridLayout === "day") return ymd(addDays(a, -1));
      if (gridLayout === "3days") return ymd(addDays(a, -3));
      if (gridLayout === "week") return ymd(addDays(a, -7));
      return ymd(subMonths(a, 1));
    });
  }, [gridLayout]);

  const navNext = useCallback(() => {
    setAnchorDate((prev) => {
      const a = parseISO(`${prev}T12:00:00`);
      if (gridLayout === "day") return ymd(addDays(a, 1));
      if (gridLayout === "3days") return ymd(addDays(a, 3));
      if (gridLayout === "week") return ymd(addDays(a, 7));
      return ymd(addMonths(a, 1));
    });
  }, [gridLayout]);

  const goToday = useCallback(() => {
    setAnchorDate(ymd(new Date()));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setApptErr(null);
    setMsg(null);
    const [r, a] = await Promise.all([
      loadLocationOpenSlotsRangeAction({
        companyId,
        locationId,
        dateFrom: rangeStart,
        dateTo: rangeEnd,
      }),
      loadCalendarPanelAppointmentsAction({
        companyId,
        locationId,
        dateFrom: rangeStart,
        dateTo: rangeEnd,
      }),
    ]);
    if (!r.ok) {
      setErr(r.error);
      setRows([]);
    } else {
      setRows(r.rows);
    }
    if (!a.ok) {
      setAppointments([]);
      setApptErr(a.error);
    } else {
      setAppointments(a.rows);
    }
    setLoading(false);
    setSelected(new Set());
  }, [companyId, locationId, rangeStart, rangeEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAnchorDate(weekAnchorDay);
  }, [weekAnchorDay]);

  useEffect(() => {
    if (displayView === "list") {
      setDeleteSlotMode(false);
    }
  }, [displayView]);

  useEffect(() => {
    if (!deleteSlotMode || detail) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeleteSlotMode(false);
        setErr(null);
        setMsg(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSlotMode, detail]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  useEffect(() => {
    setNewApptFormOpen(false);
    setCreateFormErr(null);
    setCreateBusy(false);
  }, [detail?.slot.id]);

  useEffect(() => {
    if (!recModalOpen && !sgModalOpen && !quickOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRecModalOpen(false);
        setSgModalOpen(false);
        setQuickOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recModalOpen, sgModalOpen, quickOpen]);

  const slotsByDayMins = useMemo(() => {
    const m = new Map<string, LocationOpenSlotRow[]>();
    for (const r of rows) {
      const k = `${r.slot_date}|${r.slot_mins}`;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return m;
  }, [rows]);

  const appsBySlotId = useMemo(() => {
    const m = new Map<string, CalendarPanelAppointmentRow[]>();
    for (const r of rows) {
      m.set(r.id, []);
    }
    for (const ap of appointments) {
      const { ymd, mins } = romeYmdAndMinsFromInstant(ap.date);
      for (const r of rows) {
        if (r.slot_date === ymd && r.slot_mins === mins && (r.barber_id ?? "") === (ap.barber_id ?? "")) {
          const list = m.get(r.id);
          if (list) {
            list.push(ap);
          }
        }
      }
    }
    return m;
  }, [rows, appointments]);

  const openSlotDetail = useCallback((slot: LocationOpenSlotRow) => {
    setDetail({ slot, appointments: appsBySlotId.get(slot.id) ?? [] });
  }, [appsBySlotId]);

  const deleteEmptySlotById = useCallback(
    async (slotId: string) => {
      setDeletingSlotId(slotId);
      setErr(null);
      setMsg(null);
      const r = await deletePublicSlotIdsAction({
        companyId,
        locationId,
        ids: [slotId],
      });
      setDeletingSlotId(null);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setMsg("Slot eliminato.");
      void load();
    },
    [companyId, locationId, load],
  );

  const onSlotActivate = useCallback(
    (s: LocationOpenSlotRow) => {
      if (!deleteSlotMode) {
        openSlotDetail(s);
        return;
      }
      const apps = appsBySlotId.get(s.id) ?? [];
      if (apps.length > 0) {
        setMsg(null);
        setErr("Questo slot ha prenotazioni: aprilo dal dettaglio per gestirle. Non si elimina da qui.");
        return;
      }
      void deleteEmptySlotById(s.id);
    },
    [deleteSlotMode, appsBySlotId, deleteEmptySlotById, openSlotDetail],
  );

  const onConfirmAppointment = useCallback(
    async (id: string) => {
      setStatusBusyId(id);
      const res = await updateAppointmentStatusPanelAction({ id, status: "confirmed" });
      setStatusBusyId(null);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setDetail(null);
      void load();
    },
    [load],
  );

  const openNewAppointmentForm = useCallback(() => {
    if (!detail) return;
    setCreateFormErr(null);
    setCreateClientId("");
    setCreateBarberId(detail.slot.barber_id ?? "");
    setCreateService("");
    setCreateWhen(slotToDatetimeLocalValue(detail.slot));
    setNewApptFormOpen(true);
  }, [detail]);

  const onCreateAppointmentSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!detail) return;
      if (!createClientId) {
        setCreateFormErr("Scegli un cliente.");
        return;
      }
      const service = createService.trim();
      if (!service) {
        setCreateFormErr("Inserisci il servizio.");
        return;
      }
      if (!createWhen) {
        setCreateFormErr("Inserisci data e ora.");
        return;
      }
      setCreateBusy(true);
      setCreateFormErr(null);
      const res = await createAppointmentPanelAction({
        companyId,
        clientId: createClientId,
        barberId: createBarberId ? createBarberId : null,
        serviceName: service,
        date: createWhen,
        slotMinutes: detail.slot.slot_duration_mins,
      });
      setCreateBusy(false);
      if (!res.ok) {
        setCreateFormErr(res.error);
        return;
      }
      setDetail(null);
      setMsg("Appuntamento creato.");
      void load();
    },
    [companyId, createBarberId, createClientId, createService, createWhen, detail, load],
  );

  /* --- Ricorrente --- */
  const [recBarber, setRecBarber] = useState("");
  const [recSeats, setRecSeats] = useState(2);
  const [recWd, setRecWd] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5]));
  const [recFrom, setRecFrom] = useState("09:00");
  const [recTo, setRecTo] = useState("13:00");
  const [recDur, setRecDur] = useState(60);
  const [recInt, setRecInt] = useState(60);
  const [recStart, setRecStart] = useState(weekAnchorDay);
  const [recEnd, setRecEnd] = useState(format(addDays(parseISO(`${weekAnchorDay}T12:00:00`), 28), "yyyy-MM-dd"));
  const [recShowName, setRecShowName] = useState(true);
  const [recBusy, setRecBusy] = useState(false);

  const applyRecurring = async () => {
    setRecBusy(true);
    setErr(null);
    setMsg(null);
    const a = parseHHMM(recFrom);
    const b = parseHHMM(recTo);
    if (a === null || b === null || b <= a) {
      setErr("Blocchi orari non validi.");
      setRecBusy(false);
      return;
    }
    const blocks: PublicTimeBlock[] = [{ startMins: a, endMins: b }];
    const expanded = expandPublicSlotRows({
      dateFrom: recStart,
      dateTo: recEnd,
      weekdays: Array.from(recWd),
      blocks,
      slotDurationMins: recDur,
      intervalMins: recInt,
      barberId: recBarber ? recBarber : null,
      seats: recSeats,
      showBarberName: recShowName,
    });
    if (!expanded.length) {
      setErr("Nessuno slot generato: controlla date, giorni e fascia oraria.");
      setRecBusy(false);
      return;
    }
    const ins = await insertPublicSlotRowsAction({ companyId, locationId, rows: expanded });
    setRecBusy(false);
    if (!ins.ok) {
      setErr(ins.error);
      return;
    }
    setMsg(`Aggiunti ${ins.inserted} slot (duplicati ignorati dal database se già presenti).`);
    setRecModalOpen(false);
    void load();
  };

  /* --- Singolo blocco --- */
  const [sgBarber, setSgBarber] = useState("");
  const [sgDay, setSgDay] = useState(weekAnchorDay);
  const [sgFrom, setSgFrom] = useState("09:00");
  const [sgTo, setSgTo] = useState("13:00");
  const [sgDur, setSgDur] = useState(60);
  const [sgInt, setSgInt] = useState(30);
  const [sgSeats, setSgSeats] = useState(1);
  const [sgShowName, setSgShowName] = useState(true);
  const [sgBusy, setSgBusy] = useState(false);

  const applySingle = async () => {
    setSgBusy(true);
    setErr(null);
    setMsg(null);
    const a = parseHHMM(sgFrom);
    const b = parseHHMM(sgTo);
    if (a === null || b === null || b <= a) {
      setErr("Orari blocco non validi.");
      setSgBusy(false);
      return;
    }
    const expanded = expandPublicSlotRows({
      dateFrom: sgDay,
      dateTo: sgDay,
      weekdays: [parseISO(`${sgDay}T12:00:00`).getDay()],
      blocks: [{ startMins: a, endMins: b }],
      slotDurationMins: sgDur,
      intervalMins: sgInt,
      barberId: sgBarber ? sgBarber : null,
      seats: sgSeats,
      showBarberName: sgShowName,
    });
    if (!expanded.length) {
      setErr("Nessuno slot generato.");
      setSgBusy(false);
      return;
    }
    const ins = await insertPublicSlotRowsAction({ companyId, locationId, rows: expanded });
    setSgBusy(false);
    if (!ins.ok) {
      setErr(ins.error);
      return;
    }
    setMsg(`Aggiunti ${ins.inserted} slot.`);
    setSgModalOpen(false);
    void load();
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    setErr(null);
    const r = await deletePublicSlotIdsAction({
      companyId,
      locationId,
      ids: Array.from(selected),
    });
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setMsg("Slot eliminati.");
    void load();
  };

  const openQuickSlotFromGrid = useCallback((dayYmd: string, rowMins: number) => {
    setErr(null);
    setMsg(null);
    setRecModalOpen(false);
    setSgModalOpen(false);
    setQuickDay(dayYmd);
    setQuickMins(rowMins);
    setQuickDur(60);
    setQuickBarber("");
    setQuickSeats(1);
    setQuickShowName(true);
    setQuickOpen(true);
  }, []);

  const applyQuickSlot = async () => {
    setQuickBusy(true);
    setErr(null);
    setMsg(null);
    const d = quickDur;
    if (!Number.isFinite(d) || d < 15 || d > 240) {
      setErr("Durata tra 15 e 240 minuti.");
      setQuickBusy(false);
      return;
    }
    const seats = Math.min(20, Math.max(1, Math.floor(quickSeats) || 1));
    const blockEnd = quickMins + d;
    if (blockEnd <= quickMins) {
      setErr("Durata non valida.");
      setQuickBusy(false);
      return;
    }
    const wd = parseISO(`${quickDay}T12:00:00`).getDay();
    const expanded = expandPublicSlotRows({
      dateFrom: quickDay,
      dateTo: quickDay,
      weekdays: [wd],
      blocks: [{ startMins: quickMins, endMins: blockEnd }],
      slotDurationMins: d,
      intervalMins: d,
      barberId: quickBarber ? quickBarber : null,
      seats,
      showBarberName: quickShowName,
    });
    if (!expanded.length) {
      setErr("Ora o durata non compatibili con la griglia (solo :00 e :30, 05:00–23:00).");
      setQuickBusy(false);
      return;
    }
    const ins = await insertPublicSlotRowsAction({ companyId, locationId, rows: expanded });
    setQuickBusy(false);
    if (!ins.ok) {
      setErr(ins.error);
      return;
    }
    setMsg(ins.inserted === 1 ? "Slot creato." : `Creati ${ins.inserted} slot.`);
    setQuickOpen(false);
    void load();
  };

  return (
    <>
    <Card className="border-white/10">
      <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <div
          role="group"
          aria-label="Crea disponibilità slot"
          className="rounded-xl border border-white/10 bg-gradient-to-b from-[#1C1B1B] to-[#141313] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:inline-block sm:max-w-max"
        >
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start whitespace-normal border border-white/10 bg-[#201F1F] px-3 py-2.5 text-left text-sm leading-snug hover:bg-[#2A2A2A] sm:min-w-[11rem] sm:flex-1"
              onClick={() => setRecModalOpen(true)}
            >
              Definisci disponibilità ricorrente
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start whitespace-normal border border-white/10 bg-[#201F1F] px-3 py-2.5 text-left text-sm leading-snug hover:bg-[#2A2A2A] sm:min-w-[11rem] sm:flex-1"
              onClick={() => setSgModalOpen(true)}
            >
              Aggiungi nuova disponibilità (singolo giorno)
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {locations.length > 1 ? (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 p-0.5">
            {(
              [
                { id: "day" as const, label: "Giorno" },
                { id: "3days" as const, label: "3 giorni" },
                { id: "week" as const, label: "Settimana" },
                { id: "month" as const, label: "Mese" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setGridLayout(id);
                  setDisplayView("grid");
                }}
                className={
                  gridLayout === id
                    ? "rounded-lg bg-red-900/50 px-2.5 py-1.5 text-xs font-semibold text-[#E5E2E1] sm:px-3"
                    : "rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 sm:px-3"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setDisplayView("grid")}
              className={
                displayView === "grid"
                  ? "rounded-lg bg-red-900/50 px-3 py-1.5 text-xs font-semibold text-[#E5E2E1]"
                  : "rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400"
              }
            >
              Griglia orari
            </button>
            <button
              type="button"
              onClick={() => setDisplayView("list")}
              className={
                displayView === "list"
                  ? "rounded-lg bg-red-900/50 px-3 py-1.5 text-xs font-semibold text-[#E5E2E1]"
                  : "rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400"
              }
            >
              Elenco
            </button>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Aggiorna
          </Button>
          <Button
            type="button"
            variant={deleteSlotMode ? "primary" : "secondary"}
            disabled={loading}
            onClick={() => {
              setDeleteSlotMode((v) => {
                const next = !v;
                if (next) {
                  setDisplayView("grid");
                }
                setErr(null);
                setMsg(null);
                return next;
              });
            }}
            title={
              deleteSlotMode
                ? "Disattiva e torna al tap normale sugli slot"
                : "Attiva: poi tocca nella griglia solo slot senza prenotazioni per eliminarli"
            }
            aria-pressed={deleteSlotMode}
          >
            {deleteSlotMode ? "Fine eliminazione slot" : "Elimina slot (tocca i vuoti)"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={navPrev} aria-label="Periodo precedente">
              ←
            </Button>
            <Button type="button" variant="ghost" onClick={goToday}>
              Oggi
            </Button>
            <Button type="button" variant="ghost" onClick={navNext} aria-label="Periodo successivo">
              →
            </Button>
            <span className="min-w-0 text-sm font-medium leading-snug text-zinc-300">{rangeLabel}</span>
          </div>
          {displayView === "list" && selected.size > 0 ? (
            <Button type="button" variant="secondary" onClick={() => void deleteSelected()}>
              Elimina selezionati ({selected.size})
            </Button>
          ) : null}
        </div>

        {err ? <p className="text-sm text-red-300">{err}</p> : null}
        {apptErr ? <p className="text-sm text-amber-200/90">Prenotazioni: {apptErr}</p> : null}
        {msg ? <p className="text-sm text-emerald-200">{msg}</p> : null}
        {deleteSlotMode && displayView === "grid" ? (
          <p className="rounded-xl border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-100">
            Modalità eliminazione: tocca uno slot <span className="font-semibold">senza prenotazioni</span> per
            rimuoverlo. Gli slot con clienti si aprono solo dal dettaglio.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Caricamento…</p>
        ) : displayView === "grid" ? (
          <div
            className={cn(
              "overflow-x-auto rounded-xl border",
              deleteSlotMode
                ? "border-red-600/60 ring-2 ring-red-900/50 ring-offset-2 ring-offset-[#0F0F0F]"
                : "border-white/10",
            )}
          >
            <table
              className="w-full border-collapse text-xs"
              style={{ minWidth: gridMinWidthPx }}
            >
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-12 min-w-[3rem] border border-white/10 bg-[#1C1B1B] px-1 py-2 text-left text-zinc-500 sm:w-14 sm:min-w-[3.5rem] sm:px-2" />
                  {visibleDays.map((d) => (
                    <th
                      key={ymd(d)}
                      className="min-w-[3.25rem] border border-white/10 bg-[#252424] px-0.5 py-2 text-center font-semibold text-zinc-300 sm:min-w-[3.5rem] sm:px-1"
                    >
                      <span className="block text-[9px] uppercase leading-tight text-zinc-500 sm:text-[10px]">
                        {format(d, "EEE", { locale: it })}
                      </span>
                      <span className="text-[10px] sm:text-xs">{format(d, "d/M", { locale: it })}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROME_OPEN_SLOT_MINUTES.map((mins) => (
                  <tr key={mins}>
                    <td className="sticky left-0 z-10 border border-white/10 bg-[#1C1B1B] px-1 py-1 text-[10px] text-zinc-500 sm:px-2 sm:text-xs">
                      {formatRomeSlotMinutes(mins)}
                    </td>
                    {visibleDays.map((d) => {
                      const key = `${ymd(d)}|${mins}`;
                      const list = slotsByDayMins.get(key) ?? [];
                      return (
                        <td key={key} className="border border-white/5 bg-[#141313] p-0 align-top">
                          {list.length ? (
                            <div className="flex flex-col">
                              <div className="space-y-0.5 p-0.5">
                                {list.map((s) => {
                                  const apps = appsBySlotId.get(s.id) ?? [];
                                  const booked = apps.length > 0;
                                  const hasPending = apps.some((a) => a.status === "pending");
                                  const preview = apps
                                    .slice(0, 2)
                                    .map((a) => a.client_name.trim())
                                    .filter(Boolean)
                                    .join(", ");
                                  const more = apps.length > 2 ? ` +${apps.length - 2}` : "";
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      disabled={deletingSlotId === s.id}
                                      onClick={() => onSlotActivate(s)}
                                      title={
                                        deleteSlotMode
                                          ? booked
                                            ? "Slot con prenotazioni: non eliminabile da qui"
                                            : "Tocca per eliminare questo slot"
                                          : booked
                                            ? `${apps.map((a) => a.client_name).join(", ")} — tocca per gestire`
                                            : `${s.slot_duration_mins} min · ${s.seats} ${s.seats === 1 ? "posto" : "posti"}`
                                      }
                                      className={cn(
                                        "w-full rounded border px-1 py-0.5 text-left text-[10px] leading-tight transition hover:ring-1 hover:ring-white/30",
                                        !booked &&
                                          "border-violet-700/50 bg-violet-950/50 text-violet-100 hover:bg-violet-900/50",
                                        booked &&
                                          hasPending &&
                                          "border-amber-500/60 bg-amber-950/45 text-amber-50 hover:bg-amber-900/40",
                                        booked &&
                                          !hasPending &&
                                          "border-emerald-700/50 bg-emerald-950/40 text-emerald-50 hover:bg-emerald-900/35",
                                        deleteSlotMode &&
                                          !booked &&
                                          "hover:border-red-500 hover:bg-red-950/70 hover:ring-red-500/40",
                                        deleteSlotMode && booked && "cursor-not-allowed opacity-70 hover:ring-0",
                                        deletingSlotId === s.id && "pointer-events-none opacity-50",
                                      )}
                                    >
                                      <span className="font-semibold">
                                        {s.barber_id
                                          ? s.show_barber_name
                                            ? barbers.find((b) => b.id === s.barber_id)?.name ?? "Barber"
                                            : "Barber"
                                          : "Sede"}
                                      </span>
                                      <span className="block text-[9px] opacity-90">
                                        {s.seats} {s.seats === 1 ? "posto" : "posti"}
                                      </span>
                                      {booked ? (
                                        <span className="mt-0.5 block line-clamp-2 text-[9px] font-medium leading-tight text-[#E5E2E1]">
                                          {preview}
                                          {more}
                                          {hasPending ? (
                                            <span className="ml-0.5 text-amber-200">· da confermare</span>
                                          ) : null}
                                        </span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                disabled={deleteSlotMode}
                                onClick={() => openQuickSlotFromGrid(ymd(d), mins)}
                                className={cn(
                                  "group flex w-full items-center justify-center gap-1 border-t border-white/10 py-1 text-[9px] font-semibold text-zinc-500 transition sm:text-[10px]",
                                  deleteSlotMode
                                    ? "cursor-not-allowed opacity-40"
                                    : "hover:bg-violet-950/30 hover:text-violet-200",
                                )}
                                title={
                                  deleteSlotMode
                                    ? "Disattiva «Elimina slot» per aggiungerne un altro alla stessa ora"
                                    : "Altro slot alla stessa ora (es. altro barber): stesso modale rapido"
                                }
                              >
                                <span className="text-sm leading-none text-zinc-500 group-hover:text-violet-300">+</span>
                                <span>Altro slot</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={deleteSlotMode}
                              onClick={() => openQuickSlotFromGrid(ymd(d), mins)}
                              className={cn(
                                "group flex min-h-[2.5rem] w-full flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] text-zinc-600 transition sm:min-h-[2.75rem]",
                                deleteSlotMode
                                  ? "cursor-not-allowed opacity-40"
                                  : "hover:bg-violet-950/25 hover:text-violet-200/90 active:bg-violet-950/40",
                              )}
                              title={
                                deleteSlotMode
                                  ? "Disattiva «Elimina slot» per aggiungere uno slot qui"
                                  : "Nuovo slot a questo orario (durata a scelta)"
                              }
                            >
                              <span className="sr-only">Aggiungi slot alle {formatRomeSlotMinutes(mins)}</span>
                              <span className="text-lg font-light leading-none text-zinc-500 group-hover:text-violet-300">
                                +
                              </span>
                              <span className="hidden text-[9px] font-medium text-zinc-500 group-hover:text-violet-200/80 sm:inline">
                                Aggiungi
                              </span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="max-h-[min(70vh,520px)] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#141313] p-3 sm:max-h-[560px]">
            {rows.length === 0 ? (
              <li className="text-sm text-zinc-500">Nessuno slot nel periodo selezionato.</li>
            ) : (
              rows.map((r) => {
                const slotApps = appsBySlotId.get(r.id) ?? [];
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-[#201F1F] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) {
                            n.add(r.id);
                          } else {
                            n.delete(r.id);
                          }
                          return n;
                        });
                      }}
                    />
                    <button
                      type="button"
                      disabled={deletingSlotId === r.id}
                      onClick={() => onSlotActivate(r)}
                      className="min-w-0 flex-1 text-left hover:opacity-90 disabled:opacity-50"
                    >
                      <span className="text-zinc-400">
                        {r.slot_date} {formatRomeSlotMinutes(r.slot_mins)}
                      </span>
                      <span className="ml-2 text-zinc-200">
                        {r.barber_id
                          ? r.show_barber_name
                            ? barbers.find((b) => b.id === r.barber_id)?.name ?? "Barber"
                            : "Barber"
                          : "In salone"}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {r.slot_duration_mins} min · {r.seats} posti
                      </span>
                      {slotApps.length ? (
                        <span className="mt-1 block text-xs font-medium text-emerald-200/90">
                          {slotApps.map((a) => `${a.client_name}${a.status === "pending" ? " (pending)" : ""}`).join(" · ")}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </Card>

    {recModalOpen ? (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-modal-title"
        onClick={() => setRecModalOpen(false)}
      >
        <div
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-violet-800/40 bg-[#1C1B1B] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="rec-modal-title" className="font-[family-name:var(--font-headline)] text-lg font-bold text-violet-100">
              Definisci disponibilità ricorrente
            </h2>
            <button
              type="button"
              onClick={() => setRecModalOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-[#E5E2E1]"
            >
              Chiudi
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Barber *</label>
              <select
                value={recBarber}
                onChange={(e) => setRecBarber(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              >
                <option value="">In salone (nessun barber)</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Posti per slot *</label>
              <input
                type="number"
                min={1}
                max={20}
                value={recSeats}
                onChange={(e) => setRecSeats(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-zinc-500">Giorni della settimana *</p>
              <div className="flex flex-wrap gap-2">
                {WD.map(({ k, l }) => (
                  <label key={k} className="flex items-center gap-1 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={recWd.has(k)}
                      onChange={(e) =>
                        setRecWd((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) {
                            n.add(k);
                          } else {
                            n.delete(k);
                          }
                          return n;
                        })
                      }
                    />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Blocco: dalle ore</label>
                <input
                  value={recFrom}
                  onChange={(e) => setRecFrom(e.target.value)}
                  className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Alle ore</label>
                <input
                  value={recTo}
                  onChange={(e) => setRecTo(e.target.value)}
                  className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Durata slot (min) *</label>
              <input
                type="number"
                min={15}
                max={240}
                step={5}
                value={recDur}
                onChange={(e) => setRecDur(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Intervallo avvio (min) *</label>
              <input
                type="number"
                min={15}
                max={240}
                step={5}
                value={recInt}
                onChange={(e) => setRecInt(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-zinc-600">60 ≈ solo :00; 30 = :00 e :30.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Data inizio *</label>
              <input
                type="date"
                value={recStart}
                onChange={(e) => setRecStart(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Data fine *</label>
              <input
                type="date"
                value={recEnd}
                onChange={(e) => setRecEnd(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300 md:col-span-2">
              <input type="checkbox" checked={recShowName} onChange={(e) => setRecShowName(e.target.checked)} />
              Mostra nome del barber ai clienti
            </label>
            <div className="md:col-span-2">
              <Button type="button" onClick={() => void applyRecurring()} disabled={recBusy}>
                {recBusy ? "Salvataggio…" : "Aggiungi disponibilità ricorrente"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    {sgModalOpen ? (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-modal-title"
        onClick={() => setSgModalOpen(false)}
      >
        <div
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1B1B] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="sg-modal-title" className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#E5E2E1]">
              Aggiungi nuova disponibilità (singolo giorno)
            </h2>
            <button
              type="button"
              onClick={() => setSgModalOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-[#E5E2E1]"
            >
              Chiudi
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Barber *</label>
              <select
                value={sgBarber}
                onChange={(e) => setSgBarber(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              >
                <option value="">In salone</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Giorno *</label>
              <input
                type="date"
                value={sgDay}
                onChange={(e) => setSgDay(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Inizio blocco</label>
              <input value={sgFrom} onChange={(e) => setSgFrom(e.target.value)} className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Fine blocco</label>
              <input value={sgTo} onChange={(e) => setSgTo(e.target.value)} className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Durata slot (min)</label>
              <input
                type="number"
                min={15}
                max={240}
                value={sgDur}
                onChange={(e) => setSgDur(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Inizia ogni (min)</label>
              <input
                type="number"
                min={15}
                max={240}
                value={sgInt}
                onChange={(e) => setSgInt(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Posti per slot</label>
              <input
                type="number"
                min={1}
                max={20}
                value={sgSeats}
                onChange={(e) => setSgSeats(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300 md:col-span-2">
              <input type="checkbox" checked={sgShowName} onChange={(e) => setSgShowName(e.target.checked)} />
              Mostra nome del barber ai clienti
            </label>
            <div className="md:col-span-2">
              <Button type="button" onClick={() => void applySingle()} disabled={sgBusy}>
                {sgBusy ? "Salvataggio…" : "Aggiungi slot"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    {quickOpen ? (
      <div
        className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-slot-title"
        onClick={() => {
          setQuickOpen(false);
          setErr(null);
        }}
      >
        <div
          className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-emerald-900/40 bg-[#1C1B1B] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="quick-slot-title" className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#E5E2E1]">
                Nuovo slot
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Un solo orario (es. 09:00–10:00 con durata 60 min). Per più slot o fasce lunghe usa{" "}
                <span className="text-zinc-400">«Aggiungi nuova disponibilità (singolo giorno)»</span> sopra.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuickOpen(false);
                setErr(null);
              }}
              className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-[#E5E2E1]"
            >
              Chiudi
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-500">Giorno</label>
              <input
                type="date"
                value={quickDay}
                onChange={(e) => setQuickDay(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Ora inizio</label>
              <select
                value={quickMins}
                onChange={(e) => setQuickMins(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              >
                {ROME_OPEN_SLOT_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {formatRomeSlotMinutes(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Durata (min)</label>
              <select
                value={quickDur}
                onChange={(e) => setQuickDur(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              >
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-500 sm:col-span-2">
              Fine occupata:{" "}
              <span className="font-semibold text-zinc-300">{formatRomeSlotMinutes(quickMins + quickDur)}</span>{" "}
              (solo questo slot nella griglia prenotazioni)
            </p>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-500">Barber</label>
              <select
                value={quickBarber}
                onChange={(e) => setQuickBarber(e.target.value)}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              >
                <option value="">In salone</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Posti</label>
              <input
                type="number"
                min={1}
                max={20}
                value={quickSeats}
                onChange={(e) => setQuickSeats(Number(e.target.value))}
                className="w-full rounded-xl bg-[#353534] px-3 py-2 text-sm text-[#E5E2E1]"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2">
              <input type="checkbox" checked={quickShowName} onChange={(e) => setQuickShowName(e.target.checked)} />
              Mostra nome del barber ai clienti
            </label>
            <div className="sm:col-span-2">
              <Button type="button" onClick={() => void applyQuickSlot()} disabled={quickBusy}>
                {quickBusy ? "Salvataggio…" : "Crea slot"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    {detail ? (
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-detail-title"
        onClick={() => setDetail(null)}
      >
        <div
          className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1B1B] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="slot-detail-title" className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#E5E2E1]">
                Slot {detail.slot.slot_date} {formatRomeSlotMinutes(detail.slot.slot_mins)}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {detail.slot.barber_id
                  ? detail.slot.show_barber_name
                    ? barbers.find((b) => b.id === detail.slot.barber_id)?.name ?? "Barber"
                    : "Barber"
                  : "In salone"}
                {" · "}
                {detail.slot.slot_duration_mins} min · {detail.slot.seats}{" "}
                {detail.slot.seats === 1 ? "posto" : "posti"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-[#E5E2E1]"
            >
              Chiudi
            </button>
          </div>

          {detail.appointments.length === 0 ? (
            <div className="mt-6 space-y-4">
              {!newApptFormOpen ? (
                <>
                  <p className="text-sm text-zinc-400">Nessun appuntamento su questo slot.</p>
                  <Button type="button" className="w-full" onClick={openNewAppointmentForm}>
                    Nuovo appuntamento
                  </Button>
                </>
              ) : (
                <form onSubmit={(ev) => void onCreateAppointmentSubmit(ev)} className="space-y-4">
                  <h3 className="font-[family-name:var(--font-headline)] text-base font-bold text-[#E5E2E1]">
                    Nuovo appuntamento
                  </h3>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cliente</label>
                    <select
                      value={createClientId}
                      onChange={(e) => setCreateClientId(e.target.value)}
                      required
                      className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
                    >
                      <option value="">Cliente</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Barber (opzionale)
                    </label>
                    <select
                      value={createBarberId}
                      onChange={(e) => setCreateBarberId(e.target.value)}
                      className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
                    >
                      <option value="">Barber (opzionale)</option>
                      {barbers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Servizio</label>
                    <input
                      value={createService}
                      onChange={(e) => setCreateService(e.target.value)}
                      required
                      placeholder="Servizio"
                      className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Data e ora
                    </label>
                    <input
                      type="datetime-local"
                      value={createWhen}
                      onChange={(e) => setCreateWhen(e.target.value)}
                      required
                      className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
                    />
                    <p className="text-[0.65rem] text-zinc-600">Formato: giorno / mese / anno e ora (come nel browser).</p>
                  </div>
                  {createFormErr ? <p className="text-sm text-red-300">{createFormErr}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" className="min-w-[8rem]" disabled={createBusy}>
                      {createBusy ? "Salvataggio…" : "Crea"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setNewApptFormOpen(false);
                        setCreateFormErr(null);
                      }}
                    >
                      Indietro
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {detail.appointments.map((a) => (
                <li key={a.id} className="rounded-xl border border-white/10 bg-[#141313] p-3">
                  <p className="font-semibold text-[#E5E2E1]">{a.client_name}</p>
                  <p className="text-xs text-zinc-400">{a.client_phone || "—"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {a.service_name} ·{" "}
                    <span className={a.status === "pending" ? "text-amber-300" : "text-emerald-300"}>
                      {a.status === "pending" ? "In attesa di conferma" : "Confermato"}
                    </span>
                  </p>
                  {a.status === "pending" ? (
                    <Button
                      type="button"
                      className="mt-3 w-full"
                      disabled={statusBusyId === a.id}
                      onClick={() => void onConfirmAppointment(a.id)}
                    >
                      {statusBusyId === a.id ? "Salvataggio…" : "Conferma prenotazione"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    ) : null}
    </>
  );
}
