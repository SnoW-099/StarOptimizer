const fs = require('node:fs/promises');
const path = require('node:path');
function summarize(samples) {
  if (!Array.isArray(samples) || samples.length < 5 || samples.some(s => !Number.isFinite(s.cpu) || s.cpu < 0 || s.cpu > 100 || !Number.isFinite(s.memory?.total) || s.memory.total <= 0 || !Number.isFinite(s.memory.free) || s.memory.free < 0 || s.memory.free > s.memory.total)) throw Error('Medición incompleta o no válida. No se guardará como resultado.');
  const cpu = samples.map(s => s.cpu).sort((a,b) => a-b);
  return { samples: samples.length, cpuMean: samples.reduce((n,s) => n+s.cpu,0)/samples.length, cpuPeak: cpu[cpu.length-1], memoryUsedMean: samples.reduce((n,s) => n+s.memory.total-s.memory.free,0)/samples.length, memoryTotal: samples[0].memory.total };
}
function createMeasurements(directory, sample, context) {
  const file = path.join(directory, 'measurements.json'); let busy = false;
  async function history() {
    try {
      const data = JSON.parse(await fs.readFile(file,'utf8'));
      if (!Array.isArray(data) || data.some(e => !e || !['before','after'].includes(e.kind) || !Number.isFinite(Date.parse(e.at)) || !e.summary || !['cpuMean','cpuPeak','memoryUsedMean','memoryTotal'].every(key => Number.isFinite(e.summary[key])) || typeof e.context?.cpu !== 'string' || typeof e.context.onBattery !== 'boolean')) throw Error('invalid');
      return data;
    } catch(e) { if(e.code === 'ENOENT') return []; throw Error('No se puede leer el historial de mediciones. No se sobrescribirá.'); }
  }
  async function measure(kind) {
    if (!['before','after'].includes(kind)) throw Error('Tipo de medición no válido.');
    if (busy) throw Error('Ya hay una medición en curso.'); busy = true;
    try {
      const entries = await history();
      if (kind === 'after' && !entries.some(e => e.kind === 'before')) throw Error('Guarda primero una medición inicial.');
      const environment = await context(); const samples = []; const start = Date.now();
      for(let i=0;i<12;i++) samples.push(await sample());
      const entry = { kind, at: new Date().toISOString(), durationMs: Date.now()-start, context: environment, summary: summarize(samples) };
      entries.push(entry); await fs.mkdir(directory,{recursive:true});
      await fs.writeFile(file+'.tmp',JSON.stringify(entries,null,2),{encoding:'utf8',flush:true}); await fs.rename(file+'.tmp',file);
      return entries;
    } finally { busy = false; }
  }
  return { history, measure };
}
module.exports = { createMeasurements, summarize };
