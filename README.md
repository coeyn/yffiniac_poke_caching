# Yffiniac Poke Caching

Jeu de geocaching Pokemon autour d'Yffiniac, soutenu par la mairie. Le principe: retrouver 151 figurines Pokemon cachees dans la ville, scanner leur puce NFC, puis remplir un Pokedex local directement sur l'appareil du joueur.

## Etat actuel du projet

- application web `React + Vite + TypeScript`
- deploiement sur `GitHub Pages`
- collection locale des 151 premiers Pokemon en `localStorage`
- ouverture directe depuis une puce NFC via une URL avec parametre `?tag=...`
- scene de capture dediee pour chaque figurine:
  - hautes herbes animees
  - apparition du Pokemon
  - lancer de Pokeball
  - Pokemon aspire dans la balle
  - tremblement de la balle
  - etoiles de capture reussie
- Pokedex compact avec grille de Pokemon et details en modal
- onboarding avec le Professeur Coco a la premiere visite
- pseudo de dresseur stocke localement
- systeme de point de depart / progression special Professeur Coco

## Fonctionnement NFC retenu

Chaque puce contient une URL du type:

```text
https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-8A21C4
https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-COCO01
```

Le code `YF-XXXXXX` est opaque. Le site l'interprete ensuite pour retrouver soit:

- une figurine Pokemon
- le tag special du Professeur Coco

Ce choix permet:

- d'ouvrir directement la web app au scan
- de ne pas exposer en clair le numero du Pokemon dans la puce
- de garder un systeme simple a poser sur le terrain
- de conserver un format compatible avec un futur backend

## Boucle joueur actuelle

1. Premiere visite: le Professeur Coco accueille le joueur et demande son nom de dresseur.
2. Le joueur est invite a rejoindre la mairie d'Yffiniac pour lancer son aventure.
3. Le tag `YF-COCO01` sert de point de depart officiel.
4. Lors du premier scan du tag Professeur Coco, le joueur choisit son starter.
5. Chaque scan d'une figurine Pokemon ouvre une page de capture dediee.
6. Une fois la capture terminee, le Pokemon est ajoute a la collection locale.
7. En rescannant le tag Professeur Coco:
   - le joueur obtient un point d'etape sur sa progression
   - a 50 Pokemon captures, il peut choisir un deuxieme starter
   - a 100 Pokemon captures, il peut recuperer le dernier starter restant

## Stockage local

Actuellement, toute la progression est conservee sur l'appareil du joueur:

- nom de dresseur
- Pokemon captures
- historique local des scans
- progression Professeur Coco
- starters deja recuperes

Avantage:

- pas de compte a creer pour commencer
- parfait pour une premiere version terrain

Limite:

- si le joueur change d'appareil ou efface ses donnees navigateur, sa progression est perdue

## Images Pokemon: local ou API ?

Pour ce projet, le meilleur choix actuel est de servir les images localement dans le repo.

Pourquoi:

- plus fiable pour un jeu terrain
- pas de dependance a une API externe pour l'affichage
- temps de chargement stable
- pas de risque de casse si une API change ou limite les requetes
- plus simple a deployer sur GitHub Pages

Une API externe ne deviendra interessante que plus tard si vous voulez:

- enrichir automatiquement les fiches Pokemon
- recuperer plusieurs variantes d'images
- ajouter des donnees annexes sans les maintenir a la main

## GitHub Pages

Le site est prevu pour tourner sur:

```text
https://coeyn.github.io/yffiniac_poke_caching/
```

Le deploiement se fait depuis la branche principale via GitHub Pages.

A verifier dans GitHub si besoin:

- `Settings > Pages`
- mode `Deploy from a branch` ou workflow selon votre configuration active
- branche `main`
- dossier publie adapte a la config actuelle

## Tags et documentation terrain

- les tags NFC Pokemon sont references dans [docs/TAGS.md](docs/TAGS.md)
- l'organisation terrain peut etre maintenue dans [docs/ORGANISATION.md](docs/ORGANISATION.md)

## Developpement

Installation:

```bash
npm install
```

Lancer le projet en local:

```bash
npm run dev
```

Build de production:

```bash
npm run build
```

## Suite du projet

Feuille de route a tenir a jour ici:

1. finaliser l'experience de capture et les derniers ajustements d'animation
2. completer les indices Pokemon dans les donnees
3. preparer la pose terrain des 151 figurines avec suivi mairie
4. ajouter plus tard les comptes joueurs et la synchronisation serveur
5. prevoir ensuite des outils d'administration pour suivre la progression globale
6. durcir plus tard la validation si la triche devient un vrai sujet
