# Padel · Sporting Nantes

Application web (PWA) qui liste les créneaux de padel libres au Sporting Nantes, club qui utilise la plateforme Doinsport. On choisit les jours, la période, les heures de début, la durée et « toutes les dispos » ou « la prochaine ». À l'ouverture, le formulaire propose la recherche par défaut : **mardi et jeudi, 2h, début à 18h ou 19h**. Rien n'est demandé au site du club tant qu'on n'a pas touché **Rechercher** ; le formulaire se replie alors sous forme de résumé, qu'on touche pour le rouvrir. Ces jours, heures et durée se changent dans la page **Réglages** (engrenage en haut à droite) ; ils sont enregistrés sur l'appareil.

Les créneaux ne sont pas cliquables : le site du club ne permet pas d'ouvrir un créneau précis par un lien (c'est vérifié dans son code). Le bouton **« Réserver sur le site du club »** ouvre la page padel du club ; il reste à y choisir le jour et l'heure.

## Fonctionnement

```
iPhone (PWA installée)
   │  https://paddadie.github.io/ResaPadel/   ← GitHub Pages, redéployé à chaque push
   ▼
Relais Cloudflare (worker/relay.js)          ← ajoute l'autorisation CORS
   ▼
api-v3.doinsport.club                        ← API publique du club, sans compte
```

L'API du club refuse les appels venant d'un autre site que le sien (CORS). Le relais fait l'appel à la place du navigateur. Il est limité à la lecture seule, aux deux adresses utiles et au Sporting Nantes.

Les requêtes partent une par une, une par jour recherché. La recherche s'arrête d'elle-même au premier jour pas encore ouvert à la réservation (le club ouvre environ 60 jours à l'avance), ou dès le premier jour avec une dispo en mode « la prochaine ».

Un jour qui ne répond pas est retenté une fois, puis sauté avec un avertissement ; après deux jours en échec d'affilée, la recherche s'interrompt en gardant ce qu'elle a trouvé.

## Règle de recherche

Pour chaque jour et chaque heure de début choisie :

1. un créneau de la durée demandée sur un terrain est prioritaire. S'il y en a sur les deux terrains, la ligne indique « Padel 1 ou Padel 2 » ;
2. sinon, pour une recherche de 2h, deux créneaux d'1h qui s'enchaînent conviennent : sur le même terrain si possible, sinon sur deux terrains différents. Ces lignes sont en orange : ce sont **deux réservations distinctes**.

Les créneaux déjà commencés le jour même sont ignorés.

## Structure

```
index.html                     page unique : formulaire, résultats, bouton Réserver
src/main.ts                    démarrage, appel au relais, lancement de la recherche, lien Réserver
src/config.ts                  identifiants du club, adresses, recherche par défaut
src/core/types.ts              types partagés
src/core/params.ts             heures de début possibles et validation d'une recherche
src/core/defaults.ts           recherche proposée à l'ouverture (réglage enregistré sur l'appareil)
src/core/doinsport.ts          adresses de l'API et lecture de ses réponses
src/core/search.ts             règle de recherche et orchestration des requêtes
src/core/period.ts             périodes (cette semaine, ce week-end…) et dates à interroger
src/core/format.ts             textes affichés (jours, heures, prix, résumé)
src/core/time.ts               utilitaires d'heures et de dates
src/ui/searchForm.ts           formulaire de recherche, replié après le lancement
src/ui/slotFields.ts           champs jours, heures et durée, communs à la recherche et aux réglages
src/ui/settingsPage.ts         page Réglages (#reglages) : recherche à l'ouverture, version
src/ui/results.ts              liste des résultats groupés par jour
src/ui/dom.ts                  accès aux éléments de la page et au stockage de l'appareil
src/ui/effects.ts              petites animations déclenchées par le code (rebond des pastilles, coup de raquette)
src/pwa/updatePrompt.ts(.css)  bandeau « Nouvelle version disponible » (repris de Tsuzuku)
src/style.css                  style « terrain de padel » (thèmes clair et sombre, polices système)
src/env.d.ts                   type de la version (package.json) injectée au build
public/icon.png                icône : raquette de padel détourée (source des icônes générées au build)
worker/relay.js                relais Cloudflare (à coller dans le tableau de bord Cloudflare)
tests/                         tests (Vitest) : recherche sur de vraies réponses de l'API, formats, relais
cli.ts                         recherche en ligne de commande, pour tester sur PC
vite.config.ts                 build, PWA (manifeste, service worker), version affichée
pwa-assets.config.ts           icônes PNG générées depuis public/icon.png
.github/workflows/deploy.yml   tests + build + déploiement de l'app sur push vers main
```

## Développer sur PC

```bash
npm install
npm run dev              # http://localhost:5173/ResaPadel/ (passe par le relais)
npm test                 # tests (Vitest)
npm start                # recherche par défaut en ligne de commande, directement sur l'API
npm start -- --verbose   # idem, en affichant chaque requête
npm run build            # vérifie les types puis construit dist/
npm run format           # remet en forme le projet (Prettier)
```

## Mettre en ligne

### 1. Le relais Cloudflare

Il tourne sur `https://padel-relais.pauldabadie.workers.dev`. Il n'est pas redéployé automatiquement : il change rarement. Pour le mettre à jour : tableau de bord Cloudflare → **Workers & Pages** → **padel-relais** → **Edit code**, puis collez tout le contenu de `worker/relay.js` et cliquez **Deploy**. Le fichier est autonome : ses constantes (club, adresse de l'API, délai) répètent celles de `src/config.ts`, et `npm test` vérifie qu'elles concordent.

