// Relais Cloudflare Worker entre l'application (GitHub Pages) et l'API Doinsport.
// L'API refuse les appels venant d'un autre site que celui du club (CORS) : ce
// relais fait l'appel à la place du navigateur et ajoute l'autorisation CORS.
//
// Il est volontairement limité : lecture seule, uniquement les deux adresses
// utilisées par l'application, uniquement pour le club du Sporting Nantes, et
// uniquement pour les sites autorisés. Aucun identifiant ni secret : les données
// relayées sont publiques.
//
// Fichier autonome, à coller tel quel dans le tableau de bord Cloudflare (voir README).
// Les constantes répètent celles de src/config.ts ; tests/relay.test.ts vérifie qu'elles concordent.

const API_BASE_URL = "https://api-v3.doinsport.club";
const CLUB_ID = "6178c4ab-50d4-4f2f-b360-f699f9034635";
const REQUEST_TIMEOUT_MS = 15000;

// Sites autorisés à utiliser le relais depuis un navigateur.
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

// Ajoutés à toutes les réponses : le navigateur ne doit jamais interpréter une réponse
// du relais comme une page (HTML, script), même si l'API renvoyait autre chose que du JSON.
const SAFE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cache-Control": "no-store",
};

export default {
  /** @param {Request} request */
  async fetch(request) {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return textResponse("Méthode non autorisée", 405, cors);

    const url = new URL(request.url);
    if (url.pathname === "/") return textResponse("Relais padel opérationnel", 200, cors);

    // Un autre site (ou une visite directe) ne déclenche aucun appel à l'API. Un script
    // peut imiter l'en-tête Origin : cette règle évite surtout qu'un site tiers se serve
    // du relais à travers le navigateur de ses visiteurs.
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) return textResponse("Site non autorisé", 403, cors);

    const upstreamUrl = allowedUpstreamUrl(url);
    if (!upstreamUrl) return textResponse("Adresse non autorisée par le relais", 403, cors);

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return textResponse(`Le site du club ne répond pas : ${reason}`, 502, cors);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        ...SAFE_HEADERS,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  },
};

/**
 * Adresse de l'API à appeler, ou null si la demande sort du périmètre du relais.
 * @param {URL} url
 * @returns {string | null}
 */
function allowedUpstreamUrl(url) {
  const route = ROUTES.find((r) => r.path.test(url.pathname));
  if (!route || url.searchParams.get("club.id") !== CLUB_ID) return null;

  const params = new URLSearchParams();
  for (const name of route.params) {
    const value = url.searchParams.get(name);
    if (value !== null) params.set(name, value);
  }
  return `${API_BASE_URL}${url.pathname}?${params}`;
}

/**
 * @param {string | null} origin
 * @returns {Record<string, string>}
 */
function corsHeaders(origin) {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * @param {string} message
 * @param {number} status
 * @param {Record<string, string>} headers
 */
function textResponse(message, status, headers) {
  return new Response(message, {
    status,
    headers: { ...headers, ...SAFE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}
