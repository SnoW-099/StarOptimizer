window.createScanExperience = function ({ takeNova, returnNova, navigate }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'scan-dialog';
  dialog.setAttribute('aria-labelledby', 'scan-title');
  dialog.innerHTML = `<div class="scan-layout"><span class="eyebrow">STAROPTIMIZER · DIAGNÓSTICO LOCAL</span>
    <div class="scan-scene" data-stage="thinking"><div id="scan-nova-slot"></div>
      <div class="thought-cloud" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="nova-book" aria-hidden="true"><span></span><span></span></div>
      <div class="nova-bulb" aria-hidden="true"><svg viewBox="0 0 64 80"><path d="M20 48C3 33 12 9 32 9s29 24 12 39l-3 9H23Z"/><path d="M24 65h16m-13 7h10M32 0v4M5 10l6 6M59 10l-6 6M0 34h7m50 0h7"/></svg></div>
    </div><div aria-live="polite"><h2 id="scan-title">Un momento. Estoy pensando.</h2><p id="scan-description">Consultando los datos de tu equipo en Windows.</p></div>
    <div class="scan-pending"><span class="spinner"></span><span>Analizando · sin modificar tu PC</span></div>
    <div id="scan-summary" hidden></div><div class="scan-actions"><button class="button secondary" id="scan-return">Volver al equipo</button><button class="button primary" id="scan-results" hidden>Ver recomendaciones</button></div>
  </div>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector(`#${id}`);
  let readingTimer, finishingTimer, opener, running = false;
  const scene = dialog.querySelector('.scan-scene');
  const setStage = (stage, title, description) => {
    scene.dataset.stage = stage; $('scan-title').textContent = title; $('scan-description').textContent = description;
  };
  function close(destination) {
    clearTimeout(readingTimer); clearTimeout(finishingTimer);
    dialog.close(); returnNova(); opener?.focus();
    if (destination) navigate(destination);
  }
  $('scan-return').addEventListener('click', () => close());
  $('scan-results').addEventListener('click', () => close('recommended'));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  return {
    open() {
      opener = document.activeElement; running = true;
      clearTimeout(readingTimer); clearTimeout(finishingTimer);
      $('scan-summary').hidden = true; $('scan-results').hidden = true;
      dialog.querySelector('.scan-pending').hidden = false;
      $('scan-return').textContent = 'Seguir en segundo plano';
      setStage('thinking', 'Un momento. Estoy pensando.', 'Consultando los datos de tu equipo en Windows.');
      dialog.showModal(); takeNova($('scan-nova-slot')); $('scan-return').focus();
      readingTimer = setTimeout(() => { if (running && dialog.open) setStage('reading', 'Leyendo tu equipo.', 'Windows sigue reuniendo la información. El tiempo depende del equipo.'); }, 1800);
    },
    complete(s, items) {
      running = false; clearTimeout(readingTimer);
      if (!dialog.open) return;
      dialog.querySelector('.scan-pending').hidden = true;
      setStage('idea', 'Ya tengo los resultados.', 'Preparando el resumen de las lecturas recibidas.');
      $('scan-return').textContent = 'Volver al equipo';
      finishingTimer = setTimeout(() => {
        if (!dialog.open) return;
        setStage('done', s.errors.length ? 'Finalizado con lecturas pendientes.' : 'Análisis finalizado.', 'Tu PC sigue tal como estaba. Tú decides el siguiente paso.');
        const summary = $('scan-summary'); summary.replaceChildren(); summary.hidden = false;
        const heading = document.createElement('strong');
        heading.textContent = items.length ? `${items.length} puntos para revisar, por prioridad` : 'Sin recomendaciones prioritarias en esta lectura';
        summary.append(heading);
        const list = document.createElement('ul');
        for (const item of items.slice(0, 3)) { const li = document.createElement('li'); li.textContent = item.title; list.append(li); }
        if (!items.length) { const li = document.createElement('li'); li.textContent = 'No se han superado los umbrales de CPU, memoria o espacio en los datos disponibles. Esto no es una prueba de salud del hardware.'; list.append(li); }
        summary.append(list); $('scan-results').hidden = false; $('scan-return').textContent = 'Volver al equipo';
      }, 900);
    },
    fail(message) {
      running = false; clearTimeout(readingTimer);
      if (!dialog.open) return;
      dialog.querySelector('.scan-pending').hidden = true;
      setStage('error', 'No se pudo completar.', message);
      $('scan-return').textContent = 'Volver y reintentar';
    }
  };
};
