# ENAd Web

ENAd Web es el portal de **Enseñar al nivel adecuado**, el programa de la Fundación Aprender a Quererte. Docentes registran asistencia, evaluaciones y horas desde el portal o desde ENAd Móvil, la aplicación Flutter. Coordinación gestiona los colegios de su cuenta. La Fundación mantiene el programa, las cuentas y las actividades.

Ambos clientes usan las mismas cuentas de Firebase Auth, el mismo modelo de documentos y las mismas reglas de Cloud Firestore en el proyecto `enad-entrega-final`. Cuando un cambio se sincroniza, quienes tienen acceso pueden verlo en el otro cliente. Las vistas con suscripciones a Firestore se actualizan en vivo.

## Desarrollo local

Usa Node.js 22. En el repositorio principal, ejecuta los comandos desde `web-portal/`. En el repositorio público, ejecútalos desde la raíz.

```sh
npm ci
npm run dev
```

Para verificar tipos, pruebas unitarias, lint y compilación de producción, ejecuta la misma secuencia que en CI.

```sh
npm run typecheck && npm test && npm run lint && npm run build
```

## Prueba de navegación

Con `dist/` compilado y Chromium de Playwright instalado, inicia la vista previa con `npm run preview`. En otra terminal, ejecuta `npm run smoke`. Por defecto, abre `http://localhost:4173/`, comprueba la portada y el formulario de ingreso, y guarda capturas de 375, 768 y 1440 px en `shots/`.

Para reproducir la ruta de GitHub Pages con la misma compilación, usa estas dos terminales.

```sh
# Terminal 1
npm run preview -- --base /enad-web/ --port 4173 --strictPort
```

```sh
# Terminal 2
npm run smoke -- http://localhost:4173/enad-web/
```

El smoke bloquea los servicios externos. Para verificar el menú lateral, el foco del menú móvil y la navegación hasta Grupos, compila con `VITE_USE_EMULATORS=true` y define `ENAD_USER` y `ENAD_PASS` con una cuenta del emulador local.

El [contrato del portal](CONTRACT.md) detalla las rutas y las interfaces compartidas. En el repositorio principal, `PRODUCT.md` describe el programa, `docs/contract.md` define el modelo de datos y `lib/` contiene la implementación Flutter de referencia.

## Cuentas de demostración

Puedes ingresar con el usuario o con su correo del dominio `@enad.app`. La contraseña se entrega por separado.

| Usuario | Rol y alcance |
| --- | --- |
| `sfundacion` | Fundación, gestión del programa y todos los colegios |
| `scoordinador` | Coordinación, gestión de los colegios asignados |
| `sdocente` | Docente, registro y consulta en las instituciones asignadas |

## Publicación en GitHub Pages

1. Crea el repositorio público `SamuelCharry/enad-web` vacío. Su raíz recibirá el contenido y el historial de `web-portal/`.
2. En el repositorio público, abre **Settings → Pages → Source** y selecciona **GitHub Actions**.
3. Desde la raíz del repositorio principal, con los cambios que quieres publicar confirmados y el árbol de trabajo limpio, ejecuta `web-portal/scripts/publish.sh`. El script prepara la rama local `enad-web-publish` con `git subtree split` y la envía a `main` con `--force-with-lease`. Puedes pasar un nombre de remoto o una URL como único argumento. Haz los cambios del portal en el repositorio principal, pues la publicación puede reemplazar el historial de la copia pública.
4. En **Actions**, revisa **Publicar en GitHub Pages**. Cada envío a `main` verifica y compila el portal antes de publicar el artefacto `dist/`. También puedes iniciar el flujo con **Run workflow**. Las solicitudes de cambio ejecutan únicamente las verificaciones.

Vite genera rutas de recursos relativas con `base: './'`. El portal usa HashRouter, por lo que una ruta como `/enad-web/#/login` carga el documento de entrada desde `/enad-web/`. El dominio `samuelcharry.github.io` ya está autorizado en Firebase Auth. [Abrir ENAd Web](https://samuelcharry.github.io/enad-web/)

## Créditos

La portada se construyó con el flujo de trabajo de la habilidad MotionSites web-builder. El pulido de la interfaz utilizó **unslop by Damir Sokolovsky (CC BY 4.0)**.
