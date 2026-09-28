// Lecture des réponses de l'API, règle de recherche et orchestration des requêtes.

import { describe, expect, test } from "vitest";
import { CLUB, DEFAULT_SEARCH } from "../src/config";
import { parsePlanning } from "../src/core/doinsport";
import { findForRange, isPast, requestWindow, searchAvailabilities } from "../src/core/search";
import type { Offer, SearchParams } from "../src/core/types";
import { API, CLOSED_DAY, EMPTY_DAY, dateOf, fakeApi, fixture, hours, offersOf } from "./helpers";

const offer = (terrain: string, startHour: number, priceCents = 4000): Offer => ({
  terrain,
  terrainId: terrain,
  start: startHour * 60,
  duration: 60,
  priceCents,
});

// --- Lecture de la réponse -------------------------------------------------

describe("parsePlanning", () => {
  test("ne garde que les tarifs réservables et calcule le prix total", () => {
    const { terrainCount, offers } = parsePlanning(fixture("planning-2026-09-29.json"), CLUB.activityId);
    expect(terrainCount).toBe(2);
    // 29/09 : sur chaque terrain, seuls 22h (1h et 2h) et 23h (1h) sont réservables.
    expect(offers).toHaveLength(6);
    const twoHours = offers.find((o) => o.terrain === "Padel 1" && o.start === 22 * 60 && o.duration === 120);
    expect(twoHours?.priceCents).toBe(6400); // 16 € × 4 joueurs, affiché 64 € sur le site
  });

  test("accepte aussi un simple tableau JSON (Accept: application/json)", () => {
    const plain = fixture("planning-2026-09-29.json")["hydra:member"];
    expect(parsePlanning(plain, CLUB.activityId).offers).toHaveLength(6);
  });

  test("28/09 capturé à 23h : tous les créneaux sont passés, donc non réservables", () => {
    const { terrainCount, offers } = parsePlanning(fixture("planning-2026-09-28.json"), CLUB.activityId);
    expect(terrainCount).toBe(2);
    expect(offers).toHaveLength(0);
  });

  test("signale une réponse inattendue", () => {
    expect(() => parsePlanning({ foo: 1 }, CLUB.activityId)).toThrow(/hydra:member/);
  });

  test("signale un tarif réservable sans prix plutôt que d'afficher 0 €", () => {
    const json = fixture("planning-2026-10-06.json");
    const bookable = json["hydra:member"][0].activities[0].slots
      .flatMap((slot: any) => slot.prices)
      .find((price: any) => price.bookable);
    delete bookable.pricePerParticipant;
    expect(() => parsePlanning(json, CLUB.activityId)).toThrow(/sans durée ou sans prix/);
  });
});

// --- Règle de recherche ------------------------------------------------------

