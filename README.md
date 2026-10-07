# Paradero Seguro · SITP Tadeo

App web para reportar incidentes de inseguridad en los paraderos del SITP cercanos a la
Universidad Jorge Tadeo Lozano (Bogotá). Es el proyecto de aula de Ingeniería de Sistemas
(nocturna, primer semestre) del grupo: Luisa Tovar, Catalina Moreno, Samir Quintero,
Ángel Parra, Camilo Montaña y Rafael Daniel Aguilera Gamez.

**Autor principal:** Rafael Daniel Aguilera Gamez, con la idea del proyecto y el desarrollo
de la app, programada junto con Claude (asistente de IA de Anthropic).

**En línea:** <https://dagui711.github.io/crispy-spoon/> (pruebas internas del equipo).

| Fase 1 (MVP)                                  | Estado |
|-----------------------------------------------|--------|
| Reportar incidente (paradero + categoría)     | ✅ |
| Confirmación (paradero, hora, categoría)      | ✅ |
| Lista de reportes recientes (tiempo real)     | ✅ |
| Mapa con paraderos coloreados por reportes    | ✅ |
| Sin login (anónimo)                           | ✅ |
| Abrir desde QR con paradero preseleccionado   | ✅ (`?paradero=481A00`) |

| Fase 2                                        | Estado |
|-----------------------------------------------|--------|
| Mapa de calor                                 | ✅ |
| Instalable como app (PWA), con carga de la interfaz sin conexión | ✅ |
| Confirmación comunitaria ("sigue ocurriendo" / "ya se resolvió") | ✅ |
| Anti-spam: 1 reporte cada 2 min por sesión anónima | ✅ |
| Botón de emergencia (123, 155, ubicación por WhatsApp) | ✅ |
| Compartir reportes por WhatsApp               | ✅ |
| Resumen semanal y patrones por hora / franja  | ✅ |
| Indicador de transparencia (indicaciones de la comunidad y antigüedad) | ✅ |
| Modo noche de alto contraste                  | ✅ |
| Cómo llegar y CAI cercano (Google Maps)       | ✅ |

## Alcance y limitaciones

- **Los datos son reportes de la comunidad.** Son reportes voluntarios hechos en la app:
  no son un registro oficial ni incluyen todos los incidentes que ocurren. Con pocos
  reportes, los patrones del Resumen son una referencia, no una conclusión.
- **La confirmación es comunitaria, no oficial.** "Sigue ocurriendo" y "Ya se resolvió"
  indican lo que dicen otras personas; nadie verifica el incidente.
- **El límite es por sesión anónima.** El anti-spam (1 reporte cada 2 min) y el voto único
  usan la identidad anónima que Firebase guarda en el navegador. Si alguien borra los datos
  del navegador, recibe una identidad nueva. Es el costo de permitir participar sin registro.
- **Sin conexión solo carga la interfaz.** Enviar reportes, ver reportes nuevos, votar y
  cargar zonas nuevas del mapa necesitan internet.

## Cómo probarla en tu computador

La app usa *módulos* de JavaScript (`import` / `export`). Por seguridad, el navegador
no permite cargarlos si abres `index.html` con doble clic: hay que servirla con un
pequeño servidor local. Dos opciones:

**Opción A — VS Code (la más fácil):**
1. Instala la extensión **Live Server**.
2. Abre la carpeta del proyecto, clic derecho en `index.html` → *Open with Live Server*.

**Opción B — Terminal con Python:**
```bash
cd crispy-spoon
python3 -m http.server 8000
```
Luego abre <http://localhost:8000> en el navegador.

Mientras no configures Firebase, la app arranca en **modo demo** (verás un aviso
con franjas de precaución): los reportes se guardan solo en tu navegador. Sirve para probar la
interfaz. Para que todo el equipo vea los mismos reportes, sigue
[docs/GUIA-FIREBASE.md](docs/GUIA-FIREBASE.md).

## Estructura del proyecto

```
crispy-spoon/
├── index.html          ← la página: estructura de las 4 pestañas
├── css/
│   └── estilos.css     ← colores, tamaños y diseño
├── js/
│   ├── app.js          ← lógica principal: formulario, lista, pestañas, SOS, tema
│   ├── datos.js        ← ÚNICO archivo que habla con la base de datos
│   ├── analisis.js     ← cálculos: franjas, transparencia, resumen semanal
│   ├── resumen.js      ← pestaña Resumen (gráficos de barras)
│   ├── mapa.js         ← todo lo del mapa (Leaflet + mapa de calor)
│   ├── catalogos.js    ← datos fijos: categorías y lista semilla de paraderos
│   └── config.js       ← configuración de Firebase (la pegas tú)
├── sembrar.html        ← página de un solo uso: crea los paraderos en Firestore
├── sw.js               ← service worker (PWA: instalar y cargar la interfaz sin conexión)
├── manifest.webmanifest← nombre, colores e íconos de la app instalada
├── iconos/             ← ícono de la app
├── firestore.rules     ← reglas de seguridad de la base de datos
├── firebase.json       ← configuración para publicar con Firebase
└── docs/
    ├── GUIA-FIREBASE.md   ← paso a paso para conectar Firebase
    └── ESQUEMA-DATOS.md   ← colecciones, campos y por qué
```

**¿Por qué separar en varios archivos?** Cada archivo tiene una sola responsabilidad.
Si mañana cambian Firebase por otra base de datos, solo se toca `datos.js`. Si quieren
otro mapa, solo `mapa.js`. Esto se llama *separación de responsabilidades* y es buen
material para la parte escrita del proyecto.

**Cómo viaja un reporte:**
`index.html` (el usuario llena el formulario) → `app.js` (valida) →
`datos.js` (lo guarda en Firestore) → Firestore revisa `firestore.rules` → si es válido,
lo guarda y avisa a todos los que tienen la app abierta → `app.js` repinta la lista y
`mapa.js` los colores.

## Tecnologías

- **HTML, CSS y JavaScript** puros (sin frameworks), para que el código sea fácil de leer.
- **Firebase Firestore**: base de datos en la nube, en tiempo real.
- **Firebase Authentication** (acceso anónimo): identidad sin registro para el anti-spam y los votos.
- **Leaflet** + **OpenStreetMap**: mapa gratuito y de código abierto (con **leaflet.heat** para el mapa de calor).
- Las librerías externas se cargan desde CDN con **versiones fijadas**: Leaflet 1.9.4,
  leaflet.heat 0.2.0 y Firebase 11.0.2.

## Pendientes

- QR de los 4 paraderos.
