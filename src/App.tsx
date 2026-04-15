import { startTransition, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { starterPokemonIds } from './data/professor-coco';
import { getPokemonClue } from './data/pokemon-clues';
import { pokemonCatalog } from './data/pokemon';
import {
  claimProfessorStarter,
  createEmptyCollection,
  loadCollection,
  markPokemonFound,
  recordProfessorVisit,
  saveCollection,
  type CollectionState,
} from './lib/collection';
import { parseTagPayload } from './lib/nfc';

type FilterMode = 'all' | 'found' | 'missing';

type Notice = {
  tone: 'neutral' | 'success' | 'error';
  title: string;
  message: string;
};

type PokemonEncounterState = {
  kind: 'pokemon';
  rawUrl: string;
  dex: string;
  id: number;
  tagCode: string | null;
};

type ProfessorEncounterState = {
  kind: 'professor';
  rawUrl: string;
  tagCode: string;
};

type EncounterState = PokemonEncounterState | ProfessorEncounterState;

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
const displayCatalog: PokemonView[] = pokemonCatalog;

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

function readEncounterState(): EncounterState | null {
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

  if (parsed.kind === 'professor') {
    return {
      kind: 'professor',
      rawUrl: currentUrl.toString(),
      tagCode: parsed.tagCode,
    };
  }

  return {
    kind: 'pokemon',
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

function TypewriterText(props: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const { text, className, speed = 24 } = props;
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);

    if (!text) {
      return;
    }

    const interval = window.setInterval(() => {
      setVisibleLength((currentLength) => {
        if (currentLength >= text.length) {
          window.clearInterval(interval);
          return currentLength;
        }

        return currentLength + 1;
      });
    }, speed);

    return () => window.clearInterval(interval);
  }, [speed, text]);

  const displayedText = text.slice(0, visibleLength);
  const isComplete = visibleLength >= text.length;

  return (
    <p className={className} aria-label={text}>
      {displayedText}
      <span className={`typewriter-cursor ${isComplete ? 'is-hidden' : ''}`} aria-hidden="true">
        |
      </span>
    </p>
  );
}

