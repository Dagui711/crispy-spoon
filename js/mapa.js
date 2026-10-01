// ============================================================
// Mapa con Leaflet
// ------------------------------------------------------------
// "L" es el objeto global que crea la librería Leaflet (cargada en index.html).
// ============================================================
import { CENTRO_MAPA } from "./catalogos.js";

let mapa = null;
const marcadores = {}; // codigo de paradero → círculo en el mapa

// Convierte una cantidad de reportes en un nivel de color (0 a 3)
export function nivelPorCantidad(cantidad) {
  if (cantidad === 0) return 0;
  if (cantidad <= 2) return 1;
  if (cantidad <= 5) return 2;
  return 3;
}

export function crearMapa(idContenedor, paraderos) {
  mapa = L.map(idContenedor).setView(CENTRO_MAPA, 16);

  // Las "teselas" son las imágenes del mapa base (calles), de OpenStreetMap
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  for (const p of paraderos) {
    marcadores[p.codigo] = L.marker([p.lat, p.lng], { icon: iconoConteo(0) })
      .bindPopup("")
      .addTo(mapa);
    marcadores[p.codigo].paradero = p;
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

// Recibe { "481A00": 3, "504A00": 0, ... } y repinta los círculos
export function actualizarColores(conteoPorParadero) {
  for (const [codigo, marcador] of Object.entries(marcadores)) {
    const cantidad = conteoPorParadero[codigo] ?? 0;
    marcador.setIcon(iconoConteo(cantidad));
    marcador.setPopupContent(
      `<strong>${marcador.paradero.nombre}</strong><br>` +
      `Código: ${codigo}<br>` +
      `${cantidad} reporte(s) en los últimos días`,
    );
  }
}

// Leaflet calcula mal su tamaño si el mapa estaba oculto (pestaña inactiva).
// Llamamos esto cada vez que se muestra la pestaña del mapa.
export function refrescarTamano() {
  if (mapa) mapa.invalidateSize();
}
