// =============================================================
// MAPA (Leaflet)
// -------------------------------------------------------------
// Leaflet es una librería gratuita para mostrar mapas. Los
// "mosaicos" (las imágenes del mapa) vienen de OpenStreetMap.
// Cada paradero se dibuja como un círculo cuyo color depende
// de cuántos reportes tiene en los últimos DIAS_VENTANA días.
// =============================================================

import { textoCategoria } from "./datos.js";

const CENTRO_TADEO = [4.6038, -74.0672]; // aprox. sede principal de la Tadeo
export const DIAS_VENTANA = 30;

// Escala de colores (de menos a más reportes)
const NIVELES = [
  { min: 0, color: "#2e9e5b", texto: "0 reportes" },
  { min: 1, color: "#e0b100", texto: "1 a 2" },
  { min: 3, color: "#ef7d1a", texto: "3 a 5" },
  { min: 6, color: "#d62f2f", texto: "6 o más" }
];

function colorPorCantidad(n) {
  let color = NIVELES[0].color;
  for (const nivel of NIVELES) if (n >= nivel.min) color = nivel.color;
  return color;
}

let mapa = null;
let capaCalor = null;   // capa del mapa de calor (leaflet.heat)
let calorVisible = true;
const circulos = {}; // paraderoId -> círculo dibujado

export function crearMapa(idContenedor, paraderos) {
  // `L` es el objeto global que trae Leaflet (cargado en index.html)
  mapa = L.map(idContenedor).setView(CENTRO_TADEO, 17);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; colaboradores de OpenStreetMap"
  }).addTo(mapa);

  // Mapa de calor: se dibuja ANTES que los círculos para que quede debajo.
  // `L.heatLayer` viene del plugin leaflet.heat (cargado en index.html).
  capaCalor = L.heatLayer([], { radius: 35, blur: 25, maxZoom: 18 }).addTo(mapa);

  for (const p of paraderos) {
    circulos[p.id] = L.circleMarker([p.lat, p.lng], {
      radius: 9,
      weight: 1.5,
      color: "#ffffff",
      fillColor: colorPorCantidad(0),
      fillOpacity: 0.95
    })
      .addTo(mapa)
      .bindPopup(`<strong>${p.nombre}</strong><br>${p.codigo}`)
      .bindTooltip(p.codigo, {
        permanent: true,
        direction: "top",
        offset: [0, -6],
        className: "etiqueta-paradero"
      });
  }

  // Encuadra el mapa para que se vean todos los paraderos
  if (paraderos.length > 0) {
    mapa.fitBounds(paraderos.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 17 });
  }

  agregarLeyenda();
  agregarBotonCalor();
}

// Botón para mostrar/ocultar el mapa de calor, por si tapa los paraderos
function agregarBotonCalor() {
  const control = L.control({ position: "topright" });
  control.onAdd = () => {
    const boton = L.DomUtil.create("button", "boton-calor");
    boton.type = "button";
    boton.textContent = "🔥 Calor: ON";
    boton.title = "Mostrar u ocultar el mapa de calor";
    L.DomEvent.disableClickPropagation(boton);
    boton.addEventListener("click", () => {
      calorVisible = !calorVisible;
      if (calorVisible) {
        capaCalor.addTo(mapa);
        boton.textContent = "🔥 Calor: ON";
      } else {
        mapa.removeLayer(capaCalor);
        boton.textContent = "🔥 Calor: OFF";
      }
    });
    return boton;
  };
  control.addTo(mapa);
}

function agregarLeyenda() {
  const leyenda = L.control({ position: "bottomright" });
  leyenda.onAdd = () => {
    const div = L.DomUtil.create("div", "leyenda");
    div.innerHTML =
      `<strong>Reportes (${DIAS_VENTANA} días)</strong>` +
      NIVELES.map((n) => `<div><span style="background:${n.color}"></span>${n.texto}</div>`).join("");
    return div;
  };
  leyenda.addTo(mapa);
}

// Recalcula colores, ventanas emergentes y el mapa de calor con la lista de reportes
export function actualizarMapa(paraderos, reportes) {
  if (!mapa) return;
  const limite = Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000;
  const puntosCalor = [];

  for (const p of paraderos) {
    const suyos = reportes.filter((r) => r.paraderoId === p.id && r.creadoEn.getTime() >= limite);
    const circulo = circulos[p.id];
    if (!circulo) continue;

    circulo.setStyle({ fillColor: colorPorCantidad(suyos.length) });

    const ultimo = suyos[0]; // la lista ya viene del más nuevo al más viejo
    circulo.setPopupContent(
      `<strong>${p.nombre}</strong><br>` +
      `Código: ${p.codigo}<br>` +
      `Reportes (${DIAS_VENTANA} días): <strong>${suyos.length}</strong>` +
      (ultimo
        ? `<br>Último: ${textoCategoria(ultimo.categoria)}<br><small>${ultimo.creadoEn.toLocaleString("es-CO", { timeZone: "America/Bogota" })}</small>`
        : "")
    );

    // Un punto de calor por cada reporte reciente, en la ubicación del
    // paradero. Leaflet.heat suma la intensidad cuando hay varios puntos
    // muy cerca, así que más reportes = mancha más caliente.
    for (let i = 0; i < suyos.length; i++) puntosCalor.push([p.lat, p.lng, 0.6]);
  }

  if (capaCalor) capaCalor.setLatLngs(puntosCalor);
}

// Leaflet necesita "recalcular" su tamaño cuando el mapa estaba oculto
export function refrescarTamano() {
  if (mapa) setTimeout(() => mapa.invalidateSize(), 50);
}
