// Champs communs au formulaire de recherche et à la page Réglages : jours, heures de début, durée.
// Chaque bloc de index.html contient des conteneurs data-field="days|hours|all-hours|duration",
// remplis ici.

import { CLOSING_HOUR, FIRST_START_HOUR } from "../config";
import { DAY_SHORT, WEEK_ORDER } from "../core/format";
import { possibleStartHours, validStartHours } from "../core/params";
import type { SlotChoice } from "../core/types";
import { clickedButton, setPressed } from "./dom";

function part(root: HTMLElement, name: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (!element) throw new Error(`Champ « ${name} » absent de index.html`);
  return element;
}

function optionButton(text: string, key: string, value: number, className = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset[key] = String(value);
  button.textContent = text;
  return button;
}

const toggled = (list: number[], value: number) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Remplit les champs jours, heures et durée d'un bloc de la page et gère leurs clics :
 * `choice` est modifié directement, puis `onChange` est appelé.
 * Renvoie la fonction qui met à jour leur affichage.
 */
export function initSlotFields(root: HTMLElement, choice: SlotChoice, onChange: () => void): () => void {
  const days = part(root, "days");
  const hours = part(root, "hours");
  const duration = part(root, "duration");

  days.append(...WEEK_ORDER.map((day) => optionButton(DAY_SHORT[day], "day", day, "chip")));
  for (let hour = FIRST_START_HOUR; hour < CLOSING_HOUR; hour++) {
    hours.append(optionButton(`${hour}h`, "hour", hour, "chip"));
  }
  duration.append(...[1, 2].map((h) => optionButton(`${h}h`, "duration", h)));

  days.addEventListener("click", (event) => {
    const button = clickedButton(event);
    if (!button) return;
    choice.days = toggled(choice.days, Number(button.dataset.day));
    onChange();
  });

  hours.addEventListener("click", (event) => {
    const button = clickedButton(event);
    if (!button || button.disabled) return;
    choice.startHours = toggled(choice.startHours, Number(button.dataset.hour));
    onChange();
  });

  part(root, "all-hours").addEventListener("click", () => {
    const possible = possibleStartHours(choice.durationHours);
    const allSelected = possible.every((h) => choice.startHours.includes(h));
    choice.startHours = allSelected ? [] : possible;
    onChange();
  });

  duration.addEventListener("click", (event) => {
    const value = Number(clickedButton(event)?.dataset.duration);
    if (value !== 1 && value !== 2) return;
    choice.durationHours = value;
    choice.startHours = validStartHours(choice.startHours, value); // 23h impossible en 2h
    onChange();
  });

  return function render(): void {
    for (const button of days.querySelectorAll<HTMLElement>("[data-day]")) {
      setPressed(button, choice.days.includes(Number(button.dataset.day)));
    }
    const possible = possibleStartHours(choice.durationHours);
    for (const button of hours.querySelectorAll<HTMLButtonElement>("[data-hour]")) {
      const hour = Number(button.dataset.hour);
      button.disabled = !possible.includes(hour);
      setPressed(button, choice.startHours.includes(hour));
    }
    for (const button of duration.querySelectorAll<HTMLElement>("[data-duration]")) {
      setPressed(button, Number(button.dataset.duration) === choice.durationHours);
    }
  };
}
