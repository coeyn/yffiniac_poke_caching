import { startTransition, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getPokemonClue } from './data/pokemon-clues';
import { pokemonCatalog } from './data/pokemon';
import {
  createEmptyCollection,
  loadCollection,
  markPokemonFound,
  saveCollection,
  type CollectionState,
} from './lib/collection';
import { parseTagPayload } from './lib/nfc';
import { repairMojibake } from './lib/text';

type FilterMode = 'all' | 'found' | 'missing';

type Notice = {
  tone: 'neutral' | 'success' | 'error';
  title: string;
  message: string;
};

type CaptureState = {
  rawUrl: string;
  dex: string;
  id: number;
  tagCode: string | null;
};

type CapturePhase = 'approach' | 'ready' | 'throwing' | 'captured';

type PokemonView = {
  id: number;
  dex: string;
  name: string;
  image: string;
};

const totalPokemon = pokemonCatalog.length;
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const filterModes: FilterMode[] = ['all', 'found', 'missing'];
const publicBaseUrl = import.meta.env.BASE_URL;
const displayCatalog: PokemonView[] = pokemonCatalog.map((pokemon) => ({
  ...pokemon,
  name: repairMojibake(pokemon.name),
}));

function resolvePublicAsset(path: string): string {
  return `${publicBaseUrl}${path.replace(/^\//, '')}`;
}

function formatScanDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function filterPokemon(collection: CollectionState, query: string, filterMode: FilterMode) {
  const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');

  return displayCatalog.filter((pokemon) => {
    const isFound = Boolean(collection.found[pokemon.dex]);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      pokemon.name.toLocaleLowerCase('fr-FR').includes(normalizedQuery) ||
      pokemon.dex.includes(normalizedQuery) ||
      String(pokemon.id).includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    if (filterMode === 'found') {
      return isFound;
    }

    if (filterMode === 'missing') {
      return !isFound;
    }

    return true;
  });
}

function readCaptureState(): CaptureState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.get('tag')) {
    return null;
  }

  const parsed = parseTagPayload(currentUrl.toString());
  if (!parsed) {
    return null;
  }

  return {
    rawUrl: currentUrl.toString(),
    dex: parsed.dex,
    id: parsed.id,
    tagCode: parsed.tagCode,
  };
}

function clearCaptureTagFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.delete('tag');
  window.history.replaceState({}, '', currentUrl);
}

