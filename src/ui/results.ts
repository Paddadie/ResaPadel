// Affichage des résultats : groupés par jour, lignes non cliquables.

import { describeNoResult, formatDay, formatEuros, formatTimeRange, formatWhere } from "../core/format";
import type { SearchOutcome, SearchParams, SearchResult } from "../core/types";
import { byId } from "./dom";

const list = byId("result-list");
const status = byId("status");
const progress = byId("progress");
const progressBar = byId("progress-bar");

/** Au-delà de ce rang, les lignes arrivent ensemble : la cascade ne doit pas faire attendre. */
const MAX_CASCADE_RANK = 12;

function element(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle("error", isError);
  status.classList.remove("searching");
  progress.hidden = true;
}

export function showProgress(done: number, total: number): void {
  setStatus(total === 0 ? "Recherche en cours…" : `Recherche en cours… ${done} / ${total} jours`);
  status.classList.add("searching"); // balle qui rebondit
  progress.hidden = false;
  progressBar.style.transform = `scaleX(${total === 0 ? 0 : done / total})`;
}

export function showError(message: string): void {
  list.replaceChildren();
  setStatus(message, true);
}

export function showResults(outcome: SearchOutcome, params: SearchParams): void {
  const updatedAt = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const count = outcome.results.length;
  const parts = [count === 0 ? "Aucun créneau" : `${count} créneau${count > 1 ? "x" : ""}`];
  if (outcome.bookingLimit && outcome.lastOpenDate)
    parts.push(`réservations ouvertes jusqu'au ${formatDay(outcome.lastOpenDate)}`);
  parts.push(`mis à jour à ${updatedAt}`);
  setStatus(parts.join(" · "));

  // Chaque ligne apparaît un peu après la précédente (animation .rise de style.css).
  let rank = 0;
  const rising = (el: HTMLElement): HTMLElement => {
    el.classList.add("rise");
    el.style.setProperty("--i", String(Math.min(rank++, MAX_CASCADE_RANK)));
    return el;
  };

  const nodes: HTMLElement[] = outcome.warnings.map((w) => rising(element("p", "warning", `⚠️ ${w}`)));
  if (count === 0) nodes.push(rising(element("p", "empty", describeNoResult(outcome, params))));

  const byDate = new Map<string, SearchResult[]>();
  for (const result of outcome.results) byDate.set(result.date, [...(byDate.get(result.date) ?? []), result]);
  for (const [date, results] of byDate) {
    const day = element("div", "day");
    day.append(rising(element("h2", "", formatDay(date))));
    for (const result of results) {
      const row = rising(element("div", result.type === "combinaison" ? "slot combo" : "slot"));
      row.append(
        element("span", "time", formatTimeRange(result.range)),
        element("span", "where", formatWhere(result)),
        element("span", "price", formatEuros(result.priceCents)),
      );
      day.append(row);
    }
    nodes.push(day);
  }
  list.replaceChildren(...nodes);
}
