/* A restrained character: a subtle vertical float, expressive gaze and ten-second blinks. */
window.createNova = function createNova() {
  const button = document.getElementById('nova');
  const space = document.getElementById('nova-space');
  const eyes = [...button.querySelectorAll('.eye')];
  const lids = eyes.map(eye => { const lid = document.createElement('span'); lid.className = 'nova-lid'; eye.append(lid); return lid; });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const BLINK_INTERVAL = 10000;
  let visible = true, simple = false, destroyed = false;
  let timer, lookTimer, frame, deadline = 0, target = { x: 0, y: 0 };
  let pointerUntil = 0, lastLook = -1;
  let blinkIndex = 0;
  const animations = new Set();
  const allowed = () => visible && !document.hidden && !simple && !reduce.matches && !destroyed;

  function blink() {
    if (!allowed()) return;
    const duration = blinkIndex++ % 2 ? 720 : 360;
    for (const eye of eyes) {
      const shape = eye.animate([
        { scale: '1 1', translate: '0 0', rotate: '13deg', offset: 0, easing: 'cubic-bezier(.4,0,.7,1)' },
        { scale: '1 .4', translate: '0 18px', rotate: '0deg', offset: .36 },
        { scale: '1 .4', translate: '0 18px', rotate: '0deg', offset: .53, easing: 'cubic-bezier(.16,1,.3,1)' },
        { scale: '1 1', translate: '0 0', rotate: '13deg', offset: 1 }
      ], { duration });
      animations.add(shape);
      shape.finished.catch(() => {}).finally(() => animations.delete(shape));
    }
    for (const lid of lids) {
      const animation = lid.animate([
        { transform: 'translateY(-110%)', offset: 0, easing: 'cubic-bezier(.4,0,.7,1)' },
        { transform: 'translateY(-5%)', offset: .36 },
        { transform: 'translateY(-5%)', offset: .53, easing: 'cubic-bezier(.16,1,.3,1)' },
        { transform: 'translateY(-110%)', offset: 1 }
      ], { duration });
      animations.add(animation);
      animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!allowed()) return;
    timer = setTimeout(() => {
      if (!allowed()) return;
      blink();
      // Anchor the next blink to the cadence, rather than the animation's duration.
      deadline += BLINK_INTERVAL;
      if (deadline <= performance.now()) deadline = performance.now() + BLINK_INTERVAL;
      schedule();
    }, Math.max(0, deadline - performance.now()));
  }
  function gaze(x, y, motion = {}) {
    target = { x, y };
    if (!allowed() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!allowed()) return;
      button.style.setProperty('--gaze-duration', `${motion.duration ?? 760}ms`);
      button.style.setProperty('--gaze-easing', motion.easing ?? 'cubic-bezier(.16,1,.3,1)');
      button.style.setProperty('--gaze-x', `${target.x}px`);
      button.style.setProperty('--gaze-y', `${target.y}px`);
      const strength = Math.max(0, Math.hypot(target.x, target.y) - 5) / 14;
      button.style.setProperty('--head-x', `${target.x * .47 * strength}px`);
      button.style.setProperty('--head-y', `${target.y * .5 * strength}px`);
      button.style.setProperty('--head-turn', `${target.x * .52 * strength}deg`);
      button.style.setProperty('--eye-depth', `${1 + target.x * .004}`);
    });
  }
  const idleLooks = [
    { x: -15, y: -4, duration: 930, hold: 2250 },
    { x: -10, y: 7, duration: 740, hold: 1700 },
    { x: 12, y: -7, duration: 1010, hold: 2380 },
    { x: 16, y: 3, duration: 820, hold: 1900 },
    { x: 5, y: 8, duration: 680, hold: 1450 },
    { x: 0, y: 0, duration: 1120, hold: 2600 }
  ];
  function scheduleLook(delay = 1500) {
    clearTimeout(lookTimer);
    if (!allowed()) return;
    lookTimer = setTimeout(() => {
      if (!allowed()) return;
      if (performance.now() < pointerUntil) { scheduleLook(pointerUntil - performance.now()); return; }
      let next;
      do { next = Math.floor(Math.random() * idleLooks.length); } while (next === lastLook);
      lastLook = next;
      const look = idleLooks[next];
      gaze(look.x, look.y, { duration: look.duration, easing: 'cubic-bezier(.22,1,.36,1)' });
      scheduleLook(look.hold);
    }, delay);
  }
  function pointerMove(event) {
    if (!allowed()) return;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    pointerUntil = performance.now() + 3600;
    gaze(Math.max(-16, Math.min(16, x / 18)), Math.max(-10, Math.min(10, y / 22)), { duration: 620 });
    scheduleLook(3600);
  }
  function center() { pointerUntil = 0; gaze(0, 0, { duration: 880 }); scheduleLook(2100); }
  function stop() {
    clearTimeout(timer); clearTimeout(lookTimer); cancelAnimationFrame(frame); frame = null;
    for (const animation of animations) animation.cancel();
    animations.clear();
    button.style.setProperty('--gaze-x', '0px'); button.style.setProperty('--gaze-y', '0px');
    for (const [key, value] of Object.entries({ 'head-x': '0px', 'head-y': '0px', 'head-turn': '0deg', 'eye-depth': '1' })) button.style.setProperty(`--${key}`, value);
  }
  function refresh() {
    stop();
    space.classList.toggle('nova-still', !allowed());
    if (allowed()) {
      deadline = performance.now() + BLINK_INTERVAL;
      schedule();
      scheduleLook();
    }
  }
  document.addEventListener('pointermove', pointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', center);
  document.addEventListener('visibilitychange', refresh);
  reduce.addEventListener('change', refresh);
  // Clicking only recenters the gaze. No messages, extra blinks or body motion.
  button.addEventListener('click', center);
  refresh();
  return {
    context(options) {
      const nextVisible = options.visible ?? visible, nextSimple = options.simple ?? simple;
      if (visible !== nextVisible || simple !== nextSimple) {
        visible = nextVisible; simple = nextSimple; refresh();
      }
    },
    working() {},
    react() {},
    destroy() {
      destroyed = true; stop();
      document.removeEventListener('pointermove', pointerMove);
      document.documentElement.removeEventListener('pointerleave', center);
      document.removeEventListener('visibilitychange', refresh);
      reduce.removeEventListener('change', refresh);
      button.removeEventListener('click', center);
    }
  };
};
