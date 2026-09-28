// Types partagés par la logique de recherche, l'interface et la ligne de commande.

/** Jour de la semaine, comme Date.getDay() : 0 = dimanche, 1 = lundi… 6 = samedi. */
export type Weekday = number;

/** Période de recherche. Les dates "YYYY-MM-DD" ne concernent que les dates choisies. */
export type Period = { kind: "all" | "week" | "weekend" | "next" } | { kind: "custom"; from: string; to: string };

export type PeriodKind = Period["kind"];

export interface SearchParams {
  days: Weekday[];
  /** Heures de début acceptées (10 à 23). */
  startHours: number[];
  durationHours: 1 | 2;
  period: Period;
  /** "all" : toutes les dispos ; "first" : le premier jour qui a une dispo. */
  mode: "all" | "first";
}

/** Jours, heures et durée : la partie d'une recherche réglable dans la page Réglages. */
export type SlotChoice = Pick<SearchParams, "days" | "startHours" | "durationHours">;

/** Un tarif réservable : un terrain, une heure de début, une durée. Heures en minutes. */
export interface Offer {
  terrain: string;
  terrainId: string;
  start: number;
  duration: number;
  priceCents: number;
}

export interface TimeRange {
  start: number; // minutes depuis minuit
  end: number;
}

export type Match =
  | { type: "complet"; terrains: string[]; priceCents: number }
  | { type: "combinaison"; segments: { start: number; terrain: string }[]; priceCents: number };

export type SearchResult = Match & { date: string; range: TimeRange };

export interface SearchOutcome {
  results: SearchResult[];
  warnings: string[];
  activityId: string;
  datesChecked: number;
  /** Premier jour interrogé pas encore ouvert à la réservation, s'il y en a un. */
  bookingLimit: string | null;
  /** Dernier jour interrogé ouvert à la réservation. */
  lastOpenDate: string | null;
}

export type FetchJson = (url: string) => Promise<unknown>;
