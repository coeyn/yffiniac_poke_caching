import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { huntingZones, rolloutPhases } from './data/game-plan';
import { pokemonCatalog } from './data/pokemon';
import {
  createEmptyCollection,
  formatDex,
  loadCollection,
  markPokemonFound,
  saveCollection,
  type CollectionState,
  type ScanSource,
} from './lib/collection';
import { beginNfcScan, isWebNfcAvailable, parseTagPayload } from './lib/nfc';

type FilterMode = 'all' | 'found' | 'missing';

type Notice = {
  tone: 'neutral' | 'success' | 'error';
  title: string;
  message: string;
};

const totalPokemon = pokemonCatalog.length;
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const filterModes: FilterMode[] = ['all', 'found', 'missing'];
const publicBaseUrl = import.meta.env.BASE_URL;

function resolvePublicAsset(path: string): string {
  return `${publicBaseUrl}${path.replace(/^\//, '')}`;
}

function formatScanDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function getNoticeFromError(error: unknown): Notice {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return {
        tone: 'error',
        title: 'Accès NFC refusé',
        message: 'Le navigateur a bloqué le scan NFC. Autorisez-le puis relancez la lecture.',
      };
    }

    if (error.name === 'NotSupportedError') {
      return {
        tone: 'error',
        title: 'NFC non compatible',
        message: 'Le scan Web NFC demande en pratique Android avec Chrome ou Edge, sur une page HTTPS.',
      };
    }
  }

  return {
    tone: 'error',
    title: 'Impossible de lancer le scan',
    message:
      'Le lecteur NFC du navigateur n’a pas pu démarrer. Vérifiez le HTTPS, l’autorisation navigateur et le support Web NFC.',
  };
}

function findPokemonName(id: number): string {
  return pokemonCatalog[id - 1]?.name ?? `Pokémon #${formatDex(id)}`;
}

