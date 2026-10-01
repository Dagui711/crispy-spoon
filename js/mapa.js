// ============================================================
// Mapa con Leaflet
// ------------------------------------------------------------
// "L" es el objeto global que crea la librería Leaflet (cargada en index.html).
// Hay dos vistas: círculos por paradero (con el número de reportes)
// y mapa de calor (plugin leaflet.heat).
// ============================================================
import { CENTRO_MAPA, CAIS } from "./catalogos.js";

let mapa = null;
let capaCirculos = null;
let capaCalor = null;
const marcadores = {}; // codigo de paradero → marcador en el mapa

// Convierte una cantidad de reportes en un nivel de color (0 a 3)
export function nivelPorCantidad(cantidad) {
  if (cantidad === 0) return 0;
  if (cantidad <= 2) return 1;
  if (cantidad <= 5) return 2;
  return 3;
}

export function crearMapa(idContenedor, paraderos) {
  mapa = L.map(idContenedor).setView(CENTRO_MAPA, 17);

  // Las "teselas" son las imágenes del mapa base (calles), de OpenStreetMap
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  capaCirculos = L.layerGroup().addTo(mapa);
  for (const p of paraderos) {
    marcadores[p.codigo] = L.marker([p.lat, p.lng], { icon: iconoConteo(0) })
      .bindPopup(() => contenidoPopup(p, marcadores[p.codigo].cantidad ?? 0))
      .addTo(capaCirculos);
    marcadores[p.codigo].paradero = p;
  }

  // CAI verificados (si hay en catalogos.js). Se ven en ambas vistas.
  for (const cai of CAIS) {
    L.marker([cai.lat, cai.lng], {
      icon: L.divIcon({ className: "", html: '<div class="marcador-cai">👮</div>', iconSize: [30, 30], iconAnchor: [15, 15] }),
    })
      .bindPopup(() => {
        const div = document.createElement("div");
        div.innerHTML = `<strong></strong><br><a target="_blank" rel="noopener">🚶 Cómo llegar</a>`;
        div.querySelector("strong").textContent = cai.nombre;
        div.querySelector("a").href = enlaceComoLlegar(cai.lat, cai.lng);
        return div;
      })
      .addTo(mapa);
  }

  // El plugin de calor puede no cargar (sin internet); el resto sigue funcionando
  if (typeof L.heatLayer === "function") {
    capaCalor = L.heatLayer([], { radius: 45, blur: 30, maxZoom: 17, minOpacity: 0.35 });
  }
}

// Ícono redondo de color con el número de reportes adentro.
// Es un pedacito de HTML; su aspecto está en css/estilos.css (.marcador-conteo).
function iconoConteo(cantidad) {
  return L.divIcon({
    className: "",
    html: `<div class="marcador-conteo nivel-${nivelPorCantidad(cantidad)}">${cantidad}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17], // el centro del círculo cae justo en el paradero
    popupAnchor: [0, -17],
  });
}

// Google Maps: indicaciones a pie hasta un punto
function enlaceComoLlegar(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

// Google Maps: buscar "CAI" alrededor de un punto
function enlaceBuscarCai(lat, lng) {
  return `https://www.google.com/maps/search/CAI+Polic%C3%ADa/@${lat},${lng},17z`;
}

// Ventanita que aparece al tocar un paradero.
// Se construye con textContent para que ningún texto se interprete como HTML.
function contenidoPopup(p, cantidad) {
  const div = document.createElement("div");
  div.className = "popup-paradero";
  div.innerHTML = `
    <strong></strong>
    <div class="popup-codigo"></div>
    <div class="popup-cantidad"></div>
    <a class="popup-enlace" target="_blank" rel="noopener">🚶 Cómo llegar</a>
    <a class="popup-enlace" target="_blank" rel="noopener">👮 Buscar CAI cercano</a>`;
  div.querySelector("strong").textContent = p.nombre;
  div.querySelector(".popup-codigo").textContent = `Código: ${p.codigo}`;
  div.querySelector(".popup-cantidad").textContent =
    `${cantidad} reporte${cantidad === 1 ? "" : "s"} activo${cantidad === 1 ? "" : "s"}`;
  const [llegar, cai] = div.querySelectorAll("a");
  llegar.href = enlaceComoLlegar(p.lat, p.lng);
  cai.href = enlaceBuscarCai(p.lat, p.lng);
  return div;
}

// Recibe { "481A00": 3, "504A00": 0, ... } y actualiza círculos y calor
export function actualizarMapa(conteoPorParadero) {
  const puntosCalor = [];
  const maximo = Math.max(1, ...Object.values(conteoPorParadero));
  for (const [codigo, marcador] of Object.entries(marcadores)) {
    const cantidad = conteoPorParadero[codigo] ?? 0;
    marcador.cantidad = cantidad;
    marcador.setIcon(iconoConteo(cantidad));
    if (cantidad > 0) {
      const p = marcador.paradero;
      puntosCalor.push([p.lat, p.lng, cantidad / maximo]);
    }
  }
  if (capaCalor) capaCalor.setLatLngs(puntosCalor);
}

// Cambia entre "circulos" y "calor"
export function cambiarVista(vista) {
  if (!mapa) return;
  if (vista === "calor" && capaCalor) {
    mapa.removeLayer(capaCirculos);
    capaCalor.addTo(mapa);
  } else {
    if (capaCalor) mapa.removeLayer(capaCalor);
    capaCirculos.addTo(mapa);
  }
}

export function calorDisponible() {
  return Boolean(capaCalor);
}

// Leaflet calcula mal su tamaño si el mapa estaba oculto (pestaña inactiva).
// Llamamos esto cada vez que se muestra la pestaña del mapa.
export function refrescarTamano() {
  if (mapa) mapa.invalidateSize();
}
