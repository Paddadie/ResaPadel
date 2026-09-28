// Tout ce qui dépend de l'API Doinsport : adresses et lecture des réponses.

import { CLUB, SITE_URL } from "../config";
import { toMinutes } from "./time";
import type { FetchJson, Offer } from "./types";

export interface RequestWindow {
  from: string; // "HH:MM:SS"
  to: string;
}

/** Disponibilités d'un jour. L'API filtre from/to sur l'heure de début des créneaux. */
export function buildPlanningUrl(
  apiBaseUrl: string,
  activityId: string,
  isoDate: string,
  window: RequestWindow,
): string {
  const params = new URLSearchParams({
    "club.id": CLUB.id,
    from: window.from,
    to: window.to,
    "activities.id": activityId,
    bookingType: "unique",
  });
  return `${apiBaseUrl}/clubs/playgrounds/plannings/${isoDate}?${params}`;
}

export function buildActivitiesUrl(apiBaseUrl: string): string {
  const params = new URLSearchParams({ "club.block.price.category.id": CLUB.categoryId, "club.id": CLUB.id });
  return `${apiBaseUrl}/activities?${params}`;
}

/**
 * Page de réservation padel du club. Le site ne permet pas de présélectionner
 * la date ni le créneau par l'URL (vérifié dans son code) : il reste à choisir
 * le jour puis le créneau.
 */
export function buildBookingUrl(activityId: string = CLUB.activityId): string {
  const quoted = (value: string) => encodeURIComponent(JSON.stringify(value));
  return (
    `${SITE_URL}/select-booking?guid=${quoted(CLUB.id)}&from=sport` +
    `&activitySelectedId=${quoted(activityId)}&categoryId=${quoted(CLUB.categoryId)}`
  );
}

/**
 * Éléments d'une collection. Selon l'en-tête Accept, l'API renvoie du JSON-LD
 * ({ "hydra:member": [...] }) ou un simple tableau JSON.
 */
export function collectionItems(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const items = (json as Record<string, unknown> | null)?.["hydra:member"];
  if (!Array.isArray(items)) throw new Error("Réponse inattendue de l'API : ni tableau, ni champ hydra:member");
  return items;
}

interface ApiPrice {
  bookable?: boolean;
  duration?: number;
  pricePerParticipant?: number;
  participantCount?: number;
}
interface ApiPlayground {
  id: string;
  name: string;
  activities?: { id: string; slots?: { startAt: string; prices?: ApiPrice[] }[] }[];
}

/**
 * Offres réservables d'une réponse « plannings ». Seuls les tarifs `bookable: true`
 * sont gardés, comme le fait le site. Le prix total est en centimes.
 * Un tarif réservable incomplet signale un changement de l'API : mieux vaut une
 * erreur visible qu'un prix faux affiché.
 */
export function parsePlanning(json: unknown, activityId: string): { terrainCount: number; offers: Offer[] } {
  const playgrounds = collectionItems(json) as ApiPlayground[];
  const offers: Offer[] = [];
  for (const playground of playgrounds) {
    for (const activity of playground.activities ?? []) {
      if (activity.id !== activityId) continue;
      for (const slot of activity.slots ?? []) {
        for (const price of slot.prices ?? []) {
          if (price.bookable !== true) continue;
          const { duration, pricePerParticipant, participantCount } = price;
          if (typeof duration !== "number" || typeof pricePerParticipant !== "number" || !participantCount) {
            throw new Error(`Réponse inattendue de l'API : tarif sans durée ou sans prix (${slot.startAt})`);
          }
          offers.push({
            terrain: playground.name,
            terrainId: playground.id,
            start: toMinutes(slot.startAt),
            duration: Math.round(duration / 60),
            priceCents: pricePerParticipant * participantCount,
          });
        }
      }
    }
  }
  return { terrainCount: playgrounds.length, offers };
}

/** Retrouve l'identifiant de l'activité par son nom, si celui configuré a changé. */
export async function resolveActivityId(apiBaseUrl: string, fetchJson: FetchJson): Promise<string | null> {
  const activities = collectionItems(await fetchJson(buildActivitiesUrl(apiBaseUrl))) as { id: string; name: string }[];
  const wanted = CLUB.activityName.trim().toLowerCase();
  return activities.find((a) => String(a.name).trim().toLowerCase() === wanted)?.id ?? null;
}
