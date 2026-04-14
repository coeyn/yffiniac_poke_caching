export type HuntingZone = {
  id: string;
  name: string;
  theme: string;
  description: string;
  terrain: string;
  clueStyle: string;
  dexRange: [number, number];
};

export type RolloutPhase = {
  id: string;
  title: string;
  description: string;
  deliverables: string[];
};

export const huntingZones: HuntingZone[] = [
  {
    id: 'bourg',
    name: 'Centre-bourg',
    theme: 'Départ familial',
    description:
      'Zone idéale pour lancer le parcours avec des figurines faciles à repérer et de courts trajets à pied.',
    terrain: 'Places, commerces, mobilier urbain, petits jardins',
    clueStyle: 'Indices très visibles, adaptés aux premières sorties',
    dexRange: [1, 30],
  },
  {
    id: 'sports',
    name: 'Équipements',
    theme: 'Boucle active',
    description:
      'Parcours autour des lieux de passage de la commune, utile pour drainer un public régulier toute l’année.',
    terrain: 'Salles, terrains, parkings, espaces de rendez-vous',
    clueStyle: 'Indices courts avec une consigne de sécurité claire',
    dexRange: [31, 60],
  },
  {
    id: 'nature',
    name: 'Parcs et respiration',
    theme: 'Exploration douce',
    description:
      'Caches pensées pour un rythme plus lent, avec une lecture d’environnement et un peu plus d’observation.',
    terrain: 'Sentiers, bancs, zones arborées, belvédères',
    clueStyle: 'Indices d’ambiance plutôt que repères bruts',
    dexRange: [61, 90],
  },
  {
    id: 'liaisons',
    name: 'Liaisons de quartier',
    theme: 'Chasse intermédiaire',
    description:
      'Segment utile pour relier plusieurs parties de la ville et inciter à revenir sur plusieurs jours.',
    terrain: 'Rues de transition, venelles, passages piétons, points d’arrêt',
    clueStyle: 'Indices directionnels et micro-énigmes',
    dexRange: [91, 120],
  },
  {
    id: 'finale',
    name: 'Grande finale',
    theme: 'Derniers rares',
    description:
      'Réserve de fin de jeu pour les Pokémon les plus recherchés et les sorties spéciales de la commune.',
    terrain: 'Spots emblématiques validés avec la mairie',
    clueStyle: 'Indices événementiels, publications ponctuelles, journées dédiées',
    dexRange: [121, 151],
  },
];

export const rolloutPhases: RolloutPhase[] = [
  {
    id: 'mvp',
    title: 'MVP terrain',
    description:
      'Lancer rapidement le jeu avec stockage local, scan NFC et un référentiel propre des 151 figurines.',
    deliverables: ['Collection locale', 'Scan navigateur', 'Page GitHub Pages', 'Format de tag simple'],
  },
  {
    id: 'operations',
    title: 'Opérations municipales',
    description:
      'Documenter la pose des figurines et le suivi interne des zones pour éviter les doublons et simplifier la maintenance.',
    deliverables: ['Tableau des caches', 'État par zone', 'Procédure de remplacement', 'Journal d’incident'],
  },
  {
    id: 'accounts',
    title: 'Comptes et anti-triche',
    description:
      'Passer à une validation serveur des scans afin de synchroniser les joueurs et sécuriser la progression.',
    deliverables: ['Connexion joueur', 'Historique centralisé', 'Validation backend', 'Badges et classement'],
  },
];
