const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = process.argv[2] ? { executablePath: path.resolve(process.argv[2]), args: [] } : { args: [path.join(__dirname, '..')] };
  const app = await electron.launch({ ...launch, env });
  try {
    const page = await app.firstWindow(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForSelector('#nova');
    const wasSimple = await page.locator('body').evaluate(el => el.classList.contains('simple'));
    if (wasSimple) await page.click('#appearance');
    const time = new Date('2026-09-08T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.novaAnimationCalls = [];
      const original = Element.prototype.animate;
      Element.prototype.animate = function(...args) {
        if (this.closest('#nova-space')) window.novaAnimationCalls.push({ eye: this.classList.contains('eye'), at: performance.now() });
        return original.apply(this, args);
      };
    });
    await page.reload(); await page.waitForSelector('#nova');
    const origin = await page.evaluate(() => performance.now());
    await page.clock.runFor(9999);
    assert.equal(await page.evaluate(() => novaAnimationCalls.length), 0, 'no early blink');
    await page.clock.runFor(1);
    let calls = await page.evaluate(() => novaAnimationCalls);
    assert.equal(calls.length, 2); assert.ok(calls.every(c => c.eye));
    assert.equal(calls[0].at - origin, 10000);
    await page.clock.runFor(10000);
    calls = await page.evaluate(() => novaAnimationCalls);
    assert.equal(calls.length, 4); assert.equal(calls[2].at - calls[0].at, 10000);
    const caption = await page.textContent('#nova-caption');
    await page.locator('#nova').focus(); await page.locator('#nova').press('Enter');
    assert.equal(await page.textContent('#nova-caption'), caption, 'click must not write a message');
    assert.equal(await page.locator('#toast').isVisible(), false);
    assert.equal(await page.evaluate(() => novaAnimationCalls.length), 4, 'click must not add a blink');
    await page.mouse.move(100, 150); await page.clock.runFor(20);
    assert.notEqual(await page.locator('#nova').evaluate(el => el.style.getPropertyValue('--gaze-x')), '0px');
    for (const selector of ['#nova', '.face']) {
      assert.deepEqual(await page.locator(selector).evaluate(el => ({ transform: getComputedStyle(el).transform, animation: getComputedStyle(el).animationName })), { transform: 'none', animation: 'none' });
    }
    const bodyMotion = await page.locator('.mascot').evaluate(el => {
      const style = getComputedStyle(el);
      const animation = el.getAnimations().find(a => a.animationName === 'nova-float');
      const frames = animation.effect.getKeyframes();
      return { name: style.animationName, duration: style.animationDuration, easing: style.animationTimingFunction, transforms: frames.map(f => f.transform) };
    });
    assert.equal(bodyMotion.name, 'nova-float'); assert.equal(bodyMotion.duration, '9s');
    assert.ok(bodyMotion.easing.includes('cubic-bezier'));
    assert.ok(bodyMotion.transforms.every(value => !/translate3d\([^,]*[1-9][^,]*px/.test(value)), 'body has no horizontal travel');
    await page.click('[data-view="history"]');
    const pausedCount = await page.evaluate(() => novaAnimationCalls.length);
    await page.clock.runFor(40000);
    assert.equal(await page.evaluate(() => novaAnimationCalls.length), pausedCount);
    assert.deepEqual(await page.locator('#nova-space').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').map(a => a.animationName || a.effect.target.className)), []);
    await page.click('[data-view="overview"]');
    await page.clock.runFor(9999); assert.equal(await page.evaluate(() => novaAnimationCalls.length), pausedCount);
    await page.clock.runFor(1); assert.equal(await page.evaluate(() => novaAnimationCalls.length), pausedCount + 2);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.runFor(100);
    const reducedCount = await page.evaluate(() => novaAnimationCalls.length);
    await page.clock.runFor(20000);
    assert.equal(await page.evaluate(() => novaAnimationCalls.length), reducedCount);
    assert.deepEqual(await page.locator('#nova-space').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').map(a => a.animationName || a.effect.target.className)), []);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.click('#appearance');
    await page.clock.runFor(20000); assert.equal(await page.evaluate(() => novaAnimationCalls.length), reducedCount);
    if (!wasSimple) await page.click('#appearance');
    assert.deepEqual(errors, []);
    console.log('PASS: exact 10-second blink cadence, subtle continuous vertical float, smooth gaze, silent clicks, offscreen pause, reduced motion and simple appearance.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
