import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const siteRoot = resolve(process.env.WP35_SITE_ROOT ?? 'dist');
const mount = '/future-conquest';
const port = Number(process.env.WP35_PORT ?? 4177);
const channel = process.env.WP35_BROWSER_CHANNEL || undefined;

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.mp3', 'audio/mpeg']
]);

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

const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
const consoleEvents = [];
const resourceEvents = [];
page.on('console', message => consoleEvents.push({ type: message.type(), text: message.text() }));
page.on('pageerror', error => consoleEvents.push({ type: 'pageerror', text: String(error) }));
page.on('response', response => {
  const url = response.url();
  if (/three\.module|r3-(formation|world)-miniatures/.test(url)) resourceEvents.push({ url, status: response.status() });
});
await page.addInitScript(() => {
  localStorage.setItem('future-conquest:intro-seen:v3', 'true');
  localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
});

let result;
try {
  await page.goto(`http://127.0.0.1:${port}${mount}/?terrain=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click({ timeout: 30_000 });
  await page.locator('.startup-game-shell').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('[data-command-view="map"]').click();
  const host = page.locator('.r3-terrain-prototype');
  await host.waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForFunction(() => document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status') === 'ready', undefined, { timeout: 45_000 });
  await page.waitForTimeout(2_000);

  result = await page.evaluate(() => {
    const host = document.querySelector('.r3-terrain-prototype');
    const firstFormation = document.querySelector('.r3-terrain-task-group-marker');
    const selector = ".r3-terrain-prototype[data-physical-formations='ready'] .r3-terrain-task-group-marker";
    const matchedOpacityRules = [];
    if (firstFormation instanceof HTMLElement) {
      for (const sheet of [...document.styleSheets]) {
        let rules;
        try { rules = [...sheet.cssRules]; } catch { continue; }
        for (const rule of rules) {
          if (!(rule instanceof CSSStyleRule) || !rule.style.opacity) continue;
          try {
            if (firstFormation.matches(rule.selectorText)) matchedOpacityRules.push({
              selector: rule.selectorText,
              opacity: rule.style.opacity,
              priority: rule.style.getPropertyPriority('opacity')
            });
          } catch { /* unsupported selector */ }
        }
      }
    }
    const markerStyle = firstFormation instanceof HTMLElement ? getComputedStyle(firstFormation) : null;
    const formationState = firstFormation instanceof HTMLElement
      ? firstFormation.querySelector(':scope > .bg12i-formation-state')
      : null;
    const formationStateStyle = formationState instanceof HTMLElement ? getComputedStyle(formationState) : null;
    const formationStateRect = formationState instanceof HTMLElement ? formationState.getBoundingClientRect() : null;
    return {
      hostDataset: host instanceof HTMLElement ? { ...host.dataset } : null,
      webgl2: Boolean(document.querySelector('.r3-terrain-prototype-canvas canvas')?.getContext('webgl2')),
      formationEvidence: window.__r3FormationMiniatures ?? null,
      worldEvidence: window.__r3WorldMiniatures ?? null,
      formationOpacity: markerStyle?.opacity ?? null,
      formationBackground: markerStyle?.backgroundColor ?? null,
      formationBorderColor: markerStyle?.borderTopColor ?? null,
      formationBoxShadow: markerStyle?.boxShadow ?? null,
      formationStateVisible: Boolean(formationState instanceof HTMLElement
        && formationStateStyle
        && formationStateStyle.display !== 'none'
        && formationStateStyle.visibility !== 'hidden'
        && Number(formationStateStyle.opacity) > 0
        && formationStateRect
        && formationStateRect.width > 0
        && formationStateRect.height > 0),
      markerSelectorDiagnostic: firstFormation instanceof HTMLElement ? {
        matchesReadySelector: firstFormation.matches(selector),
        insideHost: Boolean(firstFormation.closest('.r3-terrain-prototype')),
        parentClass: firstFormation.parentElement?.className ?? null,
        grandparentClass: firstFormation.parentElement?.parentElement?.className ?? null,
        activeTag: document.activeElement === firstFormation,
        focusVisible: firstFormation.matches(':focus-visible'),
        inlineOpacity: firstFormation.style.opacity || null,
        matchedOpacityRules
      } : null
    };
  });
} catch (error) {
  result = { probeError: String(error) };
}

console.log(JSON.stringify({ channel: channel ?? 'playwright-chromium', resources: resourceEvents, console: consoleEvents, result }, null, 2));
await page.screenshot({ path: process.env.WP35_SCREENSHOT ?? 'wp3-5-production-startup.png', fullPage: true }).catch(() => undefined);
await browser.close();
await new Promise(resolveClose => server.close(resolveClose));

const transparent = value => value === 'rgba(0, 0, 0, 0)' || value === 'transparent';
const ready = result?.hostDataset?.physicalFormations === 'ready'
  && result?.formationEvidence?.renderCount > 0
  && result?.worldEvidence?.renderCount > 0
  && Number(result?.formationOpacity) > 0
  && transparent(result?.formationBackground)
  && transparent(result?.formationBorderColor)
  && result?.formationBoxShadow === 'none'
  && result?.formationStateVisible === true;
if (!ready) process.exitCode = 2;
