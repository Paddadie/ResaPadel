// Démarrage : formulaire, recherche via le relais Cloudflare, affichage des résultats.

import "./style.css";
import { AUTO_REFRESH_AFTER_MS, BROWSER_TIMEOUT_MS, RELAY_URL } from "./config";
import { loadDefaultSearch } from "./core/defaults";
import { buildBookingUrl } from "./core/doinsport";
import { searchAvailabilities } from "./core/search";
import { initUpdatePrompt } from "./pwa/updatePrompt";
import { byId, deviceStorage } from "./ui/dom";
import { showError, showProgress, showResults } from "./ui/results";
import { initSearchForm } from "./ui/searchForm";
import { initSettingsPage } from "./ui/settingsPage";

const searchButton = byId<HTMLButtonElement>("search-button");
const bookLink = byId<HTMLAnchorElement>("book-link");
const resultsSection = byId("results");

bookLink.href = buildBookingUrl();

/** Appel à l'API via le relais, avec des messages d'erreur compréhensibles. */
async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(BROWSER_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("Le site du club met trop de temps à répondre. Réessayez dans un instant.");
    }
    throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.");
  }
  if (!response.ok) throw new Error(`Le serveur a répondu avec l'erreur ${response.status}. Réessayez plus tard.`);
  return response.json();
}

let searching = false;
let rerunRequested = false; // recherche demandée pendant qu'une autre tourne (réglages modifiés)
let lastSearchAt = 0;

async function runSearch(scrollToResults: boolean): Promise<void> {
  if (searching) {
    rerunRequested = true;
    return;
  }
  const error = form.validationError();
  if (error) {
    showError(error);
    return;
  }

  searching = true;
  searchButton.disabled = true;
  searchButton.textContent = "Recherche…";
  showProgress(0, 0);
  if (scrollToResults) {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsSection.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }

  const params = form.getParams();
  try {
    const outcome = await searchAvailabilities({
      params,
      apiBaseUrl: RELAY_URL,
      fetchJson,
      onProgress: showProgress,
    });
    bookLink.href = buildBookingUrl(outcome.activityId);
    showResults(outcome, params);
  } catch (err) {
    console.error(err);
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    searching = false;
    lastSearchAt = Date.now();
    searchButton.disabled = false;
    searchButton.textContent = "Rechercher";
  }
  if (rerunRequested) {
    rerunRequested = false;
    void runSearch(false);
  }
}

const storage = deviceStorage();
const form = initSearchForm(loadDefaultSearch(storage), () => void runSearch(true));
initUpdatePrompt();
void runSearch(false); // recherche par défaut à l'ouverture (page Réglages)

// Réglages modifiés : la recherche affichée repart des nouveaux jours, heures et durée.
initSettingsPage(storage, (defaults) => {
  form.setParams(defaults);
  void runSearch(false);
});

// L'app installée sur iPhone est souvent reprise depuis le multitâche sans être
// rechargée : on relance la recherche si les résultats affichés sont trop anciens.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || searching) return;
  if (Date.now() - lastSearchAt < AUTO_REFRESH_AFTER_MS) return;
  form.refresh();
  void runSearch(false);
});
