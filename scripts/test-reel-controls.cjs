const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const screen = read('src/app/(app)/index.tsx');
const reel = read('src/components/reels/movie-reel.tsx');
const feed = read('src/components/reels/movie-reel-feed.tsx');
const profile = read('src/app/(app)/profile.tsx');
const roulette = read('src/app/(app)/roulette.tsx');

const seenButton = reel.indexOf("reviewed ? 'Reseñada' : 'La vi'");
const renewButton = reel.indexOf('<Text style={styles.actionText}>Otras 10</Text>');
assert.ok(seenButton >= 0 && renewButton > seenButton, 'Otras 10 debe estar debajo de La vi');
assert.doesNotMatch(screen, /TMDB no tiene|categoría equivalente|Algunos géneros/);
assert.doesNotMatch(feed, /Encontramos \{movies\.length\} opciones/);
assert.doesNotMatch(profile, /styles\.savedCount/);
assert.match(screen, /onHorizontalSwipe=\{switchContentType\}/);
assert.match(roulette, /HorizontalSwipeArea/);
assert.match(reel, /protectedViewRef=\{playerRef\}/);

console.log('OK: controles del reel, mensajes, contador y cambio horizontal.');
