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
2. Edición: **Standard** (si lo pregunta).
3. Ubicación: `southamerica-east1 (São Paulo)`, la más cercana a Bogotá.
   ⚠️ No se puede cambiar después.
4. Modo: **Modo de prueba**. Deja escribir a cualquiera por unos minutos, justo lo que
   necesita el semillero del paso 4. En el paso 5 lo cerramos con nuestras reglas.

## Paso 3 — Registrar la app web y copiar la configuración

1. ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → sección **Tus apps** →
   ícono **`</>`** (Web).
2. Apodo: `paradero-web`. **No** marques Firebase Hosting por ahora → **Registrar app**.
3. Te muestra un bloque `const firebaseConfig = { apiKey: "...", ... }`.
4. Copia esos valores en [`js/config.js`](../js/config.js), reemplazando las comillas vacías,
   y guarda (Ctrl+S).

## Paso 4 — Sembrar los paraderos

En vez de crearlos a mano en la consola, [`sembrar.html`](../sembrar.html) los crea con
un botón, a partir de la lista `PARADEROS_SEMILLA` de [`js/catalogos.js`](../js/catalogos.js):

1. En VS Code, clic derecho en `sembrar.html` → **Open with Live Server**.
2. Revisa la lista que muestra y pulsa **Crear paraderos**.
3. Deben salir 4 líneas con ✔ y "Listo".
4. En la consola de Firebase → Firestore → pestaña **Datos** debe aparecer la colección
   `paraderos` con 4 documentos.

| ID del documento    | `nombre`                       | `lat`               | `lng`                |
|---------------------|--------------------------------|---------------------|----------------------|
| `481A00`            | `U. Jorge Tadeo Lozano 481A00` | `4.607891187072479` | `-74.06873441620392` |
| `504A00`            | `U. Jorge Tadeo Lozano 504A00` | `4.606975419584897` | `-74.06745538416442` |
| `113A00`            | `Br. Las Nieves`               | `4.608110479244784` | `-74.06717069923171` |
| `664A00`            | `Estación Universidades`       | `4.605146708561095` | `-74.06722341866632` |

Si sale ✘ con `PERMISSION_DENIED`, la base no está en modo de prueba: en la pestaña
**Reglas** pega temporalmente esto, publica, siembra y sigue con el paso 5:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

**¿Y si agregan otro paradero después?** En Google Maps, clic derecho sobre el
paradero → el primer renglón son las coordenadas; el primer número es `lat` y el
segundo `lng`. Agrégalo a `PARADEROS_SEMILLA`, vuelve a poner las reglas abiertas de
arriba, siembra, y vuelve a publicar `firestore.rules`. Sembrar dos veces no duplica:
reemplaza cada paradero por su versión nueva.

## Paso 4b — Activar el acceso anónimo

El anti-spam y la confirmación comunitaria necesitan una identidad anónima por
navegador (sin nombre ni correo):

1. Menú izquierdo → **Compilación / Build → Authentication → Comenzar**.
2. Pestaña **Método de acceso (Sign-in method)** → **Anónimo** → actívalo → **Guardar**.
3. Pestaña **Configuración → Dominios autorizados** → **Agregar dominio** →
   `dagui711.github.io`.

Sin este paso, la app muestra "Falta activar el acceso Anónimo" al reportar o votar.

## Paso 5 — Publicar las reglas de seguridad (¡no lo saltes!)

1. Firestore Database → pestaña **Reglas**.
2. Borra lo que hay, pega todo el contenido de [`firestore.rules`](../firestore.rules).
3. **Publicar**.

El modo de prueba deja que cualquiera borre o cambie todo. Desde que publicas las
reglas, solo se pueden crear reportes bien formados, y `sembrar.html` ya no puede
escribir (si lo intentas verás ✘ `PERMISSION_DENIED`: eso es lo correcto).

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
`firebase deploy` también publica `firestore.rules`, así que el paso 5 queda automatizado.

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
| `Missing or insufficient permissions`    | El paradero elegido no existe en Firestore (paso 4) |
| `No hay paraderos en la base de datos`   | Falta sembrar (paso 4)                      |
| `Failed to load module script` / CORS    | Abriste `index.html` con doble clic; usa un servidor local |
| `api-key-not-valid`                      | Revisa lo que pegaste en `js/config.js`      |
