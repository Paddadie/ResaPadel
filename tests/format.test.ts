// Adresses construites et textes affichés.

import { describe, expect, test } from "vitest";
import { CLUB, DEFAULT_SEARCH } from "../src/config";
import { buildBookingUrl, buildPlanningUrl } from "../src/core/doinsport";
import {
  describeNoResult,
  describePeriod,
  describeSearch,
  formatDay,
  formatEuros,
  formatTimeRange,
  formatWhere,
} from "../src/core/format";
import { toMinutes } from "../src/core/time";
import type { SearchOutcome, SearchParams } from "../src/core/types";
import { API, hours } from "./helpers";

describe("adresses", () => {
  test("buildPlanningUrl reproduit la requête du site", () => {
    expect(buildPlanningUrl(API, CLUB.activityId, "2026-10-06", { from: "18:00:00", to: "20:59:59" })).toBe(
      "https://api.test/clubs/playgrounds/plannings/2026-10-06" +
        "?club.id=6178c4ab-50d4-4f2f-b360-f699f9034635&from=18%3A00%3A00&to=20%3A59%3A59" +
        "&activities.id=ce8c306e-224a-4f24-aa9d-6500580924dc&bookingType=unique",
    );
  });

  test("buildBookingUrl reproduit l'URL de la page padel du site", () => {
    expect(buildBookingUrl()).toBe(
      "https://sporting-nantes.doinsport.club/select-booking?guid=%226178c4ab-50d4-4f2f-b360-f699f9034635%22" +
        "&from=sport&activitySelectedId=%22ce8c306e-224a-4f24-aa9d-6500580924dc%22" +
        "&categoryId=%22df383ee7-70e7-4f9f-bb8e-2799c881804e%22",
    );
  });
});

describe("heures", () => {
  test("toMinutes lit le format HH:MM de l'API et refuse le reste", () => {
    expect(toMinutes("18:30")).toBe(1110);
    expect(toMinutes("9:00")).toBe(540);
    for (const invalid of ["18h", "18:30:00", "18:60", "25:00"]) expect(() => toMinutes(invalid)).toThrow();
  });
});

describe("textes affichés", () => {
  test("formats courts", () => {
    expect(formatDay("2026-11-26")).toBe("Jeu 26 nov.");
    expect(formatTimeRange(hours(22, 24))).toBe("22:00 → 00:00"); // minuit
    expect(formatEuros(8000)).toBe("80 €");
    expect(formatEuros(7250)).toBe("72,50 €");
    expect(
      formatWhere({
        date: "2026-10-08",
        range: hours(19, 21),
        type: "combinaison",
        segments: [
          { start: 19 * 60, terrain: "Padel 1" },
          { start: 20 * 60, terrain: "Padel 2" },
        ],
        priceCents: 8000,
      }),
    ).toBe("19h Padel 1 + 20h Padel 2");
  });

  test("describeSearch résume la recherche", () => {
    expect(describeSearch(DEFAULT_SEARCH)).toBe("Toutes les dispos de 2h, le mardi ou jeudi, début à 18h ou 19h");
    const weekendAnyTime: SearchParams = {
      days: [0, 6],
      startHours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      durationHours: 2,
      period: { kind: "weekend" },
      mode: "first",
    };
    expect(describeSearch(weekendAnyTime)).toBe(
      "La prochaine dispo de 2h, le samedi ou dimanche, à n'importe quelle heure",
    );
  });

  test("describePeriod donne les dates en clair", () => {
    const monday = new Date(2026, 8, 28, 10, 0);
    expect(describePeriod({ kind: "weekend" }, monday)).toBe("Du Sam 3 oct. au Dim 4 oct.");
    expect(describePeriod({ kind: "weekend" }, new Date(2026, 9, 4, 10, 0))).toBe("Le Dim 4 oct.");
    expect(describePeriod({ kind: "custom", from: "2026-09-01", to: "2026-10-06" }, monday)).toBe(
      "Du Lun 28 sept. au Mar 6 oct.", // bornée à aujourd'hui
    );
    expect(describePeriod({ kind: "all" }, monday)).toMatch(/dernier jour ouvert/);
  });

  test("describeNoResult explique pourquoi rien n'est trouvé", () => {
    const outcome = (changes: Partial<SearchOutcome>): SearchOutcome => ({
      results: [],
      warnings: [],
      activityId: CLUB.activityId,
      datesChecked: 4,
      bookingLimit: null,
      lastOpenDate: "2026-10-08",
      ...changes,
    });
    expect(describeNoResult(outcome({ datesChecked: 0 }), DEFAULT_SEARCH)).toMatch(/Aucun des jours choisis/);
    expect(describeNoResult(outcome({ bookingLimit: "2026-11-28", lastOpenDate: null }), DEFAULT_SEARCH)).toMatch(
      /pas encore ouvertes/,
    );
    expect(describeNoResult(outcome({}), DEFAULT_SEARCH)).toBe("Rien de libre pour cette recherche.");
    expect(describeNoResult(outcome({}), { ...DEFAULT_SEARCH, mode: "first" })).toBe(
      "Rien de libre pour cette recherche sur toute la période.",
    );
  });
});
