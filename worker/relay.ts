// Relais Cloudflare Worker entre l'application (GitHub Pages) et l'API Doinsport.
// L'API refuse les appels venant d'un autre site que celui du club (CORS) : ce
// relais fait l'appel à la place du navigateur et ajoute l'autorisation CORS.
//
// Il est volontairement limité : lecture seule, uniquement les deux adresses
// utilisées par l'application, uniquement pour le club du Sporting Nantes.
// Aucun identifiant ni secret : les données relayées sont publiques.
//
// Déployé par GitHub Actions à chaque push sur main (voir wrangler.toml et le README).

import { API_BASE_URL, API_TIMEOUT_MS, CLUB } from "../src/config";

// Sites autorisés à lire les réponses depuis un navigateur.
const ALLOWED_ORIGINS = [
  "https://paddadie.github.io", // l'application en ligne
  "http://localhost:5173", // npm run dev
];

// Adresses de l'API que l'application a le droit de demander, et paramètres transmis
// pour chacune. Le relais reconstruit la requête : tout autre paramètre est ignoré.
const ROUTES = [
  {
    path: /^\/clubs\/playgrounds\/plannings\/\d{4}-\d{2}-\d{2}$/, // disponibilités d'un jour
    params: ["club.id", "from", "to", "activities.id", "bookingType"],
  },
  {
    path: /^\/activities$/, // liste des activités (pour retrouver l'ID « Padel »)
    params: ["club.block.price.category.id", "club.id"],
  },
];

export default {
  async fetch(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get("Origin"));

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return textResponse("Méthode non autorisée", 405, cors);

    const url = new URL(request.url);
    if (url.pathname === "/") return textResponse("Relais padel opérationnel", 200, cors);

    const upstreamUrl = allowedUpstreamUrl(url);
    if (!upstreamUrl) return textResponse("Adresse non autorisée par le relais", 403, cors);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return textResponse(`Le site du club ne répond pas : ${reason}`, 502, cors);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  },
};

/** Adresse de l'API à appeler, ou null si la demande sort du périmètre du relais. */
function allowedUpstreamUrl(url: URL): string | null {
  const route = ROUTES.find((r) => r.path.test(url.pathname));
  if (!route || url.searchParams.get("club.id") !== CLUB.id) return null;

  const params = new URLSearchParams();
  for (const name of route.params) {
    const value = url.searchParams.get(name);
    if (value !== null) params.set(name, value);
  }
  return `${API_BASE_URL}${url.pathname}?${params}`;
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function textResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(message, { status, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
}
