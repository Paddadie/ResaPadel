// Relais Cloudflare : ce qu'il laisse passer, ce qu'il refuse, et les en-têtes CORS.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { API_BASE_URL, API_TIMEOUT_MS, CLUB } from "../src/config";
import relay from "../worker/relay.js";

const APP_ORIGIN = "https://paddadie.github.io";
const RELAY = "https://padel-relais.test";
const PLANNING =
  `/clubs/playgrounds/plannings/2026-10-06?club.id=${CLUB.id}&from=18%3A00%3A00&to=20%3A59%3A59` +
  `&activities.id=${CLUB.activityId}&bookingType=unique`;

function call(path: string, { method = "GET", origin = APP_ORIGIN as string | null } = {}) {
  const headers: Record<string, string> = origin ? { Origin: origin } : {};
  return relay.fetch(new Request(RELAY + path, { method, headers }));
}

let upstream: ReturnType<typeof vi.fn>;

beforeEach(() => {
  upstream = vi.fn(
    async () => new Response('{"hydra:member":[]}', { headers: { "Content-Type": "application/ld+json" } }),
  );
  vi.stubGlobal("fetch", upstream);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("relais", () => {
  test("relaie une demande de disponibilités et autorise l'application à lire la réponse", async () => {
    const response = await call(PLANNING);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"hydra:member":[]}');
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
    expect(response.headers.get("Content-Type")).toBe("application/ld+json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(upstream.mock.calls[0][0]).toBe(API_BASE_URL + PLANNING);
  });

  test("relaie la liste des activités", async () => {
    const path = `/activities?club.block.price.category.id=${CLUB.categoryId}&club.id=${CLUB.id}`;
    expect((await call(path)).status).toBe(200);
    expect(upstream.mock.calls[0][0]).toBe(API_BASE_URL + path);
  });

  test("ne transmet que les paramètres prévus, et le seul club du Sporting", async () => {
    await call(`${PLANNING}&club.id=autre-club&page=2`);
    expect(upstream.mock.calls[0][0]).toBe(API_BASE_URL + PLANNING);
  });

  test("refuse les autres adresses, les autres clubs et l'écriture", async () => {
    const otherClub = PLANNING.replace(CLUB.id, "autre-club");
    expect((await call(otherClub)).status).toBe(403);
    expect((await call(`/clubs/bookings?club.id=${CLUB.id}`)).status).toBe(403);
    expect((await call("/clubs/playgrounds/plannings/2026-10-06")).status).toBe(403); // sans club.id
    expect((await call(PLANNING, { method: "POST" })).status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  test("les chemins détournés (.., %2e%2e, %2f) ne sortent pas des adresses autorisées", async () => {
    const club = `?club.id=${CLUB.id}`;
    for (const path of [
      `/clubs/playgrounds/plannings/2026-10-06/../../../bookings${club}`,
      `/clubs/playgrounds/plannings/%2e%2e/%2e%2e/bookings${club}`,
      `/clubs/playgrounds/plannings/2026-10-06%2f..%2fbookings${club}`,
      `/activities/../clubs/bookings${club}`,
    ]) {
      expect((await call(path)).status, path).toBe(403);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  test("refuse les autres sites et les visites directes, sans appeler l'API", async () => {
    const otherSite = await call(PLANNING, { origin: "https://autre-site.test" });
    expect(otherSite.status).toBe(403);
    expect(otherSite.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect((await call(PLANNING, { origin: null })).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  test("interdit au navigateur d'interpréter une réponse comme une page", async () => {
    upstream.mockResolvedValueOnce(
      new Response("<script>alert(1)</script>", { headers: { "Content-Type": "text/html" } }),
    );
    const response = await call(PLANNING);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  });

  test("répond à la vérification préalable du navigateur (OPTIONS)", async () => {
    const response = await call(PLANNING, { method: "OPTIONS" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(upstream).not.toHaveBeenCalled();
  });

  test("renvoie un message clair si l'API ne répond pas", async () => {
    upstream.mockRejectedValueOnce(new Error("timeout"));
    const response = await call(PLANNING);
    expect(response.status).toBe(502);
    expect(await response.text()).toMatch(/ne répond pas/);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
  });

  test("la racine indique que le relais fonctionne, même visitée directement", async () => {
    expect(await (await call("/", { origin: null })).text()).toBe("Relais padel opérationnel");
  });

  test("reprend les valeurs de src/config.ts (le fichier est collé tel quel dans Cloudflare)", () => {
    const source = readFileSync(new URL("../worker/relay.js", import.meta.url), "utf8");
    expect(source).toContain(`const API_BASE_URL = "${API_BASE_URL}";`);
    expect(source).toContain(`const CLUB_ID = "${CLUB.id}";`);
    expect(source).toContain(`const REQUEST_TIMEOUT_MS = ${API_TIMEOUT_MS};`);
  });
});