describe("findForRange", () => {
  test("06/10 : 2h à 18h et à 19h sur Padel 1 uniquement", () => {
    const offers = offersOf("planning-2026-10-06.json");
    expect(findForRange(offers, hours(18, 20))).toEqual({ type: "complet", terrains: ["Padel 1"], priceCents: 8000 });
    expect(findForRange(offers, hours(19, 21))).toEqual({ type: "complet", terrains: ["Padel 1"], priceCents: 8000 });
  });

  test("29/09 : 22h-00h libre en 2h sur les deux terrains, 20h-22h pris", () => {
    const offers = offersOf("planning-2026-09-29.json");
    expect(findForRange(offers, hours(22, 24))).toEqual({
      type: "complet",
      terrains: ["Padel 1", "Padel 2"],
      priceCents: 6400,
    });
    expect(findForRange(offers, hours(20, 22))).toBeNull();
  });

  test("10/11 : 20h-22h libre sur Padel 2 seulement", () => {
    const offers = offersOf("planning-2026-11-10.json");
    expect(findForRange(offers, hours(20, 22))).toMatchObject({ terrains: ["Padel 2"] });
  });

  test("combinaison 1h + 1h sur deux terrains quand aucun 2h n'est libre", () => {
    expect(findForRange([offer("Padel 1", 18), offer("Padel 2", 19)], hours(18, 20))).toEqual({
      type: "combinaison",
      segments: [
        { start: 18 * 60, terrain: "Padel 1" },
        { start: 19 * 60, terrain: "Padel 2" },
      ],
      priceCents: 8000,
    });
  });

  test("la combinaison garde le même terrain s'il est libre toute la plage", () => {
    // Padel 1 est renvoyé en premier à 18h, mais seul Padel 2 est libre aux deux heures.
    const offers = [offer("Padel 1", 18), offer("Padel 2", 18), offer("Padel 2", 19)];
    const result = findForRange(offers, hours(18, 20));
    expect(result?.type === "combinaison" && result.segments.map((s) => s.terrain)).toEqual(["Padel 2", "Padel 2"]);
  });

  test("sans terrain libre toute la plage, la combinaison prend le moins cher à chaque heure", () => {
    const offers = [offer("Padel 1", 18, 4500), offer("Padel 2", 18, 4000), offer("Padel 1", 19)];
    const result = findForRange(offers, hours(18, 20));
    expect(result?.type === "combinaison" && result.segments.map((s) => s.terrain)).toEqual(["Padel 1", "Padel 1"]);
    expect(findForRange([offer("Padel 1", 18, 4500), offer("Padel 2", 18, 4000)], hours(18, 20))).toBeNull();
  });

  test("le 2h est prioritaire sur la combinaison", () => {
    const offers = offersOf("planning-2026-10-06.json"); // 1h + 1h existe aussi le 06/10 à 18h
    expect(findForRange(offers, hours(18, 20))?.type).toBe("complet");
  });

  test("une recherche d'1h ne combine rien", () => {
    const offers = offersOf("planning-2026-10-06.json");
    expect(findForRange(offers, hours(21, 22))).toMatchObject({ type: "complet", terrains: ["Padel 2"] });
    expect(findForRange([offer("Padel 1", 18)], hours(19, 20))).toBeNull();
  });
});

describe("fenêtre de requête et créneaux passés", () => {
  test("requestWindow couvre les débuts utiles, combinaisons comprises", () => {
    expect(requestWindow([18, 19], 2)).toEqual({ from: "18:00:00", to: "20:59:59" });
    expect(requestWindow([10, 23], 1)).toEqual({ from: "10:00:00", to: "23:59:59" });
  });

  test("isPast ignore les créneaux déjà commencés aujourd'hui seulement", () => {
    const now = new Date(2026, 8, 29, 18, 30); // mardi 29/09 à 18h30
    expect(isPast("2026-09-29", 18 * 60, now)).toBe(true);
    expect(isPast("2026-09-29", 19 * 60, now)).toBe(false);
    expect(isPast("2026-10-01", 18 * 60, now)).toBe(false);
  });
});

// --- Orchestration (réseau simulé) -------------------------------------------

