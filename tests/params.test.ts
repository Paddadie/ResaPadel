// Paramètres de recherche (heures possibles, validation) et périodes.

import { describe, expect, test } from "vitest";
import { DEFAULT_SEARCH } from "../src/config";
import { possibleStartHours, validStartHours, validateSearch } from "../src/core/params";
import { datesToCheck, periodRange } from "../src/core/period";
import type { Period, SearchParams } from "../src/core/types";

describe("heures de début", () => {
  test("validStartHours écarte les créneaux qui finiraient après minuit, sans doublon et trié", () => {
    expect(validStartHours([23, 18, 22, 18], 2)).toEqual([18, 22]);
    expect(validStartHours([23], 1)).toEqual([23]);
  });

  test("possibleStartHours : de 10h à 22h en 2h, jusqu'à 23h en 1h", () => {
    expect(possibleStartHours(2)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(possibleStartHours(1).at(-1)).toBe(23);
  });
});

describe("validateSearch", () => {
  const withParams = (changes: Partial<SearchParams>) => validateSearch({ ...DEFAULT_SEARCH, ...changes });

  test("accepte la recherche par défaut", () => {
    expect(validateSearch(DEFAULT_SEARCH)).toBeNull();
  });

  test("explique ce qu'il manque", () => {
    expect(withParams({ days: [] })).toBe("Choisissez au moins un jour.");
    expect(withParams({ startHours: [23] })).toBe("Choisissez au moins une heure de début."); // 23h + 2h > minuit
    expect(withParams({ period: { kind: "custom", from: "2026-10-06", to: "" } })).toBe(
      "Choisissez une date de début et une date de fin.",
    );
    expect(withParams({ period: { kind: "custom", from: "2026-10-06", to: "2026-10-01" } })).toBe(
      "La date de fin doit être après la date de début.",
    );
  });
});

describe("périodes", () => {
  const monday = new Date(2026, 8, 28, 10, 0); // lundi 28/09/2026
  const sunday = new Date(2026, 9, 4, 10, 0); // dimanche 04/10/2026
  const TUE_THU = [2, 4];
  const WEEKEND = [6, 0];
  const dates = (period: Period, days: number[], now: Date) => datesToCheck(days, periodRange(period, now), now);

  test("cette semaine : jusqu'au dimanche", () => {
    expect(dates({ kind: "week" }, TUE_THU, monday)).toEqual(["2026-09-29", "2026-10-01"]);
  });

  test("ce week-end : samedi et dimanche de la semaine en cours", () => {
    expect(dates({ kind: "weekend" }, WEEKEND, monday)).toEqual(["2026-10-03", "2026-10-04"]);
    expect(dates({ kind: "weekend" }, WEEKEND, sunday)).toEqual(["2026-10-04"]); // samedi déjà passé
  });

  test("semaine prochaine : du lundi au dimanche suivants", () => {
    expect(dates({ kind: "next" }, TUE_THU, monday)).toEqual(["2026-10-06", "2026-10-08"]);
    expect(dates({ kind: "next" }, WEEKEND, sunday)).toEqual(["2026-10-10", "2026-10-11"]);
  });

  test("tout : plafonné à 63 jours", () => {
    const all = dates({ kind: "all" }, TUE_THU, monday);
    expect(all[0]).toBe("2026-09-29");
    expect(all.at(-1)).toBe("2026-11-26");
    expect(all).toHaveLength(18);
  });

  test("dates choisies : bornées à aujourd'hui et au plafond", () => {
    expect(dates({ kind: "custom", from: "2026-09-01", to: "2026-10-06" }, TUE_THU, monday)).toEqual([
      "2026-09-29",
      "2026-10-01",
      "2026-10-06",
    ]);
    expect(dates({ kind: "custom", from: "2026-11-20", to: "2027-01-31" }, TUE_THU, monday).at(-1)).toBe("2026-11-26");
  });
});
