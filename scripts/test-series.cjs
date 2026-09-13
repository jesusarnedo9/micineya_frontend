// Ejecuta módulos reales con transporte y SecureStore simulados; no consume la API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function moduleFrom(file, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, Set, Map, Date, Promise, require(id) {
    if (id in imports) return imports[id];
    throw new Error(`Import sin simular: ${file} -> ${id}`);
  } });
  return exports;
}

async function main() {
  const types = moduleFrom('src/types/movie.ts');
  const profileTypes = moduleFrom('src/types/profile.ts', { './movie': types });
  const movie = { id: 123, title: 'Peli', overview: '', poster_path: null };
  const serie = { ...movie, title: 'Serie', mediaType: 'tv' };
  assert.equal(types.contentKey(movie), 'movie:123');
  assert.equal(types.contentKey(serie), 'tv:123');
  assert.equal(types.contentKey({ id: 99, tmdbId: 123, mediaType: 'tv' }), 'tv:123');

  const values = new Map();
  const secure = {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => { assert.match(key, /^[\w.-]+$/); values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); },
  };
  const storage = moduleFrom('src/profile/review-storage.ts', {
    'expo-secure-store': secure, '../types/movie': types,
  });
  const review = { tmdbId: 123, title: 'Anterior', posterPath: null, rating: 4, comment: '', reviewedAt: '2026-01-01' };
  values.set('profile_reviews_test', '[123]');
  values.set('profile_review_test_123', JSON.stringify(review));
  assert.equal((await storage.loadProfileReviews('test'))[0].mediaType, 'movie', 'Migrar copia anterior');
  await Promise.all([
    storage.saveProfileReview('test', { ...review, mediaType: 'tv', seasonsWatched: [1, 2] }),
    storage.saveProfileReview('test', { ...review, tmdbId: 456 }),
  ]);
  let loaded = await storage.loadProfileReviews('test');
  assert.equal(loaded.length, 3, 'No perder IDs con escrituras concurrentes');
  assert.equal(new Set(loaded.map(types.contentKey)).size, 3);
  await storage.deleteProfileReview('test', 123, 'tv');
  loaded = await storage.loadProfileReviews('test');
  assert.ok(loaded.some((r) => types.contentKey(r) === 'movie:123'));
  assert.ok(!loaded.some((r) => types.contentKey(r) === 'tv:123'));
  assert.equal((await storage.loadProfileReviews('otra')).length, 0);
  await storage.clearProfileReviews('test');
  assert.equal(values.size, 0);

  const requests = [];
  let payload = {};
  const client = Object.fromEntries(['get', 'post', 'put', 'delete'].map((method) => [method, async (url, body) => {
    requests.push({ method, url, body }); return { data: payload };
  }]));
  const api = moduleFrom('src/api/movies.ts', { './client': { apiClient: client }, '../types/movie': types });
  await api.saveFavorite(serie);
  assert.equal(requests.at(-1).url, '/api/biblioteca/favoritas');
  assert.equal(requests.at(-1).body.mediaType, 'tv');
  await api.removeFavorite(123, 'tv');
  assert.equal(requests.at(-1).url, '/api/biblioteca/favoritas/tv/123');
  payload = { results: [serie] };
  await api.renewMovies([123], 'tv');
  assert.equal(requests.at(-1).url, '/api/series/recomendadas/renovar');
  assert.equal(JSON.stringify(requests.at(-1).body.actualesIds), '[123]');
  const reviewApi = moduleFrom('src/api/reviews.ts', { './client': { apiClient: client }, '../types/movie': types });
  payload = { id: 1, tmdbId: 123, titulo: 'Serie', posterPath: null, calificacion: 4, comentario: 'Bien',
    mediaType: 'tv', temporadasVistas: [1, 2], fechaVista: '2026-01-01', fechaActualizacion: '2026-02-01' };
  const mapped = await reviewApi.submitReview(serie, 4, ' Bien ', false, [1, 2]);
  assert.equal(requests.at(-1).url, '/api/biblioteca/resenas');
  assert.equal(JSON.stringify(requests.at(-1).body.temporadasVistas), '[1,2]');
  assert.equal(mapped.watchedAt, '2026-01-01');
  assert.equal(mapped.mediaType, 'tv');

  // Prueba del proveedor real: un estado de hooks mínimo, sin montar APIs nativas ni efectos iniciales.
  let cursor = 0;
  const slots = [];
  const hooks = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useEffect: () => {}, useCallback: (fn) => fn,
    useRef: (value) => { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useState: (value) => { const i = cursor++; if (!(i in slots)) slots[i] = value;
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
  };
  const fetched = [];
  const removed = [];
  const notices = [];
  let failSave = false;
  const provider = moduleFrom('src/context/app-experience.tsx', {
    react: hooks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '../api/movies': { ...api,
      saveFavorite: async (movie) => { if (failSave) throw new Error('Sin conexión'); return api.saveFavorite(movie); },
      fetchRecommendationBatch: async (type) => { fetched.push(type); return { movies: [type === 'tv' ? serie : movie, { ...movie, id: 456, mediaType: type }], notice: null }; },
      renewMovies: async (_, type) => ({ movies: [{ ...movie, id: 999, mediaType: type }], notice: null }),
    },
    '../auth/session': { getAccountStorageKey: async () => 'test', getProfileName: async () => 'Test' },
    '../api/profile': { fetchUserProfile: async () => ({}), fetchProfilePhoto: async () => null },
    '../api/reviews': { deleteReview: async (id, type, season) => removed.push(`${type}:${id}${season ? ':s' + season : ''}`), fetchMyReviews: async () => [] },
    '../profile/review-storage': storage, '../types/movie': types,
    '../types/profile': profileTypes,
    './app-feedback': { useAppFeedback: () => ({ showUndo: (message, undo) => notices.push({ message, undo }) }) },
  });
  const render = () => { cursor = 0; return provider.AppExperienceProvider({ children: null }).props.value; };
  let app = render();
  await Promise.all([app.loadRecommendations('movie'), app.loadRecommendations('tv')]);
  await app.loadRecommendations('movie');
  assert.equal(fetched.join(','), 'movie,tv', 'Un lote almacenado por tipo');
  await app.recordReview({ ...review, mediaType: 'tv', seasonsWatched: [1] });
  app = render();
  assert.ok(app.reviewedIds.has('tv:123')); assert.ok(!app.reviewedIds.has('movie:123'));
  await app.recordReview(review);
  app = render();
  await app.unmarkAsWatched(123, 'tv');
  app = render();
  assert.equal(removed.at(-1), 'tv:123');
  assert.ok(app.reviewedIds.has('movie:123')); assert.ok(!app.reviewedIds.has('tv:123'));
  await app.renewRecommendations('tv');
  const movies = await app.loadRecommendations('movie');
  const series = await app.loadRecommendations('tv');
  assert.equal(movies[0].id, 123, 'Renovar TV no cambia el lote de películas');
  assert.equal(series[0].id, 999);

  const another = { ...movie, id: 321 };
  await app.toggleFavorite(another);
  assert.ok(render().favoriteIds.has('movie:321'));
  await notices.at(-1).undo();
  assert.ok(!render().favoriteIds.has('movie:321'), 'Deshacer guardado');
  await app.toggleFavorite(another);
  await app.toggleFavorite(another);
  await notices.at(-1).undo();
  assert.ok(render().favoriteIds.has('movie:321'), 'Deshacer quitar de guardadas');
  await app.recordReview({ ...review, tmdbId: 321 });
  assert.ok(!render().favoriteIds.has('movie:321'));
  const undoWatched = notices.at(-1).undo;
  const deletionsBefore = removed.length;
  failSave = true;
  await assert.rejects(undoWatched, /Sin conexión/);
  assert.ok(!render().reviewedIds.has('movie:321'));
  failSave = false;
  await undoWatched();
  assert.equal(removed.length, deletionsBefore + 1, 'Reintentar restauración no vuelve a borrar');
  assert.ok(render().favoriteIds.has('movie:321'), 'Deshacer vista restaura guardada');

  await app.toggleFavorite(serie);
  const firstSeason = { ...review, mediaType: 'tv', seasonNumber: 1, seasonsWatched: [1], seriesComplete: false };
  await app.recordReview(firstSeason);
  await app.recordReview({ ...firstSeason, seasonNumber: 2, seasonsWatched: [2], seriesComplete: true });
  assert.ok(!render().favoriteIds.has('tv:123'));
  await notices.at(-1).undo();
  assert.equal(removed.at(-1), 'tv:123:s2', 'Borrar solo la temporada recién vista');
  assert.ok(render().reviews.some((r) => profileTypes.profileReviewKey(r) === 'tv:123:s1'));
  assert.ok(!render().reviews.some((r) => profileTypes.profileReviewKey(r) === 'tv:123:s2'));
  assert.ok(render().favoriteIds.has('tv:123'));

  await app.recordReview({ ...review, tmdbId: 777 });
  const staleUndo = notices.at(-1).undo;
  const noticeCount = notices.length;
  await app.recordReview({ ...review, tmdbId: 777, comment: 'Editada' });
  assert.equal(notices.length, noticeCount, 'No ofrecer borrado al editar reseña anterior');
  await staleUndo();
  assert.ok(render().reviews.some((r) => r.tmdbId === 777 && r.comment === 'Editada'), 'Un aviso viejo no borra una edición');

  const badgeStorage = moduleFrom('src/profile/popcorn-storage.ts', { 'expo-secure-store': secure });
  assert.equal((await badgeStorage.loadSeenBadges(1)).size, 0);
  await Promise.all([badgeStorage.rememberBadge(1, 'SERIE_TRONOS'), badgeStorage.rememberBadge(1, 'SERIE_CICLO')]);
  assert.equal((await badgeStorage.loadSeenBadges(1)).size, 2);
  assert.equal((await badgeStorage.loadSeenBadges(2)).size, 0, 'Separar cuentas');
  const reloadedBadges = moduleFrom('src/profile/popcorn-storage.ts', { 'expo-secure-store': secure });
  assert.equal((await reloadedBadges.loadSeenBadges(1)).size, 2, 'Recordar al reiniciar');
  await badgeStorage.clearPopcornProgress('account_1');
  assert.equal((await badgeStorage.loadSeenBadges(1)).size, 0);

  let seasonCalls = 0;
  let failSeasons = false;
  const seasonApi = moduleFrom('src/api/series.ts', { './client': { apiClient: {
    get: async () => { seasonCalls++; if (failSeasons) throw new Error('Sin catálogo'); return { data: { temporadas: [{ numero: 1 }] } }; },
  } } });
  await Promise.all([seasonApi.fetchCachedSeasons(123), seasonApi.fetchCachedSeasons(123)]);
  await seasonApi.fetchCachedSeasons(123);
  assert.equal(seasonCalls, 1, 'Compartir consulta y caché de temporadas');
  failSeasons = true;
  await assert.rejects(() => seasonApi.fetchCachedSeasons(456));
  failSeasons = false;
  await seasonApi.fetchCachedSeasons(456);
  assert.equal(seasonCalls, 3, 'No almacenar fallos del catálogo');

  const jsx = (type, props) => ({ type, props });
  const savedProgress = moduleFrom('src/components/profile/saved-series-progress.tsx', {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@react-navigation/native': { useIsFocused: () => true },
    'react-native': { StyleSheet: { create: (styles) => styles }, Text: 'Text', View: 'View' },
    '../../api/series': seasonApi, '../../types/movie': types, '../../types/profile': profileTypes,
  });
  const seasons = [1, 2, 3].map((numero) => ({ numero, cantidadEpisodios: 10, estreno: '2020-01-01' }));
  seasons.push({ numero: 4, cantidadEpisodios: 10, estreno: '2099-01-01' });
  const seasonReviews = [firstSeason, firstSeason, { ...review, tmdbId: 123, mediaType: 'movie' }];
  const progress = savedProgress.SavedSeriesProgress({ tmdbId: 123, seasons, reviews: seasonReviews });
  assert.equal(progress.props.children[0].props.children, '1 de 3 temporadas', 'No contar duplicados, películas ni futuras temporadas');
  assert.equal(progress.props.children[1].props.accessibilityValue.now, 1);
  const offlineProgress = savedProgress.SavedSeriesProgress({ tmdbId: 123, reviews: seasonReviews });
  assert.equal(offlineProgress.props.children[0].props.children, '1 temporada vista');
  assert.ok(!offlineProgress.props.children[1], 'Sin catálogo, no inventar porcentaje');

  const thirteen = Array.from({ length: 13 }, (_, i) => ({ numero: i + 1, cantidadEpisodios: 10, estreno: '2020-01-01' }));
  const tenth = { ...firstSeason, seasonNumber: 10, seasonsWatched: [10] };
  const advanced = savedProgress.SavedSeriesProgress({ tmdbId: 123, seasons: thirteen, reviews: [firstSeason, tenth] });
  assert.equal(advanced.props.children[0].props.children, '10 de 13 temporadas');
  assert.equal(advanced.props.children[1].props.accessibilityValue.now, 10);
  const complete = savedProgress.SavedSeriesProgress({ tmdbId: 123, seasons: thirteen.slice(0, 6),
    reviews: [{ ...firstSeason, seasonNumber: 6, seasonsWatched: [1, 2, 3, 4, 5, 6] }] });
  assert.equal(complete.props.children[1].props.children.props.style[1].width, '100%');
  const seriesReview = { ...tenth, tmdbId: 2026 };
  await app.recordReview(seriesReview);
  assert.ok(render().favoriteIds.has('tv:2026'), 'Reseñar una serie en curso la guarda automáticamente');
  assert.equal(render().reviews.filter((r) => r.tmdbId === 2026).length, 1, 'No inventar reseñas anteriores');
  await notices.at(-1).undo();
  assert.ok(!render().favoriteIds.has('tv:2026'), 'Deshacer restaura también el guardado automático');
  assert.ok(!render().reviews.some((r) => r.tmdbId === 2026));
  await storage.clearProfileReviews('test');
  console.log('OK: series, lotes, deshacer guardadas/vistas/temporadas, reintentos, avisos obsoletos, insignias por cuenta y caché.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
