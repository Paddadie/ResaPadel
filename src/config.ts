// Configuration de l'application : club, adresses, recherche par défaut.
// Les identifiants du club sont publics (visibles dans l'URL du site) : rien de secret.

import type { SearchParams } from "./core/types";

export const CLUB = {
  id: "6178c4ab-50d4-4f2f-b360-f699f9034635",
  activityId: "ce8c306e-224a-4f24-aa9d-6500580924dc",
  activityName: "Padel", // sert à retrouver l'activité si son identifiant change
  categoryId: "df383ee7-70e7-4f9f-bb8e-2799c881804e",
};

/** API Doinsport, appelée directement depuis Node (cli.ts, pas de CORS). */
export const API_BASE_URL = "https://api-v3.doinsport.club";

/** Relais Cloudflare (worker/relay.js), utilisé par le navigateur à cause du CORS. */
export const RELAY_URL = "https://padel-relais.pauldabadie.workers.dev";

export const SITE_URL = "https://sporting-nantes.doinsport.club";

/** Heures de début proposées : le club est ouvert de 10h à minuit. */
export const FIRST_START_HOUR = 10;
export const CLOSING_HOUR = 24;

/**
 * Nombre maximal de jours parcourus. Le club ouvre les réservations environ
 * 60 jours à l'avance (observé le 28/09/2026) ; la recherche s'arrête d'elle-même
 * au premier jour pas encore ouvert, ce plafond n'est qu'une sécurité.
 */
export const MAX_DAYS_AHEAD = 63;

/** Délai maximal d'une requête vers l'API, par le relais ou la ligne de commande. */
export const API_TIMEOUT_MS = 15_000;

/** Côté navigateur, un peu plus long : en cas de lenteur, c'est le relais qui abandonne en premier (erreur 502). */
export const BROWSER_TIMEOUT_MS = API_TIMEOUT_MS + 5_000;

/** Recherche proposée à l'ouverture : mardi et jeudi, 2h, début à 18h ou 19h. */
export const DEFAULT_SEARCH: SearchParams = {
  days: [2, 4],
  startHours: [18, 19],
  durationHours: 2,
  period: { kind: "all" },
  mode: "all",
};
