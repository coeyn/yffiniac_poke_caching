import { pokemonCatalog } from './pokemon';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tagByDex = new Map<string, string>();
const dexByTag = new Map<string, number>();

function encodeBase32(value: number, length: number): string {
  let current = value;
  let output = '';

  for (let index = 0; index < length; index += 1) {
    output = `${alphabet[current % alphabet.length]}${output}`;
    current = Math.floor(current / alphabet.length);
  }

  return output;
}

function createTagCode(id: number): string {
  const obfuscated = id * 983 + 71;
  return `YF-${encodeBase32(obfuscated, 6)}`;
}

for (const pokemon of pokemonCatalog) {
  const tagCode = createTagCode(pokemon.id);
  tagByDex.set(pokemon.dex, tagCode);
  dexByTag.set(tagCode, pokemon.id);
}

export function getTagCodeForDex(dex: string): string {
  return tagByDex.get(dex) ?? createTagCode(Number(dex));
}

export function getPokemonIdFromTagCode(tagCode: string): number | null {
  return dexByTag.get(tagCode.trim().toUpperCase()) ?? null;
}

export function buildTagUrl(tagCode: string): string {
  const baseUrl =
    typeof window === 'undefined'
      ? 'https://coeyn.github.io/yffiniac_poke_caching/'
      : `${window.location.origin}${import.meta.env.BASE_URL}`;

  return `${baseUrl}?tag=${encodeURIComponent(tagCode)}`;
}