Si l'adresse de l'application change (autre nom de repo ou autre compte GitHub), mettez à jour `ALLOWED_ORIGINS` dans `worker/relay.js`. Si l'adresse du relais change, mettez à jour `RELAY_URL` dans `src/config.ts`.

### 2. GitHub Pages

1. Dans `vite.config.ts`, vérifiez que `REPO_NAME` correspond exactement au nom du repo GitHub (ici `ResaPadel`).
2. Poussez le projet sur la branche `main` du repo.
3. Sur GitHub : repo → **Settings** → **Pages** → Source : **GitHub Actions**.
4. Chaque push sur `main` lance les tests, construit l'application et la publie. Si l'app est déjà ouverte, un bandeau **« Nouvelle version disponible »** propose de la recharger. Le numéro de version est affiché dans la page Réglages : pensez à l'augmenter dans `package.json` avant de publier une nouvelle version (`npm version patch --no-git-tag-version` pour une correction, `minor` pour une nouveauté), sinon il ne change pas.

L'application est ensuite à l'adresse `https://paddadie.github.io/ResaPadel/`.

## Installer sur l'iPhone

1. Ouvrez `https://paddadie.github.io/ResaPadel/` dans **Safari**.
2. Touchez le bouton de partage, puis **« Sur l'écran d'accueil »**.
3. L'icône raquette apparaît. L'application s'ouvre en plein écran.

Dans l'application installée, le bouton « Réserver » ouvre la page du club dans **l'app Chrome**, à côté de l'app padel : on passe de l'une à l'autre pour revoir les dispos. iOS ne permet pas à une application web de choisir le navigateur par défaut ; sans Chrome installé, le bouton ne fait rien. Pour réserver, soyez connecté à votre compte sur `sporting-nantes.doinsport.club` dans Chrome.

## À savoir

- **API non officielle** : elle peut changer sans préavis. En cas d'erreur, `npm test` et `npm start -- --verbose` aident à voir ce qui a changé.
- **Identifiant de l'activité** : s'il change, l'application le retrouve par son nom (« Padel »), continue de fonctionner et affiche le nouvel identifiant à reporter dans `src/config.ts`.
- **Aucune donnée personnelle** : l'application n'utilise ni compte, ni identifiant, ni mot de passe.
