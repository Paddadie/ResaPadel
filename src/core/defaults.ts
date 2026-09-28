// Recherche proposée à l'ouverture : DEFAULT_SEARCH, sauf si l'utilisateur a réglé ses
// propres jours, heures et durée dans la page Réglages. Ce réglage est mémorisé sur
// l'appareil ; le stockage est passé en paramètre pour pouvoir être simulé dans les tests.

import { CLOSING_HOUR, DEFAULT_SEARCH, FIRST_START_HOUR } from "../config";
import { validateSearch } from "./params";
import type { SearchParams, SlotChoice } from "./types";

const STORAGE_KEY = "padel.recherche-par-defaut";

/** La partie de localStorage utilisée. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isIntegerList = (value: unknown, min: number, max: number): value is number[] =>
  Array.isArray(value) && value.every((n) => Number.isInteger(n) && n >= min && n <= max);

function isSlotChoice(value: unknown): value is SlotChoice {
  const choice = value as SlotChoice | null;
  return (
    isIntegerList(choice?.days, 0, 6) &&
    isIntegerList(choice?.startHours, FIRST_START_HOUR, CLOSING_HOUR - 1) &&
    (choice?.durationHours === 1 || choice?.durationHours === 2)
  );
}

/** Jours, heures et durée d'une recherche. */
export function slotChoiceOf(params: SlotChoice): SlotChoice {
  return { days: [...params.days], startHours: [...params.startHours], durationHours: params.durationHours };
}

/** Recherche à proposer à l'ouverture. Un réglage absent, illisible ou invalide redonne DEFAULT_SEARCH. */
export function loadDefaultSearch(store: KeyValueStore | null): SearchParams {
  try {
    const saved: unknown = JSON.parse(store?.getItem(STORAGE_KEY) ?? "null");
    if (isSlotChoice(saved)) {
      const params: SearchParams = { ...structuredClone(DEFAULT_SEARCH), ...slotChoiceOf(saved) };
      if (validateSearch(params) === null) return params;
    }
  } catch {
    // Stockage indisponible (navigation privée) ou contenu illisible : réglage d'origine.
  }
  return structuredClone(DEFAULT_SEARCH);
}

/** Mémorise les jours, heures et durée à proposer à l'ouverture. Renvoie false si c'est impossible. */
export function saveDefaultSearch(store: KeyValueStore | null, choice: SlotChoice): boolean {
  try {
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(slotChoiceOf(choice)));
    return true;
  } catch {
    return false; // stockage plein ou refusé
  }
}

/** Revient au réglage d'origine (DEFAULT_SEARCH). */
export function resetDefaultSearch(store: KeyValueStore | null): void {
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    // rien à effacer
  }
}
