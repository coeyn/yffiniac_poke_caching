export type ScanSource = 'nfc' | 'manual';

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
  version: 1;
  explorerName: string;
  found: Record<string, FoundPokemonRecord>;
  history: ScanHistoryEntry[];
};

const STORAGE_KEY = 'yffiniac-poke-caching/local-collection/v1';

export function formatDex(id: number): string {
  return String(id).padStart(3, '0');
}

export function createEmptyCollection(): CollectionState {
  return {
    version: 1,
    explorerName: '',
    found: {},
    history: [],
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

    const parsed = JSON.parse(raw) as Partial<CollectionState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.explorerName !== 'string' ||
      !parsed.found ||
      !parsed.history
    ) {
      return createEmptyCollection();
    }

    return {
      version: 1,
      explorerName: parsed.explorerName,
      found: parsed.found,
      history: parsed.history,
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
