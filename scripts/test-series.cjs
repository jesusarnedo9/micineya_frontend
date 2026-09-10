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
  const provider = moduleFrom('src/context/app-experience.tsx', {
    react: hooks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '../api/movies': { ...api,
      fetchRecommendationBatch: async (type) => { fetched.push(type); return { movies: [type === 'tv' ? serie : movie, { ...movie, id: 456, mediaType: type }], notice: null }; },
      renewMovies: async (_, type) => ({ movies: [{ ...movie, id: 999, mediaType: type }], notice: null }),
    },
    '../auth/session': { getAccountStorageKey: async () => 'test', getProfileName: async () => 'Test' },
    '../api/profile': { fetchUserProfile: async () => ({}), fetchProfilePhoto: async () => null },
    '../api/reviews': { deleteReview: async (id, type) => removed.push(`${type}:${id}`), fetchMyReviews: async () => [] },
    '../profile/review-storage': storage, '../types/movie': types,
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
  await storage.clearProfileReviews('test');
  console.log('OK: identidad, almacenamiento anterior, escrituras concurrentes, API tipada y lotes independientes.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
