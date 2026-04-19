import { eachDayOfInterval, parseISO } from "date-fns";

export type PublicTimeBlock = { startMins: number; endMins: number };

export type ExpandedOpenSlotInsert = {
  slot_date: string;
  slot_mins: number;
  barber_id: string | null;
  seats: number;
  slot_duration_mins: number;
  show_barber_name: boolean;
};

/** "09:00" → minuti da mezzanotte, o null. */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) {
    return null;
  }
  return h * 60 + mi;
}

function clampRomeSlotMins(mins: number): number | null {
  const minB = 5 * 60;
  const maxB = 23 * 60;
  if (mins < minB || mins > maxB) return null;
  if (mins % 30 !== 0) return null;
  return mins;
}

/**
 * Genera righe slot per disponibilità ricorrente o blocco singolo.
 * `weekdays`: 0 = domenica … 6 = sabato (come `Date#getDay()` locale).
 */
export function expandPublicSlotRows(params: {
  dateFrom: string;
  dateTo: string;
  weekdays: number[];
  blocks: PublicTimeBlock[];
  slotDurationMins: number;
  intervalMins: number;
  barberId: string | null;
  seats: number;
  showBarberName: boolean;
}): ExpandedOpenSlotInsert[] {
  const {
    dateFrom,
    dateTo,
    weekdays,
    blocks,
    slotDurationMins,
    intervalMins,
    barberId,
    seats,
    showBarberName,
  } = params;
  if (slotDurationMins < 15 || slotDurationMins > 240 || intervalMins < 15 || intervalMins > 240) {
    return [];
  }
  const from = parseISO(`${dateFrom}T12:00:00`);
  const to = parseISO(`${dateTo}T12:00:00`);
  if (from > to) return [];

  const set = new Set<string>();
  const out: ExpandedOpenSlotInsert[] = [];

  for (const d of eachDayOfInterval({ start: from, end: to })) {
    const wd = d.getDay();
    if (!weekdays.includes(wd)) continue;
    const slot_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    for (const block of blocks) {
      if (block.endMins <= block.startMins) continue;
      let t = block.startMins;
      while (t + slotDurationMins <= block.endMins) {
        const cm = clampRomeSlotMins(t);
        if (cm !== null) {
          const key = `${slot_date}|${cm}|${barberId ?? "x"}`;
          if (!set.has(key)) {
            set.add(key);
            out.push({
              slot_date,
              slot_mins: cm,
              barber_id: barberId,
              seats,
              slot_duration_mins: slotDurationMins,
              show_barber_name: showBarberName,
            });
          }
        }
        t += intervalMins;
      }
    }
  }

  return out;
}
