import { formatDex } from './collection';

export type ParsedTagPayload = {
  id: number;
  dex: string;
};

export type ScanPayload = {
  rawText: string;
  serialNumber: string | null;
};

const supportedPatterns = [
  /(?:yffiniac(?:[_ -]?poke(?:[_ -]?caching)?)?|pokemon|pokedex)[^0-9]{0,10}(\d{1,3})/i,
  /^\s*(\d{1,3})\s*$/,
];

function decodeRecord(record: NDEFRecord): string | null {
  if (!record.data) {
    return null;
  }

  const encoding = record.encoding ?? 'utf-8';
  const decoder = new TextDecoder(encoding);
  return decoder.decode(record.data);
}

export function isWebNfcAvailable(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export function parseTagPayload(rawText: string): ParsedTagPayload | null {
  const normalized = rawText.trim();

  for (const pattern of supportedPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const id = Number(match[1]);
    if (!Number.isInteger(id) || id < 1 || id > 151) {
      return null;
    }

    return {
      id,
      dex: formatDex(id),
    };
  }

  return null;
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
