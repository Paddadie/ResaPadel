// Outils partagés par les tests : vraies réponses de l'API et API simulée.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUB } from "../src/config";
import { parsePlanning } from "../src/core/doinsport";
import type { Offer } from "../src/core/types";

export const API = "https://api.test";
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/**
 * Réponse réelle de l'API enregistrée dans tests/fixtures. Elles contiennent les débuts
 * de 18h à 23h : une fenêtre plus large que celle de la recherche par défaut.
 */
export function fixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

export function offersOf(name: string): Offer[] {
  return parsePlanning(fixture(name), CLUB.activityId).offers;
}

/** Plage horaire en heures pleines : hours(18, 20) = 18h-20h. */
export const hours = (start: number, end: number) => ({ start: start * 60, end: end * 60 });

export const EMPTY_DAY = { "hydra:member": [{ activities: [] }] }; // un terrain, aucune offre
export const CLOSED_DAY = { "hydra:member": [] }; // au-delà de l'horizon de réservation

/** Date "YYYY-MM-DD" d'une URL de planning. */
export const dateOf = (url: string) => /plannings\/(\d{4}-\d{2}-\d{2})/.exec(url)![1];

/** API simulée : `respond` renvoie la réponse (ou lève une erreur) ; les URL demandées sont gardées dans `calls`. */
export function fakeApi(respond: (url: string) => unknown) {
  const calls: string[] = [];
  const fetchJson = async (url: string) => {
    calls.push(url);
    return respond(url);
  };
  return { calls, fetchJson };
}
