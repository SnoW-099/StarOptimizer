# StarOptimizer 0.5 · Para llevar a otro PC

Lleva `StarOptimizer-0.5.0-portable.exe`. No requiere instalación ni elevación. El código no necesita viajar con el ejecutable. El historial de ajustes y las mediciones se guardan en el perfil de Windows de ese PC, no junto al ejecutable.

## En casa de tu amigo

1. Preguntad qué va lento: encender, abrir apps, escritorio o un juego concreto. Guardad el trabajo abierto y conectad el cargador si corresponde.
2. Abrir **Puesta a punto → Analizar equipo**. Revisar **Recomendados** y el estado de discos. Si Windows avisa sobre una unidad, priorizar la copia de archivos y revisar ese problema.
3. Con las aplicaciones habituales abiertas, guardar **Medir antes**. Apuntar qué tarea estabais haciendo. No comparar reposo con un juego abierto.
4. Revisar **Apps de inicio → Gestionar en Windows**. Desactivar solo las aplicaciones reconocidas que no hagan falta al iniciar. Conservar seguridad, audio y dispositivos. No desinstalar ni borrar nada para seguir esta guía.
5. En **Optimizar**, elegir un perfil, revisar cada cambio y aplicar solo lo necesario. Equilibrado es adecuado como punto de partida. Rendimiento puede aumentar consumo y temperatura; no garantiza más FPS.
6. Revisar Windows Update y preferencias de GPU desde los accesos de **Puesta a punto**. Cualquier instalación o reinicio se decide allí; guardar el trabajo antes. No usar paquetes de controladores de procedencia desconocida.
7. Si reinicias, abrir de nuevo la app y analizar. El antes y el historial de ajustes se conservan. Repetir **Medir después** con la misma tarea y alimentación.
8. Comparar CPU media, pico y RAM. Menor carga observada no demuestra mayor velocidad. Probar también la tarea que iba lenta; si un ajuste empeora el uso, restaurarlo en **Historial**.
9. **Guardar diagnóstico y mediciones** permite exportar un JSON con las lecturas y los cambios. Incluye nombres de procesos: revisarlo antes de compartirlo.

## Límites que conviene conocer

La app no borra archivos ni cierra programas para liberar memoria. No repara discos ni comprueba temperaturas de CPU/GPU, estabilidad bajo carga o FPS. Un estado de disco sin avisos no es garantía de salud. Si persisten calentamiento, bloqueos o lentitud, hay que investigar esa causa concreta. No se debe seguir cambiando ajustes al azar.

Para volver atrás después de cerrar o reiniciar la app, usa **Historial**. Los cambios hechos directamente en Configuración de Windows se revierten desde Windows, no desde ese historial.
