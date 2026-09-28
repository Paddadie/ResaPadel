// Règle de recherche et orchestration des appels à l'API.

import { CLUB } from "../config";
import { buildPlanningUrl, parsePlanning, resolveActivityId, type RequestWindow } from "./doinsport";
import { formatDay } from "./format";
import { validStartHours, validateSearch } from "./params";
import { datesToCheck, periodRange } from "./period";
import { pad2, toIsoDate } from "./time";
import type { FetchJson, Match, Offer, SearchOutcome, SearchParams, SearchResult, TimeRange } from "./types";

const ONE_HOUR = 60; // en minutes

/** Jours en échec d'affilée à partir desquels on considère que le site ne répond plus. */
const MAX_CONSECUTIVE_FAILURES = 2;

type Planning = ReturnType<typeof parsePlanning>;

function cheapest(offers: Offer[]): Offer {
  return offers.reduce((best, offer) => (offer.priceCents < best.priceCents ? offer : best));
}

function totalPrice(offers: Offer[]): number {
  return offers.reduce((sum, offer) => sum + offer.priceCents, 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Cherche une disponibilité pour une plage donnée :
 * 1. un créneau de la durée complète sur un terrain (prioritaire) ;
 * 2. sinon, au-delà d'1h, une suite de créneaux d'1h : sur le même terrain
 *    si l'un d'eux est libre toute la plage, sinon le moins cher à chaque heure.
 * Renvoie null si rien ne convient.
 */
export function findForRange(offers: Offer[], range: TimeRange): Match | null {
  const duration = range.end - range.start;

  const fullOffers = offers.filter((o) => o.start === range.start && o.duration === duration);
  if (fullOffers.length > 0) {
    const byTerrain = new Map<string, Offer>();
    for (const offer of fullOffers) {
      const known = byTerrain.get(offer.terrainId);
      if (!known || offer.priceCents < known.priceCents) byTerrain.set(offer.terrainId, offer);
    }
    const terrains = [...byTerrain.values()].sort((a, b) => a.terrain.localeCompare(b.terrain));
    return { type: "complet", terrains: terrains.map((o) => o.terrain), priceCents: cheapest(terrains).priceCents };
  }

  if (duration <= ONE_HOUR) return null;

  // Créneaux d'1h libres à chaque heure de la plage.
  const hourly: Offer[][] = [];
  for (let start = range.start; start < range.end; start += ONE_HOUR) {
    const candidates = offers.filter((o) => o.start === start && o.duration === ONE_HOUR);
    if (candidates.length === 0) return null;
    hourly.push(candidates);
  }

  const sameTerrainChains = hourly[0]
    .map((first) => hourly.map((candidates) => candidates.find((o) => o.terrainId === first.terrainId)))
    .filter((chain): chain is Offer[] => chain.every((offer) => offer !== undefined));
  const segments =
    sameTerrainChains.length > 0
      ? sameTerrainChains.reduce((best, chain) => (totalPrice(chain) < totalPrice(best) ? chain : best))
      : hourly.map(cheapest);

  return {
    type: "combinaison",
    segments: segments.map((o) => ({ start: o.start, terrain: o.terrain })),
    priceCents: totalPrice(segments),
  };
}

/**
 * Fenêtre from/to à demander à l'API. Elle filtre sur l'heure de début : il faut
 * inclure les débuts des créneaux d'1h utiles aux combinaisons (19h pour 18h-20h).
 */
export function requestWindow(startHours: number[], durationHours: number): RequestWindow {
  const first = Math.min(...startHours);
  const lastStart = Math.max(...startHours) + durationHours - 1;
  return { from: `${pad2(first)}:00:00`, to: `${pad2(lastStart)}:59:59` };
}

/** Vrai si le créneau commence déjà (ou est passé) le jour même. */
export function isPast(isoDate: string, startMinutes: number, now: Date): boolean {
  if (isoDate !== toIsoDate(now)) return false;
  return startMinutes <= now.getHours() * 60 + now.getMinutes();
}

export interface SearchOptions {
  params: SearchParams;
  apiBaseUrl: string;
  fetchJson: FetchJson;
  now?: Date;
  log?: (message: string) => void;
  /** Appelé après chaque jour interrogé, pour afficher l'avancement. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Recherche complète. Les requêtes partent une par une pour ménager le site,
 * et s'arrêtent au premier jour pas encore ouvert à la réservation (ou au
 * premier jour qui a une dispo, en mode "first").
 *
 * Un jour qui ne répond pas est retenté une fois, puis sauté avec un avertissement,
 * sauf le premier : son échec signifie en général que le site est injoignable.
 * Après MAX_CONSECUTIVE_FAILURES jours en échec d'affilée, la recherche s'interrompt
 * en gardant les résultats déjà trouvés.
 */
export async function searchAvailabilities(options: SearchOptions): Promise<SearchOutcome> {
  const { params, apiBaseUrl, fetchJson, now = new Date() } = options;
  const log = options.log ?? (() => {});
  const onProgress = options.onProgress ?? (() => {});

  const invalid = validateSearch(params);
  if (invalid) throw new Error(invalid);

  const startHours = validStartHours(params.startHours, params.durationHours);
  const dates = datesToCheck(params.days, periodRange(params.period, now));
  const window = requestWindow(startHours, params.durationHours);
  const outcome: SearchOutcome = {
    results: [],
    warnings: [],
    activityId: CLUB.activityId,
    datesChecked: 0,
    bookingLimit: null,
    lastOpenDate: null,
  };

  const fetchPlanning = async (isoDate: string): Promise<Planning> => {
    const url = buildPlanningUrl(apiBaseUrl, outcome.activityId, isoDate, window);
    log(`GET ${url}`);
    return parsePlanning(await fetchJson(url), outcome.activityId);
  };

  const loadPlanning = async (isoDate: string): Promise<Planning> => {
    try {
      return await fetchPlanning(isoDate);
    } catch (error) {
      log(`Échec le ${isoDate} (${errorMessage(error)}) : nouvelle tentative`);
      return fetchPlanning(isoDate);
    }
  };

  // Premier jour : si l'API ne renvoie rien d'exploitable, on vérifie que
  // l'identifiant de l'activité n'a pas changé avant de conclure.
  const loadFirstPlanning = async (isoDate: string): Promise<Planning> => {
    let planning: Planning | null = null;
    let failure: unknown = null;
    try {
      planning = await loadPlanning(isoDate);
    } catch (error) {
      failure = error;
    }
    if (planning && planning.terrainCount > 0) return planning;

    log("Aucun terrain renvoyé : vérification de l'identifiant de l'activité");
    const resolvedId = await resolveActivityId(apiBaseUrl, fetchJson).catch(() => null);
    if (resolvedId && resolvedId !== outcome.activityId) {
      outcome.warnings.push(
        `L'identifiant de l'activité « ${CLUB.activityName} » a changé. ` +
          `Nouvel identifiant : ${resolvedId} (à reporter dans src/config.ts).`,
      );
      outcome.activityId = resolvedId;
      return loadPlanning(isoDate);
    }
    if (planning) return planning;
    throw failure;
  };

  let consecutiveFailures = 0;
  for (const [index, isoDate] of dates.entries()) {
    outcome.datesChecked++;
    let planning: Planning;
    try {
      planning = index === 0 ? await loadFirstPlanning(isoDate) : await loadPlanning(isoDate);
    } catch (error) {
      if (index === 0) throw error;
      outcome.warnings.push(`Le ${formatDay(isoDate)} n'a pas pu être vérifié (${errorMessage(error)})`);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        outcome.warnings.push("Recherche interrompue : le site du club ne répond plus.");
        break;
      }
      onProgress(index + 1, dates.length);
      continue;
    }
    consecutiveFailures = 0;
    onProgress(index + 1, dates.length);

    if (planning.terrainCount === 0) {
      // Au-delà de l'horizon de réservation, l'API ne renvoie plus aucun terrain.
      log(`Aucun terrain le ${isoDate} : réservations pas encore ouvertes, fin de la recherche`);
      outcome.bookingLimit = isoDate;
      break;
    }
    outcome.lastOpenDate = isoDate;

    const found: SearchResult[] = [];
    for (const hour of startHours) {
      const range = { start: hour * 60, end: (hour + params.durationHours) * 60 };
      if (isPast(isoDate, range.start, now)) continue;
      const match = findForRange(planning.offers, range);
      if (match) found.push({ date: isoDate, range, ...match });
    }
    outcome.results.push(...found);
    if (params.mode === "first" && found.length > 0) break;
  }

  outcome.results.sort((a, b) => a.date.localeCompare(b.date) || a.range.start - b.range.start);
  return outcome;
}
