import { isProfessorCocoTag } from '../data/professor-coco';
import { getPokemonIdFromTagCode } from '../data/tag-codes';
import { formatDex } from './collection';

export type PokemonTagPayload = {
  kind: 'pokemon';
  id: number;
  dex: string;
  tagCode: string | null;
};

export type ProfessorTagPayload = {
  kind: 'professor';
  professor: 'coco';
  tagCode: string;
};

export type ParsedTagPayload = PokemonTagPayload | ProfessorTagPayload;

export type ScanPayload = {
  rawText: string;
  serialNumber: string | null;
};

function decodeRecord(record: NDEFRecord): string | null {
  if (!record.data) {
    return null;
  }

  const encoding = record.encoding ?? 'utf-8';
  const decoder = new TextDecoder(encoding);
  return decoder.decode(record.data);
}

function parsePokemonId(id: number, tagCode: string | null): ParsedTagPayload | null {
  if (!Number.isInteger(id) || id < 1 || id > 151) {
    return null;
  }

  return {
    kind: 'pokemon',
    id,
    dex: formatDex(id),
    tagCode,
  };
}

function parseTagCodeValue(tagCode: string): ParsedTagPayload | null {
  if (isProfessorCocoTag(tagCode)) {
    return {
      kind: 'professor',
      professor: 'coco',
      tagCode,
    };
  }

  const id = getPokemonIdFromTagCode(tagCode);
  return id ? parsePokemonId(id, tagCode) : null;
}

function parseUrlTag(normalized: string): ParsedTagPayload | null {
  try {
    const url = new URL(normalized);
    const tagCode = url.searchParams.get('tag')?.trim().toUpperCase() ?? null;
    if (!tagCode) {
      return null;
    }

    return parseTagCodeValue(tagCode);
  } catch {
    return null;
  }
}

function parseTagCode(normalized: string): ParsedTagPayload | null {
  const match = normalized.match(/\b(YF-[A-Z0-9]{6})\b/i);
  if (!match) {
    return null;
  }

  const tagCode = match[1].toUpperCase();
  return parseTagCodeValue(tagCode);
}

function parseLegacyDex(normalized: string): ParsedTagPayload | null {
  const patterns = [
    /(?:yffiniac(?:[_ -]?poke(?:[_ -]?caching)?)?|pokemon|pokedex)[^0-9]{0,10}(\d{1,3})/i,
    /^\s*(\d{1,3})\s*$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    return parsePokemonId(Number(match[1]), null);
  }

  return null;
}

export function isWebNfcAvailable(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export function parseTagPayload(rawText: string): ParsedTagPayload | null {
  const normalized = rawText.trim();

  return parseUrlTag(normalized) ?? parseTagCode(normalized) ?? parseLegacyDex(normalized);
}

export async function beginNfcScan(
  onPayload: (payload: ScanPayload) => void,
  onError: (message: string) => void,
): Promise<AbortController> {
  if (!isWebNfcAvailable()) {
    throw new Error('Web NFC est indisponible sur cet appareil.');
  }

  const reader = new NDEFReader();
  const controller = new AbortController();

  reader.onreadingerror = () => {
    onError('La puce a été détectée, mais son contenu NDEF est illisible.');
  };

  reader.onreading = (event) => {
    const rawText = event.message.records
      .map((record) => decodeRecord(record))
      .find((value): value is string => Boolean(value?.trim()));

    if (!rawText) {
      onError('Aucune donnée texte exploitable n’a été trouvée sur la puce.');
      return;
    }

    onPayload({
      rawText,
      serialNumber: event.serialNumber ?? null,
    });
  };

  await reader.scan({ signal: controller.signal });

  return controller;
}
