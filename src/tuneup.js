window.createTuneup = function ({ call, analyze, show, hasSnapshot, begin, end }) {
  const section = document.createElement('section'); section.id = 'tuneup'; section.className = 'view'; section.hidden = true;
  section.innerHTML = `<div class="panel glass"><span class="tag">Preparar · medir · ajustar · comparar</span><h2>Una puesta a punto con criterio.</h2><p class="panel-description">Usa la misma carga antes y después: mismas aplicaciones, mismo cargador y unos minutos tras arrancar. La medición observa CPU y RAM; no mide FPS, temperaturas ni velocidad de arranque.</p>
  <div class="setup-steps">
  <article><span>01</span><h3>Conocer el equipo</h3><p>Analiza y revisa Recomendados. Si hay avisos de disco, protege los archivos primero.</p><button class="button secondary" id="setup-scan">Analizar equipo</button></article>
  <article><span>02</span><h3>Guardar el antes</h3><p>Deja el equipo en reposo o abre la tarea que quieras comparar. Mantén esa misma situación después.</p><button class="button secondary" id="measure-before">Medir antes · ~12 s</button></article>
  <article><span>03</span><h3>Reducir lo innecesario</h3><p>Revisa las apps de inicio que reconoces. Conserva seguridad, audio y dispositivos. Windows confirma cuáles están activadas.</p><button class="button secondary" id="setup-startup">Revisar inicio</button></article>
  <article><span>04</span><h3>Elegir ajustes</h3><p>Prepara el perfil adecuado, revisa los cambios y aplícalos. Historial permite restaurarlos.</p><button class="button secondary" id="setup-profile">Preparar perfil</button></article>
  <article><span>05</span><h3>Comprobar Windows</h3><p>Revisa actualizaciones y preferencias gráficas. Los reinicios y las instalaciones se deciden en Windows.</p><button class="button secondary" id="setup-update">Windows Update ↗</button><button class="text-button" id="setup-display">Preferencias de GPU ↗</button></article>
  <article><span>06</span><h3>Comparar el después</h3><p>Tras los cambios y, si procede, reiniciar, repite la misma tarea. El antes se conserva en este PC.</p><button class="button primary" id="measure-after">Medir después · ~12 s</button></article></div>
  <p id="measurement-status" role="status" aria-live="polite"></p><div id="measurement-results"></div>
  <button class="button secondary" id="setup-export">Guardar diagnóstico y mediciones</button><button class="text-button" id="setup-history">Ver cambios y restaurar</button></div>
  <div class="panel glass"><h3>Estado de las unidades</h3><p class="panel-description">Estado comunicado por Windows. «Sin avisos» no garantiza que una unidad esté perfecta. Algunos controladores no exponen esta información.</p><div id="physical-disks" class="rows"><p class="empty">Analiza el equipo para consultar las unidades.</p></div><p class="micro">Temperaturas de CPU/GPU y estabilidad bajo carga: no evaluadas por esta versión. Si sigue lento, se calienta o se bloquea, hace falta revisar ese problema antes de seguir ajustando.</p></div>`;
  document.querySelector('main footer').before(section);
  const $ = id => section.querySelector(`#${id}`); let entries = [], busy = false, unavailable = false;
  const text = (tag, value) => { const el = document.createElement(tag); el.textContent = value; return el; };
  function render() {
    const index = entries.findLastIndex(e => e.kind === 'before');
    const before = entries[index]; const after = entries.slice(index+1).findLast(e => e.kind === 'after');
    $('measure-before').disabled = busy || unavailable || !hasSnapshot(); $('measure-after').disabled = busy || unavailable || !before || !hasSnapshot();
    $('measure-before').textContent = before ? 'Guardar un nuevo antes · ~12 s' : 'Medir antes · ~12 s';
    const container = $('measurement-results'); container.replaceChildren();
    if (!before) { container.append(text('p', unavailable ? 'Historial de mediciones no disponible. No se sobrescribirá.' : 'Todavía no hay una medición inicial. Analiza primero el equipo.')); return; }
    container.append(text('h3','Comparación de carga observada'));
    const table = document.createElement('table'); const heading = document.createElement('tr');
    for (const label of ['Lectura','Antes','Después']) heading.append(text('th',label)); table.append(heading);
    for (const [label, key, format] of [
      ['Fecha','at',v => new Date(v).toLocaleString('es-ES')],
      ['CPU media','cpuMean',v => `${v.toFixed(1)} %`], ['Pico de CPU','cpuPeak',v => `${v.toFixed(1)} %`],
      ['RAM ocupada media','memoryUsedMean',v => `${(v/1073741824).toFixed(2)} GB`]
    ]) { const tr = document.createElement('tr'); tr.append(text('th',label)); for(const e of [before,after]) tr.append(text('td', e ? format(key === 'at' ? e.at : e.summary[key]) : 'Pendiente')); table.append(tr); }
    container.append(table);
    if (after) {
      if (before.context.cpu !== after.context.cpu || before.summary.memoryTotal !== after.summary.memoryTotal) container.append(text('p','Ha cambiado el hardware observado. Guarda un nuevo antes para comparar.'));
      else container.append(text('p',`Diferencia de CPU media: ${(after.summary.cpuMean-before.summary.cpuMean).toFixed(1)} puntos porcentuales. Una bajada de carga no prueba una ganancia de rendimiento: comprueba que ejecutabas la misma tarea.`));
      if (before.context.onBattery !== after.context.onBattery) container.append(text('p','Cambió la alimentación entre lecturas. Repite ambas en las mismas condiciones.'));
    }
  }
  async function measure(kind) {
    if (busy || !hasSnapshot()) return;
    busy = true; begin(); section.querySelectorAll('button').forEach(b => b.disabled = true); render(); $('measurement-status').textContent = 'Midiendo CPU y RAM durante unas 12 muestras. Mantén la misma tarea y espera…';
    try { entries = await call('measure',kind); unavailable = false; $('measurement-status').textContent = 'Medición guardada en este PC. Ningún ajuste modificado por la medición.'; }
    catch(e) { $('measurement-status').textContent = e.message; }
    finally { busy = false; end(); section.querySelectorAll('button').forEach(b => b.disabled = false); render(); }
  }
  const action = fn => async () => { try { await fn(); } catch(e) { $('measurement-status').textContent = e.message; } };
  $('measure-before').onclick = () => measure('before'); $('measure-after').onclick = () => measure('after');
  $('setup-scan').onclick = () => analyze(true); $('setup-startup').onclick = () => show('startup'); $('setup-profile').onclick = () => show('recommendations'); $('setup-history').onclick = () => show('history');
  $('setup-update').onclick = action(() => call('settings','update')); $('setup-display').onclick = action(() => call('settings','display'));
  $('setup-export').onclick = action(async () => { if(await call('export')) $('measurement-status').textContent = 'Informe guardado. Incluye diagnóstico, cambios y mediciones; revísalo antes de compartirlo.'; });
  call('measurements').then(data => { entries = data; render(); }).catch(e => { unavailable = true; $('measurement-status').textContent = e.message; render(); });
  render();
  return { update(snapshot) {
    render(); const rows = $('physical-disks'); rows.replaceChildren();
    if (!snapshot.physicalDisks?.length || snapshot.errors.includes('physicalDisks')) { rows.append(text('p','Estado no disponible. No se asume que las unidades estén bien o mal.')); return; }
    for (const disk of snapshot.physicalDisks) {
      const row = document.createElement('div'); row.className = 'row'; const body = document.createElement('div');
      body.append(text('strong',disk.Name),text('p',`${disk.MediaType || 'Tipo no disponible'} · ${(disk.Size/1073741824).toFixed(0)} GB · ${disk.OperationalStatus || 'Estado operativo no disponible'}`));
      row.append(body,text('span',({ Healthy:'Sin avisos reportados', Warning:'Aviso de Windows', Unhealthy:'Estado degradado', Unknown:'Desconocido' })[disk.HealthStatus] || 'No disponible')); rows.append(row);
    }
  } };
};
