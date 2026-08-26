import { createRequire } from 'node:module';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { beginOperation, newGame } = require('../.test-dist/engine.js');
const { AUTOSAVE_KEY } = require('../.test-dist/persistence.js');

const siteRoot = resolve(process.env.WP37_SITE_ROOT ?? 'dist');
const mount = '/future-conquest';
const port = Number(process.env.WP37_PORT ?? 4179);
const targetTerritory = 'FR-01';
const groupId = 'TG-1';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.mp3', 'audio/mpeg']
]);

function buildScenario() {
  let state = newGame(2, 'standard');
  for (const defender of Object.values(state.enemyFormations)) {
    if (defender.location !== targetTerritory) continue;
    defender.personnel = 1;
    defender.armour = 0;
    defender.readiness = 15;
    defender.entrenchment = 0;
  }
  state.selectedTaskGroupId = groupId;
  state.selectedTerritory = targetTerritory;
  state.targetTerritory = targetTerritory;
  state = beginOperation(state);
  if (state.taskGroups[groupId]?.order?.type !== 'attack' || state.taskGroups[groupId].order.days !== 0) {
    throw new Error('WP3.7 browser fixture failed to create a fresh invasion order.');
  }
  if (state.territories[targetTerritory]?.controller !== 'enemy') {
    throw new Error('WP3.7 browser fixture target must begin enemy-held.');
  }
  return state;
}

const scenario = buildScenario();
const startTurn = scenario.turn;

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  if (!requestUrl.pathname.startsWith(mount)) {
    response.writeHead(404).end('not found');
    return;
  }
  let relative = decodeURIComponent(requestUrl.pathname.slice(mount.length));
  if (!relative || relative === '/') relative = '/index.html';
  const candidate = resolve(siteRoot, `.${normalize(relative)}`);
  if (!candidate.startsWith(siteRoot)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let file = candidate;
  if ((!existsSync(file) || statSync(file).isDirectory()) && !extname(relative)) file = join(siteRoot, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end(`missing ${relative}`);
    return;
  }
  response.writeHead(200, {
    'content-type': contentTypes.get(extname(file)) ?? 'application/octet-stream',
    'cache-control': 'no-store'
  });
  createReadStream(file).pipe(response);
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(port, '127.0.0.1', resolveListen);
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'no-preference' });
const consoleEvents = [];
page.on('console', message => consoleEvents.push({ type: message.type(), text: message.text() }));
page.on('pageerror', error => consoleEvents.push({ type: 'pageerror', text: String(error) }));

await page.addInitScript(({ key, raw }) => {
  localStorage.setItem('future-conquest:intro-seen:v3', 'true');
  localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  localStorage.setItem('future-conquest-global-settings-v1', JSON.stringify({ muted: true, autosaveEnabled: true, assistanceLevel: 'Off' }));
  localStorage.setItem(key, raw);
}, { key: AUTOSAVE_KEY, raw: JSON.stringify(scenario) });

const piece = async () => page.evaluate(id => {
  const evidence = window.__r3FormationMiniatures;
  const item = evidence?.pieces?.find(candidate => candidate.id === id);
  return item ? { current: item.current, target: item.target, reducedMotion: evidence.reducedMotion } : null;
}, groupId);

const distance = (a, b) => Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0));