function CaptureView(props: {
  captureState: CaptureState;
  collection: CollectionState;
  onCaptured: () => void;
  onReturn: () => void;
}) {
  const pokemon = displayCatalog[props.captureState.id - 1];
  const foundRecord = props.collection.found[props.captureState.dex];
  const clue = getPokemonClue(pokemon);
  const [phase, setPhase] = useState<CapturePhase>('approach');
  const [hasRecorded, setHasRecorded] = useState(false);

  useEffect(() => {
    setPhase('approach');
    setHasRecorded(false);
    const revealTimer = window.setTimeout(() => {
      setPhase('ready');
    }, 1100);

    return () => window.clearTimeout(revealTimer);
  }, [props.captureState.dex]);

  useEffect(() => {
    if (phase !== 'throwing') {
      return;
    }

    const captureTimer = window.setTimeout(() => {
      setPhase('captured');
    }, 1450);

    return () => window.clearTimeout(captureTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'captured' || hasRecorded) {
      return;
    }

    props.onCaptured();
    setHasRecorded(true);
  }, [hasRecorded, phase, props]);

  function handlePrimaryAction(): void {
    if (phase === 'ready') {
      setPhase('throwing');
      return;
    }

    if (phase === 'captured') {
      props.onReturn();
    }
  }

  const primaryButtonLabel =
    phase === 'ready'
      ? 'Lancer la Pokeball'
      : phase === 'throwing'
        ? 'Capture en cours...'
        : 'Retourner au Pokedex';

  const sceneMessage =
    phase === 'approach'
      ? 'Les hautes herbes bougent... quelque chose approche.'
      : phase === 'ready'
        ? `${pokemon.name} surgit des herbes. Lance une Pokeball.`
        : phase === 'throwing'
          ? 'La Pokeball file droit sur la figurine.'
          : foundRecord
            ? `${pokemon.name} est deja dans ta collection.`
            : `${pokemon.name} rejoint maintenant ta collection locale.`;

  return (
    <main className="capture-shell">
      <section className="capture-card capture-card-scene">
        <div className="capture-header">
          <p className="hero-kicker">Rencontre sauvage</p>
          <span className="capture-dex">#{pokemon.dex}</span>
        </div>

        <div className={`capture-arena is-${phase}`} aria-live="polite">
          <div className="capture-glow" aria-hidden="true" />
          <div className="capture-grass capture-grass-back" aria-hidden="true" />
          <div className="capture-pokemon-stage">
            <img
              src={resolvePublicAsset(pokemon.image)}
              alt={pokemon.name}
              width="220"
              height="220"
              className="capture-image"
            />
          </div>
          <div className="capture-grass capture-grass-front" aria-hidden="true" />
          <div className="capture-ball-flight" aria-hidden="true" />
          <div className="capture-impact" aria-hidden="true" />
          <p className="capture-scene-text">{sceneMessage}</p>
        </div>

        <div className="capture-copy">
          <h1>{pokemon.name}</h1>
          <p className="capture-text">
            {foundRecord
              ? 'Cette figurine a deja ete validee sur cet appareil.'
              : 'Tu viens de trouver une figurine Pokemon cachee dans Yffiniac.'}
          </p>
          {clue ? (
            <p className="capture-clue">
              <span>Indice</span>
              {clue}
            </p>
          ) : null}
        </div>

        <button
          className={`capture-button ${phase === 'ready' ? 'is-throw' : ''}`}
          type="button"
          onClick={handlePrimaryAction}
          disabled={phase === 'approach' || phase === 'throwing'}
        >
          <span className="capture-button-ball" aria-hidden="true" />
          {primaryButtonLabel}
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const [collection, setCollection] = useState(loadCollection);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [captureState, setCaptureState] = useState<CaptureState | null>(readCaptureState);
  const [selectedDex, setSelectedDex] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    title: 'Collection locale',
    message: 'Ta progression est enregistree sur cet appareil.',
  });
  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    saveCollection(collection);
  }, [collection]);

  const foundCount = Object.keys(collection.found).length;
  const completion = foundCount / totalPokemon;
  const completionPercent = Math.round(completion * 100);
  const filteredPokemon = filterPokemon(collection, deferredSearch, filterMode);
  const lastHistoryEntry = collection.history[0];
  const lastScannedPokemon = lastHistoryEntry ? displayCatalog[lastHistoryEntry.id - 1] : null;
  const selectedPokemon = selectedDex
    ? displayCatalog.find((pokemon) => pokemon.dex === selectedDex) ?? null
    : null;
  const selectedFoundRecord = selectedPokemon ? collection.found[selectedPokemon.dex] : null;
  const selectedClue = selectedPokemon ? getPokemonClue(selectedPokemon) : null;

  const capturePokemon = useMemo(
    () => (captureState ? displayCatalog[captureState.id - 1] : null),
    [captureState],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setSelectedDex(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleCaptureRecorded(): void {
    if (!captureState) {
      return;
    }

    const alreadyFound = Boolean(collection.found[captureState.dex]);

    setCollection((currentCollection) =>
      markPokemonFound(currentCollection, {
        id: captureState.id,
        payload: captureState.rawUrl,
        source: 'url',
        serialNumber: null,
      }),
    );

    setNotice({
      tone: 'success',
      title: alreadyFound ? `${capturePokemon?.name ?? 'Pokemon'} deja trouve` : `${capturePokemon?.name ?? 'Pokemon'} capture`,
      message: alreadyFound
        ? 'Cette capture etait deja presente sur cet appareil.'
        : 'Le Pokemon a bien ete ajoute a ta collection.',
    });
  }

  function handleCaptureReturn(): void {
    clearCaptureTagFromUrl();
    setCaptureState(null);
  }

  function handleCollectionReset(): void {
    const confirmed = window.confirm(
      'Effacer toute la progression locale sur cet appareil ? Cette action reinitialise la collection et l historique.',
    );

    if (!confirmed) {
      return;
    }

    setCollection(createEmptyCollection());
    setFilterMode('all');
    setSearchTerm('');
    setNotice({
      tone: 'neutral',
      title: 'Collection locale effacee',
      message: 'Le Pokedex de cet appareil a ete remis a zero.',
    });
  }

  if (captureState) {
    return (
      <CaptureView
        captureState={captureState}
        collection={collection}
        onCaptured={handleCaptureRecorded}
        onReturn={handleCaptureReturn}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">Yffiniac Poke Caching</p>
          <h1>Retrouve les figurines Pokemon cachees dans la ville et remplis ton Pokedex.</h1>
          <p className="hero-description">
            Chaque figurine trouvee ajoute un nouveau Pokemon a ta collection sur cet appareil.
          </p>

          <div className={`notice notice-${notice.tone} hero-notice`}>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>

          <ul className="hero-metrics">
            <li>
              <strong>{foundCount} / 151</strong>
              <span>Pokemon trouves</span>
            </li>
            <li>
              <strong>{completionPercent}%</strong>
              <span>Pokedex complete</span>
            </li>
            <li>
              <strong>{lastScannedPokemon ? lastScannedPokemon.name : 'Aucun'}</strong>
              <span>Derniere capture</span>
            </li>
          </ul>
        </div>

        <div className="hero-stage" aria-live="polite">
          <div className="hero-progress">
            <div
              className="progress-ring"
              style={{ '--progress-angle': `${completion * 360}deg` } as CSSProperties}
            >
              <div>
                <strong>{completionPercent}%</strong>
                <span>complete</span>
              </div>
            </div>

            <div className="hero-progress-copy">
              <p className="hero-label">Pokedex actuel</p>
              <h2>
                {foundCount} / {totalPokemon} trouves
              </h2>
              <p>
                {lastScannedPokemon && lastHistoryEntry
                  ? `Derniere capture : ${lastScannedPokemon.name} le ${formatScanDate(lastHistoryEntry.scannedAt)}`
                  : 'Aucune figurine validee pour le moment.'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="workspace-rail">
          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Profil local</p>
              <h3>Appareil en cours</h3>
            </div>

            <label className="stacked-field" htmlFor="explorer-name">
              Nom du dresseur
              <input
                id="explorer-name"
                name="explorer-name"
                type="text"
                value={collection.explorerName}
                onChange={(event) => {
                  const value = event.target.value.slice(0, 32);
                  startTransition(() => {
                    setCollection((currentCollection) => ({
                      ...currentCollection,
                      explorerName: value,
                    }));
                  });
                }}
                placeholder="Ex: Team Yffiniac"
                autoComplete="nickname"
              />
            </label>

            <dl className="stats-list">
              <div>
                <dt>Progression</dt>
                <dd>{completionPercent}%</dd>
              </div>
              <div>
                <dt>Trouves</dt>
                <dd>{foundCount}</dd>
              </div>
              <div>
                <dt>A trouver</dt>
                <dd>{totalPokemon - foundCount}</dd>
              </div>
            </dl>

            <button className="danger-button" type="button" onClick={handleCollectionReset}>
              Effacer les donnees locales
            </button>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Historique</p>
              <h3>Dernieres captures</h3>
            </div>

            {collection.history.length === 0 ? (
              <p className="panel-text">Aucune capture enregistree sur cet appareil pour l instant.</p>
            ) : (
              <ol className="history-list">
                {collection.history.map((entry) => (
                  <li key={`${entry.scannedAt}-${entry.dex}`}>
                    <div>
                      <span>#{entry.dex}</span>
                      <strong>{displayCatalog[entry.id - 1]?.name ?? `Pokemon #${entry.dex}`}</strong>
                      <small>{formatScanDate(entry.scannedAt)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>

        <section className="panel dex-panel" id="collection">
          <div className="dex-toolbar">
            <div>
              <p className="eyebrow">Collection</p>
              <h3>Pokedex d Yffiniac</h3>
              <p className="panel-text">
                Filtre les Pokemon et consulte directement leur indice dans les vignettes.
              </p>
            </div>

            <div className="toolbar-controls">
              <label className="search-field" htmlFor="pokemon-search">
                <span className="sr-only">Rechercher un Pokemon</span>
                <input
                  id="pokemon-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => setSearchTerm(value));
                  }}
                  placeholder="Nom ou numero"
                />
              </label>

              <div className="filter-row" role="tablist" aria-label="Filtrer la collection">
                {filterModes.map((mode) => {
                  const labels: Record<FilterMode, string> = {
                    all: 'Tous',
                    found: 'Trouves',
                    missing: 'Manquants',
                  };

                  return (
                    <button
                      key={mode}
                      className={mode === filterMode ? 'filter-chip active' : 'filter-chip'}
                      type="button"
                      role="tab"
                      aria-selected={mode === filterMode}
                      onClick={() => setFilterMode(mode)}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="selection-strip">
            <div>
              <p className="hero-label">Collection</p>
              <h4>{filteredPokemon.length} Pokemon affiches</h4>
              <p>Touche une vignette pour ouvrir son detail.</p>
            </div>

            <div className="selection-status">
              <span className="status-badge found">{foundCount} trouves</span>
              <span>{totalPokemon - foundCount} restants</span>
            </div>
          </div>

          <div className="dex-grid">
            {filteredPokemon.map((pokemon) => {
              const foundRecord = collection.found[pokemon.dex];

              return (
                <button
                  key={pokemon.dex}
                  className={['dex-tile', foundRecord ? 'is-found' : 'is-missing'].filter(Boolean).join(' ')}
                  type="button"
                  onClick={() => setSelectedDex(pokemon.dex)}
                  aria-label={`Ouvrir ${pokemon.name}`}
                >
                  <span className="dex-number">#{pokemon.dex}</span>
                  <div className="dex-visual">
                    <img
                      src={resolvePublicAsset(pokemon.image)}
                      alt=""
                      width="96"
                      height="96"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="dex-copy">
                    <strong>{pokemon.name}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {selectedPokemon ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedDex(null)}>
          <section
            className="pokemon-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pokemon-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelectedDex(null)}
              aria-label="Fermer"
            >
              ×
            </button>

            <div className="pokemon-modal-head">
              <span className="dex-number">#{selectedPokemon.dex}</span>
              <img
                src={resolvePublicAsset(selectedPokemon.image)}
                alt={selectedPokemon.name}
                width="140"
                height="140"
                className="pokemon-modal-image"
              />
              <h3 id="pokemon-modal-title">{selectedPokemon.name}</h3>
            </div>

            <div className="pokemon-modal-body">
              {selectedClue ? (
                <p className="pokemon-modal-clue">
                  <span>Indice</span>
                  {selectedClue}
                </p>
              ) : null}

              {selectedFoundRecord ? (
                <p className="pokemon-modal-status">
                  {`Trouve le ${formatScanDate(selectedFoundRecord.foundAt)}`}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
