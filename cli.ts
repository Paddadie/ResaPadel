// Recherche en ligne de commande sur PC, pratique pour tester la logique.
// Appelle directement l'API du club (pas de CORS hors navigateur).
// Usage : npm start          (ou : npm start -- --verbose pour voir les requêtes)

import { API_BASE_URL, API_TIMEOUT_MS, DEFAULT_SEARCH } from "./src/config";
import { buildBookingUrl } from "./src/core/doinsport";
import {
  describeNoResult,
  describePeriod,
  describeSearch,
  formatDay,
  formatEuros,
  formatTimeRange,
  formatWhere,
} from "./src/core/format";
import { searchAvailabilities } from "./src/core/search";

const verbose = process.argv.includes("--verbose");

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} en interrogeant ${url}`);
  return response.json();
}

async function main() {
  const params = DEFAULT_SEARCH;
  const startedAt = Date.now();
  const outcome = await searchAvailabilities({
    params,
    apiBaseUrl: API_BASE_URL,
    fetchJson,
    log: verbose ? (message) => console.error(`[debug] ${message}`) : undefined,
  });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\n${describeSearch(params)}`);
  console.log(describePeriod(params.period, new Date()));
  console.log(`${outcome.datesChecked} jours interrogés en ${seconds} s`);
  if (outcome.bookingLimit && outcome.lastOpenDate) {
    console.log(`Réservations ouvertes jusqu'au ${formatDay(outcome.lastOpenDate)}`);
  }
  console.log("");

  if (outcome.results.length === 0) console.log(describeNoResult(outcome, params));
  for (const result of outcome.results) {
    const when = `${formatDay(result.date)} · ${formatTimeRange(result.range)}`;
    console.log(`  ${when.padEnd(30)} ${formatWhere(result).padEnd(28)} ${formatEuros(result.priceCents)}`);
  }
  for (const warning of outcome.warnings) console.warn(`\n⚠️  ${warning}`);

  console.log(`\nRéserver : ${buildBookingUrl(outcome.activityId)}\n`);
}

main().catch((error: Error) => {
  console.error(`Erreur : ${error.message}`);
  process.exitCode = 1;
});
