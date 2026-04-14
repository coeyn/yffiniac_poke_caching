# Yffiniac Poké Caching

Jeu de geocaching Pokémon autour d’Yffiniac, soutenu par la mairie. Le principe: retrouver 151 figurines cachées dans la ville, scanner leur puce NFC, puis compléter sa collection.

## MVP livré

- application web `React + Vite + TypeScript`
- collection locale des 151 premiers Pokémon
- scans enregistrés en `localStorage` sur l’appareil
- lecture NFC via Web NFC côté navigateur
- saisie manuelle de secours pour les tests desktop et les appareils non compatibles
- sprites Pokémon servis localement depuis le projet

## Choix recommandé pour les images

Pour ce projet, le meilleur choix est d’héberger les images localement sur le serveur et dans le dépôt, pas de les charger à chaque visite via une API externe.

Pourquoi:

- il n’y a que 151 Pokémon, donc le volume reste raisonnable
- l’expérience sera plus fiable pour un projet municipal et un usage terrain
- pas de dépendance runtime à une API tierce ni à ses limites de disponibilité
- temps de chargement plus stable
- possibilité d’aller vers une PWA plus tard

Le bon compromis est celui utilisé ici: les visuels sont servis localement par l’application. Une API externe peut rester utile plus tard pour enrichir les données, mais pas pour le coeur du jeu.

## Limite importante du MVP

Cette première version ne fournit pas encore une preuve anti-triche forte, car tout est stocké localement sur l’appareil. Un joueur pourrait donc théoriquement partager un code.

Pour une vraie validation robuste, la prochaine étape sera:

- comptes utilisateurs
- base de données serveur
- jetons de tags uniques validés côté backend
- historique centralisé des scans

## Format NFC conseillé

Pour commencer simplement avec les puces `NTAG213 / NFC213`, stocker un enregistrement texte NDEF de la forme:

```text
YFFINIAC-POKE:025
```

Le MVP actuel accepte aussi `025` tout seul pour les tests.

## Compatibilité Web NFC

Le scan navigateur fonctionne surtout avec:

- Android
- Chrome ou Edge
- site servi en HTTPS

Sur desktop, sur iPhone, ou sur un appareil sans Web NFC, la saisie manuelle permet tout de même de tester le jeu.

## Développement

```bash
npm install
npm run dev
```

Build de production:

```bash
npm run build
```