function filterPokemon(collection: CollectionState, query: string, filterMode: FilterMode) {
  const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');

  return pokemonCatalog.filter((pokemon) => {
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

function getZoneForPokemon(id: number) {
  return huntingZones.find((zone) => id >= zone.dexRange[0] && id <= zone.dexRange[1]) ?? huntingZones[0];
}

export default function App() {
  const [collection, setCollection] = useState(loadCollection);
  const [selectedDex, setSelectedDex] = useState('025');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [manualTag, setManualTag] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    title: 'Prêt pour le parcours',
    message: 'Scannez une figurine NFC ou saisissez un code test pour remplir votre Pokédex local.',
  });
  const scanAbortRef = useRef<AbortController | null>(null);
  const deferredSearch = useDeferredValue(searchTerm);
  const supportsNfc = isWebNfcAvailable();

  useEffect(() => {
    saveCollection(collection);
  }, [collection]);

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
    };
  }, []);

  const foundCount = Object.keys(collection.found).length;
  const completion = foundCount / totalPokemon;
  const completionPercent = Math.round(completion * 100);
  const filteredPokemon = filterPokemon(collection, deferredSearch, filterMode);
  const selectedPokemon =
    pokemonCatalog.find((pokemon) => pokemon.dex === selectedDex) ?? pokemonCatalog[24];
  const selectedFoundRecord = collection.found[selectedPokemon.dex];
  const lastHistoryEntry = collection.history[0];
  const lastScannedPokemon = lastHistoryEntry ? pokemonCatalog[lastHistoryEntry.id - 1] : null;
  const selectedZone = getZoneForPokemon(selectedPokemon.id);
  const zoneProgress = huntingZones.map((zone) => {
    const idsInZone = pokemonCatalog.filter(
      (pokemon) => pokemon.id >= zone.dexRange[0] && pokemon.id <= zone.dexRange[1],
    );
    const foundInZone = idsInZone.filter((pokemon) => collection.found[pokemon.dex]).length;

    return {
      ...zone,
      total: idsInZone.length,
      found: foundInZone,
      percent: Math.round((foundInZone / idsInZone.length) * 100),
    };
  });

  function stopScan(): void {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    setIsScanning(false);
  }

  function applyScan(rawText: string, source: ScanSource, serialNumber: string | null): boolean {
    const parsedPayload = parseTagPayload(rawText);

    if (!parsedPayload) {
      setNotice({
        tone: 'error',
        title: 'Tag non reconnu',
        message:
          'Le format lu ne correspond pas au jeu. Le MVP accepte par exemple `YFFINIAC-POKE:025` ou simplement `025`.',
      });
      return false;
    }

    const pokemonName = findPokemonName(parsedPayload.id);
    const alreadyFound = Boolean(collection.found[parsedPayload.dex]);

    setCollection((currentCollection) =>
      markPokemonFound(currentCollection, {
        id: parsedPayload.id,
        payload: rawText,
        source,
        serialNumber,
      }),
    );

    setSelectedDex(parsedPayload.dex);
    setNotice({
      tone: 'success',
      title: alreadyFound ? `${pokemonName} déjà validé` : `${pokemonName} rejoint la collection`,
      message: alreadyFound
        ? `La figurine #${parsedPayload.dex} a bien été rescannée sur cet appareil.`
        : `La figurine #${parsedPayload.dex} est maintenant enregistrée dans votre Pokédex local.`,
    });

    return true;
  }

  async function handleStartScan(): Promise<void> {
    if (!supportsNfc) {
      setNotice({
        tone: 'error',
        title: 'Web NFC indisponible',
        message:
          'Le scan navigateur fonctionne surtout sur Android avec Chrome ou Edge, et sur une page servie en HTTPS.',
      });
      return;
    }

    stopScan();
    setIsScanning(true);
    setNotice({
      tone: 'neutral',
      title: 'Mode scan actif',
      message: 'Approchez une figurine du téléphone pour lire la puce NFC.',
    });

    try {
      const controller = await beginNfcScan(
        ({ rawText, serialNumber }) => {
          if (applyScan(rawText, 'nfc', serialNumber)) {
            stopScan();
          }
        },
        (message) => {
          setNotice({
            tone: 'error',
            title: 'Lecture incomplète',
            message,
          });
        },
      );

      scanAbortRef.current = controller;
    } catch (error) {
      stopScan();
      setNotice(getNoticeFromError(error));
    }
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const cleanedTag = manualTag.trim();
    if (!cleanedTag) {
      setNotice({
        tone: 'error',
        title: 'Code vide',
        message: 'Saisissez un identifiant de test avant de valider la figurine manuellement.',
      });
      return;
    }

    if (applyScan(cleanedTag, 'manual', null)) {
      setManualTag('');
    }
  }

  function handleCollectionReset(): void {
    const confirmed = window.confirm(
      'Effacer toute la progression locale sur cet appareil ? Cette action réinitialise la collection et l’historique.',
    );

    if (!confirmed) {
      return;
    }

    stopScan();
    setCollection(createEmptyCollection());
    setSelectedDex('025');
    setFilterMode('all');
    setSearchTerm('');
    setManualTag('');
    setNotice({
      tone: 'neutral',
      title: 'Collection locale effacée',
      message: 'Le Pokédex de cet appareil a été remis à zéro.',
    });
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">Yffiniac Poké Caching</p>
          <h1>
            Un parcours Pokémon municipal, pensé pour scanner, collectionner et faire sortir les
            joueurs dans la ville.
          </h1>
          <p className="hero-description">
            151 figurines NFC à retrouver dans Yffiniac. Cette première version enregistre la
            progression localement sur l’appareil, pour lancer le jeu vite avant d’ajouter les
            comptes et la validation serveur.
          </p>

          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => void handleStartScan()}>
              {isScanning ? 'Scanner en attente...' : 'Scanner une figurine'}
            </button>
            <a className="secondary-button" href="#collection">
              Voir la collection
            </a>
          </div>

          <ul className="hero-metrics">
            <li>
              <strong>151</strong>
              <span>figurines de la 1re génération</span>
            </li>
            <li>
              <strong>Mairie</strong>
              <span>projet soutenu par la commune</span>
            </li>
            <li>
              <strong>Local first</strong>
              <span>données stockées sur l’appareil</span>
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
                <span>complété</span>
              </div>
            </div>

            <div className="hero-progress-copy">
              <p className="hero-label">Pokédex actuel</p>
              <h2>
                {foundCount} / {totalPokemon} validés
              </h2>
              <p>
                {lastScannedPokemon && lastHistoryEntry
                  ? `Dernier scan : ${lastScannedPokemon.name} le ${formatScanDate(lastHistoryEntry.scannedAt)}`
                  : 'Aucune figurine validée pour le moment.'}
              </p>
            </div>
          </div>

          <figure className="featured-pokemon">
            <img
              src={resolvePublicAsset(selectedPokemon.image)}
              alt={selectedPokemon.name}
              width="320"
              height="320"
              loading="eager"
            />
            <figcaption>
              <p className="hero-label">Pokémon en focus</p>
              <div className="featured-heading">
                <span>#{selectedPokemon.dex}</span>
                <h2>{selectedPokemon.name}</h2>
              </div>
              <p>
                {selectedFoundRecord
                  ? `Validé le ${formatScanDate(selectedFoundRecord.foundAt)} · ${selectedFoundRecord.scanCount} scan${selectedFoundRecord.scanCount > 1 ? 's' : ''}`
                  : 'Encore introuvable dans votre collection locale.'}
              </p>
            </figcaption>
          </figure>
        </div>
      </header>

      <main className="workspace">
        <aside className="workspace-rail">
          <section className="panel scan-panel">
            <div className="panel-heading">
              <p className="eyebrow">Scan NFC</p>
              <h3>Valider une figurine</h3>
            </div>

            <p className="panel-text">
              Format conseillé sur la puce pour ce MVP : <code>YFFINIAC-POKE:025</code>
            </p>

            <div className={`notice notice-${notice.tone}`}>
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
            </div>

            <div className="scan-actions">
              <button className="primary-button" type="button" onClick={() => void handleStartScan()}>
                {isScanning ? 'En écoute NFC' : 'Lancer le scan'}
              </button>
              <button className="secondary-button" type="button" onClick={stopScan}>
                Arrêter
              </button>
            </div>

            <form className="manual-form" onSubmit={handleManualSubmit}>
              <label htmlFor="manual-tag">Code de secours / test</label>
              <div className="manual-row">
                <input
                  id="manual-tag"
                  name="manual-tag"
                  type="text"
                  value={manualTag}
                  onChange={(event) => setManualTag(event.target.value)}
                  placeholder="Ex: YFFINIAC-POKE:025"
                  autoComplete="off"
                />
                <button className="accent-button" type="submit">
                  Valider
                </button>
              </div>
            </form>

            <div className="compatibility-block">
              <p className="hero-label">Compatibilité réelle</p>
              <p>
                {supportsNfc
                  ? 'Web NFC détecté. Le scan navigateur devrait fonctionner si la page est servie en HTTPS.'
                  : 'Web NFC non détecté sur cet appareil. Gardez la saisie manuelle pour les tests desktop et iPhone.'}
              </p>
            </div>
          </section>

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
                <dt>Trouvés</dt>
                <dd>{foundCount}</dd>
              </div>
              <div>
                <dt>À trouver</dt>
                <dd>{totalPokemon - foundCount}</dd>
              </div>
            </dl>

            <button className="danger-button" type="button" onClick={handleCollectionReset}>
              Effacer les données locales
            </button>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Historique</p>
              <h3>Dernières validations</h3>
            </div>

            {collection.history.length === 0 ? (
              <p className="panel-text">Aucun scan enregistré sur cet appareil pour l’instant.</p>
            ) : (
              <ol className="history-list">
                {collection.history.map((entry) => (
                  <li key={`${entry.scannedAt}-${entry.dex}`}>
                    <button type="button" onClick={() => setSelectedDex(entry.dex)}>
                      <span>#{entry.dex}</span>
                      <strong>{findPokemonName(entry.id)}</strong>
                      <small>{formatScanDate(entry.scannedAt)}</small>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Feuille de route</p>
              <h3>Suite du projet</h3>
            </div>

            <div className="roadmap-list">
              {rolloutPhases.map((phase) => (
                <article key={phase.id} className="roadmap-item">
                  <h4>{phase.title}</h4>
                  <p>{phase.description}</p>
                  <ul>
                    {phase.deliverables.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </aside>

        <section className="panel dex-panel" id="collection">
          <div className="dex-toolbar">
            <div>
              <p className="eyebrow">Collection</p>
              <h3>Pokédex d’Yffiniac</h3>
              <p className="panel-text">
                Sélectionnez un Pokémon pour voir son statut, ou filtrez la grille pour suivre la
                chasse.
              </p>
            </div>

            <div className="toolbar-controls">
              <label className="search-field" htmlFor="pokemon-search">
                <span className="sr-only">Rechercher un Pokémon</span>
                <input
                  id="pokemon-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => setSearchTerm(value));
                  }}
                  placeholder="Nom ou numéro"
                />
              </label>

              <div className="filter-row" role="tablist" aria-label="Filtrer la collection">
                {filterModes.map((mode) => {
                  const labels: Record<FilterMode, string> = {
                    all: 'Tous',
                    found: 'Trouvés',
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
              <p className="hero-label">Focus actuel</p>
              <h4>
                #{selectedPokemon.dex} {selectedPokemon.name}
              </h4>
              <p>
                {selectedFoundRecord
                  ? `Validé par ${selectedFoundRecord.lastSource === 'nfc' ? 'scan NFC' : 'saisie manuelle'}`
                  : 'Pas encore validé sur cet appareil'}
              </p>
            </div>

            <div className="selection-status">
              <span className={selectedFoundRecord ? 'status-badge found' : 'status-badge missing'}>
                {selectedFoundRecord ? 'Trouvé' : 'À découvrir'}
              </span>
              <span>{filteredPokemon.length} résultat(s)</span>
            </div>
          </div>

          <section className="zone-overview">
            <div className="zone-overview-header">
              <div>
                <p className="eyebrow">Parcours</p>
                <h4>Plan de chasse par zone</h4>
              </div>
              <p className="panel-text">
                Le Pokémon sélectionné appartient actuellement à la zone <strong>{selectedZone.name}</strong>.
              </p>
            </div>

            <div className="zone-grid">
              {zoneProgress.map((zone) => (
                <article
                  key={zone.id}
                  className={zone.id === selectedZone.id ? 'zone-card zone-card-active' : 'zone-card'}
                >
                  <div className="zone-card-header">
                    <p className="hero-label">{zone.theme}</p>
                    <strong>
                      {zone.found}/{zone.total}
                    </strong>
                  </div>
                  <h5>{zone.name}</h5>
                  <p>{zone.description}</p>
                  <ul>
                    <li>Terrain: {zone.terrain}</li>
                    <li>Indice: {zone.clueStyle}</li>
                    <li>
                      Dex: #{formatDex(zone.dexRange[0])} à #{formatDex(zone.dexRange[1])}
                    </li>
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <div className="dex-grid">
            {filteredPokemon.map((pokemon) => {
              const foundRecord = collection.found[pokemon.dex];
              const isActive = pokemon.dex === selectedPokemon.dex;

              return (
                <button
                  key={pokemon.dex}
                  className={[
                    'dex-tile',
                    foundRecord ? 'is-found' : 'is-missing',
                    isActive ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  onClick={() => setSelectedDex(pokemon.dex)}
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
                    <small>
                      {foundRecord
                        ? `Validé le ${formatScanDate(foundRecord.foundAt)}`
                        : 'Encore caché dans la ville'}
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          MVP local-first : les scans sont enregistrés uniquement sur cet appareil. Pour une preuve
          réellement robuste entre joueurs, la prochaine étape sera un backend avec comptes,
          historique serveur et signature de tags.
        </p>
      </footer>
    </div>
  );
}
