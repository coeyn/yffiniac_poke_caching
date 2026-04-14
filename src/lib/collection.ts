export type ScanSource = 'nfc' | 'manual' | 'url' | 'professor';

export type FoundPokemonRecord = {
  id: number;
  dex: string;
  foundAt: string;
  scanCount: number;
  lastSource: ScanSource;
  lastPayload: string;
  serialNumber: string | null;
};

export type ScanHistoryEntry = {
  id: number;
  dex: string;
  scannedAt: string;
  source: ScanSource;
  payload: string;
  serialNumber: string | null;
};

export type CollectionState = {
  version: 2;
  explorerName: string;
  found: Record<string, FoundPokemonRecord>;
  history: ScanHistoryEntry[];
  professor: ProfessorProgress;
};

export type ProfessorProgress = {
  visits: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  startersClaimed: string[];
};

const STORAGE_KEY = 'yffiniac-poke-caching/local-collection/v1';

export function formatDex(id: number): string {
  return String(id).padStart(3, '0');
}

export function createEmptyProfessorProgress(): ProfessorProgress {
  return {
    visits: 0,
    firstVisitAt: null,
    lastVisitAt: null,
    startersClaimed: [],
  };
}

export function createEmptyCollection(): CollectionState {
  return {
    version: 2,
    explorerName: '',
    found: {},
    history: [],
    professor: createEmptyProfessorProgress(),
  };
}

export function loadCollection(): CollectionState {
  if (typeof window === 'undefined') {
    return createEmptyCollection();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyCollection();
    }

    const parsed = JSON.parse(raw) as {
      version?: number;
      explorerName?: unknown;
      found?: Record<string, FoundPokemonRecord>;
      history?: ScanHistoryEntry[];
      professor?: Partial<ProfessorProgress>;
    };

    if (parsed.version === 1) {
      return {
        version: 2,
        explorerName: typeof parsed.explorerName === 'string' ? parsed.explorerName : '',
        found: parsed.found ?? {},
        history: parsed.history ?? [],
        professor: createEmptyProfessorProgress(),
      };
    }

    if (
      parsed.version !== 2 ||
      typeof parsed.explorerName !== 'string' ||
      !parsed.found ||
      !parsed.history
    ) {
      return createEmptyCollection();
    }

    return {
      version: 2,
      explorerName: parsed.explorerName,
      found: parsed.found,
      history: parsed.history,
      professor: {
        visits: parsed.professor?.visits ?? 0,
        firstVisitAt: parsed.professor?.firstVisitAt ?? null,
        lastVisitAt: parsed.professor?.lastVisitAt ?? null,
        startersClaimed: parsed.professor?.startersClaimed ?? [],
      },
    };
  } catch {
    return createEmptyCollection();
  }
}

export function saveCollection(collection: CollectionState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  } catch {
    // Ignore storage write failures so the app remains usable.
  }
}

export function recordProfessorVisit(
  current: CollectionState,
  visitedAt = new Date().toISOString(),
): CollectionState {
  return {
    ...current,
    professor: {
      ...current.professor,
      visits: current.professor.visits + 1,
      firstVisitAt: current.professor.firstVisitAt ?? visitedAt,
      lastVisitAt: visitedAt,
    },
  };
}

export function markPokemonFound(
  current: CollectionState,
  options: {
    id: number;
    payload: string;
    source: ScanSource;
    serialNumber?: string | null;
    scannedAt?: string;
  },
): CollectionState {
  const dex = formatDex(options.id);
  const scannedAt = options.scannedAt ?? new Date().toISOString();
  const previousRecord = current.found[dex];

  return {
    ...current,
    found: {
      ...current.found,
      [dex]: {
        id: options.id,
        dex,
        foundAt: previousRecord?.foundAt ?? scannedAt,
        scanCount: (previousRecord?.scanCount ?? 0) + 1,
        lastSource: options.source,
        lastPayload: options.payload,
        serialNumber: options.serialNumber ?? null,
      },
    },
    history: [
      {
        id: options.id,
        dex,
        scannedAt,
        source: options.source,
        payload: options.payload,
        serialNumber: options.serialNumber ?? null,
      },
      ...current.history,
    ].slice(0, 12),
  };
}

export function claimProfessorStarter(
  current: CollectionState,
  options: {
    id: number;
    payload: string;
    scannedAt?: string;
  },
): CollectionState {
  const dex = formatDex(options.id);
  const scannedAt = options.scannedAt ?? new Date().toISOString();
  const withPokemon = markPokemonFound(current, {
    id: options.id,
    payload: options.payload,
    source: 'professor',
    serialNumber: null,
    scannedAt,
  });

  return {
    ...withPokemon,
    professor: {
      ...withPokemon.professor,
      startersClaimed: withPokemon.professor.startersClaimed.includes(dex)
        ? withPokemon.professor.startersClaimed
        : [...withPokemon.professor.startersClaimed, dex],
      firstVisitAt: withPokemon.professor.firstVisitAt ?? scannedAt,
      lastVisitAt: scannedAt,
    },
  };
}
