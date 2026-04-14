export const PROFESSOR_COCO_TAG = 'YF-COCO01';
export const starterPokemonIds = [1, 4, 7] as const;

export function isProfessorCocoTag(tagCode: string): boolean {
  return tagCode.trim().toUpperCase() === PROFESSOR_COCO_TAG;
}
