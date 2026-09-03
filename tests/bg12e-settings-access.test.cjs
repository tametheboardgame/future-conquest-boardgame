const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12E reserves status-strip space for the permanent Settings control', () => {
  const main = read('src/main.tsx');
  const css = read('src/bg12e-settings-access.css');
  const startup = read('src/components/StartupExperience.tsx');

  assert.ok(main.indexOf("import './bg12e-tabletop-layout.css';") < main.indexOf("import './bg12e-settings-access.css';"));
  assert.match(css, /\.bg12e-status-zone \.tabletop-status-shell\s*\{[\s\S]*?padding-right:\s*48px !important;/);
  assert.match(css, /html\.bg12d-board-ui \.global-settings-toggle\s*\{[\s\S]*?width:\s*34px;/);
  assert.match(css, /min-height:\s*34px;/);
  assert.match(startup, /className="global-settings-toggle"/);
  assert.match(startup, /aria-label="Open game settings"/);
});
