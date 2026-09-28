// Petites animations déclenchées par le code. Leur dessin est dans style.css ; elles sont jouées
// même si l'appareil demande de réduire les animations (choix de l'utilisateur).

/** Rejoue une animation CSS portée par une classe, même si la classe est déjà présente. */
export function replayAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth; // oblige le navigateur à constater le retrait avant de remettre la classe
  element.classList.add(className);
}

/** Pastilles (jours, heures, période) : petit rebond au toucher, dans la recherche comme dans les réglages. */
export function initChipPop(): void {
  document.addEventListener("click", (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLButtonElement>(".chip");
    if (chip && !chip.disabled) replayAnimation(chip, "pop");
  });
}
