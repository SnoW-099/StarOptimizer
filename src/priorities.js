/* Recommendations are observations from a completed snapshot, never assumed faults. */
(function (root) {
  function priorities(s) {
    if (!s) return [];
    const list = [], errors = s.errors || [];
    const add = (priority, title, evidence, action, view) => list.push({ priority, title, evidence, action, view });
    const names = { cpu: 'CPU', memory: 'memoria', disks: 'almacenamiento', physicalDisks: 'estado físico de discos', processes: 'procesos', startup: 'inicio', plans: 'energía', gpu: 'GPU', configuration: 'ajustes de Windows' };
    if (!errors.includes('physicalDisks')) for (const disk of s.physicalDisks || []) {
      if (['Warning','Unhealthy'].includes(disk.HealthStatus)) add(0, `Proteger los datos de ${disk.Name}`, `Windows reporta ${disk.HealthStatus}. Prioriza una copia de tus archivos importantes y revisar la unidad antes de buscar más rendimiento.`, 'Ver estado de discos', 'tuneup');
    }
    if (errors.length) add(0, 'Completar las lecturas pendientes', `Windows no pudo consultar: ${errors.map(key => names[key] || key).join(', ')}. Las recomendaciones solo cubren los datos disponibles.`, 'Volver a analizar', 'scan');
    if (!errors.includes('disks')) for (const d of s.disks || []) {
      if (Number.isFinite(d.Size) && d.Size > 0 && Number.isFinite(d.FreeSpace) && d.FreeSpace >= 0 && d.FreeSpace / d.Size < .15)
        add(1, `Revisar el espacio de ${d.DeviceID}`, `${Math.round(d.FreeSpace / d.Size * 100)} % libre en esta unidad. Considera mover archivos que reconozcas a otra unidad; no se borra nada automáticamente.`, 'Ver almacenamiento', 'processes');
    }
    const m = s.memory;
    if (!errors.includes('memory') && Number.isFinite(m?.total) && m.total > 0 && Number.isFinite(m.free) && m.free >= 0 && m.free <= m.total && (m.total - m.free) / m.total > .85)
      add(1, 'Revisar las aplicaciones que ocupan memoria', `${Math.round((m.total - m.free) / m.total * 100)} % de RAM ocupada en esta lectura. Guarda tu trabajo antes de cerrar aplicaciones que no necesites.`, 'Ver recursos', 'processes');
    const cpu = s.cpu?.[0]?.LoadPercentage;
    if (!errors.includes('cpu') && Number.isFinite(cpu) && cpu > 80 && cpu <= 100)
      add(2, 'Comprobar si la carga de CPU se mantiene', `${cpu} % en una muestra. Un pico puede ser normal: repite la lectura cuando finalicen las tareas actuales.`, 'Ver recursos', 'processes');
    if (!errors.includes('startup') && s.startup?.length)
      add(3, 'Revisar las aplicaciones de inicio', `${s.startup.length} entradas reportadas. El inventario puede incluir entradas deshabilitadas: confirma su estado en Windows y conserva seguridad y controladores.`, 'Revisar inicio', 'startup');
    return list.sort((a, b) => a.priority - b.priority);
  }
  if (typeof module !== 'undefined') module.exports = priorities;
  else root.starPriorities = priorities;
})(globalThis);
