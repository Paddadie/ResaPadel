import { registerSW } from "virtual:pwa-register";
import "./updatePrompt.css";

// Repris de Tsuzuku. Enregistre le service worker et affiche un bandeau
// « Mettre à jour » quand une nouvelle version de l'app a été précachée (donc à
// chaque push sur GitHub). Pas de mise à jour silencieuse : c'est vous qui choisissez le moment.
export function initUpdatePrompt(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      showBanner(() => {
        void updateSW(true); // recharge la page sur la nouvelle version
      });
    },
    // Le navigateur ne cherche une nouvelle version qu'au chargement de la page. Or l'app
    // installée sur iPhone est souvent reprise depuis le multitâche sans être rechargée :
    // on vérifie donc aussi à chaque retour au premier plan.
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {}); // hors ligne : on réessaiera
      });
    },
    onRegisterError(error) {
      console.error("Échec de l'enregistrement du service worker :", error);
    },
  });
}

function showBanner(onUpdate: () => void): void {
  if (document.querySelector(".update-prompt")) return;

  const banner = document.createElement("div");
  banner.className = "update-prompt";
  banner.setAttribute("role", "status");

  const text = document.createElement("span");
  text.className = "update-prompt-text";
  text.textContent = "Nouvelle version disponible";

  const actions = document.createElement("div");
  actions.className = "update-prompt-actions";
  actions.append(
    button("update-prompt-dismiss", "Plus tard", () => banner.remove()),
    button("update-prompt-confirm", "Mettre à jour", onUpdate),
  );

  banner.append(text, actions);
  document.body.appendChild(banner);
}

function button(cls: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
