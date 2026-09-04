const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const roadmap = fs.readFileSync('docs/roadmap/R3-ROADMAP.md', 'utf8');
const status = fs.readFileSync('docs/DEVELOPMENT_STATUS.md', 'utf8');
const refinement = fs.readFileSync('docs/roadmap/R3-WP3.6-WP3.8-PHYSICAL-MAP-REFINEMENT.md', 'utf8');
const packageDoc = fs.readFileSync('docs/roadmap/R3-WP2B-REAL-TERRAIN.md', 'utf8');
const dataDoc = fs.readFileSync('docs/architecture/R3-WP2B-TERRAIN-DATA.md', 'utf8');

test('R3 programme records terrain completion and the approved physical-map refinement gate before WP4', () => {
  const wp2b = roadmap.indexOf('## R3-WP2B - Real Terrain Foundation');
  const wp2c = roadmap.indexOf('## R3-WP2C - Terrain Operational Overlay Parity');
  const wp2d = roadmap.indexOf('## R3-WP2D - Terrain Refinement & Presentation Polish');
  const wp2e = roadmap.indexOf('## R3-WP2E through post-WP2I terrain completion');
  const wp3 = roadmap.indexOf('## R3-WP3 - Formation Pieces & Animated Movement');
  const recovery = roadmap.indexOf('## R3 Production Coherence Recovery');
  const stabilisation = roadmap.indexOf('## R3 Stabilisation Gate - Map & WP3 Bug Remediation');
  const wp35 = roadmap.indexOf('# R3-WP3.5 - World Pieces & Strategic Miniatures');
  const wp36 = roadmap.indexOf('# R3-WP3.6 - Future Soldier Army Miniatures');
  const wp37 = roadmap.indexOf('# R3-WP3.7 - End-of-Day Operational Movement Beat');
  const wp38 = roadmap.indexOf('# R3-WP3.8 - Landmark City Miniatures Programme');
  const wp4 = roadmap.indexOf('## R3-WP4 - Battle, Front & Strategic Event Feedback');
  assert.ok(wp2b >= 0 && wp2c > wp2b && wp2d > wp2c && wp2e > wp2d && wp3 > wp2e);
  assert.ok(recovery > wp3 && stabilisation > recovery && wp35 > stabilisation);
  assert.ok(wp36 > wp35 && wp37 > wp36 && wp38 > wp37 && wp4 > wp38);
  assert.match(status, /active product programme is the board-game conversion and tabletop-completion plan/i);
  assert.match(status, /previous R3-WP6\.6 status text in this file is historical and no longer selects work/i);
  assert.match(status, /\*\*BG12G-R — Physical 2D6 Dice Tray and Combat Recalibration\*\*/);
  assert.match(refinement, /R3-WP3\.6 - Future Soldier Army Miniatures/);
  assert.match(refinement, /R3-WP3\.7 - End-of-Day Operational Movement Beat/);
  assert.match(refinement, /R3-WP3\.8A - Landmark Cities Pass 1/);
  assert.match(refinement, /R3-WP3\.8E - Landmark Cities Pass 5/);
});

test('R3 WP2B explicitly replaces political slab elevation with continuous terrain', () => {
  assert.match(packageDoc, /single continuous geospatial terrain surface/i);
  assert.match(packageDoc, /Political capture must never alter the physical terrain mesh/i);
  assert.match(packageDoc, /no continuation of the WP2 raised-political-slab effect as the primary map/i);
});

test('R3 WP2B selects MapLibre Copernicus and Three.js with an SVG fallback', () => {
  assert.match(packageDoc, /Primary terrain\/map platform: \*\*MapLibre GL JS\*\*/);
  assert.match(packageDoc, /Terrain source direction: \*\*Copernicus DEM\*\*/);
  assert.match(packageDoc, /Three\.js through a MapLibre custom 3D layer/);
  assert.match(packageDoc, /SVG\/DOM strategic map remains an accessible\/reduced-effects\/failure fallback/);
});

test('R3 WP2B forbids browser geospatial acquisition credentials', () => {
  assert.match(dataDoc, /does not query authenticated Copernicus DEM services from the shipped browser/i);
  assert.match(dataDoc, /No terrain acquisition credential or access token belongs in Vite\/browser output/i);
  assert.match(dataDoc, /MapLibre requests only the generated same-origin Terrain-RGB assets/i);
  assert.match(packageDoc, /shipped browser must not contain Copernicus client secrets/i);
});
