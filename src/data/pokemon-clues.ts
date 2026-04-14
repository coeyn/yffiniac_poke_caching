import type { PokemonEntry } from './pokemon';

export const pokemonClues: Partial<Record<string, string>> = {
  '001': 'Pres des feuillages calmes, la ou le vert prend toute la place.',
  '004': 'Cherche un coin qui aime la chaleur ou la brique au soleil.',
  '007': 'L eau n est jamais tres loin quand celui-ci observe les alentours.',
  '010': 'Regarde les bordures plantees et les passages tres tranquilles.',
  '016': 'Un endroit ouvert, ou l on peut facilement prendre un peu de hauteur.',
  '019': 'Il prefere les passages bas, rapides et discrets.',
  '025': 'Souvent la ou ca circule, mais jamais loin d un point qui attire les regards.',
  '035': 'Un lieu doux, calme, presque feerique quand la lumiere tombe bien.',
  '039': 'Tends l oreille pres d un coin reposant.',
  '043': 'Quand la nature prend le dessus, il n est jamais loin.',
  '052': 'Pres d un passage vivant, avec de quoi observer sans etre vu.',
  '054': 'Si l endroit invite a rever ou a regarder l eau, tu chauffes.',
  '074': 'Cherche la matiere brute, la pierre, le relief.',
  '092': 'Un coin discret, surtout quand la lumiere baisse.',
  '129': 'Il n est jamais totalement a sa place, et c est justement l indice.',
  '133': 'Un lieu de passage, parfait pour imaginer plusieurs chemins possibles.',
  '143': 'Cherche un endroit qui donne envie de faire une pause.',
  '151': 'Celui-ci aime garder un peu de mystere, meme quand on croit avoir compris.',
};

export function getPokemonClue(pokemon: Pick<PokemonEntry, 'dex'>): string | null {
  return pokemonClues[pokemon.dex] ?? null;
}