function CaptureView(props: {
  captureState: PokemonEncounterState;
  collection: CollectionState;
  onCaptured: () => void;
  onReturn: () => void;
}) {
  const pokemon = displayCatalog[props.captureState.id - 1];
  const foundRecord = props.collection.found[props.captureState.dex];
  const clue = getPokemonClue(pokemon);
  const [phase, setPhase] = useState<CapturePhase>('approach');
  const [hasRecorded, setHasRecorded] = useState(false);
  const [wasAlreadyFound, setWasAlreadyFound] = useState(Boolean(foundRecord));

  useEffect(() => {
    setPhase('approach');
    setHasRecorded(false);
    setWasAlreadyFound(Boolean(props.collection.found[props.captureState.dex]));
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
          : wasAlreadyFound
            ? `${pokemon.name} est deja dans ta collection.`
            : `${pokemon.name} rejoint maintenant ta collection locale.`;

  return (
    <main className="capture-shell">
      <section className="capture-card capture-card-scene">
        <div className="capture-header">
          <p className="hero-kicker">Rencontre sauvage</p>
          <span className="capture-dex">#{pokemon.dex}</span>
        </div>

        <div
          className={`capture-arena is-${phase}`}
          aria-live="polite"
          style={
            {
              '--grass-texture': `url("${resolvePublicAsset('/img/grass.webp')}")`,
            } as CSSProperties
          }
        >
          <div className="capture-glow" aria-hidden="true" />
          <div className="capture-grass capture-grass-back" aria-hidden="true" />
          <div className="capture-leaf-curtain" aria-hidden="true">
            <span className="capture-leaf-panel is-left" />
            <span className="capture-leaf-panel is-right" />
          </div>
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
          <div className="capture-stars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="capture-scene-text">{sceneMessage}</p>
        </div>

        <div className="capture-copy">
          <h1>{pokemon.name}</h1>
          <p className="capture-text">
            {wasAlreadyFound
              ? 'Cette figurine a deja ete validee sur cet appareil.'
              : 'Tu viens de trouver une figurine Pokemon cachée dans Yffiniac.'}
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

function ProfessorCocoView(props: {
  collection: CollectionState;
  onChooseStarter: (starterId: number) => void;
  onReturn: () => void;
}) {
  const starterChoices = props.collection.professor.startersClaimed;
  const starterSet = new Set(starterChoices);
  const foundCount = Object.keys(props.collection.found).length;
  const starterPool = starterPokemonIds
    .map((id) => displayCatalog[id - 1])
    .filter((pokemon) => !starterSet.has(pokemon.dex));
  const [claimedStarterId, setClaimedStarterId] = useState<number | null>(null);
  const startersCount = starterChoices.length;
  const canClaimStarter =
    startersCount === 0 || (startersCount === 1 && foundCount >= 50) || (startersCount === 2 && foundCount >= 100);
  const progressTarget = startersCount === 1 ? 50 : startersCount === 2 ? 100 : null;
  const chosenStarter = claimedStarterId ? displayCatalog[claimedStarterId - 1] : null;

  function handleStarterChoice(starterId: number): void {
    setClaimedStarterId(starterId);
    props.onChooseStarter(starterId);
  }

  function renderMessage(): string {
    if (chosenStarter) {
      return `Parfait. ${chosenStarter.name} rejoint officiellement ton equipe de depart.`;
    }

    if (startersCount === 0) {
      return "Bienvenue a Yffiniac, dresseur. Je suis le Professeur Coco. Choisis ton premier compagnon pour lancer l'aventure.";
    }

    if (canClaimStarter) {
      if (startersCount === 1) {
        return 'Analyse terminée: tu as atteint 50 Pokemon. Tu peux maintenant choisir un deuxieme starter.';
      }

      return 'Analyse terminée: tu as atteint 100 Pokemon. Le dernier starter de l aventure est a toi.';
    }

    const nextMessage =
      progressTarget !== null
        ? `Reviens me voir quand tu auras valide ${progressTarget} Pokemon.`
        : 'Tu as deja reuni les trois starters. Continue la chasse.';

    return `Je vois ${foundCount} Pokemon valides sur cet appareil. ${nextMessage}`;
  }

  return (
    <main className="capture-shell professor-shell">
      <section className="capture-card professor-card">
        <div className="professor-head">
          <div className="professor-avatar">
            <img
              src={resolvePublicAsset('/img/pp.png')}
              alt="Professeur Coco"
              width="160"
              height="160"
            />
          </div>

          <div className="professor-copy">
            <p className="hero-kicker">Professeur Coco</p>
            <TypewriterText className="capture-text" text={renderMessage()} speed={20} />
          </div>
        </div>

        <dl className="professor-stats">
          <div>
            <dt>Pokemon valides</dt>
            <dd>{foundCount}</dd>
          </div>
          <div>
            <dt>Visites au labo</dt>
            <dd>{props.collection.professor.visits}</dd>
          </div>
          <div>
            <dt>Starters obtenus</dt>
            <dd>{starterChoices.length} / 3</dd>
          </div>
        </dl>

        {canClaimStarter && !chosenStarter ? (
          <div className="starter-grid">
            {starterPool.map((pokemon) => (
              <button
                key={pokemon.dex}
                className="starter-card"
                type="button"
                onClick={() => handleStarterChoice(pokemon.id)}
              >
                <img
                  src={resolvePublicAsset(pokemon.image)}
                  alt={pokemon.name}
                  width="128"
                  height="128"
                />
                <strong>{pokemon.name}</strong>
                <span>#{pokemon.dex}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="professor-summary">
            <p>
              {starterChoices.length > 0
                ? `Equipe de depart actuelle : ${starterChoices
                    .map((dex) => displayCatalog[Number(dex) - 1]?.name)
                    .filter(Boolean)
                    .join(', ')}.`
                : 'Aucun starter choisi pour le moment.'}
            </p>
          </div>
        )}

        <button className="capture-button" type="button" onClick={props.onReturn}>
          {chosenStarter ? 'Retourner au Pokedex' : 'Fermer le labo'}
        </button>
      </section>
    </main>
  );
}

function OnboardingView(props: {
  explorerName: string;
  onNameChange: (value: string) => void;
  onStart: () => void;
}) {
  const trimmedName = props.explorerName.trim();
  const [step, setStep] = useState(0);
  const finalStep = 3;

  const dialogue = [
    "Salut dresseur. Moi, c'est le Professeur Coco. Je serai ton guide pour cette aventure Pokémon à Yffiniac.",
    "Dans la ville, des figurines Pokémon sont cachées un peu partout. Chaque figurine possède une puce NFC que tu pourras scanner pour l'ajouter à ton Pokedex.",
    '',
    "Parfait. Maintenant, rejoins-moi devant la mairie d'Yffiniac pour recuperer ton premier starter et lancer officiellement ton aventure.",
  ];

  function handleNext(): void {
    if (step < finalStep) {
      setStep((currentStep) => currentStep + 1);
    }
  }

  return (
    <main className="capture-shell professor-shell">
      <section className="capture-card professor-card onboarding-card">
        <div className="professor-head">
          <div className="professor-avatar">
            <img
              src={resolvePublicAsset('/img/pp.png')}
              alt="Professeur Coco"
              width="160"
              height="160"
            />
          </div>

          <div className="professor-copy">
            <h3 className="hero-kicker">Professeur Coco</h3>
            <div className="dialogue-bubble">
              {step === 2 ? (
                <>
                  <p className="dialogue-label">Creation du pseudo</p>
                  <label className="stacked-field onboarding-field" htmlFor="trainer-name">
                    Ton nom de dresseur
                    <input
                      id="trainer-name"
                      name="trainer-name"
                      type="text"
                      value={props.explorerName}
                      onChange={(event) => props.onNameChange(event.target.value.slice(0, 32))}
                      placeholder="Ex: Team Yffiniac"
                      autoComplete="nickname"
                    />
                  </label>
                </>
              ) : (
                <TypewriterText className="capture-text" text={dialogue[step]} speed={20} />
              )}
            </div>
          </div>
        </div>

        <div className="dialogue-controls">
          <p className="dialogue-progress">
            Etape {step + 1} / {finalStep + 1}
          </p>

          {step < finalStep ? (
            <button
              className="capture-button"
              type="button"
              onClick={handleNext}
              disabled={step === 2 && trimmedName.length < 2}
            >
              Suivant
            </button>
          ) : (
            <button
              className="capture-button"
              type="button"
              onClick={props.onStart}
              disabled={trimmedName.length < 2}
            >
              Commencer l'aventure
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [collection, setCollection] = useState(loadCollection);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [encounterState, setEncounterState] = useState<EncounterState | null>(readEncounterState);
  const [selectedDex, setSelectedDex] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    title: '',
    message: '',
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
    () => (encounterState?.kind === 'pokemon' ? displayCatalog[encounterState.id - 1] : null),
    [encounterState],
  );

  useEffect(() => {
    if (encounterState?.kind !== 'professor') {
      return;
    }

    setCollection((currentCollection) => recordProfessorVisit(currentCollection));
  }, [encounterState]);

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
    if (encounterState?.kind !== 'pokemon') {
      return;
    }

    const alreadyFound = Boolean(collection.found[encounterState.dex]);

    setCollection((currentCollection) =>
      markPokemonFound(currentCollection, {
        id: encounterState.id,
        payload: encounterState.rawUrl,
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
    setEncounterState(null);
  }

  function handleProfessorStarterChoice(starterId: number): void {
    if (encounterState?.kind !== 'professor') {
      return;
    }

    const starter = displayCatalog[starterId - 1];

    setCollection((currentCollection) =>
      claimProfessorStarter(currentCollection, {
        id: starterId,
        payload: encounterState.rawUrl,
      }),
    );

    setNotice({
      tone: 'success',
      title: `${starter.name} rejoint ton equipe`,
      message: 'Le Professeur Coco a valide ce starter sur cet appareil.',
    });
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
      title: 'Collection effacée',
      message: 'Le Pokedex de cet appareil a ete remis a zero.',
    });
  }

  function handleOnboardingStart(): void {
    const explorerName = collection.explorerName.trim();
    if (explorerName.length < 2) {
      return;
    }

    setCollection((currentCollection) => ({
      ...currentCollection,
      explorerName,
      adventureStarted: true,
    }));
    setNotice({
      tone: 'success',
      title: `Bienvenue ${explorerName}`,
      message: 'Ton Pokedex local est pret. Tu peux commencer la chasse.',
    });
  }

  if (encounterState?.kind === 'pokemon') {
    return (
      <CaptureView
        captureState={encounterState}
        collection={collection}
        onCaptured={handleCaptureRecorded}
        onReturn={handleCaptureReturn}
      />
    );
  }

  if (encounterState?.kind === 'professor') {
    return (
      <ProfessorCocoView
        collection={collection}
        onChooseStarter={handleProfessorStarterChoice}
        onReturn={handleCaptureReturn}
      />
    );
  }

  if (!collection.adventureStarted) {
    return (
      <OnboardingView
        explorerName={collection.explorerName}
        onNameChange={(value) =>
          setCollection((currentCollection) => ({
            ...currentCollection,
            explorerName: value,
          }))
        }
        onStart={handleOnboardingStart}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
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
                  : 'Aucune figurine validée pour le moment.'}
              </p>
            </div>
          </div>
        </div>

        <div className="hero-copy">
          {notice.title || notice.message ? (
            <div className={`notice notice-${notice.tone} hero-notice`}>
              {notice.title ? <strong>{notice.title}</strong> : null}
              {notice.message ? <p>{notice.message}</p> : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className="workspace">
        <aside className="workspace-rail">
          <section className="panel profile-panel">
            <div className="panel-heading">
              <h3>Profil local</h3>
            </div>

            <dl className="stats-list">
              <div>
                <dt>Dresseur</dt>
                <dd>{collection.explorerName}</dd>
              </div>
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
              Effacer les données locales
            </button>
          </section>

          <section className="panel history-panel">
            <div className="panel-heading">
              <h3>Historique</h3>
            </div>

            {collection.history.length === 0 ? (
              <p className="panel-text">Aucune capture enregistrée sur cet appareil pour l'instant.</p>
            ) : (
              <ol className="history-list">
                {collection.history.slice(0, 3).map((entry) => (
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
            <div className="dex-toolbar-head">
              <h3>Pokedex d'Yffiniac</h3>
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
