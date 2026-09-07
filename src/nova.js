/* A restrained character: a subtle vertical float, smooth gaze and ten-second blinks. */
window.createNova = function createNova() {
  const button = document.getElementById('nova');
  const space = document.getElementById('nova-space');
  const eyes = [...button.querySelectorAll('.eye')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const BLINK_INTERVAL = 10000;
  let visible = true, simple = false, destroyed = false;
  let timer, frame, deadline = 0, target = { x: 0, y: 0 };
  const animations = new Set();
  const allowed = () => visible && !document.hidden && !simple && !reduce.matches && !destroyed;

  function blink() {
    if (!allowed()) return;
    for (const eye of eyes) {
      const animation = eye.animate([
        { scale: '1 1', offset: 0 },
        { scale: '1 .04', offset: .38 },
        { scale: '1 .04', offset: .48 },
        { scale: '1 1', offset: 1 }
      ], { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)' });
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
  function gaze(x, y) {
    target = { x, y };
    if (!allowed() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!allowed()) return;
      button.style.setProperty('--gaze-x', `${target.x}px`);
      button.style.setProperty('--gaze-y', `${target.y}px`);
    });
  }
  function pointerMove(event) {
    if (!allowed()) return;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    gaze(Math.max(-7, Math.min(7, x / 65)), Math.max(-5, Math.min(5, y / 75)));
  }
  function center() { gaze(0, 0); }
  function stop() {
    clearTimeout(timer); cancelAnimationFrame(frame); frame = null;
    for (const animation of animations) animation.cancel();
    animations.clear();
    button.style.setProperty('--gaze-x', '0px'); button.style.setProperty('--gaze-y', '0px');
  }
  function refresh() {
    stop();
    space.classList.toggle('nova-still', !allowed());
    if (allowed()) { deadline = performance.now() + BLINK_INTERVAL; schedule(); }
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
