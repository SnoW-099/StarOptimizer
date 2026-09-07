const $ = id => document.getElementById(id);
const api = window.star;
let snapshot, journal = [], toastTimer;
const GB = n => (Number(n) / 1073741824).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const labels = { overview: ['Un buen día para tu PC.', 'Conoce tu equipo. Mejora lo que importa.', 'Vista general'], recommendations: ['Ajustes con sentido.', 'Elige cada cambio con la información por delante.', 'Optimización'], startup: ['Empieza más ligero.', 'Decide qué aplicaciones necesitas al encender tu equipo.', 'Inicio de Windows'], processes: ['Mira qué está trabajando.', 'Una fotografía real del uso de memoria de tus aplicaciones.', 'Procesos'], history: ['Siempre puedes volver.', 'Consulta y restaura los cambios de energía de StarOptimizer.', 'Historial de cambios'] };
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 9000); }
async function call(method, ...args) {
  if (!api) throw Error('Abre StarOptimizer como aplicación de escritorio para acceder a Windows.');
  const response = await api[method](...args);
  if (!response.ok) throw Error(response.error);
  return response.data;
}
function show(view) {
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== view);
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  [$('title').textContent, $('subtitle').textContent, $('breadcrumb').textContent] = labels[view];
  if (view === 'history') loadHistory();
}
function row(title, detail, action) {
  const el = document.createElement('div'); el.className = 'row';
  const body = document.createElement('div'), strong = document.createElement('strong'), p = document.createElement('p');
  strong.textContent = title; p.textContent = detail; body.append(strong, p); el.append(body);
  if (action) el.append(action);
  return el;
}
function empty(container, message) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = message; container.replaceChildren(p); }
function badge(text) { const s = document.createElement('span'); s.textContent = text; return s; }
function button(text, action) {
  const b = document.createElement('button'); b.className = 'button secondary'; b.textContent = text;
  b.addEventListener('click', async () => { b.disabled = true; try { await action(); } catch (e) { toast(e.message); } finally { b.disabled = false; } });
  return b;
}
async function loadHistory() {
  try {
    journal = await call('history');
    const container = $('history-list'); container.replaceChildren();
    if (!journal.length) empty(container, 'Sin cambios todavía. Tu configuración sigue tal como estaba.');
    journal.forEach(entry => {
      const restored = entry.status === 'restored';
      container.append(row(restored ? 'Plan original restaurado' : entry.status === 'applied' ? 'Plan de energía modificado' : 'Cambio pendiente de verificar', `${new Date(entry.at).toLocaleString('es-ES')} · Plan original: ${entry.before}`, restored ? badge('Restaurado ✓') : button('Restaurar original', async () => { await call('undo', entry.id); toast('Plan original restaurado y verificado.'); await loadHistory(); await analyze(); })));
    });
    renderPlans();
  } catch (e) { empty($('history-list'), e.message); journal = null; renderPlans(); }
}
function renderPlans() {
  if (!snapshot) return;
  const container = $('plans'); container.replaceChildren();
  const pending = !journal || journal.some(x => ['pending', 'applied', 'undoing'].includes(x.status));
  if (!snapshot.plans.length) empty(container, 'No se pudieron consultar los planes de energía.');
  snapshot.plans.forEach(plan => {
    const action = plan.active ? badge('Activo ✓') : button(pending ? 'Restaura desde Historial' : 'Elegir plan', async () => {
      if (pending) return show('history');
      try {
        const result = await call('apply', plan.id);
        if (result) { toast('Cambio aplicado y verificado. Puedes deshacerlo desde Historial.'); await analyze(); }
      } finally { await loadHistory(); }
    });
    container.append(row(plan.name, plan.active ? 'Tu plan de energía actual.' : 'Solo se activa este plan; no se editan sus valores.', action));
  });
}
function render() {
  const s = snapshot;
  const samples = s.cpu.map(x => x.LoadPercentage).filter(x => typeof x === 'number');
  const cpu = samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null;
  $('cpu-value').textContent = cpu === null ? 'No disponible' : `${cpu} %`;
  $('cpu-bar').value = cpu || 0; $('cpu-detail').textContent = s.cpu.map(x => x.Name).join(' · ') || 'Windows no proporcionó datos';
  $('cpu-detail').title = $('cpu-detail').textContent;
  const used = s.memory.total - s.memory.free;
  $('memory-value').textContent = `${GB(used)} GB`; $('memory-bar').value = used / s.memory.total * 100;
  $('memory-detail').textContent = `${GB(s.memory.total)} GB en total · ${GB(s.memory.free)} GB disponibles`;
  const total = s.disks.reduce((n, d) => n + Number(d.Size || 0), 0), free = s.disks.reduce((n, d) => n + Number(d.FreeSpace || 0), 0);
  $('disk-value').textContent = total ? `${GB(free)} GB` : 'No disponible'; $('disk-bar').value = total ? (total - free) / total * 100 : 0;
  $('disk-detail').textContent = total ? `Libres de ${GB(total)} GB · ${s.disks.length} unidades` : 'Windows no proporcionó datos';
  $('last-scan').textContent = `Última lectura · ${new Date(s.at).toLocaleTimeString('es-ES')}`;
  $('hero-description').textContent = s.errors.length ? 'Análisis parcial. Algunas lecturas no están disponibles; puedes volver a intentarlo.' : 'Ya tenemos una foto de tu equipo. Revisa sus recursos y elige qué quieres mejorar.';
  $('scan-status').textContent = s.errors.length ? `No disponible: ${s.errors.join(', ')}` : 'Análisis completado · Ningún ajuste modificado';
  const processes = $('process-list'); processes.replaceChildren();
  s.processes.forEach(p => processes.append(row(p.ProcessName, `PID ${p.Id}`, badge(`${Math.round(p.WorkingSet64 / 1048576).toLocaleString('es-ES')} MB`))));
  if (!s.processes.length) empty(processes, 'No hay datos de procesos disponibles.');
  const startup = $('startup-list'); startup.replaceChildren();
  s.startup.forEach(p => startup.append(row(p.Name, p.Location, badge('Revisar en Windows'))));
  if (!s.startup.length) empty(startup, s.errors.includes('startup') ? 'Windows no permitió consultar el inicio.' : 'Windows no reportó entradas mediante este inventario.');
  const disks = $('disk-list'); disks.replaceChildren();
  s.disks.forEach(d => disks.append(row(d.DeviceID, `${GB(d.FreeSpace)} GB libres de ${GB(d.Size)} GB`, badge(Number(d.Size) ? `${Math.round(d.FreeSpace / d.Size * 100)} % libre` : 'No disponible'))));
  if (!s.disks.length) empty(disks, 'No se pudieron consultar las unidades.');
  const insights = $('insights'); insights.replaceChildren();
  if (used / s.memory.total > .85) insights.append(row('La memoria está bastante ocupada', 'Se utiliza más del 85 % de la RAM. Revisa los procesos y cierra solo apps que reconozcas, después de guardar tu trabajo.', button('Ver procesos', () => show('processes'))));
  if (cpu !== null && cpu > 80) insights.append(row('La CPU está trabajando mucho', 'Esta lectura supera el 80 %. Espera a que terminen las tareas actuales y repite el análisis; un pico aislado puede ser normal.'));
  s.disks.filter(d => Number(d.Size) > 0 && d.FreeSpace / d.Size < .15).forEach(d => insights.append(row(`Poco espacio libre en ${d.DeviceID}`, 'Queda menos del 15 % de espacio. Revisa qué necesitas y considera mover archivos a otra unidad. StarOptimizer no los borra.', button('Ver unidades', () => show('processes')))));
  if (s.startup.length > 0) insights.append(row(`${s.startup.length} entradas de inicio para revisar`, 'No todas tienen por qué estar habilitadas. Comprueba en Windows las aplicaciones que no necesitas al iniciar sesión.', button('Revisar inicio', () => show('startup'))));
  if (s.errors.length) insights.append(row('Diagnóstico incompleto', 'Algunas consultas no están disponibles. Repite el análisis antes de sacar conclusiones.'));
  if (!insights.children.length) insights.append(row('Sin alertas en estas lecturas', 'No se detecta presión alta de CPU, RAM o espacio en esta muestra. Esto no es una comprobación de salud del hardware.'));
  renderPlans();
}
async function analyze() {
  $('scan').disabled = true; $('scan').textContent = 'Analizando tu equipo…'; document.body.classList.add('scanning');
  $('scan-status').textContent = 'Consultando Windows. Puede tardar unos segundos…';
  try { snapshot = await call('scan'); render(); }
  catch (e) { $('scan-status').textContent = 'No se pudo completar el análisis. Inténtalo de nuevo.'; toast(e.message); }
  finally { $('scan').disabled = false; $('scan').textContent = '✧ Volver a analizar →'; document.body.classList.remove('scanning'); }
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
document.querySelectorAll('[data-settings]').forEach(b => b.addEventListener('click', async () => { try { await call('settings', b.dataset.settings); } catch (e) { toast(e.message); } }));
$('scan').addEventListener('click', analyze);
$('export').addEventListener('click', async () => { try { if (await call('export')) toast('Diagnóstico guardado. Contiene nombres de procesos y entradas de inicio; revísalo antes de compartirlo.'); } catch (e) { toast(e.message); } });
loadHistory();
