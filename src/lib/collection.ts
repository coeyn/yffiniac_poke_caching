export type ScanSource = 'nfc' | 'manual' | 'url' | 'professor';

export type FoundPokemonRecord = {
  id: number;
  dex: string;
  foundAt: string;
  scanCount: number;
  isShiny: boolean;
  lastSource: ScanSource;
  lastPayload: string;
  serialNumber: string | null;
};

export type ShinyPokemonRecord = {
  id: number;
  dex: string;
  firstFoundAt: string;
  lastFoundAt: string;
  shinyCount: number;
};

export type PendingEncounterRecord = {
  id: number;
  dex: string;
  openedAt: string;
  blockedUntil: string;
  captured: boolean;
};

export type ScanHistoryEntry = {
  id: number;
  dex: string;
  scannedAt: string;
  source: ScanSource;
  payload: string;
  serialNumber: string | null;
  isShiny: boolean;
};

export type CollectionState = {
  version: 5;
  explorerName: string;
  adventureStarted: boolean;
  found: Record<string, FoundPokemonRecord>;
  shinyDex: Record<string, ShinyPokemonRecord>;
  shinyAttempts: Record<string, number>;
  pendingEncounters: Record<string, PendingEncounterRecord>;
  history: ScanHistoryEntry[];
  lastWeeklyResetAt: string | null;
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
    version: 5,
    explorerName: '',
    adventureStarted: false,
    found: {},
    shinyDex: {},
    shinyAttempts: {},
    pendingEncounters: {},
    history: [],
    lastWeeklyResetAt: null,
    professor: createEmptyProfessorProgress(),
  };
}

function normalizeFoundRecord(
  record: FoundPokemonRecord,
  fallbackId: number,
  fallbackDex: string,
): FoundPokemonRecord {
  return {
    id: record.id ?? fallbackId,
    dex: record.dex ?? fallbackDex,
    foundAt: record.foundAt,
    scanCount: record.scanCount ?? 1,
    isShiny: Boolean(record.isShiny),
    lastSource: record.lastSource,
    lastPayload: record.lastPayload,
    serialNumber: record.serialNumber ?? null,
  };
}

function normalizeFoundRecords(
  found: Record<string, FoundPokemonRecord> | undefined,
): Record<string, FoundPokemonRecord> {
  if (!found) {
    return {};
  }

  return Object.entries(found).reduce<Record<string, FoundPokemonRecord>>((acc, [dex, record]) => {
    acc[dex] = normalizeFoundRecord(record, Number.parseInt(dex, 10), dex);
    return acc;
  }, {});
}

function normalizeHistory(history: ScanHistoryEntry[] | undefined): ScanHistoryEntry[] {
  if (!history) {
    return [];
  }

  return history.map((entry) => ({
    ...entry,
    isShiny: Boolean(entry.isShiny),
  }));
}

function resetMarkerForDate(date: Date): string {
  const marker = new Date(date);
  marker.setSeconds(0, 0);
  marker.setDate(marker.getDate() - ((marker.getDay() + 7 - 5) % 7));
  marker.setHours(14, 0, 0, 0);

  if (date.getTime() < marker.getTime()) {
    marker.setDate(marker.getDate() - 7);
  }

  return marker.toISOString();
}

export function getCurrentResetMarker(now = new Date()): string {
  return resetMarkerForDate(now);
}

export function getNextWeeklyResetAt(now = new Date()): string {
  const currentMarker = new Date(resetMarkerForDate(now));
  currentMarker.setDate(currentMarker.getDate() + 7);
  return currentMarker.toISOString();
}

export function applyWeeklyResetIfNeeded(
  current: CollectionState,
  now = new Date(),
): CollectionState {
  const expectedMarker = getCurrentResetMarker(now);
  if (current.lastWeeklyResetAt === expectedMarker) {
    return current;
  }

  return {
    ...current,
    found: {},
    history: [],
    pendingEncounters: {},
    lastWeeklyResetAt: expectedMarker,
  };
}

export function getShinyChanceByAttempts(attempts: number): number {
  const baseChance = 0.015;
  const progression = Math.max(0, attempts - 1) * 0.0075;
  return Math.min(0.3, baseChance + progression);
}

export function getEncounterBlockUntil(
  current: CollectionState,
  dex: string,
  now = new Date(),
): string | null {
  const pending = current.pendingEncounters[dex];
  if (!pending || pending.captured) {
    return null;
  }

  const blockedUntil = new Date(pending.blockedUntil);
  return blockedUntil.getTime() > now.getTime() ? pending.blockedUntil : null;
}

export function registerEncounterAttempt(
  current: CollectionState,
  options: {
    id: number;
    dex: string;
    openedAt?: string;
    blockedUntil?: string;
  },
): CollectionState {
  const openedAt = options.openedAt ?? new Date().toISOString();
  const blockedUntil = options.blockedUntil ?? getNextWeeklyResetAt(new Date(openedAt));
  const attempts = (current.shinyAttempts[options.dex] ?? 0) + 1;

  return {
    ...current,
    shinyAttempts: {
      ...current.shinyAttempts,
      [options.dex]: attempts,
    },
    pendingEncounters: {
      ...current.pendingEncounters,
      [options.dex]: {
        id: options.id,
        dex: options.dex,
        openedAt,
        blockedUntil,
        captured: false,
      },
    },
  };
}