describe("searchAvailabilities", () => {
  const monday = new Date(2026, 8, 28, 10, 0); // lundi 28/09/2026
  /** Le 06/10 a des dispos, les autres jours sont ouverts mais complets. */
  const onlyOctober6 = (url: string) =>
    dateOf(url) === "2026-10-06" ? fixture("planning-2026-10-06.json") : EMPTY_DAY;

  test("une requête par jour, résultats triés, avancement signalé", async () => {
    const api = fakeApi(onlyOctober6);
    const progress: string[] = [];
    const params: SearchParams = {
      ...DEFAULT_SEARCH,
      period: { kind: "custom", from: "2026-09-29", to: "2026-10-11" },
    };
    const outcome = await searchAvailabilities({
      params,
      apiBaseUrl: API,
      fetchJson: api.fetchJson,
      now: new Date(2026, 8, 29, 21, 0), // mardi 29/09 à 21h
      onProgress: (done, total) => progress.push(`${done}/${total}`),
    });

    expect(api.calls.map(dateOf)).toEqual(["2026-09-29", "2026-10-01", "2026-10-06", "2026-10-08"]);
    expect(outcome.results.map((r) => `${r.date} ${r.range.start / 60}h`)).toEqual([
      "2026-10-06 18h",
      "2026-10-06 19h",
    ]);
    expect(outcome.warnings).toEqual([]);
    expect(progress).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  });

  test("s'arrête au premier jour pas encore ouvert à la réservation", async () => {
    // Comme observé le 28/09 : ouvert jusqu'au 27/11, plus aucun terrain ensuite.
    const api = fakeApi((url) => (dateOf(url) <= "2026-11-27" ? fixture("planning-2026-10-06.json") : CLOSED_DAY));
    const params: SearchParams = { ...DEFAULT_SEARCH, days: [2, 4, 6] }; // mardi, jeudi, samedi
    const outcome = await searchAvailabilities({ params, apiBaseUrl: API, fetchJson: api.fetchJson, now: monday });

    expect(outcome.lastOpenDate).toBe("2026-11-26");
    expect(outcome.bookingLimit).toBe("2026-11-28");
    expect(api.calls.at(-1)).toContain("2026-11-28"); // rien au-delà
    expect(outcome.datesChecked).toBe(api.calls.length);
  });

  test("dates toutes au-delà de l'horizon : fin immédiate, sans avertissement", async () => {
    const api = fakeApi((url) =>
      url.includes("/activities?") ? { "hydra:member": [{ id: CLUB.activityId, name: "Padel" }] } : CLOSED_DAY,
    );
    const params: SearchParams = {
      ...DEFAULT_SEARCH,
      days: [6, 0],
      period: { kind: "custom", from: "2026-11-28", to: "2026-11-29" },
    };
    const outcome = await searchAvailabilities({ params, apiBaseUrl: API, fetchJson: api.fetchJson, now: monday });

    // Le premier jour vide déclenche la vérification de l'activité, puis la recherche s'arrête.
    expect(api.calls).toHaveLength(2);
    expect(outcome.warnings).toEqual([]);
    expect(outcome.bookingLimit).toBe("2026-11-28");
    expect(outcome.lastOpenDate).toBeNull();
  });

  test("mode « la prochaine » : s'arrête au premier jour qui a une dispo", async () => {
    const api = fakeApi(onlyOctober6);
    const params: SearchParams = { ...DEFAULT_SEARCH, mode: "first" };
    const outcome = await searchAvailabilities({ params, apiBaseUrl: API, fetchJson: api.fetchJson, now: monday });

    expect(api.calls.map(dateOf)).toEqual(["2026-09-29", "2026-10-01", "2026-10-06"]);
    expect(outcome.results).toHaveLength(2); // 18h et 19h le même jour
  });

  test("refuse une recherche invalide sans rien demander à l'API", async () => {
    const api = fakeApi(() => EMPTY_DAY);
    const search = (params: SearchParams) =>
      searchAvailabilities({ params, apiBaseUrl: API, fetchJson: api.fetchJson });
    await expect(search({ ...DEFAULT_SEARCH, startHours: [23] })).rejects.toThrow(/heure de début/); // 23h + 2h > minuit
    await expect(search({ ...DEFAULT_SEARCH, days: [] })).rejects.toThrow(/un jour/);
    await expect(search({ ...DEFAULT_SEARCH, period: { kind: "custom", from: "2026-10-06", to: "" } })).rejects.toThrow(
      /date de fin/,
    );
    expect(api.calls).toEqual([]);
  });

  test("retrouve l'activité si son identifiant a changé", async () => {
    const NEW_ID = "00000000-0000-0000-0000-000000000000";
    const api = fakeApi((url) => {
      if (url.includes("/activities?")) {
        return {
          "hydra:member": [
            { id: "x", name: "Tennis" },
            { id: NEW_ID, name: "Padel" },
          ],
        };
      }
      if (url.includes(`activities.id=${NEW_ID}`)) {
        if (dateOf(url) !== "2026-10-06") return EMPTY_DAY;
        const json = fixture("planning-2026-10-06.json");
        for (const pg of json["hydra:member"]) pg.activities[0].id = NEW_ID;
        return json;
      }
      return CLOSED_DAY; // ancien identifiant : plus aucun terrain
    });
    const params: SearchParams = { ...DEFAULT_SEARCH, period: { kind: "week" } };
    const now = new Date(2026, 9, 6, 8, 0); // mardi 06/10 à 8h
    const outcome = await searchAvailabilities({ params, apiBaseUrl: API, fetchJson: api.fetchJson, now });

    expect(outcome.activityId).toBe(NEW_ID);
    expect(outcome.warnings[0]).toMatch(/a changé/);
    expect(outcome.results).toHaveLength(2);
  });

  describe("réseau capricieux", () => {
    /** API qui échoue `failures` fois pour les dates données, puis répond normalement. */
    const flaky = (failures: Record<string, number>) =>
      fakeApi((url) => {
        const date = dateOf(url);
        if ((failures[date] ?? 0) > 0) {
          failures[date]--;
          throw new Error("Le site du club met trop de temps à répondre.");
        }
        return onlyOctober6(url);
      });

    test("retente une fois un jour qui ne répond pas", async () => {
      const api = flaky({ "2026-10-06": 1 });
      const outcome = await searchAvailabilities({
        params: DEFAULT_SEARCH,
        apiBaseUrl: API,
        fetchJson: api.fetchJson,
        now: monday,
      });

      expect(api.calls.filter((url) => dateOf(url) === "2026-10-06")).toHaveLength(2);
      expect(outcome.results).toHaveLength(2);
      expect(outcome.warnings).toEqual([]);
    });

    test("saute un jour qui échoue deux fois et garde le reste", async () => {
      const api = flaky({ "2026-10-01": 2 });
      const outcome = await searchAvailabilities({
        params: DEFAULT_SEARCH,
        apiBaseUrl: API,
        fetchJson: api.fetchJson,
        now: monday,
      });

      expect(outcome.warnings).toEqual([
        "Le Jeu 1 oct. n'a pas pu être vérifié (Le site du club met trop de temps à répondre.)",
      ]);
      expect(outcome.results.map((r) => r.date)).toEqual(["2026-10-06", "2026-10-06"]);
      expect(outcome.datesChecked).toBe(18); // la recherche continue jusqu'au bout
    });

    test("s'interrompt après deux jours en échec d'affilée, en gardant les résultats trouvés", async () => {
      const api = flaky({ "2026-10-08": 2, "2026-10-13": 2 });
      const outcome = await searchAvailabilities({
        params: DEFAULT_SEARCH,
        apiBaseUrl: API,
        fetchJson: api.fetchJson,
        now: monday,
      });

      expect(outcome.results.map((r) => r.date)).toEqual(["2026-10-06", "2026-10-06"]);
      expect(outcome.warnings.at(-1)).toMatch(/Recherche interrompue/);
      expect(dateOf(api.calls.at(-1)!)).toBe("2026-10-13");
    });

    test("premier jour injoignable : l'erreur remonte", async () => {
      const unreachable = fakeApi(() => {
        throw new Error("HTTP 503");
      });
      await expect(
        searchAvailabilities({ params: DEFAULT_SEARCH, apiBaseUrl: API, fetchJson: unreachable.fetchJson }),
      ).rejects.toThrow(/HTTP 503/);

      // Même si la liste des activités répond : l'identifiant n'a pas changé, le problème est ailleurs.
      const planningsDown = fakeApi((url) => {
        if (url.includes("/activities?")) return { "hydra:member": [{ id: CLUB.activityId, name: "Padel" }] };
        throw new Error("HTTP 503");
      });
      await expect(
        searchAvailabilities({ params: DEFAULT_SEARCH, apiBaseUrl: API, fetchJson: planningsDown.fetchJson }),
      ).rejects.toThrow(/HTTP 503/);
    });
  });
});
