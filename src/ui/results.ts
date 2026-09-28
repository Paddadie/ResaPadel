// Affichage des résultats : groupés par jour, lignes non cliquables.

import { describeNoResult, formatDay, formatEuros, formatTimeRange, formatWhere } from "../core/format";
import type { SearchOutcome, SearchParams, SearchResult } from "../core/types";
import { byId } from "./dom";

const list = byId("result-list");
const status = byId("status");

function element(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

export function showProgress(done: number, total: number): void {
  setStatus(total === 0 ? "Recherche en cours…" : `Recherche en cours… ${done} / ${total} jours`);
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

  const nodes: HTMLElement[] = outcome.warnings.map((w) => element("p", "warning", `⚠️ ${w}`));
  if (count === 0) nodes.push(element("p", "empty", describeNoResult(outcome, params)));

  const byDate = new Map<string, SearchResult[]>();
  for (const result of outcome.results) byDate.set(result.date, [...(byDate.get(result.date) ?? []), result]);
  for (const [date, results] of byDate) {
    const day = element("div", "day");
    day.append(element("h2", "", formatDay(date)));
    for (const result of results) {
      const row = element("div", result.type === "combinaison" ? "slot combo" : "slot");
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
