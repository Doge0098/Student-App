# LockIn

Todo lo que un estudiante necesita para estudiar, **en un solo sitio**, para no ir saltando de web en web
ni acabar en el móvil. Para todos los cursos, de Primaria a la universidad.

**Úsala ya:** https://doge0098.github.io/Student-App/

- **Concentración**: eliges cuánto tiempo (mínimo 30 min) y en qué tarea. Al acabar te pregunta
  *«¿Quieres descansar o seguir?»*. Modo foco, tu progreso con racha de días y **sala con amigos**
  (un enlace y todos estudiáis con el mismo reloj).
- **Tareas y exámenes**: con fechas, cuenta atrás y avisos. Cada tarea se etiqueta sola con su asignatura.
- **Estudio**: busca o pega un enlace; lo que abres se guarda clasificado por asignatura. Además:
  - **Apps**: tienda de apps de estudio (Google, IA, VS Code, máquinas virtuales, mensajería…) con
    recomendaciones según tu curso.
  - **Notas** por asignatura y **Repasar** con tarjetas de memoria.
  - **IA**: resuelve dudas, resume, hace tests y crea tarjetas. Usa tu propia clave de Claude, ChatGPT o
    Gemini (Gemini tiene plan gratis); la clave se queda en tu navegador.
- **Modos de estudio** Suave, Normal y Estricto: desde solo avisar hasta bloquear las distracciones
  (redes, reels, juegos y las webs que tú añadas) mientras te concentras.
- **Música**: YouTube Music con aspecto de app de móvil (biblioteca de listas, reproductor) y sonidos ambiente (lluvia, olas, ruido…) que se pausan solos en los descansos.
- **Ajustes**: curso, modo, colores, tu cuenta de Google, copia de tus datos e instalación.

Tus datos se guardan solo en tu navegador: no hay cuentas ni servidor. Para cambiar de ordenador,
descarga una copia en Ajustes → Datos.

## Usarla

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run dev
```

Abre la dirección que aparece (normalmente http://localhost:5173).

### Instalarla como app

Con la versión publicada (`npm run build` genera la carpeta `dist/`), en Chrome o Edge aparece el botón
**Instalar** (o el icono de instalar en la barra de direcciones). En iPhone/iPad: *Compartir → Añadir a pantalla de inicio*.
Funciona también sin internet.

### Versión de escritorio

Programa para Windows, Mac y Linux (Electron) donde todas las webs se abren dentro de LockIn.
Ver [`desktop/README.md`](desktop/README.md). Para probarla: `npm run desktop:install` y luego `npm run desktop`.

## Para desarrollar

- `npm test` — tests
- `npm run lint` — revisión del código
- `npm run build` — comprobación de tipos y versión final en `dist/`

Las decisiones del proyecto, la estructura y los próximos pasos están en [`CLAUDE.md`](CLAUDE.md).
