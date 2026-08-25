import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.R3_WP9_ORIGIN ?? 'http://127.0.0.1:4173';
const outputDir = process.env.R3_WP9_ARTIFACTS ?? 'artifacts/r3-wp9';
const manualSaveKey = 'future-conquest-slice-v0.14';
fs.mkdirSync(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

try {
  await page.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  });

  await page.goto(`${origin}/?terrain=0`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
  await page.locator('.command-workspace').waitFor({ state: 'visible', timeout: 30000 });

  await page.locator('[data-command-view="campaign"]').click();
  const difficulty = page.getByLabel('New campaign difficulty');
  await difficulty.selectOption('hard');
  const tutorialToggle = page.getByLabel('Guided tutorial');
  if (await tutorialToggle.isChecked()) await tutorialToggle.evaluate(element => element.click());
  await page.getByRole('button', { name: 'New campaign', exact: true }).click();

  await page.locator('[data-command-view="campaign"]').click();
  const statusBeforeSave = (await page.locator('.campaign-status-card').innerText()).replace(/\s+/g, ' ').trim();
  assert(/hard/i.test(statusBeforeSave), `hard campaign was not established before save: ${statusBeforeSave}`);

  await page.getByRole('button', { name: 'Manual Save', exact: true }).click();
  await page.getByText('Manual campaign saved', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });

  const saved = await page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, manualSaveKey);
  assert(saved, 'manual save slot was not written');
  assert(saved.difficulty === 'hard', `manual save lost campaign difficulty: ${saved.difficulty}`);
  assert(Number.isInteger(saved.turn) && saved.turn > 0, `manual save has invalid day: ${saved.turn}`);
  assert(Number.isInteger(saved.seed), `manual save has invalid seed: ${saved.seed}`);

  await page.screenshot({ path: `${outputDir}/manual-save-before-reload.png`, fullPage: false });

  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueButton = page.getByRole('button', { name: /^CONTINUE CAMPAIGN/ });
  await continueButton.waitFor({ state: 'visible', timeout: 30000 });
  await page.screenshot({ path: `${outputDir}/continue-launcher-after-reload.png`, fullPage: false });
  await continueButton.click();

  await page.locator('.command-workspace').waitFor({ state: 'visible', timeout: 30000 });
  const expectedDay = `Day ${String(saved.turn).padStart(3, '0')}`;
  await page.waitForTimeout(180);
  await page.locator('[data-command-view="campaign"]').click();
  await page.waitForFunction(({ day, seed }) => {
    const text = document.querySelector('.campaign-status-card')?.textContent ?? '';
    return text.includes(day) && text.includes(`Seed ${seed}`) && /hard/i.test(text);
  }, { day: expectedDay, seed: saved.seed }, { timeout: 10000 });

  const statusAfterLoad = (await page.locator('.campaign-status-card').innerText()).replace(/\s+/g, ' ').trim();
  assert(statusAfterLoad.includes(expectedDay), `continued campaign restored the wrong day: ${statusAfterLoad}`);
  assert(statusAfterLoad.includes(`Seed ${saved.seed}`), `continued campaign restored the wrong seed: ${statusAfterLoad}`);
  assert(/hard/i.test(statusAfterLoad), `continued campaign restored the wrong difficulty: ${statusAfterLoad}`);

  await page.screenshot({ path: `${outputDir}/continued-campaign-after-load.png`, fullPage: false });

  const relevantErrors = errors.filter(error => !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(error));
  assert(relevantErrors.length === 0, `browser errors detected during save/load continuity: ${JSON.stringify(relevantErrors)}`);

  const evidence = {
    schemaVersion: 1,
    head: process.env.R3_WP9_REF ?? process.env.GITHUB_SHA ?? null,
    saved: { turn: saved.turn, seed: saved.seed, difficulty: saved.difficulty },
    statusBeforeSave,
    statusAfterLoad,
    screenshots: [
      'manual-save-before-reload.png',
      'continue-launcher-after-reload.png',
      'continued-campaign-after-load.png'
    ]
  };
  fs.writeFileSync(`${outputDir}/session-continuity.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log('R3-WP9 browser save/load and session continuity probe passed.');
} finally {
  await browser.close();
}
