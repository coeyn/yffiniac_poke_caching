# Organisation Yffiniac Poke Caching

Document reserve a l’equipe projet. Les informations ci-dessous ne doivent pas apparaitre sur le site joueur.

## Format NFC retenu

Chaque puce doit contenir une URL du type :

```text
https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-8A21C4
```

Le code `YF-XXXXXX` est opaque. Le site l’interprete ensuite pour retrouver le Pokemon correspondant.

## Pourquoi ce format

- le numero du Pokemon n’est pas ecrit en clair dans la puce
- un scan peut ouvrir directement la web app
- le format reste compatible avec un futur backend
- le niveau de securite est volontairement simple pour le MVP

## Fichiers utiles

- logique des tags : [src/data/tag-codes.ts](</c:/Users/coeyn/Documents/projet code/yffiniac_poke_caching/src/data/tag-codes.ts>)
- interpretation NFC : [src/lib/nfc.ts](</c:/Users/coeyn/Documents/projet code/yffiniac_poke_caching/src/lib/nfc.ts>)
- interface joueur : [src/App.tsx](</c:/Users/coeyn/Documents/projet code/yffiniac_poke_caching/src/App.tsx>)

## Feuille de route

1. stabiliser la demo NFC sur telephone avec le format URL `?tag=...`
2. preparer un tableau de pose des figurines pour la mairie
3. ajouter plus tard les comptes joueurs et la validation serveur
4. renforcer ensuite la securite anti-triche si le projet monte en charge

## Note exploitation

Si besoin, je pourrai ensuite generer ici un tableau complet des 151 tags a ecrire sur les puces.
