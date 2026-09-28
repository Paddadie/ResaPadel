// Mise en forme pour l'affichage (interface et ligne de commande).

import { possibleStartHours, validStartHours } from "./params";
import { periodRange } from "./period";
import { addDays, formatMinutes, fromIsoDate, toIsoDate } from "./time";
import type { Period, SearchOutcome, SearchParams, SearchResult, TimeRange } from "./types";

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTH_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi en premier

/** ["a", "b", "c"] -> "a, b ou c" */
export function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ou ${items.at(-1)}`;
}

/** "2026-10-06" -> "Mar 6 oct." */
export function formatDay(isoDate: string): string {
  const day = fromIsoDate(isoDate);
  return `${DAY_SHORT[day.getDay()]} ${day.getDate()} ${MONTH_SHORT[day.getMonth()]}`;
}

/** { 18:00, 20:00 } -> "18:00 → 20:00" */
export function formatTimeRange(range: TimeRange): string {
  return `${formatMinutes(range.start)} → ${formatMinutes(range.end)}`;
}

/** 8000 -> "80 €", 7250 -> "72,50 €" */
export function formatEuros(cents: number): string {
  const euros = cents / 100;
  return Number.isInteger(euros) ? `${euros} €` : `${euros.toFixed(2).replace(".", ",")} €`;
}

/** Terrain(s) d'un résultat : "Padel 1 ou Padel 2", ou "18h Padel 1 + 19h Padel 2". */
export function formatWhere(result: SearchResult): string {
  if (result.type === "complet") return result.terrains.join(" ou ");
  return result.segments.map((s) => `${s.start / 60}h ${s.terrain}`).join(" + ");
}

/** Période en clair, par exemple « Du Lun 5 oct. au Dim 11 oct. ». */
export function describePeriod(period: Period, now: Date): string {
  if (period.kind === "all") return "Jusqu'au dernier jour ouvert à la réservation (environ 60 jours)";
  const { from, to } = periodRange(period, now);
  const today = addDays(now, 0);
  const start = toIsoDate(from < today ? today : from);
  const end = toIsoDate(to);
  if (start === end) return `Le ${formatDay(end)}`;
  return `Du ${formatDay(start)} au ${formatDay(end)}`;
}

/** Résumé d'une recherche, par exemple « Toutes les dispos de 2h, le mardi ou jeudi, début à 18h ou 19h ». */
export function describeSearch(params: SearchParams): string {
  const days = WEEK_ORDER.filter((d) => params.days.includes(d)).map((d) => DAY_LONG[d]);
  const hours = validStartHours(params.startHours, params.durationHours);
  const anyHour = hours.length === possibleStartHours(params.durationHours).length;
  const hoursText = anyHour ? "à n'importe quelle heure" : `début à ${joinOr(hours.map((h) => `${h}h`))}`;
  const what = params.mode === "all" ? "Toutes les dispos" : "La prochaine dispo";
  return `${what} de ${params.durationHours}h, le ${joinOr(days)}, ${hoursText}`;
}

/** Explication affichée quand une recherche ne trouve aucun créneau. */
export function describeNoResult(outcome: SearchOutcome, params: SearchParams): string {
  if (outcome.datesChecked === 0) return "Aucun des jours choisis ne tombe dans cette période.";
  if (outcome.bookingLimit && !outcome.lastOpenDate) {
    return "Les réservations ne sont pas encore ouvertes pour ces dates (le club ouvre environ 60 jours à l'avance).";
  }
  return `Rien de libre pour cette recherche${params.mode === "first" ? " sur toute la période" : ""}.`;
}
