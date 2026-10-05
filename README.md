# Student App

Todo lo que un estudiante necesita para estudiar, **en un solo sitio**, para no ir saltando de web en web
ni acabar en el móvil.

- **Concentración**: eliges cuánto tiempo (mínimo 30 min). Al acabar te pregunta *«¿Quieres descansar o seguir?»*.
- **Tareas**: las apuntas y las tachas. Cada una se etiqueta sola con su asignatura.
- **Navegador**: busca o pega un enlace. Lo que abres se guarda clasificado por asignatura para volver con un clic,
  y te avisa si intentas abrir distracciones (Instagram, TikTok, Shorts…).
- **Apps**: tienda con apps de estudio (Google, IA, VS Code, máquinas virtuales, ciencias, apuntes, idiomas…).
  Las apps web se abren desde aquí; las descargables te llevan a su página oficial.
- **Música**: YouTube, YouTube Music y Spotify sin salir de la página.
- **Ajustes**: modo claro/oscuro, colores para cada parte, inicio de sesión en Google y Spotify, e instalación.

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

## Para desarrollar

- `npm test` — tests
- `npm run lint` — revisión del código
- `npm run build` — comprobación de tipos y versión final en `dist/`

Las decisiones del proyecto, la estructura y los próximos pasos están en [`CLAUDE.md`](CLAUDE.md).
