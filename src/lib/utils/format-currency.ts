const eurIt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatEurIt(amount: number): string {
  return eurIt.format(amount);
}
