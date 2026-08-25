import { chromium } from 'playwright';

const origin = process.env.R3_WP6_ORIGIN ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function keyboardFocus(selector, maxTabs = 48) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press('Tab');
    const matched = await page.evaluate(target => document.activeElement?.matches(target) ?? false, selector);
    if (matched) return;
  }
  throw new Error(`keyboard tab order did not reach ${selector}`);
}

try {
  await page.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  });

  await page.goto(`${origin}/?terrain=0`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
  await page.locator('.command-workspace').waitFor({ state: 'visible', timeout: 15000 });

  const primary = await page.evaluate(() => [...document.querySelectorAll('.command-nav-primary [data-command-view]')].map(node => {
    const box = node.getBoundingClientRect();
    const label = node.querySelector('.command-nav-label');
    return {
      view: node.getAttribute('data-command-view'),
      title: node.getAttribute('title'),
      label: label?.textContent?.trim() ?? '',
      labelDisplay: label ? getComputedStyle(label).display : 'missing',
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  }));

  assert(primary.length === 4, `expected four board-game command views, found ${primary.length}`);
  assert(primary.map(item => item.view).join(',') === 'map,forces,operations,campaign', `unexpected primary board-game views: ${primary.map(item => item.view).join(',')}`);
  for (const item of primary) {
    assert(Boolean(item.title), `primary command ${item.view} has no hover title`);
    assert(Boolean(item.label) && item.labelDisplay !== 'none', `primary command ${item.view} has no visible caption`);
    assert(item.width >= 54 && item.height >= 54, `primary command ${item.view} has a small target: ${item.width}x${item.height}`);
  }

  const reservedCards = await page.evaluate(() => {
    const node = document.querySelector('.command-nav-cards');
    if (!(node instanceof HTMLButtonElement)) return null;
    const box = node.getBoundingClientRect();
    return {
      disabled: node.disabled,
      label: node.querySelector('.command-nav-label')?.textContent?.trim() ?? '',
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  });
  assert(reservedCards?.disabled && reservedCards.label === 'Cards', `reserved Cards control is not clearly unavailable: ${JSON.stringify(reservedCards)}`);
  assert((reservedCards?.width ?? 0) >= 54 && (reservedCards?.height ?? 0) >= 54, `reserved Cards target is too small: ${JSON.stringify(reservedCards)}`);

  const more = page.locator('.command-nav-legacy summary');
  const moreTarget = await more.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  });
  assert(moreTarget.width >= 54 && moreTarget.height >= 54, `More disclosure target is too small: ${moreTarget.width}x${moreTarget.height}`);

  const forces = page.locator('[data-command-view="forces"]');
  await keyboardFocus('[data-command-view="forces"]');
  const primaryFocus = await forces.evaluate(node => ({
    focused: document.activeElement === node,
    focusVisible: node.matches(':focus-visible'),
    outlineStyle: getComputedStyle(node).outlineStyle,
    outlineWidth: getComputedStyle(node).outlineWidth
  }));
  assert(primaryFocus.focused && primaryFocus.focusVisible, `primary navigation was not reached by keyboard focus: ${JSON.stringify(primaryFocus)}`);
  assert(primaryFocus.outlineStyle !== 'none' && parseFloat(primaryFocus.outlineWidth) >= 1, `primary keyboard focus is not visible: ${JSON.stringify(primaryFocus)}`);
  await page.keyboard.press('Enter');
  await page.locator('.forces-view').waitFor({ state: 'visible', timeout: 5000 });
  assert(await forces.getAttribute('aria-current') === 'page', 'keyboard activation did not update primary navigation state');

  await keyboardFocus('.command-nav-legacy summary');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.command-nav-legacy')?.hasAttribute('open'));

  const legacy = await page.evaluate(() => [...document.querySelectorAll('.command-nav-legacy-items [data-command-view]')].map(node => {
    const box = node.getBoundingClientRect();
    const label = node.querySelector('.command-nav-label');
    return {
      view: node.getAttribute('data-command-view'),
      label: label?.textContent?.trim() ?? '',
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  }));
  assert(legacy.length === 4, `expected four legacy utility views behind More, found ${legacy.length}`);
  assert(legacy.every(item => item.width >= 54 && item.height >= 54 && item.label), `legacy utility target is inaccessible after disclosure: ${JSON.stringify(legacy)}`);

  const logistics = page.locator('[data-command-view="logistics"]');
  await keyboardFocus('[data-command-view="logistics"]');
  await page.keyboard.press('Enter');
  await page.locator('.logistics-priority-view').waitFor({ state: 'visible', timeout: 5000 });

  const specialist = await page.evaluate(() => [...document.querySelectorAll('.logistics-tabs button')].map(node => {
    const box = node.getBoundingClientRect();
    const label = node.querySelector('span');
    return {
      label: label?.textContent?.trim() ?? '',
      width: Math.round(box.width),
      height: Math.round(box.height),
      current: node.getAttribute('aria-current')
    };
  }));
  assert(specialist.length === 4, `expected four logistics specialist controls, found ${specialist.length}`);
  for (const item of specialist) {
    assert(Boolean(item.label), 'specialist icon control lost its visible caption');
    assert(item.width >= 68 && item.height >= 54, `specialist control is too small: ${item.label} ${item.width}x${item.height}`);
  }

  const formationsTab = page.locator('.logistics-tabs button:nth-child(2)');
  await keyboardFocus('.logistics-tabs button:nth-child(2)');
  const focusEvidence = await formationsTab.evaluate(node => ({
    focused: document.activeElement === node,
    focusVisible: node.matches(':focus-visible'),
    outlineStyle: getComputedStyle(node).outlineStyle,
    outlineWidth: getComputedStyle(node).outlineWidth
  }));
  assert(focusEvidence.focused && focusEvidence.focusVisible, `specialist control was not reached by keyboard focus: ${JSON.stringify(focusEvidence)}`);
  assert(focusEvidence.outlineStyle !== 'none' && parseFloat(focusEvidence.outlineWidth) >= 1, `specialist keyboard focus is not visible: ${JSON.stringify(focusEvidence)}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.logistics-tabs button')].some(button => button.getAttribute('aria-current') === 'page' && button.textContent?.includes('Formations')));

  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  assert(reducedMotion, 'reduced-motion browser preference was not active');

  await page.locator('[data-command-view="map"]').click();
  await page.locator('.command-nav-legacy').evaluate(node => node.removeAttribute('open'));
  await page.setViewportSize({ width: 640, height: 900 });
  await page.waitForTimeout(250);
  const compact = await page.evaluate(() => {
    const nav = document.querySelector('.command-navigation');
    const navBox = nav?.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.command-nav-primary button')].map(node => {
      const box = node.getBoundingClientRect();
      const label = node.querySelector('.command-nav-label');
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        labelDisplay: label ? getComputedStyle(label).display : 'missing'
      };
    });
    const summary = document.querySelector('.command-nav-legacy summary');
    const summaryBox = summary?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
      navPosition: nav ? getComputedStyle(nav).position : 'missing',
      navBottom: navBox ? Math.round(innerHeight - navBox.bottom) : null,
      navWidth: navBox ? Math.round(navBox.width) : null,
      buttonCount: buttons.length,
      buttons,
      moreTarget: summaryBox ? { width: Math.round(summaryBox.width), height: Math.round(summaryBox.height) } : null
    };
  });

  assert(compact.documentFits, `compact layout causes document-level horizontal overflow: ${JSON.stringify(compact)}`);
  assert(compact.navPosition === 'fixed' && Math.abs(compact.navBottom ?? 999) <= 1, `compact primary navigation is not pinned to the bottom: ${JSON.stringify(compact)}`);
  assert(compact.navWidth === 640, `compact navigation does not span the viewport: ${JSON.stringify(compact)}`);
  assert(compact.buttonCount === 5, `compact navigation lost primary board-game controls: ${compact.buttonCount}`);
  assert(compact.buttons.every(item => item.width >= 54 && item.height >= 54), `compact command target is too small: ${JSON.stringify(compact.buttons)}`);
  assert(compact.buttons.every(item => item.labelDisplay !== 'none'), '640px compact navigation unexpectedly hid its short captions');
  assert((compact.moreTarget?.width ?? 0) >= 54 && (compact.moreTarget?.height ?? 0) >= 54, `compact More target is too small: ${JSON.stringify(compact.moreTarget)}`);

  console.log(JSON.stringify({ primary, reservedCards, moreTarget, primaryFocus, legacy, specialist, focusEvidence, reducedMotion, compact }, null, 2));
} finally {
  await browser.close();
}
