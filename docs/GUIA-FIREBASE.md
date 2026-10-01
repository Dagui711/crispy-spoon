# Guía: conectar la app a Firebase

Tiempo estimado: 20–30 minutos. Todo es gratis (plan **Spark**), no pide tarjeta.

> Los nombres de los botones pueden variar un poco si Firebase cambia su consola,
> pero los pasos son los mismos.

## Paso 1 — Crear el proyecto

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto** → nombre: `paradero-seguro-tadeo` (o el que quieran).
3. Google Analytics: puedes **desactivarlo** (no lo necesitamos).

## Paso 2 — Crear la base de datos Firestore

1. Menú izquierdo → **Compilación / Build → Firestore Database → Crear base de datos**.
2. Ubicación: `southamerica-east1 (São Paulo)`, la más cercana a Bogotá.
   ⚠️ No se puede cambiar después.
3. Modo: **Producción** (bloquea todo; en el paso 4 ponemos nuestras reglas).

## Paso 3 — Registrar la app web y copiar la configuración

1. ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → sección **Tus apps** →
   ícono **`</>`** (Web).
2. Apodo: `paradero-web`. **No** marques Firebase Hosting por ahora → **Registrar app**.
3. Te muestra un bloque `const firebaseConfig = { apiKey: "...", ... }`.
4. Copia esos valores en [`js/config.js`](../js/config.js), reemplazando las comillas vacías.

Al recargar la app, el aviso amarillo de "Modo demo" debe desaparecer.

## Paso 4 — Publicar las reglas de seguridad

1. Firestore Database → pestaña **Reglas**.
2. Borra lo que hay, pega todo el contenido de [`firestore.rules`](../firestore.rules).
3. **Publicar**.

Sin este paso la app mostrará "No se pudieron cargar los paraderos", porque el modo
producción bloquea todo.

## Paso 5 — Crear los 4 paraderos

Firestore Database → pestaña **Datos** → **+ Iniciar colección**:

1. ID de la colección: `paraderos` → Siguiente.
2. ID del documento: `481A00` (el código SITP, **no** uses "ID automático").
3. Campos:

   | Campo    | Tipo   | Valor                    |
   |----------|--------|--------------------------|
   | `nombre` | string | ej. `Calle 22 con Cra 4` |
   | `lat`    | number | ej. `4.6031`             |
   | `lng`    | number | ej. `-74.0690`           |

4. **Guardar**. Repite con **+ Agregar documento** para `504A00`, `907A00` y el cuarto.

**¿Cómo saco lat/lng reales?** En Google Maps, clic derecho exactamente sobre el
paradero → el primer renglón son las coordenadas (ej. `4.6031, -74.0690`); el primer
número es `lat`, el segundo `lng`. Para que el modo demo coincida, actualiza también
`PARADEROS_DEMO` en [`js/catalogos.js`](../js/catalogos.js).

La colección `reportes` **no** hay que crearla: aparece sola con el primer reporte.

## Paso 6 — Probar

1. Abre la app (Live Server o `python3 -m http.server 8000`).
2. Envía un reporte.
3. En la consola de Firebase, pestaña **Datos**, debe aparecer en `reportes`.
4. Abre la app en otra pestaña o en tu celular: el reporte aparece en "Recientes" sin recargar.

## Paso 7 (opcional) — Publicar en internet con Firebase Hosting

Para que el equipo la abra desde el celular con un enlace:

```bash
npm install -g firebase-tools   # una sola vez (necesitas Node.js instalado)
firebase login
firebase use --add              # elige tu proyecto
firebase deploy                 # publica la página y las reglas
```

Te dará un enlace tipo `https://paradero-seguro-tadeo.web.app`.
`firebase deploy` también publica `firestore.rules`, así que el paso 4 queda automatizado.

## Los QR de los paraderos

Cada QR puede llevar el paradero preseleccionado agregando `?paradero=CODIGO` al enlace:

```
https://paradero-seguro-tadeo.web.app/?paradero=481A00
```

Cualquier generador de QR gratuito sirve para convertir ese enlace en imagen.

## Si algo falla

Abre las herramientas de desarrollador del navegador (**F12** → pestaña **Consola**).
Los errores rojos dicen qué pasó. Los más comunes:

| Mensaje                                  | Causa probable                               |
|------------------------------------------|----------------------------------------------|
| `Missing or insufficient permissions`    | No publicaste las reglas (paso 4), o el paradero elegido no existe en Firestore |
| `No hay paraderos en la base de datos`   | Falta el paso 5                              |
| `Failed to load module script` / CORS    | Abriste `index.html` con doble clic; usa un servidor local |
| `api-key-not-valid`                      | Revisa lo que pegaste en `js/config.js`      |
