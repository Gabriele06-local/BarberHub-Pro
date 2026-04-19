/** Estrae data calendario e minuti da mezzanotte in fuso Europe/Rome (allineato a `location_open_slots`). */
export function romeYmdAndMinsFromInstant(iso: string): { ymd: string; mins: number } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (type: Intl.DateTimeFormatPart["type"]) => parts.find((p) => p.type === type)?.value ?? "";
  const ymd = `${g("year")}-${g("month")}-${g("day")}`;
  const mins = Number(g("hour")) * 60 + Number(g("minute"));
  return { ymd, mins };
}
