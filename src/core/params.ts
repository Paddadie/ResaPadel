// Paramètres de recherche : heures de début possibles et validation.
// Partagé par le formulaire (messages affichés) et la recherche (garde-fou).

import { CLOSING_HOUR, FIRST_START_HOUR } from "../config";
import type { Period, SearchParams } from "./types";

/** Heures de début réellement possibles (le créneau doit finir avant la fermeture), triées. */
export function validStartHours(startHours: number[], durationHours: number): number[] {
  return [...new Set(startHours)].filter((h) => h + durationHours <= CLOSING_HOUR).sort((a, b) => a - b);
}

/** Toutes les heures de début possibles pour une durée : de 10h à 22h en 2h, à 23h en 1h. */
export function possibleStartHours(durationHours: number): number[] {
  const all = Array.from({ length: CLOSING_HOUR - FIRST_START_HOUR }, (_, i) => FIRST_START_HOUR + i);
  return validStartHours(all, durationHours);
}

/** Message expliquant pourquoi la période est inutilisable, ou null. */
export function validatePeriod(period: Period): string | null {
  if (period.kind !== "custom") return null;
  if (!period.from || !period.to) return "Choisissez une date de début et une date de fin.";
  if (period.to < period.from) return "La date de fin doit être après la date de début.";
  return null;
}

/** Message expliquant pourquoi la recherche est impossible, ou null. */
export function validateSearch(params: SearchParams): string | null {
  if (params.days.length === 0) return "Choisissez au moins un jour.";
  if (validStartHours(params.startHours, params.durationHours).length === 0) {
    return "Choisissez au moins une heure de début.";
  }
  return validatePeriod(params.period);
}
