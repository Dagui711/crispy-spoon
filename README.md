# Paradero Seguro · SITP Tadeo

App web para reportar incidentes de inseguridad en los paraderos del SITP cercanos a la
Universidad Jorge Tadeo Lozano (Bogotá). Es el proyecto de aula de Ingeniería de Sistemas
(nocturna, primer semestre) del grupo: Luisa Tovar, Catalina Moreno, Samir Quintero,
Ángel Parra, Camilo Montaña y Daniel Gómez.

**Estado:** Fase 1 (MVP), para pruebas internas del equipo.

| Funcionalidad del MVP                         | Estado |
|-----------------------------------------------|--------|
| Reportar incidente (paradero + categoría)     | ✅ |
| Confirmación (paradero, hora, categoría)      | ✅ |
| Lista de reportes recientes (tiempo real)     | ✅ |
| Mapa con paraderos coloreados por reportes    | ✅ |
| Sin login (anónimo)                           | ✅ |
| Abrir desde QR con paradero preseleccionado   | ✅ (`?paradero=481A00`) |

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
amarillo): los reportes se guardan solo en tu navegador. Sirve para probar la
interfaz. Para que todo el equipo vea los mismos reportes, sigue
[docs/GUIA-FIREBASE.md](docs/GUIA-FIREBASE.md).

## Estructura del proyecto

```
crispy-spoon/
├── index.html          ← la página: estructura de las 3 pestañas
├── css/
│   └── estilos.css     ← colores, tamaños y diseño
├── js/
│   ├── app.js          ← lógica principal: formulario, lista, pestañas
│   ├── datos.js        ← ÚNICO archivo que habla con la base de datos
│   ├── mapa.js         ← todo lo del mapa (Leaflet)
│   ├── catalogos.js    ← datos fijos: categorías y paraderos (modo demo)
│   └── config.js       ← configuración de Firebase (la pegas tú)
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
- **Leaflet** + **OpenStreetMap**: mapa gratuito y de código abierto.

## Próximos pasos (Fase 2)

Mapa de calor real · instalación como PWA · confirmación comunitaria de reportes ·
anti-spam (throttle) · botón de emergencia · compartir por WhatsApp · resumen semanal
y patrones por hora · indicador de transparencia · modo oscuro de alto contraste ·
CAI cercano / cómo llegar.
