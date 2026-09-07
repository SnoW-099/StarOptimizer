const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const GUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const labels = { power: 'Plan de energía', animations: 'Animaciones de interfaz', menuAnimation: 'Animaciones de menús', comboAnimation: 'Animaciones de listas' };
const active = entry => ['pending', 'applied', 'recovering', 'recovery-needed'].includes(entry.status);
const valid = (key, value) => key === 'power' ? typeof value === 'string' && GUID.test(value) : Object.hasOwn(labels, key) && typeof value === 'boolean';
function createOptimizer(directory, adapter, now = Date.now) {
  const file = path.join(directory, 'optimization-journal.json');
  const tokens = new Map();
  let busy = false;
  async function save(entries) {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(file + '.tmp', JSON.stringify(entries, null, 2), { encoding: 'utf8', flush: true });
    await fs.rename(file + '.tmp', file);
  }
  async function history() {
    try {
      let data;
      try { data = JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        try {
          const legacy = JSON.parse(await fs.readFile(path.join(directory, 'energy-journal.json'), 'utf8'));
          data = legacy.map(e => ({ id: e.id, at: e.at, title: 'Plan de energía · versión anterior', status: e.status === 'undoing' ? 'recovering' : e.status, changes: [{ key: 'power', label: labels.power, before: e.before, after: e.after, state: e.status === 'restored' ? 'restored' : 'writing' }] }));
        } catch (legacyError) { if (legacyError.code === 'ENOENT') return []; throw legacyError; }
      }
      if (!Array.isArray(data) || data.some(e => !e || !GUID.test(e.id) || !Number.isFinite(Date.parse(e.at)) || typeof e.title !== 'string' || !['pending', 'applied', 'recovering', 'recovery-needed', 'restored', 'rolled-back'].includes(e.status) || !Array.isArray(e.changes) || !e.changes.length || new Set(e.changes.map(c => c.key)).size !== e.changes.length || e.changes.some(c => !valid(c.key, c.before) || !valid(c.key, c.after) || !['planned', 'writing', 'applied', 'restored'].includes(c.state)))) throw Error('schema');
      return data;
    } catch { throw Error('No se puede leer el historial. Por seguridad, no se harán cambios.'); }
  }
  async function exclusive(fn) {
    if (busy) throw Error('Ya hay una operación en curso.');
    busy = true;
    try { return await fn(); } finally { busy = false; }
  }
  async function preview(selection) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection) || Object.keys(selection).length > 4 || Object.entries(selection).some(([key, value]) => !valid(key, value))) throw Error('Selección no válida.');
    const entries = await history();
    if (entries.some(e => active(e) && e.status !== 'applied')) throw Error('Hay una recuperación pendiente. Resuélvela desde Historial antes de continuar.');
    const state = await adapter.snapshot();
    const changes = Object.entries(selection).flatMap(([key, after]) => {
      const before = state.values[key];
      if (!valid(key, before)) throw Error(`${labels[key]} no está disponible en este equipo.`);
      if (key === 'power' && !state.plans.some(p => p.id === after)) throw Error('El plan seleccionado ya no existe.');
      if (before === after) return [];
      if (entries.some(e => active(e) && e.changes.some(c => c.key === key && c.state !== 'restored'))) throw Error(`Restaura primero el cambio anterior de ${labels[key].toLowerCase()} desde Historial.`);
      const describe = value => key === 'power' ? state.plans.find(p => p.id === value)?.name || value : value ? 'Activadas' : 'Desactivadas';
      return [{ key, label: labels[key], before, after, beforeLabel: describe(before), afterLabel: describe(after), state: 'planned' }];
    });
    for (const [token, value] of tokens) if (now() - value.created > 300000) tokens.delete(token);
    if (tokens.size >= 20) tokens.delete(tokens.keys().next().value);
    const token = randomUUID();
    tokens.set(token, { changes, created: now() });
    return { token, changes: structuredClone(changes) };
  }
  async function recover(entries, entry, automatic) {
    entry.status = 'recovering';
    await save(entries);
    const errors = [];
    for (const change of [...entry.changes].reverse()) {
      if (['planned', 'restored'].includes(change.state)) continue;
      try {
        const state = await adapter.snapshot();
        const current = state.values[change.key];
        if (current !== change.before && current !== change.after) throw Error(`${labels[change.key]} cambió fuera de StarOptimizer o no se puede leer. No se sobrescribirá.`);
        if (current !== change.before) {
          if (change.key === 'power' && !state.plans.some(p => p.id === change.before)) throw Error('El plan de energía original ya no existe.');
          await adapter.set(change.key, change.before);
          if ((await adapter.snapshot()).values[change.key] !== change.before) throw Error(`Windows no confirmó la restauración de ${labels[change.key].toLowerCase()}.`);
        }
        change.state = 'restored';
        await save(entries);
      } catch (error) { errors.push(error.message); }
    }
    entry.status = errors.length ? 'recovery-needed' : automatic ? 'rolled-back' : 'restored';
    entry.finishedAt = new Date(now()).toISOString();
    entry.errors = errors;
    await save(entries);
    if (errors.length) throw Error(`Quedan cambios por recuperar. ${errors.join(' ')}`);
  }
  async function apply(token) {
    return exclusive(async () => {
      const prepared = tokens.get(token); tokens.delete(token);
      if (!prepared || now() - prepared.created > 300000) throw Error('La revisión ha caducado. Revisa los cambios de nuevo.');
      if (!prepared.changes.length) return { changed: 0 };
      const entries = await history();
      if (entries.some(e => active(e) && (e.status !== 'applied' || e.changes.some(c => c.state !== 'restored' && prepared.changes.some(p => p.key === c.key))))) throw Error('El historial ha cambiado. Revisa la selección de nuevo.');
      const current = await adapter.snapshot();
      if (prepared.changes.some(c => current.values[c.key] !== c.before || c.key === 'power' && !current.plans.some(p => p.id === c.after))) throw Error('Windows cambió desde la revisión. Vuelve a revisar los ajustes.');
      const entry = { id: randomUUID(), at: new Date(now()).toISOString(), title: prepared.changes.length === 1 ? prepared.changes[0].label : `Optimización · ${prepared.changes.length} ajustes`, status: 'pending', changes: structuredClone(prepared.changes) };
      entries.unshift(entry);
      await save(entries);
      try {
        for (const change of entry.changes) {
          if ((await adapter.snapshot()).values[change.key] !== change.before) throw Error('Otro programa cambió la configuración durante la operación.');
          change.state = 'writing'; await save(entries);
          await adapter.set(change.key, change.after);
          if ((await adapter.snapshot()).values[change.key] !== change.after) throw Error('Windows no confirmó el ajuste solicitado.');
          change.state = 'applied'; await save(entries);
        }
        entry.status = 'applied'; await save(entries);
        return { changed: entry.changes.length, id: entry.id };
      } catch (error) {
        try { await recover(entries, entry, true); }
        catch (recoveryError) { throw Error(`La operación no terminó. ${recoveryError.message} Abre Historial para reintentar la recuperación.`); }
        throw Error(`No se aplicó la optimización; se restauraron los cambios iniciados. ${error.message}`);
      }
    });
  }
  async function undo(id) {
    return exclusive(async () => {
      const entries = await history(); const entry = entries.find(e => e.id === id && active(e));
      if (!entry) throw Error('No hay cambios que restaurar en esta entrada.');
      await recover(entries, entry, false);
      return { restored: true };
    });
  }
  return { preview, apply, undo, history, state: adapter.snapshot };
}
module.exports = { createOptimizer };
