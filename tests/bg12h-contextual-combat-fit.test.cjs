const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12H contextual combat stays inside the compact tabletop rail', () => {
  const css = read('src/bg12h-contextual-combat-fit.css');
  const main = read('src/main.tsx');

  assert.match(main, /import '\.\/bg12e-settings-access\.css';\s*import '\.\/bg12h-contextual-combat-fit\.css';/,
    'contextual fit overrides must load after the BG12E layout/settings cascade');
  assert.match(css, /\.bg12h-contextual-combat \.tabletop-combat-panel[\s\S]*?box-sizing:\s*border-box/);
  assert.match(css, /\.bg12h-contextual-combat \.tabletop-combat-panel[\s\S]*?overflow-x:\s*hidden\s*!important/);
  assert.match(css, /\.bg12h-contextual-combat \.bg12g-tray[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.bg12h-contextual-combat \.bg12g-integrated-dice[\s\S]*?min-width:\s*0/);
});

test('BG12H contextual combat remains available in the compact mobile drawer', () => {
  const css = read('src/bg12h-contextual-combat-fit.css');

  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.bg12h-contextual-combat \.tabletop-combat-panel\s*\{[\s\S]*?display:\s*block\s*!important/,
    'legacy standalone combat hiding must not suppress contextual combat on mobile');
});

test('BG12H combat fit remains presentation-only and scoped to the contextual owner', () => {
  const css = read('src/bg12h-contextual-combat-fit.css');

  assert.doesNotMatch(css, /tabletop-combat-panel\s*\{(?![\s\S]*?bg12h-contextual-combat)/,
    'fit rules must not globally restyle the accepted combat panel');
  assert.doesNotMatch(css, /MapLibre|maplibregl|attack-piece|Math\.random|seededRandom/);
});
