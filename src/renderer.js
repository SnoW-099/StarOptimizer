const $ = id => document.getElementById(id);
const api = window.star;
const nova = window.createNova();
const novaSpace = $('nova-space');
const novaHome = document.createElement('div');
novaHome.className = 'nova-home-slot';
novaSpace.parentNode.insertBefore(novaHome, novaSpace);
novaHome.append(novaSpace);
const novaDock = document.createElement('aside');
novaDock.id = 'nova-dock';
novaDock.setAttribute('aria-label', 'Nova, tu compañera de optimización');
document.body.append(novaDock);
let snapshot, journal = [], draft = {}, token, analysisTask, operating = false, toastTimer, liveTimer, view = 'overview';
const GB = n => (Number(n) / 1073741824).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const active = e => ['pending', 'applied', 'recovering', 'recovery-needed'].includes(e.status);
const visual = {
  animations: ['Reducir animaciones de interfaz', 'Menos movimiento en aplicaciones que respetan este ajuste de Windows.'],
  menuAnimation: ['Menús más directos', 'Desactiva la transición al abrir menús compatibles.'],
  comboAnimation: ['Listas sin transiciones', 'Desactiva el efecto de apertura de las listas desplegables compatibles.']
};
const labels = {
  tuneup: ['Puesta a punto.', 'Un recorrido guiado para ajustar y comprobar el resultado.', 'PREPARAR TU PC.'],
  recommended: ['Recomendados para tu PC.', 'Una lista de prioridades basada en las lecturas disponibles.', 'EL SIGUIENTE PASO.'],
  overview: ['Todo en su sitio.', 'El estado de tu equipo y tus ajustes, en un solo lugar.', 'UN POCO MÁS SIMPLE.'],
  recommendations: ['Ajustes a tu medida.', 'Elige un perfil o prepara tus propios cambios.', 'LA FLUIDEZ EMPIEZA AQUÍ.'],
  startup: ['Un buen comienzo.', 'Menos aplicaciones al iniciar sesión, más espacio para lo que necesitas.', 'ELIGE QUIÉN TE ACOMPAÑA.'],
  processes: ['Cada recurso, a la vista.', 'Una lectura de tu equipo para decidir con información.', 'SIN CERRAR TUS PROGRAMAS.'],
  history: ['Puedes volver atrás.', 'Tus cambios y sus valores originales, guardados en este equipo.', 'TODO BAJO TU CONTROL.']
};
function toast(message) {
  $('toast-message').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 12000);
}
async function call(method, ...args) {
  if (!api) throw Error('Abre StarOptimizer como aplicación de escritorio para acceder a Windows.');
  const response = await api[method](...args);
  if (!response.ok) throw Error(response.error);
  return response.data;
}
function node(tag, text, className) {
  const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el;
}
function empty(container, message) { container.replaceChildren(node('p', message, 'empty')); }
function row(title, detail, action) {
  const el = node('div', undefined, 'row'), body = node('div');
  body.append(node('strong', title), node('p', detail)); el.append(body); if (action) el.append(action); return el;
}
function button(text, action) {
  const b = node('button', text, 'button secondary');
  b.addEventListener('click', async () => {
    if (operating) return;
    b.disabled = true; try { await action(); } catch (e) { toast(e.message); } finally { b.disabled = false; }
  }); return b;
}
let novaFlight;
function moveNova(next, from = $('nova').getBoundingClientRect()) {
  const target = next === 'overview' ? novaHome : novaDock;
  if (novaSpace.parentElement === target) return;
  novaFlight?.cancel();
  novaSpace.classList.remove('nova-travelling');
  target.append(novaSpace);
  const to = $('nova').getBoundingClientRect();
  if (!from.width || !to.width || document.body.classList.contains('simple') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.body.append(novaSpace);
  novaSpace.classList.add('nova-travelling');
  const pose = rect => `translate3d(${rect.left}px,${rect.top}px,0) scale(${rect.width / 223})`;
  const flight = novaSpace.animate([
    { transform: pose(from) },
    { transform: pose(to) }
  ], { duration: 1050, easing: 'cubic-bezier(.4,0,.18,1)', fill: 'both' });
  novaFlight = flight;
  flight.finished.then(() => {
    if (novaFlight !== flight) return;
    target.append(novaSpace); novaSpace.classList.remove('nova-travelling');
    flight.cancel(); novaFlight = null;
  }).catch(() => {});
}
function show(next) {
  if (operating || !labels[next]) return;
  if (next === 'recommended' && !snapshot) return;
  const previousNovaPosition = $('nova').getBoundingClientRect();
  view = next;
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== view);
  moveNova(view, previousNovaPosition);
  nova.context({ visible: true });
  document.querySelectorAll('.nav').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
    if (el.dataset.view === view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  [$('title').textContent, $('subtitle').textContent, $('eyebrow').textContent] = labels[view];
  window.scrollTo({ top: 0 });
  if (view === 'history') loadHistory();
  scheduleLive();
}
function isLocked(key) { return !journal || journal.some(e => active(e) && (e.status !== 'applied' || e.changes.some(c => c.key === key && c.state !== 'restored'))); }
function selection() {
  if (!snapshot) return {};
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== snapshot.configuration.values[key] && !isLocked(key)));
}
function selectionCount() {
  const count = Object.keys(selection()).length;
  $('selection-count').textContent = count ? `${count} ${count === 1 ? 'ajuste preparado' : 'ajustes preparados'}` : 'Sin cambios';
  $('selection-summary').textContent = !journal ? 'El historial no está disponible. Resuelve el error antes de modificar ajustes.' : !snapshot ? 'Analiza tu PC para ver los ajustes compatibles.' : journal.some(e => active(e) && e.status !== 'applied') ? 'Hay una recuperación pendiente. Ábrela en Historial antes de continuar.' : count ? 'El siguiente paso muestra los valores actuales y los nuevos, antes de aplicar nada.' : 'Tu selección coincide con Windows. Elige un perfil o marca los ajustes que quieras preparar.';
  $('review').disabled = !count || !journal || operating;
}
function renderConfiguration() {
  const select = $('power-select'); select.replaceChildren();
  if (!snapshot) { select.append(node('option', 'Analiza para ver los planes')); select.disabled = true; selectionCount(); return; }
  const { plans, values } = snapshot.configuration;
  if (!plans.length) { const opt = node('option', 'No disponible en este equipo'); opt.value = ''; select.append(opt); }
  for (const plan of plans) {
    const duplicate = plans.filter(p => p.name === plan.name).length > 1;
    const opt = node('option', `${plan.name}${duplicate ? ` · ${plan.id.slice(0, 8)}` : ''}${plan.active ? ' · actual' : ''}`);
    opt.value = plan.id; select.append(opt);
  }
  select.value = draft.power || values.power || '';
  select.disabled = !plans.length || isLocked('power');
  $('power-note').textContent = isLocked('power') ? 'Restaura el cambio anterior desde Historial para elegir otro plan.' : snapshot.onBattery ? 'Estás usando batería. Un plan exigente puede reducir la autonomía.' : 'Solo activamos planes existentes. Sus valores internos no se modifican.';
  const container = $('visual-options'); container.replaceChildren();
  for (const [key, [title, detail]] of Object.entries(visual)) {
    const unavailable = typeof values[key] !== 'boolean';
    const locked = isLocked(key);
    const label = node('label', undefined, `visual-option${unavailable ? ' unavailable' : ''}`);
    const input = node('input'); input.type = 'checkbox'; input.id = `option-${key}`;
    input.checked = (draft[key] ?? values[key]) === false;
    input.disabled = unavailable || locked || values[key] === false;
    const copy = node('span'); copy.append(node('strong', title), node('small', detail), node('em', unavailable ? 'No disponible en este equipo' : locked ? 'Guardado en Historial · puedes restaurarlo' : values[key] === false ? 'Ya está desactivada en Windows' : 'Ahora está activada en Windows'));
    input.addEventListener('change', () => { draft[key] = !input.checked; clearProfile(); selectionCount(); });
    label.append(input, copy); container.append(label);
  }
  selectionCount();
}
function clearProfile() { document.querySelectorAll('.profile').forEach(b => b.classList.remove('selected')); }
async function prepareProfile(profile) {
  if (operating) return;
  if (!snapshot && !await analyze()) return;
  draft = {}; clearProfile();
  const { plans, values } = snapshot.configuration;
  if (profile === 'fluid') {
    for (const key of Object.keys(visual)) if (values[key] === true && !isLocked(key)) draft[key] = false;
  } else {
    const id = profile === 'daily' ? '381b4222-f694-41f0-9685-ff5bb260df2e' : '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
    const plan = plans.find(p => p.id === id) || plans.find(p => profile === 'daily' ? /^(equilibrado|balanced)$/i.test(p.name) : /^(alto rendimiento|high performance)$/i.test(p.name));
    if (!plan) toast('Este perfil no tiene un plan compatible en tu equipo. Puedes elegir uno de los planes disponibles.');
    else if (isLocked('power')) toast('Restaura primero el cambio de energía anterior desde Historial.');
    else draft.power = plan.id;
    if (profile === 'performance' && snapshot.onBattery) toast('Estás usando batería. Revisa el consumo y conecta el cargador antes de usar un plan exigente.');
  }
  document.querySelector(`[data-profile="${profile}"]`).classList.add('selected');
  renderConfiguration();
  if (!Object.keys(selection()).length) toast('No hay cambios nuevos para este perfil. Los ajustes ya coinciden, no están disponibles o tienen una restauración pendiente.');
}
function valueLabel(change, which) {
  if (change[`${which}Label`]) return change[`${which}Label`];
  const value = change[which];
  return typeof value === 'boolean' ? value ? 'Activadas' : 'Desactivadas' : snapshot?.configuration.plans.find(p => p.id === value)?.name || value;
}
async function loadHistory() {
  try {
    journal = await call('history');
    const container = $('history-list'); container.replaceChildren();
    if (!journal.length) empty(container, 'Todavía no has hecho cambios. Cuando los hagas, tendrás aquí un camino de vuelta.');
    for (const entry of journal) {
      const pending = active(entry), failed = pending && entry.status !== 'applied';
      const article = node('article', undefined, 'history-entry'), top = node('div', undefined, 'history-top');
      const status = { applied: 'Aplicado y verificado', restored: 'Restaurado', 'rolled-back': 'Recuperado automáticamente', pending: 'Operación interrumpida', recovering: 'Restauración interrumpida', 'recovery-needed': 'Requiere recuperación' };
      top.append(node('strong', entry.title), node('span', status[entry.status], `tag${failed ? ' warning' : ''}`));
      article.append(top, node('p', new Date(entry.at).toLocaleString('es-ES')));
      const changes = node('div', undefined, 'history-changes');
      for (const change of entry.changes) changes.append(node('span', `${change.label || change.key} · ${valueLabel(change, 'before')} → ${valueLabel(change, 'after')}${change.state === 'restored' ? ' · restaurado' : ''}`));
      article.append(changes);
      if (entry.errors?.length) article.append(node('p', entry.errors.join(' '), 'history-error'));
      if (pending) article.append(button(failed ? 'Reintentar recuperación' : 'Restaurar valores originales', () => performMutation('Restaurando valores originales', () => call('undo', entry.id))));
      container.append(article);
    }
    $('history-dot').hidden = !journal.some(active);
  } catch (e) { journal = null; empty($('history-list'), e.message); $('history-dot').hidden = false; }
  renderConfiguration();
}
function metric(id, value, unit) { const el = $(id); el.replaceChildren(document.createTextNode(`${value} `), node('em', unit)); }
function renderTelemetry(cpu, memory) {
  metric('cpu-value', cpu === null ? '—' : cpu, '%'); $('cpu-bar').value = cpu ?? 0;
  const used = memory.total - memory.free;
  metric('memory-value', GB(used), 'GB'); $('memory-bar').value = used / memory.total * 100;
  $('memory-detail').textContent = `${GB(memory.total)} GB en total · ${GB(memory.free)} GB disponibles`;
}
function filterLists() {
  if (!snapshot) return;
  const list = $('process-list'); list.replaceChildren();
  const query = $('process-search').value.trim().toLocaleLowerCase('es');
  snapshot.processes.filter(p => p.ProcessName.toLocaleLowerCase('es').includes(query)).forEach(p => list.append(row(p.ProcessName, `${p.Count} ${p.Count === 1 ? 'proceso' : 'procesos'} · memoria residente`, node('span', `${Math.round(p.WorkingSet64 / 1048576).toLocaleString('es-ES')} MB`))));
  if (!list.children.length) empty(list, snapshot.errors.includes('processes') ? 'Windows no permitió consultar los procesos.' : 'No hay procesos que coincidan con la búsqueda.');
  const startup = $('startup-list'); startup.replaceChildren();
  const startupQuery = $('startup-search').value.trim().toLocaleLowerCase('es');
  snapshot.startup.filter(p => p.Name.toLocaleLowerCase('es').includes(startupQuery)).forEach(p => startup.append(row(p.Name, p.Location, node('span', 'Revisar en Windows'))));
  if (!startup.children.length) empty(startup, snapshot.errors.includes('startup') ? 'Windows no permitió consultar el inicio.' : 'No hay entradas que coincidan con la búsqueda.');
}
function render() {
  const s = snapshot, cpu = s.cpu[0]?.LoadPercentage ?? null;
  renderTelemetry(cpu, s.memory);
  $('cpu-detail').textContent = s.cpu[0]?.Name || 'Windows no proporcionó datos'; $('cpu-detail').title = $('cpu-detail').textContent;
  const total = s.disks.reduce((n, d) => n + Number(d.Size || 0), 0), free = s.disks.reduce((n, d) => n + Number(d.FreeSpace || 0), 0);
  metric('disk-value', total ? GB(free) : '—', 'GB'); $('disk-bar').value = total ? free / total * 100 : 0;
  $('disk-detail').textContent = total ? `Libres de ${GB(total)} GB · ${s.disks.length} unidades` : 'Windows no proporcionó datos';
  $('last-scan').textContent = `Última lectura completa · ${new Date(s.at).toLocaleTimeString('es-ES')}`;
  $('hero-description').textContent = s.errors.length ? 'Hay lecturas que Windows no ha podido completar. Revisa los resultados disponibles o vuelve a analizar.' : 'Ya conozco un poco mejor tu equipo. Vamos a elegir los ajustes que encajan contigo.';
  $('scan-status').textContent = s.errors.length ? 'Análisis parcial · Revisa los detalles en Optimizar' : 'Análisis completado. Ningún ajuste modificado por el análisis.';
  $('machine-status').textContent = s.onBattery ? '◦ Usando batería' : '◦ Conectado a la corriente';
  $('go-optimize').hidden = false;
  $('startup-summary').textContent = `${s.startup.length} entradas reportadas por Windows.`;
  const disks = $('disk-list'); disks.replaceChildren();
  s.disks.forEach(d => disks.append(row(d.DeviceID, `${GB(d.FreeSpace)} GB libres de ${GB(d.Size)} GB`, node('span', Number(d.Size) ? `${Math.round(d.FreeSpace / d.Size * 100)} % libre` : 'No disponible'))));
  if (!s.disks.length) empty(disks, 'No se pudieron consultar las unidades.');
  const hardware = $('hardware-list'); hardware.replaceChildren(row(s.cpu[0]?.Name || 'Procesador no disponible', `${s.platform} · ${Math.floor(s.uptime / 3600)} h desde el último arranque`));
  s.gpu.forEach(g => hardware.append(row(g.Name, `Controlador ${g.DriverVersion || 'no disponible'}`)));
  const insights = $('insights'); insights.replaceChildren();
  let signals = 0;
  if ((s.memory.total - s.memory.free) / s.memory.total > .85) { signals++; insights.append(row('La memoria está bastante ocupada', 'Más del 85 % en esta lectura. Revisa las apps con mayor consumo y guarda tu trabajo antes de cerrar las que no necesites.', button('Ver recursos', () => show('processes')))); }
  if (cpu !== null && cpu > 80) { signals++; insights.append(row('La CPU está trabajando mucho', 'Más del 80 % en esta muestra. Repite el análisis cuando terminen las tareas actuales; un pico aislado es normal.')); }
  s.disks.filter(d => d.Size > 0 && d.FreeSpace / d.Size < .15).forEach(d => { signals++; insights.append(row(`Poco espacio en ${d.DeviceID}`, 'Menos del 15 % libre. Considera mover archivos que conozcas a otra unidad. StarOptimizer no los borra.', button('Ver unidades', () => show('processes')))); });
  if (!signals) insights.append(row('Sin presión alta en las lecturas disponibles', 'No se detectan los umbrales de uso alto de CPU, RAM o poco espacio en esta muestra. No es una prueba de salud del hardware.', node('span', 'Sin alertas')));
  if (s.startup.length) insights.append(row('Revisa lo que arranca contigo', `${s.startup.length} entradas en el inventario. Confirma cuáles están activadas en Windows antes de decidir.`, button('Revisar inicio', () => show('startup'))));
  const missing = { cpu: 'CPU', disks: 'discos', processes: 'procesos', startup: 'inicio', plans: 'energía', gpu: 'GPU', configuration: 'algunos ajustes de Windows' };
  if (s.errors.length) insights.append(row('Lecturas incompletas', `No disponibles: ${s.errors.map(k => missing[k] || k).join(', ')}. No se asume que estos componentes estén bien ni mal.`));
  $('recommendation-summary').textContent = signals ? `${signals} ${signals === 1 ? 'señal para revisar' : 'señales para revisar'} · Tú decides el siguiente paso.` : 'Tu diagnóstico y los ajustes compatibles.';
  filterLists(); renderConfiguration();
}
const scanExperience = window.createScanExperience({
  takeNova(slot) {
    novaFlight?.cancel(); novaFlight = null;
    novaSpace.classList.remove('nova-travelling'); slot.append(novaSpace);
  },
  returnNova() { (view === 'overview' ? novaHome : novaDock).append(novaSpace); },
  navigate: show
});
function renderPriorities() {
  const items = window.starPriorities(snapshot);
  const nav = document.querySelector('[data-view="recommended"]');
  nav.disabled = !snapshot; nav.title = snapshot ? 'Ver las prioridades del último análisis' : 'Analiza tu equipo primero';
  $('priority-date').textContent = `Lectura del ${new Date(snapshot.at).toLocaleString('es-ES')}${snapshot.errors.length ? ' · datos parciales' : ''}. Vuelve a analizar si ha cambiado la carga de tu equipo.`;
  const list = $('priority-list'); list.replaceChildren();
  for (const item of items) {
    const li = node('li', undefined, 'priority-item');
    const body = node('div');
    body.append(node('span', ['Lecturas pendientes', 'Prioridad alta', 'Comprobar carga', 'Revisión opcional'][item.priority], 'tag'), node('h3', item.title), node('p', item.evidence));
    li.append(body, button(item.action, () => item.view === 'scan' ? analyze(true) : show(item.view))); list.append(li);
  }
  if (!items.length) list.append(node('li', 'Sin acciones prioritarias según los datos disponibles. No hace falta modificar ajustes por modificar.', 'empty'));
  return items;
}
async function performAnalysis(interactive = false) {
  let completed = false;
  $('toast').hidden = true;
  if (interactive) scanExperience.open();
  $('scan').disabled = true; $('scan').textContent = 'Analizando…';
  document.body.classList.add('scanning'); nova.working(true);
  $('scan-status').textContent = 'Consultando Windows. Puede tardar unos segundos.';
  clearTimeout(liveTimer);
  try {
    snapshot = await call('scan');
    for (const key of Object.keys(draft)) if (snapshot.configuration.values[key] == null || key === 'power' && !snapshot.configuration.plans.some(p => p.id === draft[key])) delete draft[key];
    render(); tuneup.update(snapshot); const priorities = renderPriorities(); await loadHistory(); completed = snapshot.errors.length === 0;
    if (interactive) scanExperience.complete(snapshot, priorities);
    return true;
  } catch (e) { $('scan-status').textContent = 'No se pudo completar el análisis. Puedes reintentarlo.'; if (interactive) scanExperience.fail(e.message); toast(e.message); return false; }
  finally {
    $('scan').disabled = false; $('scan').textContent = 'Volver a analizar ↻';
    document.body.classList.remove('scanning');
    if (!operating) { nova.working(false); nova.react(completed ? 'success' : 'error'); }
    scheduleLive();
  }
}
function analyze(interactive = false) {
  if (!analysisTask) analysisTask = performAnalysis(interactive === true).finally(() => analysisTask = null);
  return analysisTask;
}
function setOperating(value, title = '') {
  operating = value; document.body.classList.toggle('operation-active', value);
  nova.working(value);
  document.querySelector('main').inert = value; document.querySelector('.rail').inert = value;
  $('operation').hidden = !value; $('operation-title').textContent = title;
  clearTimeout(liveTimer); if (!value) scheduleLive();
}
async function performMutation(title, task) {
  if (operating) return;
  setOperating(true, title);
  let failure, restored = false;
  try { if (analysisTask) await analysisTask; const result = await task(); restored = Boolean(result.restored); toast(result.restored ? 'Valores originales restaurados y verificados.' : `${result.changed} ajustes aplicados y verificados. Puedes restaurarlos desde Historial.`); }
  catch (e) { failure = e; }
  finally {
    draft = {}; clearProfile();
    await analyze(); await loadHistory(); setOperating(false);
    nova.react(failure ? 'error' : restored ? 'restore' : 'success');
    if (failure) { toast(failure.message); show('history'); }
  }
}
async function review() {
  if (operating) return;
  $('review').disabled = true;
  try {
    const prepared = await call('preview', selection());
    if (!prepared.changes.length) return toast('Los ajustes ya coinciden con Windows. No hace falta cambiar nada.');
    token = prepared.token;
    $('review-list').replaceChildren(...prepared.changes.map(c => row(c.label, `${c.beforeLabel} → ${c.afterLabel}`)));
    $('review-warning').textContent = prepared.changes.some(c => c.key === 'power') ? `${snapshot.onBattery ? 'Estás usando batería. ' : ''}Cambiar la energía puede aumentar consumo, temperatura y ruido. No garantiza más FPS.` : 'Se reduce el movimiento de controles compatibles. El efecto depende de cada aplicación y no mejora necesariamente el rendimiento de los juegos.';
    $('confirm-apply').textContent = `Aplicar ${prepared.changes.length} ${prepared.changes.length === 1 ? 'ajuste' : 'ajustes'}`;
    $('review-dialog').showModal();
  } catch (e) { toast(e.message); }
  finally { selectionCount(); }
}
function scheduleLive() {
  clearTimeout(liveTimer);
  if (!$('live').checked || document.hidden || view !== 'overview' || operating) { $('live-status').textContent = $('live').checked ? 'en pausa' : 'cada 5 s'; return; }
  $('live-status').textContent = 'CPU y RAM · cada 5 s';
  liveTimer = setTimeout(async () => {
    try {
      if (!analysisTask && !operating && !document.hidden && view === 'overview' && $('live').checked) {
        const data = await call('telemetry');
        if ($('live').checked && !document.hidden && view === 'overview' && !operating) { renderTelemetry(data.cpu, data.memory); $('live-status').textContent = `CPU y RAM · ${new Date(data.at).toLocaleTimeString('es-ES')}`; }
      }
    } catch (e) { $('live').checked = false; toast(e.message); }
    finally { scheduleLive(); }
  }, 5000);
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
document.querySelectorAll('[data-profile]').forEach(b => b.addEventListener('click', () => prepareProfile(b.dataset.profile)));
document.querySelectorAll('[data-settings]').forEach(b => b.addEventListener('click', async () => { try { await call('settings', b.dataset.settings); } catch (e) { toast(e.message); } }));
for (const id of ['scan', 'refresh-analysis', 'refresh-processes']) $(id).addEventListener('click', () => analyze(true));
$('power-select').addEventListener('change', () => { draft.power = $('power-select').value; clearProfile(); selectionCount(); });
$('reset-selection').addEventListener('click', () => { draft = {}; clearProfile(); renderConfiguration(); });
$('review').addEventListener('click', review);
for (const id of ['cancel-review', 'close-review']) $(id).addEventListener('click', () => { token = null; $('review-dialog').close(); });
$('review-dialog').addEventListener('cancel', () => token = null);
$('confirm-apply').addEventListener('click', async () => {
  if (!token || operating) return;
  const approvedToken = token; token = null; $('review-dialog').close();
  await performMutation('Aplicando y verificando ajustes', () => call('apply', approvedToken));
});
for (const id of ['startup-search', 'process-search']) $(id).addEventListener('input', filterLists);
$('live').addEventListener('change', scheduleLive);
$('dismiss-toast').addEventListener('click', () => $('toast').hidden = true);
$('export').addEventListener('click', async () => { try { if (await call('export')) toast('Diagnóstico guardado. Incluye procesos, inicio e historial. Revísalo antes de compartirlo.'); } catch (e) { toast(e.message); } });
function appearance(simple) {
  nova.context({ simple });
  document.body.classList.toggle('simple', simple); $('appearance').setAttribute('aria-pressed', String(simple));
  $('appearance').querySelector('span').textContent = simple ? 'Sencilla' : 'Cristal';
  $('appearance').title = simple ? 'Volver a la apariencia de cristal' : 'Usar apariencia sencilla, con menos efectos';
  try { localStorage.setItem('star-simple', String(simple)); } catch { /* Appearance remains usable without storage. */ }
}
$('appearance').addEventListener('click', () => appearance(!document.body.classList.contains('simple')));
try { appearance(localStorage.getItem('star-simple') === 'true'); } catch { /* Default appearance. */ }
function theme(dark) {
  document.body.classList.toggle('dark', dark);
  $('theme').setAttribute('aria-pressed', String(dark));
  const label = dark ? 'Activar modo claro' : 'Activar modo oscuro';
  $('theme').title = label; $('theme').setAttribute('aria-label', label);
  try { localStorage.setItem('star-dark', String(dark)); } catch { /* Theme remains usable without storage. */ }
}
$('theme').addEventListener('click', () => theme(!document.body.classList.contains('dark')));
try { theme(localStorage.getItem('star-dark') === 'true'); } catch { /* Default light theme. */ }
document.addEventListener('visibilitychange', () => { document.body.classList.toggle('paused', document.hidden); scheduleLive(); });
api?.onBusyClose(() => toast('Estamos verificando un cambio. Espera a que termine antes de cerrar la app.'));
loadHistory();
const tuneup = window.createTuneup({ call, analyze, show, hasSnapshot: () => Boolean(snapshot),
  begin() { clearTimeout(liveTimer); document.querySelectorAll('main>*, .rail').forEach(el => { if(el.id !== 'tuneup') el.inert = true; }); },
  end() { document.querySelectorAll('main>*, .rail').forEach(el => el.inert = false); scheduleLive(); }
});