export function resolveEncounterCaptured(current: CollectionState, dex: string): CollectionState {
  const pending = current.pendingEncounters[dex];
  if (!pending || pending.captured) {
    return current;
  }

  return {
    ...current,
    pendingEncounters: {
      ...current.pendingEncounters,
      [dex]: {
        ...pending,
        captured: true,
      },
    },
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
      adventureStarted?: unknown;
      found?: Record<string, FoundPokemonRecord>;
      history?: ScanHistoryEntry[];
      shinyDex?: Record<string, ShinyPokemonRecord>;
      shinyAttempts?: Record<string, number>;
      pendingEncounters?: Record<string, PendingEncounterRecord>;
      lastWeeklyResetAt?: string | null;
      professor?: Partial<ProfessorProgress>;
    };

    if (parsed.version === 1) {
      return applyWeeklyResetIfNeeded({
        version: 5,
        explorerName: typeof parsed.explorerName === 'string' ? parsed.explorerName : '',
        adventureStarted:
          typeof parsed.explorerName === 'string' && parsed.explorerName.trim().length >= 2,
        found: normalizeFoundRecords(parsed.found),
        shinyDex: {},
        shinyAttempts: {},
        pendingEncounters: {},
        history: normalizeHistory(parsed.history),
        lastWeeklyResetAt: null,
        professor: createEmptyProfessorProgress(),
      });
    }

    if (parsed.version === 2) {
      const explorerName = typeof parsed.explorerName === 'string' ? parsed.explorerName : '';
      return applyWeeklyResetIfNeeded({
        version: 5,
        explorerName,
        adventureStarted:
          typeof parsed.adventureStarted === 'boolean'
            ? parsed.adventureStarted
            : explorerName.trim().length >= 2,
        found: normalizeFoundRecords(parsed.found),
        shinyDex: {},
        shinyAttempts: {},
        pendingEncounters: {},
        history: normalizeHistory(parsed.history),
        lastWeeklyResetAt: null,
        professor: {
          visits: parsed.professor?.visits ?? 0,
          firstVisitAt: parsed.professor?.firstVisitAt ?? null,
          lastVisitAt: parsed.professor?.lastVisitAt ?? null,
          startersClaimed: parsed.professor?.startersClaimed ?? [],
        },
      });
    }

    if (
      (parsed.version !== 3 && parsed.version !== 4 && parsed.version !== 5) ||
      typeof parsed.explorerName !== 'string' ||
      typeof parsed.adventureStarted !== 'boolean' ||
      !parsed.found ||
      !parsed.history
    ) {
      return createEmptyCollection();
    }

    return applyWeeklyResetIfNeeded({
      version: 5,
      explorerName: parsed.explorerName,
      adventureStarted: parsed.adventureStarted,
      found: normalizeFoundRecords(parsed.found),
      shinyDex: parsed.shinyDex ?? {},
      shinyAttempts: parsed.shinyAttempts ?? {},
      pendingEncounters: parsed.pendingEncounters ?? {},
      history: normalizeHistory(parsed.history),
      lastWeeklyResetAt: parsed.lastWeeklyResetAt ?? null,
      professor: {
        visits: parsed.professor?.visits ?? 0,
        firstVisitAt: parsed.professor?.firstVisitAt ?? null,
        lastVisitAt: parsed.professor?.lastVisitAt ?? null,
        startersClaimed: parsed.professor?.startersClaimed ?? [],
      },
    });
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
    isShiny?: boolean;
    serialNumber?: string | null;
    scannedAt?: string;
  },
): CollectionState {
  const dex = formatDex(options.id);
  const scannedAt = options.scannedAt ?? new Date().toISOString();
  const previousRecord = current.found[dex];
  const isShiny = Boolean(options.isShiny);
  const hasShinyInCurrentWeek = previousRecord?.isShiny ?? false;
  const previousShiny = current.shinyDex[dex];

  return {
    ...current,
    found: {
      ...current.found,
      [dex]: {
        id: options.id,
        dex,
        foundAt: previousRecord?.foundAt ?? scannedAt,
        scanCount: (previousRecord?.scanCount ?? 0) + 1,
        isShiny: hasShinyInCurrentWeek || isShiny,
        lastSource: options.source,
        lastPayload: options.payload,
        serialNumber: options.serialNumber ?? null,
      },
    },
    shinyDex: isShiny
      ? {
          ...current.shinyDex,
          [dex]: {
            id: options.id,
            dex,
            firstFoundAt: previousShiny?.firstFoundAt ?? scannedAt,
            lastFoundAt: scannedAt,
            shinyCount: (previousShiny?.shinyCount ?? 0) + 1,
          },
        }
      : current.shinyDex,
    history: [
      {
        id: options.id,
        dex,
        scannedAt,
        source: options.source,
        payload: options.payload,
        serialNumber: options.serialNumber ?? null,
        isShiny,
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
    isShiny: false,
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
