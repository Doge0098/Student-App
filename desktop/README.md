# LockIn para ordenador

Versión de escritorio de LockIn hecha con [Electron](https://www.electronjs.org/). Es la misma app
web (la carpeta `dist/` de la raíz) metida en un programa, con dos cosas que una web normal no puede
hacer:

- **Cualquier web se abre dentro de las pestañas de LockIn**, también las que no se dejan meter en
  un iframe (Google Docs, Classroom, la mayoría de webs). El estudiante no tiene que salir de la app.
- **LockIn sabe qué página está viendo**: cuando se pulsa un enlace dentro de una pestaña, la pestaña
  cambia de título y la página se guarda y clasifica en el historial («Continuar donde lo dejaste»).
- En **modo Estricto**, las webs bloqueadas tampoco se abren pulsando enlaces dentro de otra página.

## Empezar

Necesitas Node 22.12 o más nuevo.

```bash
# 1. Construir la web (en la carpeta principal de LockIn)
npm run build

# 2. Instalar y abrir la versión de escritorio
cd desktop
npm install
npm start
```

Desde la carpeta principal también vale `npm run desktop` (construye la web y abre el programa).

Si al abrir dice que falta Electron (a veces no se descarga al instalar):

```bash
node node_modules/electron/install.js
```

Detrás de un proxy, Electron usa `HTTPS_PROXY` si existe `ELECTRON_GET_USE_PROXY=1`.

## Crear el instalador

```bash
npm run dist:win     # Windows (.exe con instalador)
npm run dist:mac     # Mac (.dmg) — hay que hacerlo en un Mac
npm run dist:linux   # Linux (AppImage y .deb)
npm run pack         # solo la carpeta sin instalador, para probar rápido
```

Los instaladores quedan en `desktop/release/`. El icono es `public/icon-512.png` y la web se copia
dentro del programa (carpeta `resources/web`). Antes de crear el instalador hay que ejecutar
`npm run build` en la raíz para que lleve la última versión de la web.

Para Windows y Mac conviene **firmar** el programa (si no, el sistema avisa de «editor desconocido»).
Eso necesita un certificado de pago y aún no está configurado.

## Cómo funciona

```
desktop/
  src/main.ts      arranque: ventana, protocolo app://, menú, mensajes con la app
  src/guards.ts    reglas de cada página: navegación, ventanas nuevas, menú del botón derecho, atajos
  src/sessions.ts  sesiones, permisos, agente de usuario, bloqueo del modo Estricto
  src/policy.ts    las decisiones, sin Electron (con tests: policy.test.ts)
  src/state.ts     estado compartido (webs bloqueadas, avisos a la app)
  src/preload.ts   el puente window.lockinDesktop
  scripts/smoke.mjs  prueba de humo con Playwright
```

- La app se carga desde **`app://lockin/`** (un protocolo propio que sirve los archivos de `dist/`),
  no desde `file://`: así funcionan `localStorage`, los módulos y los reproductores.
- Hay **dos sesiones** separadas:
  - la de la **app** (tareas, apuntes, claves de IA en `localStorage`, reproductores de música);
  - la de las **webs** (`persist:lockin-web`): pestañas, ventanas emergentes e inicio de sesión de
    Google. Ninguna web puede cargar la app ni leer lo que guarda.
- Las pestañas son etiquetas `<webview>` (ver `src/features/browser/BrowserFrame.tsx`). Al cambiar de
  pestaña solo se ocultan: la página no se recarga y conserva su estado.

### El puente `window.lockinDesktop`

| Función | Qué hace |
| --- | --- |
| `version`, `platform` | versión de LockIn para ordenador y sistema (`win32`, `darwin`, `linux`) |
| `openExternal(url)` | abre un enlace `http/https` en el navegador del sistema |
| `setBlockedSites(hosts)` | webs bloqueadas ahora (modo Estricto con un bloque en marcha) |
| `onBlockedNavigation(cb)` | avisa cuando se ha impedido abrir una web bloqueada; devuelve cómo dejar de escuchar |
| `onOpenTab(cb)` | una web pide abrir un enlace en pestaña nueva; si nadie escucha, va al navegador del sistema |

La app no lo usa directamente: pasa por `src/platform/index.ts`.

### Ventanas nuevas y enlaces

- Enlace «en pestaña nueva» dentro de una web (`target=_blank`, `window.open` sin tamaño, botón
  derecho → «Abrir enlace en una pestaña nueva») → **pestaña nueva de LockIn**, pasando por los
  mismos avisos de distracciones e historial que la barra de direcciones. Así el estudiante no sale
  de la app.
- Ventana emergente de verdad (`window.open` con tamaño, p. ej. «Iniciar sesión con Google» en otra
  web) → **ventana pequeña de LockIn**: la web necesita seguir conectada con ella para terminar.
- Botón «Iniciar sesión» de LockIn → ventana de LockIn con la página oficial. Google entra en la
  sesión de las pestañas (Docs, Drive, Classroom, YouTube…).
- Enlaces de la propia app (↗, «Descargar»…) → navegador del sistema.

### Modo Estricto

Mientras hay un bloque de concentración en modo Estricto, la app manda la lista de webs bloqueadas
(`setBlockedSites`). Se impide llegar a ellas de tres formas: al pulsar un enlace o enviar un
formulario, en las redirecciones y, como última barrera, en cualquier carga de página (también
«Atrás» o recargar). Cada vez se avisa a la app (`onBlockedNavigation`), que lo muestra en un aviso.

### Seguridad (lista de Electron)

- Ventana de la app: `contextIsolation`, `sandbox`, sin `nodeIntegration`, sin módulo `remote`;
  solo puede navegar dentro de `app://lockin/`.
- Cada `<webview>` se fuerza a preferencias seguras (sin Node, sin preload, sesión de las webs),
  aunque la página intente otra cosa. Solo direcciones `http/https`. Las webs no pueden crear
  `<webview>` ni ir a `app://` o `file://`.
- Los mensajes al proceso principal solo se aceptan desde la página principal de la app y las
  direcciones se comprueban (`http/https`).
- Permisos: la app puede mandar notificaciones (temporizador). Las webs pueden usar pantalla
  completa, copiar y contenido protegido; **cámara y micrófono se preguntan** (Meet, Teams…);
  notificaciones, ubicación, USB, etc. se deniegan.
- En los instaladores se apagan los «fuses» peligrosos de Electron (`runAsNode`, `NODE_OPTIONS`,
  `--inspect`) y solo se carga la app desde su `app.asar`.
- El agente de usuario no lleva «Electron» para que las webs traten a LockIn como a Chrome.

### YouTube

YouTube exige que su reproductor incrustado sepa qué app lo usa (cabecera `Referer`). Desde
`app://` Chromium no la manda y salía «Error 153», así que LockIn añade `https://app.lockin.desktop/`
solo a esas peticiones y solo si no llevan ya una.

## Probar

```bash
# Tests de las reglas (desde la raíz)
npx vitest run desktop

# Comprobar tipos
npm run typecheck

# Prueba de humo: abre LockIn, carga webs en pestañas, prueba el bloqueo, las ventanas nuevas…
npm run smoke                      # en Linux sin pantalla: xvfb-run -a npm run smoke
```

La prueba de humo usa Playwright (`npm i -D playwright-core` si no lo tienes) y admite:

- `LOCKIN_WEB_DIR=/ruta/dist` — probar con otra build de la web (solo al desarrollar).
- `LOCKIN_SMOKE_CA=/ruta/ca.crt` — detrás de un proxy que reabre el TLS con su propia CA.
- `LOCKIN_SMOKE_APP=release/linux-unpacked/lockin` — probar la app empaquetada. Como los
  instaladores apagan `--inspect`, para esto hay que empaquetar con
  `npx electron-builder --dir -c.electronFuses.enableNodeCliInspectArguments=true`.

## Pendiente

- Compartir pantalla en Meet/Teams (`getDisplayMedia`) aún no está preparado.
- Los enlaces `mailto:` o de programas (p. ej. `zoommtg:`) dentro de las pestañas no se abren.
- Google puede bloquear el inicio de sesión dentro de apps («Este navegador o esta aplicación pueden
  no ser seguros»). Si pasa, abre el documento con ↗ en el navegador del sistema.
- Firmar los instaladores y las actualizaciones automáticas.
