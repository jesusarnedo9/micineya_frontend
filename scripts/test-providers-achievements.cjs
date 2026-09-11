const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/components/reels/provider-label.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const moduleExports = context.exports;

assert.equal(moduleExports.formatPlatforms(['Netflix']), 'Netflix');
assert.equal(moduleExports.formatPlatforms(['Amazon Prime Video', 'Disney Plus']), 'Prime Video +1');
assert.equal(moduleExports.formatPlatforms(['Netflix', 'Netflix']), 'Netflix');
assert.equal(moduleExports.formatPlatforms([]), null);

const assets = ['popcorn-bucket-textured.png', 'popcorn-kernel.png', 'badge-thrones.png', 'badge-chemistry.png', 'badge-cycle.png'];
for (const asset of assets) {
  const file = path.join(__dirname, '../assets/images/gamification', asset);
  assert.ok(fs.existsSync(file), `Falta ${asset}`);
  assert.ok(fs.statSync(file).size < 400_000, `${asset} debe mantenerse liviano`);
}

const room = fs.readFileSync(path.join(__dirname, '../src/components/profile/popcorn-room.tsx'), 'utf8');
for (const code of ['SERIE_TRONOS', 'SERIE_QUIMICA', 'SERIE_CICLO']) assert.match(room, new RegExp(code));
assert.doesNotMatch(room, /Una película o una temporada completa/);

console.log('OK: plataformas compactas, recursos livianos y estante de insignias.');
