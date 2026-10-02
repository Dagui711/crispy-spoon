// ============================================================
// Service worker: un programa pequeño que el navegador guarda y
// que se pone "en medio" de las descargas de la app. Sirve para:
//   - Que la app se pueda instalar (PWA).
//   - Que abra aunque la señal esté mala (usa la copia guardada).
//
// Estrategia:
//   - Archivos de la app (html, css, js): primero internet, para tener
//     siempre la última versión; si no hay conexión, la copia guardada.
//   - Librerías externas (Leaflet, Firebase, tipografías de Google Fonts):
//     primero la copia guardada, porque su versión nunca cambia.
//   - Firestore y el mapa base: no se tocan (Firebase maneja lo suyo).
//
// ⚠️ Si cambias la lista de archivos, sube el número de VERSION.
// ============================================================
const VERSION = "v3";
const CACHE = `paradero-seguro-${VERSION}`;

const ARCHIVOS_APP = [
  "./",
  "index.html",
  "css/estilos.css",
  "js/app.js",
  "js/analisis.js",
  "js/catalogos.js",
  "js/config.js",
  "js/datos.js",
  "js/mapa.js",
  "js/resumen.js",
  "manifest.webmanifest",
  "iconos/icono.svg",
  "iconos/icono-180.png",
  "iconos/icono-192.png",
  "iconos/icono-512.png",
  "iconos/icono-maskable-512.png",
];

const LIBRERIAS = [
  "https://cdnjs.cloudflare.com/",
  "https://www.gstatic.com/firebasejs/",
  "https://fonts.googleapis.com/",   // hojas de estilo de las tipografías
  "https://fonts.gstatic.com/",      // archivos de las tipografías
];

// Al instalarse: guarda los archivos de la app
self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS_APP)));
  self.skipWaiting();
});

// Al activarse: borra copias de versiones viejas
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = pedido.url;

  if (LIBRERIAS.some((base) => url.startsWith(base))) {
    evento.respondWith(primeroCopia(pedido));
  } else if (new URL(url).origin === self.location.origin) {
    evento.respondWith(primeroInternet(pedido));
  }
  // Todo lo demás (Firestore, mapa base) pasa directo, sin intervenir
});

async function primeroCopia(pedido) {
  const guardada = await caches.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone());
  return respuesta;
}

async function primeroInternet(pedido) {
  try {
    const respuesta = await fetch(pedido);
    if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone());
    return respuesta;
  } catch {
    // Sin conexión: usamos la copia (ignorando "?paradero=..." en la dirección)
    const guardada = await caches.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    throw new Error("Sin conexión y sin copia guardada");
  }
}
