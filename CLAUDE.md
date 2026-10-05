# LockIn — memoria del proyecto

(El repositorio se llama Student-App; la app se llama **LockIn** desde la fase 4.)

Este archivo es la memoria del proyecto: Claude lo lee al empezar cada sesión.
Mantenlo al día cuando cambie una decisión o se termine una fase.

## La idea

Los estudiantes se distraen al saltar entre webs o al coger el móvil (reels).
LockIn reúne en **una sola página web** todo lo que necesitan para estudiar,
para que no tengan que moverse de ella. Es para estudiantes **de todos los cursos** y para
**cualquiera que quiera usarla** (pública). Se usará sobre todo en el **ordenador propio, en casa**
(los institutos quizá más adelante). La interfaz está en español.

## Requisitos del usuario (no cambiar sin preguntar)

1. **Música integrada**: YouTube Music / YouTube y Spotify, controlables desde la propia página.
2. **Tareas**: el estudiante las apunta y las tacha él mismo.
3. **Navegador inteligente** de interfaz sencilla: clasifica solo lo que ve el estudiante
   y tiene una pestaña con varias opciones web para volver a lo que estaba haciendo.
4. **Temporizador**: lo pone el estudiante, **mínimo 30 min**; al acabar pregunta
   **"¿Quieres descansar o seguir?"**.
5. **Suite de Google** (gratis): Drive, Docs, Hojas, Presentaciones, Classroom, Calendar,
   Gmail, Keep, Meet, Formularios, Traductor, Académico.
6. **Inicio de sesión** en las funciones que lo necesiten (Google, Spotify).
7. **Personalización**: claro/oscuro y colores de iconos y funciones, **solo colores predefinidos**.
8. **Minimalista de verdad y fácil de entender**: nada decorativo que no aporte (p. ej. se quitó el
   círculo de progreso del temporizador). Wikipedia se queda.
9. **Tienda de apps de estudio** (VS Code, máquinas virtuales, IA…) y preparada para **app descargable**.
10. **Nombre: LockIn.**
11. **Selector de curso** (Primaria, ESO, Bachillerato, FP, Universidad, Otro) que adapta funciones
    (asignaturas que se ofrecen, apps recomendadas, cómo explica la IA…).
12. **Modos de estudio**: lo estricto que es LockIn con las distracciones depende del modo elegido
    (Suave / Normal / Estricto, ver `src/features/profile/profile.ts`).
13. **IA**: cada estudiante usa su propia clave de la IA que elija (Claude, ChatGPT, Gemini…).
    LockIn no tiene servidor ni paga IA.
14. **Datos solo en el navegador**: sin cuentas ni servidor propio. Para cambiar de ordenador:
    exportar/importar una copia en un archivo.

## Convenciones de código

- Estado compartido entre componentes: `createStore` + `useStore` (`src/hooks/store.ts`); se guarda
  en `localStorage` y se sincroniza entre componentes y pestañas. `usePersistentState` solo para estado
  local de un componente.
- Claves de `localStorage` con el prefijo `student-app:` (se mantiene tras el cambio de nombre para no
  perder datos).
- Cada función nueva trae su propio CSS (`features/x/x.css` importado desde su componente);
  `styles.css` es solo para la base común.
- Textos en español, tono cercano y corto. Minimalismo: nada decorativo que no aporte.

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
  segundo plano. Sonido con Web Audio + notificación del navegador. La duración se elige con − / +
  (de 5 en 5, mínimo 30); el descanso se elige en el aviso final.
  Se muestra como **reloj digital `00:00`** (siempre minutos:segundos, p. ej. `90:00`), sin círculo
  de progreso: el usuario lo pidió así por minimalismo. El estado se indica solo con el color de los
  dígitos (concentración = color de la función, descanso = verde, pausa = gris).
- **Tienda de apps**: catálogo en `src/features/store/catalog.ts` (con test). Cada app tiene `webUrl`
  (se abre por el navegador de la app) y/o `downloadUrl` (página oficial). La web no instala programas.
  «Mis apps» (ids en `localStorage`, clave `my-apps`) se muestran en Inicio.
- **Mensajería** (WhatsApp, Discord, Telegram; Teams cuenta como plataforma de clase): están en la
  tienda. No son distracciones bloqueadas: solo se avisa («¿Abrir X ahora?») si se abren durante un
  bloque de concentración en marcha (`getMessagingApp` en `src/lib/web.ts`). Ninguna se deja mostrar
  dentro de la app: se abren en pestaña nueva o se descargan.
- **App descargable**: PWA (`public/manifest.webmanifest`, `public/sw.js`, iconos PNG) con botón
  «Instalar» cuando el navegador lo permite (`src/platform/install.ts`). Vite usa `base: './'`.
  Todo lo que dependa de web vs escritorio pasa por `src/platform/index.ts`: la futura versión
  Electron expondrá `window.studentAppDesktop` (preload) y entonces `platform.canEmbedAnySite` será
  `true` (todas las webs dentro) y `openExternal` usará el navegador del sistema.

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
  components/     Panel, Modal (usa data-autofocus para el botón principal), Toast, SubjectPicker
  platform/       web vs escritorio (index.ts) e instalación PWA (install.ts)
  features/
    timer/        TimerContext, FocusTimer, TimerPrompt ("¿descansar o seguir?")
    tasks/        TaskList (pendientes arriba, hechas plegadas)
    music/        MusicContext, providers.ts (carga de APIs), reproductores y panel
    browser/      navegador: pestañas Inicio (seguir con lo último, Mis apps, historial) y Apps
    store/        tienda de apps de estudio (catalog.ts + AppStore.tsx)
    accounts/     inicio de sesión en Google y Spotify
    settings/     apariencia (colores, tema), ventana de Ajustes y guía de bienvenida
  App.tsx         maquetación: izquierda (concentración + tareas), centro (navegador), derecha (música)
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
    (nada de selector RGB). El color por defecto de la app es índigo; «Azul cian» es una opción más
    de la paleta (el usuario la pidió para Personalizar, **no** como color de toda la app). Paleta en `src/lib/colors.ts`; cada panel lleva `data-accent` y redefine
    `--accent` (ver `styles.css`). Cuentas en `src/features/accounts/`.
- [x] Fase 3 (el usuario prefiere seguir mejorando la web antes del escritorio):
  - Más minimalista: un solo botón de ajustes, temporizador con − / +, tareas sin filtros, música
    compacta, Inicio con «Mis apps», guía de bienvenida la primera vez.
  - App descargable: PWA instalable (Chrome no da errores de instalación) y funciona sin internet.
  - Tienda de apps de estudio con ~50 apps en 8 categorías.
- [x] README en español.
- [ ] Publicarla en internet (GitHub Pages o similar).
- [ ] Integración real con Google (OAuth): ver archivos de Drive, eventos de Calendar y sincronizar
      tareas con Google Tasks. Requiere crear un proyecto gratuito en Google Cloud.
- [ ] Versión de escritorio con Electron (carpeta `desktop/`): preload que exponga
      `window.studentAppDesktop`, pestañas con WebContentsView para mostrar cualquier web y saber su
      título/URL, empaquetado para Windows/Mac/Linux. Spotify necesitará Widevine (p. ej. Electron de castLabs).
- [ ] Clasificación con IA opcional para afinar las asignaturas.
