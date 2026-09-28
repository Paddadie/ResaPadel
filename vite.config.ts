import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

// ⚠️ Doit correspondre exactement au nom du repo GitHub pour que GitHub Pages
// serve les fichiers au bon chemin (https://paddadie.github.io/<repo>/).
const REPO_NAME = "ResaPadel";

// Couleurs de src/style.css : bleu « terrain » (--band) pour la barre du navigateur,
// fond clair (--ground) pour l'écran de lancement.
const COURT_BLUE = "#1E5BA8";
const GROUND = "#EEF2F6";

export default defineConfig({
  base: `/${REPO_NAME}/`,

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version), // affichée dans la page Réglages
  },

  plugins: [
    VitePWA({
      registerType: "prompt", // bandeau « Nouvelle version disponible » géré dans src/pwa/updatePrompt.ts
      injectRegister: false,
      pwaAssets: {
        config: true,
        overrideManifestIcons: true,
      },
      manifest: {
        lang: "fr",
        name: "Padel · Sporting Nantes",
        short_name: "Padel",
        description: "Prochains créneaux de padel libres au Sporting Nantes.",
        theme_color: COURT_BLUE,
        background_color: GROUND,
        display: "standalone",
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        globIgnores: ["icon.png"], // source des icônes générées, jamais affichée : inutile hors ligne
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