let evidence;
try {
  await page.goto(`http://127.0.0.1:${port}${mount}/?terrain=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click({ timeout: 30_000 });
  await page.locator('.startup-game-shell').waitFor({ state: 'visible', timeout: 30_000 });
  // The production game now enters on Map. Navigate to Campaign before loading
  // the seeded autosave, then return to Map to exercise the movement renderer.
  await page.locator('[data-command-view="campaign"]').click();
  await page.getByRole('button', { name: 'Load Autosave', exact: true }).click({ timeout: 30_000 });
  await page.locator('[data-command-view="map"]').click();

  const terrain = page.locator('.r3-terrain-prototype');
  await terrain.waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForFunction(() => {
    const host = document.querySelector('.r3-terrain-prototype');
    return host?.getAttribute('data-status') === 'ready' && host?.getAttribute('data-physical-formations') === 'ready';
  }, undefined, { timeout: 45_000 });
  await page.waitForFunction(id => Boolean(window.__r3FormationMiniatures?.pieces?.find(piece => piece.id === id)), groupId, { timeout: 15_000 });
  await page.waitForTimeout(250);

  const beforePiece = await piece();
  const beforeTurn = Number((await page.locator('.turn-block strong').textContent())?.trim());
  const beforeTargetClass = await page.locator(`.r3-terrain-territory-label[data-territory-id="${targetTerritory}"]`).getAttribute('class');

  if (!beforePiece || beforePiece.reducedMotion) throw new Error('Physical formation evidence missing or unexpectedly reduced-motion.');
  if (beforeTurn !== startTurn) throw new Error(`Expected starting day ${startTurn}, saw ${beforeTurn}.`);
  if (!beforeTargetClass?.includes('enemy')) throw new Error('Target province was not visibly enemy-held before End Day.');
  if (distance(beforePiece.current, beforePiece.target) > 0.00001) throw new Error('Formation was already travelling before End Day.');

  // Observe the renderer from inside the page so CI scheduling cannot miss the
  // deliberately short beat. The observer records the first actual frame where
  // the piece has left its origin but has not yet reached its target.
  await page.evaluate(({ id, territoryId, origin }) => {
    const frameDistance = (a, b) => Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0));
    window.__wp37MovementProbe = {
      sawPlaying: false,
      startedAt: null,
      mid: null,
      endedWithoutMid: false
    };
    const observe = now => {
      const probe = window.__wp37MovementProbe;
      if (!probe || probe.mid || probe.endedWithoutMid) return;
      const overlay = document.querySelector('.r3-movement-resolution-lock[data-phase="playing"]');
      if (overlay) {
        if (!probe.sawPlaying) {
          probe.sawPlaying = true;
          probe.startedAt = now;
        }
        const physicalEvidence = window.__r3FormationMiniatures;
        const item = physicalEvidence?.pieces?.find(candidate => candidate.id === id);
        if (item) {
          const wholeJourney = frameDistance(origin, item.target);
          const travelled = frameDistance(origin, item.current);
          const remaining = frameDistance(item.current, item.target);
          if (wholeJourney > 0.01 && travelled > 0.001 && remaining > 0.001) {
            probe.mid = {
              piece: { current: item.current, target: item.target, reducedMotion: physicalEvidence.reducedMotion },
              turn: Number(document.querySelector('.turn-block strong')?.textContent?.trim()),
              targetClass: document.querySelector(`.r3-terrain-territory-label[data-territory-id="${territoryId}"]`)?.getAttribute('class') ?? null,
              status: overlay.querySelector('strong')?.textContent ?? null,
              elapsedMs: probe.startedAt === null ? null : now - probe.startedAt,
              wholeJourney,
              travelled,
              remaining
            };
            return;
          }
        }
      } else if (probe.sawPlaying) {
        probe.endedWithoutMid = true;
        return;
      }
      window.requestAnimationFrame(observe);
    };
    window.requestAnimationFrame(observe);
  }, { id: groupId, territoryId: targetTerritory, origin: beforePiece.current });

  await page.locator('.global-resolve').click();
  await page.waitForFunction(() => Boolean(window.__wp37MovementProbe?.mid || window.__wp37MovementProbe?.endedWithoutMid), undefined, { timeout: 7_000 });
  const movementProbe = await page.evaluate(() => window.__wp37MovementProbe);
  const midSnapshot = movementProbe?.mid;

  if (!midSnapshot) {
    throw new Error(`Movement beat ended without an observable in-transit frame: ${JSON.stringify(movementProbe)}`);
  }
  if (!midSnapshot.piece) throw new Error('Physical formation evidence disappeared during movement beat.');
  if (!midSnapshot.status?.includes('Movement resolution')) throw new Error('Movement-resolution status was not presented during the in-transit frame.');
  if (midSnapshot.turn !== startTurn) throw new Error(`Command day advanced early during movement beat: ${midSnapshot.turn}.`);
  if (!midSnapshot.targetClass?.includes('enemy')) throw new Error('Target ownership changed before movement presentation completed.');
  if (!(midSnapshot.wholeJourney > 0.01 && midSnapshot.travelled > 0.001 && midSnapshot.remaining > 0.001)) {
    throw new Error(`Formation did not show an in-progress invasion journey: ${JSON.stringify(midSnapshot)}.`);
  }

  await page.locator('.r3-movement-resolution-lock').waitFor({ state: 'detached', timeout: 6_000 });
  await page.waitForTimeout(150);

  const afterPiece = await piece();
  const afterTurn = Number((await page.locator('.turn-block strong').textContent())?.trim());
  const afterTargetClass = await page.locator(`.r3-terrain-territory-label[data-territory-id="${targetTerritory}"]`).getAttribute('class');
  const autosaveTurn = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').turn, AUTOSAVE_KEY);

  if (!afterPiece) throw new Error('Physical formation evidence missing after movement beat.');
  if (afterTurn !== startTurn + 1) throw new Error(`Expected exactly one day advance to ${startTurn + 1}, saw ${afterTurn}.`);
  if (autosaveTurn !== startTurn + 1) throw new Error(`Autosave did not contain the one authoritative resolved day: ${autosaveTurn}.`);
  if (!afterTargetClass?.includes('player')) throw new Error('Captured target did not reveal player control after the movement beat.');
  if (distance(afterPiece.current, afterPiece.target) > 0.00005) throw new Error('Formation did not settle at its resolved target after the beat.');

  await page.screenshot({ path: process.env.WP37_AFTER_SCREENSHOT ?? 'wp3-7-movement-after.png', fullPage: true });
  evidence = {
    startTurn,
    before: { piece: beforePiece, targetClass: beforeTargetClass },
    mid: midSnapshot,
    after: { piece: afterPiece, targetClass: afterTargetClass, turn: afterTurn, autosaveTurn }
  };
} catch (error) {
  evidence = { probeError: String(error) };
  process.exitCode = 2;
}

console.log(JSON.stringify({ evidence, console: consoleEvents }, null, 2));
await browser.close();
await new Promise(resolveClose => server.close(resolveClose));
