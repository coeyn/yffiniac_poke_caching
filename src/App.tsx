import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { buildTagUrl, getTagCodeForDex } from './data/tag-codes';
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
import { repairMojibake } from './lib/text';

type FilterMode = 'all' | 'found' | 'missing';

type Notice = {
  tone: 'neutral' | 'success' | 'error';
  title: string;
  message: string;
};

type ScanPreview = {
  rawText: string;
  serialNumber: string | null;
  source: ScanSource;
  parsedDex: string | null;
  parsedTagCode: string | null;
};

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

function getNoticeFromError(error: unknown): Notice {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return {
        tone: 'error',
        title: 'Acces NFC refuse',
        message: 'Le navigateur a bloque le scan NFC. Autorise-le puis relance la lecture.',
      };
    }

    if (error.name === 'NotSupportedError') {
      return {
        tone: 'error',
        title: 'NFC non compatible',
        message: 'Le scan Web NFC demande surtout Android avec Chrome ou Edge, sur une page HTTPS.',
      };
    }
  }

  return {
    tone: 'error',
    title: 'Impossible de lancer le scan',
    message:
      'Le lecteur NFC du navigateur n’a pas pu demarrer. Verifie le HTTPS, l’autorisation navigateur et le support Web NFC.',
  };
}

function findPokemonName(id: number): string {
  return displayCatalog[id - 1]?.name ?? `Pokemon #${formatDex(id)}`;
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

function getSourceLabel(source: ScanSource): string {
  if (source === 'nfc') return 'scan NFC';
  if (source === 'url') return 'ouverture directe';
  return 'saisie manuelle';
}

export default function App() {
  const [collection, setCollection] = useState(loadCollection);
  const [selectedDex, setSelectedDex] = useState('025');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [manualTag, setManualTag] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<ScanPreview | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    title: 'Pret pour le scan',
    message: 'Scanne une figurine NFC ou ouvre un tag URL pour voir comment la lecture est interpretee.',
  });
  const scanAbortRef = useRef<AbortController | null>(null);
  const consumedUrlTagRef = useRef(false);
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
    displayCatalog.find((pokemon) => pokemon.dex === selectedDex) ?? displayCatalog[24];
  const selectedFoundRecord = collection.found[selectedPokemon.dex];
  const lastHistoryEntry = collection.history[0];
  const lastScannedPokemon = lastHistoryEntry ? displayCatalog[lastHistoryEntry.id - 1] : null;
  const selectedTagCode = getTagCodeForDex(selectedPokemon.dex);
  const selectedTagUrl = buildTagUrl(selectedTagCode);

  function stopScan(): void {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    setIsScanning(false);
  }

  function applyScan(rawText: string, source: ScanSource, serialNumber: string | null): boolean {
    const parsedPayload = parseTagPayload(rawText);

    setScanPreview({
      rawText,
      serialNumber,
      source,
      parsedDex: parsedPayload?.dex ?? null,
      parsedTagCode: parsedPayload?.tagCode ?? null,
    });

    if (!parsedPayload) {
      setNotice({
        tone: 'error',
        title: 'Tag non reconnu',
        message:
          'Le site attend surtout une URL comme `https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-XXXXXX` ou un code `YF-XXXXXX`.',
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
      title: alreadyFound ? `${pokemonName} deja valide` : `${pokemonName} rejoint la collection`,
      message: alreadyFound
        ? `La figurine #${parsedPayload.dex} a bien ete rescanee sur cet appareil.`
        : `La figurine #${parsedPayload.dex} est maintenant enregistree dans votre Pokedex local.`,
    });

    return true;
  }

  useEffect(() => {
    if (consumedUrlTagRef.current || typeof window === 'undefined') {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const tagCode = currentUrl.searchParams.get('tag');
    if (!tagCode) {
      return;
    }

    consumedUrlTagRef.current = true;
    const sourceUrl = currentUrl.toString();
    applyScan(sourceUrl, 'url', null);
    currentUrl.searchParams.delete('tag');
    window.history.replaceState({}, '', currentUrl);
  }, []);

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
      message: 'Approche une figurine du telephone pour lire la puce NFC.',
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
            title: 'Lecture incomplete',
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
        message: 'Saisis une URL de tag ou un code YF-XXXXXX avant de valider.',
      });
      return;
    }

    if (applyScan(cleanedTag, 'manual', null)) {
      setManualTag('');
    }
  }

  function handleCollectionReset(): void {
    const confirmed = window.confirm(
      'Effacer toute la progression locale sur cet appareil ? Cette action reinitialise la collection et l’historique.',
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
    setScanPreview(null);
    setNotice({
      tone: 'neutral',
      title: 'Collection locale effacee',
      message: 'Le Pokedex de cet appareil a ete remis a zero.',
    });
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">Yffiniac Poke Caching</p>
          <h1>Le site montre maintenant clairement comment une figurine NFC ouvre et valide un tag.</h1>
          <p className="hero-description">
            Chaque puce peut contenir une URL du type <code>?tag=YF-XXXXXX</code>. Si le telephone
            ouvre cette URL, le site reconnait automatiquement la figurine et l’ajoute a la
            collection locale.
          </p>

          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => void handleStartScan()}>
              {isScanning ? 'Scanner en attente...' : 'Scanner une figurine'}
            </button>
            <a className="secondary-button" href="#scan-demo">
              Voir le flux NFC
            </a>
          </div>

          <ul className="hero-metrics">
            <li>
              <strong>Format retenu</strong>
              <span>URL opaque avec parametre `tag`</span>
            </li>
            <li>
              <strong>Compatibilite</strong>
              <span>Android + Chrome/Edge + HTTPS</span>
            </li>
            <li>
              <strong>Stockage actuel</strong>
              <span>Collection locale sur l’appareil</span>
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
                {foundCount} / {totalPokemon} valides
              </h2>
              <p>
                {lastScannedPokemon && lastHistoryEntry
                  ? `Dernier scan : ${lastScannedPokemon.name} le ${formatScanDate(lastHistoryEntry.scannedAt)}`
                  : 'Aucune figurine validee pour le moment.'}
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
              <p className="hero-label">Pokemon en focus</p>
              <div className="featured-heading">
                <span>#{selectedPokemon.dex}</span>
                <h2>{selectedPokemon.name}</h2>
              </div>
              <p>
                {selectedFoundRecord
                  ? `Valide le ${formatScanDate(selectedFoundRecord.foundAt)}`
                  : 'Encore introuvable dans votre collection locale.'}
              </p>
            </figcaption>
          </figure>
        </div>
      </header>

      <main className="workspace">
        <aside className="workspace-rail">
          <section className="panel scan-panel" id="scan-demo">
            <div className="panel-heading">
              <p className="eyebrow">Scan NFC</p>
              <h3>Demonstration du flux</h3>
            </div>

            <p className="panel-text">
              Le tag recommande est une URL directe vers le site, pas un numero de Pokemon en clair.
            </p>

            <div className={`notice notice-${notice.tone}`}>
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
            </div>

            <div className="scan-actions">
              <button className="primary-button" type="button" onClick={() => void handleStartScan()}>
                {isScanning ? 'En ecoute NFC' : 'Lancer le scan'}
              </button>
              <button className="secondary-button" type="button" onClick={stopScan}>
                Arreter
              </button>
            </div>

            <form className="manual-form" onSubmit={handleManualSubmit}>
              <label htmlFor="manual-tag">Test manuel</label>
              <div className="manual-row">
                <input
                  id="manual-tag"
                  name="manual-tag"
                  type="text"
                  value={manualTag}
                  onChange={(event) => setManualTag(event.target.value)}
                  placeholder="Ex: https://coeyn.github.io/yffiniac_poke_caching/?tag=YF-ABC123"
                  autoComplete="off"
                />
                <button className="accent-button" type="submit">
                  Simuler
                </button>
              </div>
            </form>

            <div className="compatibility-block">
              <p className="hero-label">Compatibilite reelle</p>
              <p>
                {supportsNfc
                  ? 'Web NFC detecte. Le scan navigateur devrait fonctionner si la page est servie en HTTPS.'
                  : 'Web NFC non detecte sur cet appareil. Garde la saisie manuelle pour les tests desktop et iPhone.'}
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Tag de la figurine</p>
              <h3>Valeur a ecrire sur la puce</h3>
            </div>

            <div className="tag-url-box">
              <p className="hero-label">Tag opaque</p>
              <strong>{selectedTagCode}</strong>
              <p>{selectedTagUrl}</p>
            </div>

            <ul className="inspector-list">
              <li>Le tag n’expose pas directement le numero du Pokemon.</li>
              <li>Le telephone peut ouvrir le site sans que le joueur l’ait deja lance.</li>
              <li>Le site lit ensuite `?tag=...` et interprete la figurine correspondante.</li>
            </ul>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Lecture courante</p>
              <h3>Ce que le site a compris</h3>
            </div>

            {scanPreview ? (
              <dl className="scan-preview">
                <div>
                  <dt>Source</dt>
                  <dd>{getSourceLabel(scanPreview.source)}</dd>
                </div>
                <div>
                  <dt>Contenu brut</dt>
                  <dd className="mono-value">{scanPreview.rawText}</dd>
                </div>
                <div>
                  <dt>Tag reconnu</dt>
                  <dd>{scanPreview.parsedTagCode ?? 'Aucun'}</dd>
                </div>
                <div>
                  <dt>Pokemon reconnu</dt>
                  <dd>{scanPreview.parsedDex ? `#${scanPreview.parsedDex}` : 'Aucun'}</dd>
                </div>
                <div>
                  <dt>Numero de serie NFC</dt>
                  <dd>{scanPreview.serialNumber ?? 'Non expose par le navigateur'}</dd>
                </div>
              </dl>
            ) : (
              <p className="panel-text">Aucune lecture a afficher pour le moment.</p>
            )}
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
        </aside>

        <section className="panel dex-panel" id="collection">
          <div className="dex-toolbar">
            <div>
              <p className="eyebrow">Collection</p>
              <h3>Pokedex d’Yffiniac</h3>
              <p className="panel-text">
                Selectionne un Pokemon pour voir son tag URL exact et simuler sa lecture.
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
              <p className="hero-label">Focus actuel</p>
              <h4>
                #{selectedPokemon.dex} {selectedPokemon.name}
              </h4>
              <p>
                {selectedFoundRecord
                  ? `Valide par ${getSourceLabel(selectedFoundRecord.lastSource)}`
                  : 'Pas encore valide sur cet appareil'}
              </p>
            </div>

            <div className="selection-status">
              <span className={selectedFoundRecord ? 'status-badge found' : 'status-badge missing'}>
                {selectedFoundRecord ? 'Trouve' : 'A decouvrir'}
              </span>
              <span>{filteredPokemon.length} resultat(s)</span>
            </div>
          </div>

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
                        ? `Valide le ${formatScanDate(foundRecord.foundAt)}`
                        : 'Encore cache dans la ville'}
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
          Le MVP reste volontairement simple : le tag NFC ouvre le site avec un code opaque, puis
          la collection est stockee localement. La vraie securisation viendra plus tard avec un backend.
        </p>
      </footer>
    </div>
  );
}
