import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Génère au build les icônes PNG (écran d'accueil iOS, Android, favicon) à partir de
// public/icon.png, la raquette détourée sur fond transparent. Les icônes qui ne supportent
// pas la transparence (iPhone, Android « maskable ») la posent sur le bleu terrain
// (--band dans src/style.css) ; les autres restent transparentes.
const COURT_BLUE = "#1E5BA8";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0.05 },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: COURT_BLUE } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: COURT_BLUE } },
  },
  images: ["public/icon.png"],
});
