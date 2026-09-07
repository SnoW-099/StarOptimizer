# StarOptimizer

Aplicación de escritorio para Windows 10/11 x64. Diagnóstico local, mascota Nova animada y cambios de plan de energía con recuperación persistente. Primera versión funcional, sin firma digital.

## Ejecutar

Descarga o genera `dist/StarOptimizer-0.1.0-portable.exe` y ábrelo. No necesita instalarse ni ejecutarse como administrador. Windows puede mostrar una advertencia de editor desconocido porque el binario no está firmado.

Para desarrollo, con Node.js y npm instalados:

```sh
npm ci
npm start
```

## Qué hace

- Consulta CPU, RAM, discos locales, los 12 procesos con más memoria y entradas de inicio de Windows.
- Muestra datos del último análisis: no es un monitor continuo ni una puntuación inventada. Señala CPU por encima del 80 %, RAM por encima del 85 % y unidades con menos del 15 % libre como señales para revisar, sin confundirlas con fallos de hardware.
- Permite elegir planes de energía existentes, previa confirmación nativa.
- Guarda el plan anterior antes de modificar Windows y verifica el resultado.
- Restaura el plan anterior desde Historial, también tras reiniciar la aplicación.
- Abre controles oficiales para gestionar inicio, Modo Juego, actualizaciones y energía.
- Exporta un diagnóstico JSON solo a petición del usuario. El informe incluye nombres de procesos y entradas de inicio: revisarlo antes de compartirlo.

No borra archivos, limpia cachés, mata procesos, modifica el registro, desactiva servicios/antivirus, instala drivers ni altera red o BIOS. No utiliza telemetría ni necesita conexión para funcionar. Las mejoras dependen del problema real; cambiar la energía no garantiza más FPS. El inventario de inicio no indica con certeza si cada entrada está activada y no incluye todos los mecanismos de arranque.

## Recuperación

El historial está en `%APPDATA%/StarOptimizer/energy-journal.json`. Solo se permite un cambio sin restaurar. Un estado pendiente indica una operación interrumpida: Historial permite recuperar el plan previo. Si otro programa cambió el plan a un tercero, la aplicación evita sobrescribirlo; puedes elegir el identificador original desde los controles de Windows. No borres el historial si quieres conservar la recuperación. Los cambios hechos directamente en Ajustes de Windows no forman parte del historial.

## Pruebas y compilación

```sh
npm test
npm run test:ui
npm run dist
```

Las pruebas de energía usan un adaptador simulado: verifican recuperación, reinicio, comandos fallidos, historial corrupto, escritura fallida y cambios externos sin modificar el equipo anfitrión. La prueba de interfaz arranca Electron y ejecuta un diagnóstico real de solo lectura. Se necesita Windows para esa prueba y para generar el ejecutable portable.

## Diseño y referencia

Nova está dibujada con CSS propio: cuerpo oscuro, ojos azules, flotación y parpadeo, con respeto a la preferencia de movimiento reducido. Referencia visual aportada por el usuario: [Creature Company / LILGUY EYES](https://creature.company/eyes?swatch=circle-stoplight), especialmente los ojos redondos de la captura. No se distribuye código, imágenes ni animaciones descargadas de Creature Company. No se ha verificado una licencia que permita redistribuir sus assets; una incorporación literal requeriría comprobarla.

## Arquitectura y límites

Electron con sandbox, aislamiento de contexto, sin Node en el renderizador, CSP local, comprobación de emisor IPC y lista cerrada de acciones. PowerShell usa comandos fijos codificados y `powercfg` recibe argumentos separados y GUIDs validados. El historial se escribe antes de cada mutación con reemplazo de archivo. Los permisos, las políticas de empresa o proveedores WMI pueden impedir lecturas o cambios; se presentan como datos no disponibles o errores recuperables.

Referencias: [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security) y [powercfg de Microsoft](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/powercfg-command-line-options).

Antes de distribuir ampliamente: firmar el ejecutable y probar restauraciones reales en máquinas virtuales Windows 10/11, portátiles y equipos con Modern Standby. Las pruebas con adaptadores y el diagnóstico local no sustituyen esa matriz de hardware.
