# StarOptimizer

Aplicación de escritorio para Windows 10/11 x64. Versión 0.2.2: mascota adaptada al vídeo de referencia, interfaz de cristal, diagnóstico local y ajustes de energía/animaciones con revisión previa y recuperación persistente. Beta sin firma digital.

## Ejecutar

Descarga o genera `dist/StarOptimizer-0.2.2-portable.exe` y ábrelo. No necesita instalarse ni pide elevación. Windows puede mostrar una advertencia de editor desconocido porque el binario no está firmado. Algunas políticas de empresa pueden impedir leer o modificar ajustes; la app informa del error.

Para desarrollo, con Node.js y npm instalados:

```sh
npm ci
npm start
```

## Qué hace

- Consulta CPU, RAM, discos locales, GPU/controlador, hasta 30 grupos de procesos por consumo de memoria y entradas de inicio, con búsquedas.
- Ofrece un monitor opcional de CPU/RAM cada cinco segundos. Se pausa fuera de Inicio, al ocultar la app y durante operaciones. El resto de los datos conserva la fecha del análisis completo.
- Señala CPU por encima del 80 %, RAM por encima del 85 % y unidades con menos del 15 % libre como señales para revisar, sin confundirlas con fallos de hardware.
- Prepara perfiles Equilibrado, Más directo y Rendimiento. Los perfiles solo seleccionan opciones: nunca se aplican automáticamente.
- Cambia a un plan de energía existente y/o reduce animaciones de interfaz, menús y listas mediante la API documentada `SystemParametersInfoW`. Sus efectos dependen de que cada aplicación respete esos ajustes.
- Muestra una revisión exacta de valores actuales y nuevos. La revisión caduca a los cinco minutos y se invalida si Windows cambia entre medias.
- Guarda los valores originales antes de escribir, verifica cada paso e intenta recuperar los pasos iniciados si falla el lote. Los fallos de recuperación siguen visibles en Historial.
- Restaura operaciones desde Historial, también tras reiniciar la aplicación.
- Abre controles oficiales para gestionar inicio, Modo Juego, preferencias gráficas, actualizaciones y energía.
- Exporta un diagnóstico JSON solo a petición del usuario. Incluye nombres de procesos, entradas de inicio e historial: revisarlo antes de compartirlo.

No borra archivos, limpia cachés, mata procesos, desactiva servicios/antivirus, instala drivers ni altera red o BIOS. No escribe valores de registro directamente: Windows persiste los ajustes visuales a través de su API. No envía telemetría ni necesita conexión para funcionar. Las mejoras dependen del problema real; cambiar la energía o reducir animaciones no garantiza más FPS. El inventario de inicio no indica con certeza si cada entrada está activada y no incluye todos los mecanismos de arranque.

## Recuperación

El historial está en `%APPDATA%/StarOptimizer/optimization-journal.json`. Se escribe con vaciado a disco del archivo temporal y reemplazo atómico. La versión 0.2 conserva la recuperación del antiguo `energy-journal.json`, sin borrarlo. Una vez escrito el nuevo historial, este es la fuente de verdad: evita usar la versión 0.1 para aplicar o restaurar nuevos cambios.

Se permiten operaciones independientes pendientes de restaurar, pero un mismo ajuste no puede sobrescribirse hasta recuperar su valor original. Una operación interrumpida bloquea nuevas optimizaciones hasta resolver la recuperación. Si otro programa cambió la energía a un tercer plan, la app evita sobrescribirlo. Si desaparece el plan original o Windows deniega permisos, la recuperación puede requerir intervención manual; no se presenta como completada. No borres los historiales si quieres conservar la recuperación. Los cambios hechos directamente en Ajustes de Windows no forman parte del historial. El cierre normal de la ventana se bloquea durante una escritura/verificación; un cierre forzado conserva los datos de recuperación ya registrados.

## Pruebas y compilación

```sh
npm test
npm run test:ui
npm run test:workflow
npm run test:nova
npm run dist
```

Las 23 pruebas unitarias cubren el motor nuevo y la compatibilidad del motor de energía anterior: recuperación, reinicio, comandos fallidos, historial corrupto, escritura fallida, valores externos, permisos, lotes parciales, caducidad y migración. Las mutaciones usan adaptadores aislados y directorios temporales.

`test:ui` ejecuta un diagnóstico real y lee las opciones nativas, prueba navegación, revisión/cancelación, búsqueda, apariencia, movimiento reducido y una ventana compacta. No aplica ajustes al anfitrión. `test:workflow` prueba desde los botones el ciclo revisión → aplicación → restauración y la recuperación automática de un lote fallido, con el motor real y un adaptador simulado dentro del proceso de prueba. La app distribuida no expone un modo de prueba. Ambas pruebas admiten un ejecutable empaquetado: `node test/ui.cjs dist/win-unpacked/StarOptimizer.exe` y `node test/workflow.cjs dist/win-unpacked/StarOptimizer.exe`.

## Diseño y referencia

Nova está dibujada con CSS propio siguiendo el vídeo aportado: círculo negro plano, ojos azules ovalados y pequeñas pupilas blancas. Sin boca, estrella, reflejos ni partículas decorativas. Un pequeño director de animaciones elige miradas curiosas y guiños con movimientos suaves. Sigue el cursor, responde al contacto y mantiene estados de atención, descanso y análisis. Tras unos 35 segundos sin interacción, se adormece y vuelve a despertar al mover el ratón o pulsar una tecla.

Las animaciones usan capas separadas y Web Animations; los temporizadores solo eligen gestos, sin un bucle JavaScript continuo. Se cancelan al salir de Inicio, ocultar la app, activar movimiento reducido o elegir la apariencia Sencilla. `test:nova` comprueba gestos espontáneos, caricias, variedad de clics, sueño/despertar y suspensión de animaciones con reloj controlado.

Referencia visual aportada por el usuario: [Creature Company / LILGUY EYES](https://creature.company/eyes?swatch=circle-stoplight). No se distribuye código, imágenes ni animaciones descargadas de Creature Company. No se ha verificado una licencia que permita redistribuir sus assets.

## Arquitectura y límites

Electron con sandbox, aislamiento de contexto, sin Node en el renderizador, CSP local, comprobación de emisor IPC y lista cerrada de acciones. PowerShell usa comandos fijos codificados y `powercfg` recibe argumentos separados y GUIDs validados. El historial se escribe antes de cada mutación con reemplazo de archivo. Los permisos, las políticas de empresa o proveedores WMI pueden impedir lecturas o cambios; se presentan como datos no disponibles o errores recuperables.

Referencias: [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [powercfg de Microsoft](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/powercfg-command-line-options) y [SystemParametersInfoW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow).

Antes de distribuir ampliamente: firmar el ejecutable y probar restauraciones reales en máquinas virtuales Windows 10/11, portátiles y equipos con Modern Standby. Las pruebas con adaptadores y el diagnóstico local no sustituyen esa matriz de hardware.
