// Heures et dates, en heure locale. Les dates circulent au format "YYYY-MM-DD".

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "18:30" -> 1110 (minutes depuis minuit). */
export function toMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) throw new Error(`Heure invalide : "${hhmm}" (format attendu HH:MM)`);
  const total = Number(match[1]) * 60 + Number(match[2]);
  if (Number(match[2]) > 59 || total > 24 * 60) throw new Error(`Heure invalide : "${hhmm}"`);
  return total;
}

/** 1110 -> "18:30". Minuit s'affiche "00:00". */
export function formatMinutes(total: number): string {
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "YYYY-MM-DD" -> Date locale à minuit. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date locale à minuit, décalée de `days` jours. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
