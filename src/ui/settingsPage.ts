// Page Réglages (adresse #reglages) : jours, heures et durée de la recherche lancée à
// l'ouverture, enregistrés sur l'appareil à chaque changement, et version de l'application.

import { DEFAULT_SEARCH } from "../config";
import {
  loadDefaultSearch,
  resetDefaultSearch,
  saveDefaultSearch,
  slotChoiceOf,
  type KeyValueStore,
} from "../core/defaults";
import { describeSearch } from "../core/format";
import { validateSearch } from "../core/params";
import type { SearchParams, SlotChoice } from "../core/types";
import { byId } from "./dom";
import { initSlotFields } from "./slotFields";

const SETTINGS_HASH = "#reglages";

/** `onDefaultsChanged` est appelé en quittant la page si le réglage a changé. */
export function initSettingsPage(store: KeyValueStore | null, onDefaultsChanged: (params: SearchParams) => void) {
  const searchView = byId("search-view");
  const settingsView = byId("settings-view");
  const bookBar = byId("book-bar");
  const settingsLink = byId("settings-link");
  const summary = byId("settings-summary");

  byId("app-version").textContent = `Version ${__APP_VERSION__}`;

  const choice: SlotChoice = slotChoiceOf(loadDefaultSearch(store));
  let changed = false;
  let openedFromSearch = false; // pour que « Terminé » revienne en arrière dans l'historique
  let searchScrollY = 0;

  const validity = () => validateSearch({ ...DEFAULT_SEARCH, ...choice });

  const renderSlotFields = initSlotFields(byId("settings-fields"), choice, () => {
    const saved = validity() === null && saveDefaultSearch(store, choice);
    if (saved) changed = true;
    render(saved);
  });

  byId("settings-reset").addEventListener("click", () => {
    resetDefaultSearch(store);
    Object.assign(choice, slotChoiceOf(DEFAULT_SEARCH));
    changed = true;
    render(true);
  });

  byId("settings-done").addEventListener("click", () => {
    if (openedFromSearch) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      showView();
    }
  });

  settingsLink.addEventListener("click", () => {
    searchScrollY = window.scrollY;
  });

  window.addEventListener("hashchange", () => {
    openedFromSearch = location.hash === SETTINGS_HASH;
    showView();
  });

  function render(saved = true): void {
    renderSlotFields();
    const error = validity();
    if (error) summary.textContent = `${error} Ce réglage n'est pas enregistré.`;
    else if (!saved) summary.textContent = "Impossible d'enregistrer sur cet appareil (navigation privée ?).";
    else summary.textContent = `${describeSearch({ ...DEFAULT_SEARCH, ...choice })}.`;
    summary.classList.toggle("invalid", error !== null || !saved);
  }

  function showView(): void {
    const onSettings = location.hash === SETTINGS_HASH;
    if (onSettings === !settingsView.hidden) return;

    searchView.hidden = onSettings;
    bookBar.hidden = onSettings;
    settingsLink.hidden = onSettings;
    settingsView.hidden = !onSettings;

    if (onSettings) {
      Object.assign(choice, slotChoiceOf(loadDefaultSearch(store)));
      changed = false;
      render();
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, searchScrollY);
      if (changed) onDefaultsChanged(loadDefaultSearch(store));
      changed = false;
    }
  }

  showView();
}
