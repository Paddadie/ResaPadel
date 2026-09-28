// Petits outils d'accès à la page et au navigateur, partagés par l'interface.

/** Élément de index.html, avec une erreur explicite s'il a disparu. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément #${id} absent de index.html`);
  return element as T;
}

/** Bouton cliqué dans un groupe de boutons (l'événement est écouté sur le groupe). */
export function clickedButton(event: Event): HTMLButtonElement | null {
  return (event.target as HTMLElement).closest("button");
}

export function setPressed(button: HTMLElement, pressed: boolean): void {
  button.setAttribute("aria-pressed", String(pressed));
}

/** localStorage, ou null si le navigateur le refuse (certains modes de navigation privée). */
export function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
