/** Minuti da mezzanotte (solo :00 e :30), fascia 05:00–23:00 inclusi — allineata a `location_open_slots` / RPC. */
export const ROME_OPEN_SLOT_MINUTES = Object.freeze(
  Array.from({ length: (23 * 60 - 5 * 60) / 30 + 1 }, (_, i) => 5 * 60 + i * 30),
);

export function formatRomeSlotMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const min = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
