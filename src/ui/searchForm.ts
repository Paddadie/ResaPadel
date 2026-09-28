// Formulaire de recherche : jours, période, heures de début, durée, mode.
// L'état vit dans un objet SearchParams ; l'affichage est recalculé à chaque changement.
// Le panneau se replie quand une recherche est lancée et se rouvre d'un toucher sur son en-tête.

import { MAX_DAYS_AHEAD } from "../config";
import { describePeriod, describeSearch } from "../core/format";
import { validatePeriod, validateSearch } from "../core/params";
import { addDays, toIsoDate } from "../core/time";
import type { Period, PeriodKind, SearchParams } from "../core/types";
import { byId, clickedButton, setPressed } from "./dom";
import { initSlotFields } from "./slotFields";

const WEEKEND = [6, 0];
const PERIOD_KINDS: PeriodKind[] = ["all", "week", "weekend", "next", "custom"];

const isPeriodKind = (value: unknown): value is PeriodKind => PERIOD_KINDS.includes(value as PeriodKind);

export interface SearchForm {
  /** Copie de la recherche actuelle. */
  getParams(): SearchParams;
  /** Remplace la recherche affichée, par exemple après un changement de réglages. */
  setParams(params: SearchParams): void;
  /** Message expliquant pourquoi la recherche est impossible, ou null. */
  validationError(): string | null;
  /** Recalcule ce qui dépend de la date du jour, par exemple quand l'application est reprise le lendemain. */
  refresh(): void;
  /** Replie le panneau (seul le résumé reste visible) ou le rouvre. */
  setCollapsed(collapsed: boolean): void;
}

export function initSearchForm(initial: SearchParams, onSubmit: () => void): SearchForm {
  const params: SearchParams = structuredClone(initial);

  const form = byId<HTMLFormElement>("search-form");
  const panel = byId("search-panel");
  const toggle = byId("search-toggle");
  const recap = byId("search-recap");
  const period = byId("period");
  const mode = byId("mode");
  const customDates = byId("custom-dates");
  const dateFrom = byId<HTMLInputElement>("date-from");
  const dateTo = byId<HTMLInputElement>("date-to");
  const periodNote = byId("period-note");
  const summary = byId("summary");

  const renderSlotFields = initSlotFields(form, params, render);

  // Calendriers « Dates… » : deux semaines à partir d'aujourd'hui par défaut.
  const today = new Date();
  dateFrom.value = toIsoDate(today);
  dateTo.value = toIsoDate(addDays(today, 13));
  const customPeriod = (): Period => ({ kind: "custom", from: dateFrom.value, to: dateTo.value });

  period.addEventListener("click", (event) => {
    const kind = clickedButton(event)?.dataset.period;
    if (!isPeriodKind(kind)) return;
    params.period = kind === "custom" ? customPeriod() : { kind };
    if (kind === "weekend") params.days = [...WEEKEND];
    render();
  });

  for (const input of [dateFrom, dateTo]) {
    input.addEventListener("change", () => {
      params.period = customPeriod();
      render();
    });
  }

  mode.addEventListener("click", (event) => {
    const value = clickedButton(event)?.dataset.mode;
    if (value !== "all" && value !== "first") return;
    params.mode = value;
    render();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit();
  });

  toggle.addEventListener("click", () => setCollapsed(!form.inert));

  function setCollapsed(collapsed: boolean): void {
    // Replié en glissant (style.css) ; « inert » retire le formulaire masqué du clavier et des lecteurs d'écran.
    panel.classList.toggle("collapsed", collapsed);
    form.inert = collapsed;
    recap.hidden = !collapsed;
    toggle.setAttribute("aria-expanded", String(!collapsed));
  }

  function render(): void {
    renderSlotFields();
    for (const button of period.querySelectorAll<HTMLElement>("[data-period]")) {
      setPressed(button, button.dataset.period === params.period.kind);
    }
    for (const button of mode.querySelectorAll<HTMLElement>("[data-mode]")) {
      setPressed(button, button.dataset.mode === params.mode);
    }

    // Bornes des calendriers : d'aujourd'hui au plafond de recherche.
    const now = new Date();
    dateFrom.min = dateTo.min = toIsoDate(now);
    dateFrom.max = dateTo.max = toIsoDate(addDays(now, MAX_DAYS_AHEAD - 1));
    customDates.hidden = params.period.kind !== "custom";
    // Dates incomplètes : pas de résumé de période, le message d'erreur explique quoi corriger.
    const periodText = validatePeriod(params.period) ? "" : describePeriod(params.period, now);
    periodNote.textContent = periodText;

    const error = validateSearch(params);
    summary.textContent = error ?? `${describeSearch(params)}.`;
    summary.classList.toggle("invalid", error !== null);
    recap.textContent = error ?? `${describeSearch(params)} · ${periodText}`;
  }

  render();
  return {
    getParams: () => structuredClone(params),
    setParams: (next) => {
      Object.assign(params, structuredClone(next)); // même objet : les champs partagés le modifient directement
      render();
    },
    validationError: () => validateSearch(params),
    refresh: render,
    setCollapsed,
  };
}
