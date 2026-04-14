# Yffiniac Poke Caching

Jeu de geocaching Pokemon autour d’Yffiniac, soutenu par la mairie. Le principe : retrouver 151 figurines cachees dans la ville, scanner leur puce NFC, puis completer sa collection.

## MVP actuel

- application web `React + Vite + TypeScript`
- collection locale des 151 premiers Pokemon
- scans enregistres en `localStorage` sur l’appareil
- lecture NFC via Web NFC cote navigateur
- saisie manuelle de secours pour les tests desktop et les appareils non compatibles
- sprites Pokemon servis localement depuis le projet
- format de tag opaque base sur une URL GitHub Pages

## Format NFC retenu

Chaque puce doit contenir une URL du type :

```text
https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-8A21C4
https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-COCO01
```

Le code `YF-XXXXXX` est opaque. Le site l’interprete ensuite pour retrouver le Pokemon correspondant.

Avantages :

- si le joueur scanne la puce sans avoir deja ouvert le site, le telephone peut ouvrir directement la web app
- le numero du Pokemon n’est pas ecrit en clair dans la puce
- le systeme reste simple a poser sur le terrain
- ce format pourra etre conserve plus tard si un backend est ajoute

## Compatibilite Web NFC

Le scan navigateur fonctionne surtout avec :

- Android
- Chrome ou Edge
- site servi en HTTPS

Sur desktop, sur iPhone, ou sur un appareil sans Web NFC, la saisie manuelle permet de tester le flux.

## GitHub Pages

Le depot est configure pour un deploiement via GitHub Actions sur GitHub Pages.

URL attendue :

```text
https://coeyn.github.io/yffiniac_poke_caching/
```

Si le site n’apparait pas, verifier dans GitHub :

- `Settings > Pages`
- `Source: GitHub Actions`
- l’onglet `Actions` pour confirmer que le workflow de deploiement est passe au vert

## Suite du projet

Feuille de route a maintenir ici plutot que dans l’interface :

1. stabiliser la demo NFC sur telephone avec le format URL `?tag=...`
2. preparer un tableau de pose des figurines pour la mairie
3. ajouter plus tard les comptes joueurs et la validation serveur
4. renforcer ensuite la securite anti-triche si le projet monte en charge

## Developpement

```bash
npm install
npm run dev
```

Build de production :

```bash
npm run build
```
