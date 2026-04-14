export function repairMojibake(value: string): string {
  const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
