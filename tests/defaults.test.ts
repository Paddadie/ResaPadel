// Recherche lancée à l'ouverture : réglage d'origine ou réglage enregistré sur l'appareil.

import { describe, expect, test } from "vitest";
import { DEFAULT_SEARCH } from "../src/config";
import { loadDefaultSearch, resetDefaultSearch, saveDefaultSearch, type KeyValueStore } from "../src/core/defaults";

/** Stockage en mémoire, à la place de localStorage. */
function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  };
}

const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const WEEKEND_MORNING = { days: [6, 0], startHours: [10, 11], durationHours: 1 as const };

describe("recherche à l'ouverture", () => {
  test("sans réglage : mardi et jeudi, 18h ou 19h, 2h", () => {
    expect(loadDefaultSearch(memoryStore())).toEqual(DEFAULT_SEARCH);
    expect(loadDefaultSearch(null)).toEqual(DEFAULT_SEARCH);
  });

  test("enregistre jours, heures et durée ; la période et le mode restent ceux d'origine", () => {
    const store = memoryStore();
    expect(saveDefaultSearch(store, WEEKEND_MORNING)).toBe(true);
    expect(loadDefaultSearch(store)).toEqual({ ...DEFAULT_SEARCH, ...WEEKEND_MORNING });
  });

  test("revenir au réglage d'origine efface le réglage enregistré", () => {
    const store = memoryStore();
    saveDefaultSearch(store, WEEKEND_MORNING);
    resetDefaultSearch(store);
    expect(loadDefaultSearch(store)).toEqual(DEFAULT_SEARCH);
  });

  test("un réglage illisible ou incohérent redonne le réglage d'origine", () => {
    const stored = (value: string) => loadDefaultSearch(memoryStore({ "padel.recherche-par-defaut": value }));
    expect(stored("{pas du json")).toEqual(DEFAULT_SEARCH);
    expect(stored(JSON.stringify({ ...WEEKEND_MORNING, days: [9] }))).toEqual(DEFAULT_SEARCH);
    expect(stored(JSON.stringify({ ...WEEKEND_MORNING, durationHours: 3 }))).toEqual(DEFAULT_SEARCH);
    expect(stored(JSON.stringify({ ...WEEKEND_MORNING, days: [] }))).toEqual(DEFAULT_SEARCH); // aucun jour
    expect(stored(JSON.stringify({ days: [2], startHours: [23], durationHours: 2 }))).toEqual(DEFAULT_SEARCH); // 23h + 2h
  });

  test("un stockage refusé (navigation privée) ne bloque pas l'application", () => {
    expect(loadDefaultSearch(brokenStore)).toEqual(DEFAULT_SEARCH);
    expect(saveDefaultSearch(brokenStore, WEEKEND_MORNING)).toBe(false);
    expect(saveDefaultSearch(null, WEEKEND_MORNING)).toBe(false);
    expect(() => resetDefaultSearch(brokenStore)).not.toThrow();
  });

  test("le réglage renvoyé est une copie : le modifier ne change pas la valeur d'origine", () => {
    const params = loadDefaultSearch(null);
    params.days.push(5);
    expect(DEFAULT_SEARCH.days).toEqual([2, 4]);
  });
});
