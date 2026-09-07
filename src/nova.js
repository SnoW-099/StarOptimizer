/* Nova's small animation director. Timers choose gestures; the compositor animates them. */
window.createNova = function createNova() {
  const button = document.getElementById('nova');
  const space = document.getElementById('nova-space');
  const caption = document.getElementById('nova-caption');
  const body = button.querySelector('.mascot');
  const face = button.querySelector('.face');
  const eyes = [...button.querySelectorAll('.eye')];
  const motion = document.createElement('span'); motion.className = 'nova-motion';
  body.before(motion); motion.append(body);
  const sleep = document.createElement('span'); sleep.className = 'nova-sleep'; sleep.textContent = 'z z Z'; sleep.setAttribute('aria-hidden', 'true'); motion.append(sleep);
  for (const eye of eyes) { const lid = document.createElement('span'); lid.className = 'eyelid'; eye.append(lid); }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, simple = false, working = false, destroyed = false;
  let lastInput = performance.now(), lastPet = 0, gestureUntil = 0, sequence = 0, idleStep = 0;
  let idleTimer, blinkTimer, resetTimer, gazeFrame, sparkleTimer;
  let target = { x: 0, y: 0 }, lastPointer = null;
  const animations = new Set();
  const allowed = () => visible && !document.hidden && !simple && !reduce.matches && !destroyed;
  function animate(el, frames, options) {
    if (!allowed()) return;
    const animation = el.animate(frames, { easing: 'ease-in-out', ...options });
    animations.add(animation); animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  }
  function gaze(x, y) {
    target = { x, y };
    if (gazeFrame || !allowed()) return;
    gazeFrame = requestAnimationFrame(() => {
      gazeFrame = null;
      if (!allowed()) return;
      button.style.setProperty('--gaze-x', `${target.x}px`);
      button.style.setProperty('--gaze-y', `${target.y}px`);
    });
  }
  function mood(name, text) {
    space.dataset.mood = name;
    if (text) caption.textContent = text;
  }
  function rest() {
    if (working) mood('working', 'Un momento… estoy mirando.');
    else mood('idle', 'Nova está contigo · prueba a acariciarme');
  }
  function blink(wink = false) {
    const selected = wink ? [eyes[1]] : eyes;
    for (const eye of selected) animate(eye, [{ scale: '1 1' }, { scale: '1 .07', offset: .42 }, { scale: '1 1' }], { duration: wink ? 380 : 170 });
  }
  const poses = {
    curious: [
      { transform: 'rotate(0) translateY(0)' }, { transform: 'rotate(-13deg) translateY(-4px)', offset: .32 },
      { transform: 'rotate(9deg) translateY(-2px)', offset: .7 }, { transform: 'rotate(0) translateY(0)' }
    ],
    stretch: [
      { transform: 'scale(1)' }, { transform: 'scale(.94,1.1) translateY(-8px)', offset: .35 },
      { transform: 'scale(1.06,.94) translateY(4px)', offset: .72 }, { transform: 'scale(1)' }
    ],
    happy: [
      { transform: 'translateY(0) scale(1)' }, { transform: 'translateY(8px) scale(1.1,.88)', offset: .15 },
      { transform: 'translateY(-28px) scale(.94,1.08) rotate(-9deg)', offset: .4 },
      { transform: 'translateY(5px) scale(1.1,.91) rotate(4deg)', offset: .67 },
      { transform: 'translateY(-7px) scale(.98,1.03)', offset: .83 }, { transform: 'translateY(0) scale(1)' }
    ],
    pet: [
      { transform: 'rotate(0) scale(1)' }, { transform: 'rotate(8deg) scale(1.07,.94)', offset: .28 },
      { transform: 'rotate(-8deg) scale(1.04,.97)', offset: .6 }, { transform: 'rotate(0) scale(1)' }
    ],
    surprise: [
      { transform: 'scale(1)' }, { transform: 'translateY(-13px) scale(.93,1.1)', offset: .25 },
      { transform: 'translateY(3px) scale(1.04,.96)', offset: .72 }, { transform: 'scale(1)' }
    ],
    concerned: [
      { transform: 'rotate(0)' }, { transform: 'rotate(-7deg)', offset: .25 },
      { transform: 'rotate(6deg)', offset: .5 }, { transform: 'rotate(-3deg)', offset: .75 }, { transform: 'rotate(0)' }
    ]
  };
  // The supplied character has restrained motion: most expression comes from its eyes.
  poses.curious = [{ transform: 'rotate(0)' }, { transform: 'rotate(-4deg)', offset: .35 }, { transform: 'rotate(3deg)', offset: .7 }, { transform: 'rotate(0)' }];
  poses.stretch = [{ transform: 'scale(1)' }, { transform: 'scale(.99,1.02)', offset: .4 }, { transform: 'scale(1)' }];
  poses.happy = [{ transform: 'translateY(0)' }, { transform: 'translateY(-5px)', offset: .4 }, { transform: 'translateY(0)' }];
  poses.pet = [{ transform: 'rotate(0)' }, { transform: 'rotate(4deg)', offset: .35 }, { transform: 'rotate(-3deg)', offset: .7 }, { transform: 'rotate(0)' }];
  poses.surprise = [{ transform: 'scale(1)' }, { transform: 'scale(1.025)', offset: .3 }, { transform: 'scale(1)' }];
  function gesture(name, text, duration = 1600) {
    clearTimeout(resetTimer);
    gestureUntil = performance.now() + duration;
    for (const a of animations) a.cancel(); animations.clear();
    mood(name, text);
    if (poses[name]) animate(body, poses[name], { duration });
    if (name === 'wink') blink(true);
    resetTimer = setTimeout(() => { gestureUntil = 0; rest(); }, duration + 300);
  }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (!allowed()) return;
    blinkTimer = setTimeout(() => {
      if (space.dataset.mood !== 'sleepy' && performance.now() > gestureUntil) blink();
      scheduleBlink();
    }, 2200 + Math.random() * 3300);
  }
  function scheduleIdle(delay = 3200 + Math.random() * 2600) {
    clearTimeout(idleTimer);
    if (!allowed()) return;
    idleTimer = setTimeout(() => {
      if (!allowed()) return;
      if (performance.now() > gestureUntil) {
        if (working) {
          mood('working', 'Un momento… estoy mirando.');
          gaze(idleStep++ % 2 ? 8 : -8, 4);
          animate(body, poses.curious, { duration: 2300 });
        } else if (performance.now() - lastInput > 35000) {
          if (space.dataset.mood !== 'sleepy') { animate(body, poses.stretch, { duration: 1700 }); gaze(0, 3); }
          mood('sleepy', 'Un descansito… avísame cuando vuelvas.');
        } else {
          const next = idleStep++ % 5;
          if (next === 0) { gesture('curious', '¿Qué hacemos ahora?', 2200); gaze(-9, -3); }
          else if (next === 1) { gaze(7, -5); gesture('wink', 'Tengo un ojo puesto en tu PC.', 1000); }
          else if (next === 2) { gesture('stretch', 'Me estiro un poco. Ya estoy.', 2000); gaze(0, -4); }
          else if (next === 3) { gesture('curious', 'Por aquí todo tranquilo.', 1900); gaze(9, 2); }
          else { gesture('happy', 'Aquí estoy.', 1300); gaze(0, 0); }
        }
      }
      scheduleIdle();
    }, delay);
  }
  function wake() {
    lastInput = performance.now();
    if (space.dataset.mood === 'sleepy') { gesture('surprise', '¡Eh! Ya estoy aquí.', 1100); scheduleIdle(); }
  }
  function pointerMove(event) {
    if (!visible || document.hidden) return;
    wake();
    if (!allowed()) return;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
    const now = performance.now();
    if (lastPointer && Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) > 180 && now - lastPointer.at < 140 && Math.abs(x) < 160 && Math.abs(y) < 145 && now > gestureUntil && !working) gesture('surprise', '¡Uy! Te he visto.', 850);
    lastPointer = { x: event.clientX, y: event.clientY, at: now };
    if (space.dataset.mood !== 'pet') gaze(Math.max(-9, Math.min(9, x / 45)), Math.max(-6, Math.min(6, y / 55)));
    if (Math.abs(x) < 100 && y > -105 && y < -25 && now - lastPet > 3500 && !working && now > gestureUntil) {
      lastPet = now; gesture('pet', 'Mmm… eso se siente bien.', 1500);
    }
  }
  function clicked() {
    wake();
    if (working) { blink(true); return; }
    const reactions = [
      ['happy', '¡Hey! Estoy contigo.'], ['pet', 'Vale, vale… otra caricia.'],
      ['wink', 'Nuestro pequeño secreto.'], ['surprise', '¡Me has pillado!']
    ];
    const [name, text] = reactions[sequence++ % reactions.length]; gesture(name, text, name === 'wink' ? 1100 : 1500); gaze(0, 0); scheduleIdle();
  }
  function stopMotion() {
    clearTimeout(idleTimer); clearTimeout(blinkTimer); clearTimeout(resetTimer); clearTimeout(sparkleTimer);
    cancelAnimationFrame(gazeFrame); gazeFrame = null;
    for (const a of animations) a.cancel(); animations.clear();
    space.querySelectorAll('.nova-pop').forEach(el => el.remove());
    button.style.setProperty('--gaze-x', '0px'); button.style.setProperty('--gaze-y', '0px');
  }
  function refresh() {
    stopMotion(); gestureUntil = 0;
    space.classList.toggle('nova-still', !allowed());
    rest();
    if (allowed()) { lastInput = performance.now(); scheduleBlink(); scheduleIdle(1400); }
  }
  function visibility() { refresh(); }
  document.addEventListener('pointermove', pointerMove, { passive: true });
  document.addEventListener('keydown', wake);
  document.addEventListener('visibilitychange', visibility);
  button.addEventListener('click', clicked);
  reduce.addEventListener('change', refresh);
  refresh();
  return {
    context(options) {
      const nextVisible = options.visible ?? visible, nextSimple = options.simple ?? simple;
      if (visible !== nextVisible || simple !== nextSimple) { visible = nextVisible; simple = nextSimple; refresh(); }
    },
    working(value) { working = value; clearTimeout(resetTimer); gestureUntil = 0; rest(); if (allowed()) { scheduleIdle(value ? 600 : 2300); } },
    react(result) {
      working = false;
      const error = result === 'error';
      gesture(error ? 'concerned' : 'happy', error ? 'Algo no ha salido. Lo revisamos juntos.' : result === 'restore' ? 'Todo ha vuelto a su sitio.' : '¡Listo! Un pasito más.', error ? 1800 : 1600);
      gaze(0, 0); scheduleIdle();
    },
    destroy() { destroyed = true; stopMotion(); document.removeEventListener('pointermove', pointerMove); document.removeEventListener('keydown', wake); document.removeEventListener('visibilitychange', visibility); button.removeEventListener('click', clicked); reduce.removeEventListener('change', refresh); }
  };
};
