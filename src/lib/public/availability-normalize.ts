/** Normalizza il valore restituito da RPC `jsonb` / PostgREST in un array. */
export function rpcJsonbToArray(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.slots)) {
      return o.slots;
    }
  }
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value) as unknown;
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys.sort((a, b) => Number(a) - Number(b)).map((k) => o[k]);
    }
  }
  return [];
}

function pickNum(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return undefined;
}

export type PublicAvailabilitySlotDto = {
  at: string;
  barberId: string | null;
  barberName: string;
  durationMins?: number;
  seatsLeft?: number;
};

/** Converte una riga RPC / JSON in forma usata dal client (camelCase + fallback snake_case). */
export function normalizeAvailabilitySlotRow(x: unknown): PublicAvailabilitySlotDto | null {
  if (x == null || typeof x !== "object") {
    return null;
  }
  const o = x as Record<string, unknown>;
  const atRaw = o.at ?? o.slot_at;
  if (atRaw == null) {
    return null;
  }
  const at = typeof atRaw === "string" ? atRaw : String(atRaw);
  const barberRaw = o.barberId ?? o.barber_id;
  const barberId =
    barberRaw === null || barberRaw === undefined || barberRaw === ""
      ? null
      : typeof barberRaw === "string"
        ? barberRaw
        : String(barberRaw);
  const barberName = String(o.barberName ?? o.barber_name ?? "");
  return {
    at,
    barberId,
    barberName,
    durationMins: pickNum(o.durationMins, o.duration_mins),
    seatsLeft: pickNum(o.seatsLeft, o.seats_left),
  };
}
