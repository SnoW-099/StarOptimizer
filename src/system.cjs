const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const GUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const win = process.env.SystemRoot || 'C:\\Windows';
function execute(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => error ? reject(new Error('Windows no pudo completar la operación. Puede que esté restringida por permisos o por tu equipo.')) : resolve(stdout.trim())));
}
async function ps(script) {
  const prefix = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); $ErrorActionPreference = "Stop"; ';
  return JSON.parse(await execute(path.join(win, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(prefix + script, 'utf16le').toString('base64')]));
}
async function power(args) { return execute(path.join(win, 'System32/powercfg.exe'), args); }
async function plans() {
  const output = await power(['/list']);
  return output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\s+\((.*)\)/i);
    return match ? [{ id: match[1].toLowerCase(), name: match[2], active: line.includes('*') }] : [];
  });
}
async function cpuSample() {
  const first = os.cpus();
  await new Promise(resolve => setTimeout(resolve, 900));
  const second = os.cpus();
  let idle = 0, elapsed = 0;
  second.forEach((core, i) => {
    if (!first[i]) return;
    idle += core.times.idle - first[i].times.idle;
    elapsed += Object.values(core.times).reduce((a, b) => a + b, 0) - Object.values(first[i].times).reduce((a, b) => a + b, 0);
  });
  return [{ Name: second[0]?.model || 'Procesador', LoadPercentage: elapsed > 0 ? Math.max(0, Math.min(100, Math.round((1 - idle / elapsed) * 100))) : null }];
}
async function scan() {
  const sections = await Promise.allSettled([
    cpuSample(),
    ps('Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress'),
    ps('Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 ProcessName,Id,WorkingSet64 | ConvertTo-Json -Compress'),
    ps('Get-CimInstance Win32_StartupCommand | Select-Object Name,Location | ConvertTo-Json -Compress'),
    plans()
  ]);
  const names = ['cpu', 'disks', 'processes', 'startup', 'plans'];
  const result = { at: new Date().toISOString(), platform: `Windows ${os.release()}`, memory: { total: os.totalmem(), free: os.freemem() }, uptime: os.uptime(), errors: [] };
  sections.forEach((section, i) => {
    if (section.status === 'fulfilled') result[names[i]] = [].concat(section.value || []);
    else { result[names[i]] = []; result.errors.push(names[i]); }
  });
  return result;
}
function createPowerManager(directory, adapter = { plans, power }) {
  const file = path.join(directory, 'energy-journal.json');
  let busy = false;
  async function read() {
    try {
      const value = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!Array.isArray(value) || value.some(x => !GUID.test(x.before) || !GUID.test(x.after))) throw Error();
      return value;
    } catch (error) { if (error.code === 'ENOENT') return []; throw new Error('El historial no se puede leer. No se harán cambios.'); }
  }
  async function save(data) {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(file + '.tmp', JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(file + '.tmp', file);
  }
  async function exclusive(fn) {
    if (busy) throw new Error('Ya hay un cambio en curso.');
    busy = true;
    try { return await fn(); } finally { busy = false; }
  }
  async function apply(id) {
    return exclusive(async () => {
      if (!GUID.test(id)) throw new Error('Plan no válido.');
      const available = await adapter.plans();
      const before = available.find(x => x.active)?.id;
      if (!before || !available.some(x => x.id === id)) throw new Error('Ese plan ya no está disponible.');
      if (before === id) throw new Error('Ese plan ya está activo.');
      const journal = await read();
      if (journal.some(x => ['pending', 'applied', 'undoing'].includes(x.status))) throw new Error('Restaura primero el cambio anterior.');
      const entry = { id: require('node:crypto').randomUUID(), before, after: id, at: new Date().toISOString(), status: 'pending' };
      journal.unshift(entry);
      await save(journal); // Durable recovery information BEFORE touching Windows.
      await adapter.power(['/setactive', id]);
      if (!(await adapter.plans()).some(x => x.id === id && x.active)) throw new Error('Windows no confirmó el cambio. Revisa el historial para restaurar.');
      entry.status = 'applied';
      await save(journal);
      return journal;
    });
  }
  async function undo(id) {
    return exclusive(async () => {
      const journal = await read();
      const entry = journal.find(x => x.id === id && ['pending', 'applied', 'undoing'].includes(x.status));
      if (!entry) throw new Error('No hay ningún cambio pendiente de restaurar.');
      const available = await adapter.plans();
      if (!available.some(x => x.id === entry.before)) throw new Error('Windows ya no tiene el plan original. No se ha modificado nada.');
      const current = available.find(x => x.active)?.id;
      if (current !== entry.after && current !== entry.before) throw new Error('El plan se cambió fuera de StarOptimizer. Selecciona manualmente el plan original desde Windows.');
      entry.status = 'undoing';
      await save(journal);
      if (current !== entry.before) await adapter.power(['/setactive', entry.before]);
      if (!(await adapter.plans()).some(x => x.id === entry.before && x.active)) throw new Error('No se pudo verificar la restauración. Puedes volver a intentarlo.');
      entry.status = 'restored'; entry.restoredAt = new Date().toISOString();
      await save(journal);
      return journal;
    });
  }
  return { read, apply, undo };
}
module.exports = { scan, plans, createPowerManager };
