# Student App — memoria del proyecto

Este archivo es la memoria del proyecto: Claude lo lee al empezar cada sesión.
Mantenlo al día cuando cambie una decisión o se termine una fase.

## La idea

Los estudiantes se distraen al saltar entre webs o al coger el móvil (reels).
Student App reúne en **una sola página web** todo lo que necesitan para estudiar,
para que no tengan que moverse de ella. Es para todo tipo de estudiantes.
La interfaz está en español.

## Requisitos del usuario (no cambiar sin preguntar)

1. **Música integrada**: YouTube Music / YouTube y Spotify, controlables desde la propia página.
2. **Tareas**: el estudiante las apunta y las tacha él mismo.
3. **Navegador inteligente** de interfaz sencilla: clasifica solo lo que ve el estudiante
   y tiene una pestaña con varias opciones web para volver a lo que estaba haciendo.
4. **Temporizador**: lo pone el estudiante, **mínimo 30 min**; al acabar pregunta
   **"¿Quieres descansar o seguir?"**.
5. **Suite de Google** (gratis): Drive, Docs, Hojas, Presentaciones, Classroom, Calendar,
   Gmail, Keep, Meet, Formularios, Traductor, Académico.

## Decisiones tomadas

- **Stack**: React 19 + TypeScript + Vite 8. Iconos `lucide-react`. Tests con Vitest. Lint con oxlint.
- **Sin servidor**: todo se guarda en `localStorage` con el prefijo `student-app:` (hook `usePersistentState`).
- **Navegador**: una web normal no puede mostrar cualquier página dentro (la mayoría lo bloquea con
  `X-Frame-Options`). Por eso:
  - Se muestran dentro de la app (iframe, en pestañas internas) solo las que lo permiten:
    Wikipedia y familia, YouTube (como embed), Vimeo, Desmos, GeoGebra, PhET, búsquedas de Google
    (`igu=1`) y archivos de Google Docs/Hojas/Presentaciones (requiere sesión de Google en el navegador).
  - El resto se abre en una pestaña nueva, pero **igualmente se guarda y clasifica** en el historial.
  - La clasificación es por reglas (dominio + palabras clave) en `src/lib/web.ts` y `src/lib/subjects.ts`:
    tipo de web (búsqueda, vídeo, Google, lectura…) y asignatura (Matemáticas, Historia…).
  - Las distracciones (Instagram, TikTok, Shorts, Netflix, juegos…) muestran un aviso antes de abrirse;
    durante el descanso no se avisa.
- **Música**: APIs oficiales de reproductor (YouTube IFrame API y Spotify iFrame API). Los enlaces de
  YouTube Music se reproducen con el reproductor de YouTube. Spotify sin sesión iniciada solo da 30 s.
- **Temporizador**: guarda la hora de fin (`endsAt`), no una cuenta atrás, para no desajustarse en
  segundo plano. Sonido con Web Audio + notificación del navegador.

## Sobre una versión instalable (respuesta dada al usuario)

- Web (lo actual): sin instalar, funciona en cualquier ordenador y en Chromebooks; pero muchas webs no se
  dejan mostrar dentro y no se sabe qué página exacta ve el estudiante.
- Programa de escritorio (Electron recomendado, porque lleva su propio Chromium): todas las webs dentro,
  se sabe qué está viendo, sesiones dentro de la app, bloqueo de distracciones más fuerte. Contras:
  hay que instalarlo (en ordenadores del centro a veces no se puede), no vale en Chromebooks, y Spotify
  necesita trabajo extra por la protección anticopia (DRM).
- Se puede reutilizar casi todo el código React actual dentro de Electron.

## Estructura

```
src/
  lib/            lógica pura con tests (web.ts, subjects.ts, time.ts, oembed.ts, alerts.ts, text.ts)
  hooks/          usePersistentState
  components/     Panel, Modal, Toast, SubjectPicker
  features/
    timer/        TimerContext, FocusTimer, TimerPrompt ("¿descansar o seguir?")
    tasks/        TaskList
    music/        MusicContext, providers.ts (carga de APIs), reproductores y panel
    browser/      navegador de estudio, inicio con "Continuar donde lo dejaste" y accesos de Google
  App.tsx         maquetación: izquierda (temporizador + tareas), centro (navegador), derecha (música)
```

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm test` — tests
- `npm run lint` — oxlint
- `npm run build` — comprobación de tipos y build

## Estado y próximos pasos

- [x] Fase 1 (MVP web): temporizador, aviso "¿descansar o seguir?", tareas, música (YouTube/Spotify),
      navegador con clasificación y "Continuar donde lo dejaste", accesos y "Crear nuevo" de Google,
      tema claro/oscuro, diseño adaptado a móvil. Probado en Chromium.
- [x] Wikipedia **se queda** (buscador y acceso rápido): el usuario la considera útil.
- [x] Fase 2:
  - Inicio de sesión en lo que lo necesita (Google: Docs/Drive/Classroom/YouTube; Spotify: canciones
    completas). Siempre en la página oficial (ventana emergente), nunca pedimos contraseñas en la app.
    Al volver, se recargan los reproductores/pestañas que usan esa cuenta.
  - Personalización: interruptor claro/oscuro (+ automático), color principal y color de cada función
    (temporizador, tareas, navegador, música) elegidos de una **paleta de colores predefinidos**
    (nada de selector RGB). Paleta en `src/lib/colors.ts`; cada panel lleva `data-accent` y redefine
    `--accent` (ver `styles.css`). Cuentas en `src/features/accounts/`.
- [ ] Decidir con el usuario si se hace versión instalable (ver abajo).
- [ ] README en español con cómo usarla y arrancarla.
- [ ] Publicarla en internet (GitHub Pages o similar).
- [ ] Integración real con Google (OAuth): ver archivos de Drive, eventos de Calendar y sincronizar
      tareas con Google Tasks. Requiere crear un proyecto gratuito en Google Cloud.
- [ ] Versión de escritorio (Tauri/Electron) o extensión de navegador: navegador integrado de verdad
      donde carguen todas las webs y se pueda saber qué página exacta está viendo el estudiante.
- [ ] Clasificación con IA opcional para afinar las asignaturas.
