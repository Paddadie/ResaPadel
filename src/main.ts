// Démarrage : formulaire, recherche via le relais Cloudflare, affichage des résultats.
// Rien n'est demandé au site du club tant que la recherche n'est pas lancée à la main.

import "./style.css";
import { BROWSER_TIMEOUT_MS, RELAY_URL } from "./config";
import { loadDefaultSearch } from "./core/defaults";
import { buildBookingUrl } from "./core/doinsport";
import { searchAvailabilities } from "./core/search";
import { initUpdatePrompt } from "./pwa/updatePrompt";
import { byId, deviceStorage } from "./ui/dom";
import { initChipPop, replayAnimation } from "./ui/effects";
import { showError, showProgress, showResults } from "./ui/results";
import { initSearchForm } from "./ui/searchForm";
import { initSettingsPage } from "./ui/settingsPage";

const appbar = byId("appbar");
const searchButton = byId<HTMLButtonElement>("search-button");
const bookLink = byId<HTMLAnchorElement>("book-link");

/** Vrai dans l'app installée sur l'écran d'accueil d'un iPhone (propriété propre à iOS). */
const installedOnIPhone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Bouton « Réserver ». Sur iPhone, l'app installée ouvre les autres sites dans un navigateur
 * intégré qui la recouvre, et iOS ne permet pas de viser le navigateur par défaut : le schéma
 * « googlechromes: » (documenté par Google) ouvre plutôt l'app Chrome, à côté de l'app padel.
 */
function setBookingLink(activityId?: string): void {
  const url = buildBookingUrl(activityId);
  if (installedOnIPhone) {
    bookLink.href = url.replace(/^https:/, "googlechromes:");
    bookLink.removeAttribute("target"); // c'est iOS qui passe la main à Chrome : aucune page à ouvrir ici
  } else {
    bookLink.href = url;
  }
}

setBookingLink();

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

async function runSearch(): Promise<void> {
  if (searching) return;
  const error = form.validationError();
  if (error) {
    showError(error);
    return;
  }

  searching = true;
  searchButton.disabled = true;
  searchButton.textContent = "Recherche…";
  showProgress(0, 0);
  replayAnimation(appbar, "swing"); // la raquette de l'en-tête frappe une balle
  // Panneau replié : les résultats remontent juste sous le résumé de la recherche.
  form.setCollapsed(true);
  window.scrollTo({ top: 0, behavior: "smooth" });

  const params = form.getParams();
  try {
    const outcome = await searchAvailabilities({
      params,
      apiBaseUrl: RELAY_URL,
      fetchJson,
      onProgress: showProgress,
    });
    setBookingLink(outcome.activityId);
    showResults(outcome, params);
  } catch (err) {
    console.error(err);
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    searching = false;
    searchButton.disabled = false;
    searchButton.textContent = "Rechercher";
  }
}

const storage = deviceStorage();
const form = initSearchForm(loadDefaultSearch(storage), () => void runSearch());
initUpdatePrompt();
initChipPop();

// Réglages modifiés : le formulaire repart des nouveaux jours, heures et durée, ouvert et prêt à être lancé.
initSettingsPage(storage, (defaults) => {
  form.setParams(defaults);
  form.setCollapsed(false);
});

// L'app installée sur iPhone est souvent reprise depuis le multitâche sans être
// rechargée : les dates proposées suivent la date du jour.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") form.refresh();
});
