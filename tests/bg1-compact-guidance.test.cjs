const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG1E compacts the existing warning families instead of replacing them', () => {
  const css = read('src/bg1-compact-guidance.css');

  for (const selector of [
    '.operational-alert-strip',
    '.adviser-alert-strip',
    '.enemy-action-alert',
    '.combat-report-alert'
  ]) assert.match(css, new RegExp(selector.replaceAll('.', '\\.')));

  assert.match(css, /max-height: 50px !important/);
  assert.match(css, /:focus-within/);
});

test('BG1E guidance remains presentation-only and leaves protected rendering code alone', () => {
  const css = read('src/bg1-compact-guidance.css');
  const main = read('src/main.tsx');

  assert.doesNotMatch(css, /MapLibre|WebGL|TerrainMapPrototype|MapView|canvas|requestAnimationFrame/);
  assert.match(css, /No game, map or renderer state is owned here/);
  assert.match(main, /bg1-compact-guidance\.css/);
});
