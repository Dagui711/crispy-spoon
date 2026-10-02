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
let puntosCalor = [];  // últimos puntos del calor (se aplican al mostrar la capa)
const marcadores = {}; // codigo de paradero → marcador en el mapa

// Ícono del sprite de index.html (el nombre siempre viene de nuestro código)
const icono = (nombre, clase = "ico") =>
  `<svg class="${clase}" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;

// --- El mapa y la barra del navegador siguen al tema (claro / noche) ---
// Los colores salen de las variables de css/estilos.css, así que aquí no
// hay colores escritos a mano.
const token = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

// Escala del mapa de calor: de ámbar (pocos) a rojo (muchos)
function degradadoCalor() {
  return { 0.25: token("--calor-1"), 0.5: token("--calor-2"), 0.75: token("--calor-3"), 1: token("--calor-4") };
}

// meta theme-color: si la persona eligió tema con el botón, manda ese;
// si no, cada meta conserva su media query (sigue al celular).
function sincronizarColorTema() {
  const elegido = document.documentElement.dataset.tema;
  const color = token("--color-tema");
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.dataset.original ??= meta.content;
    meta.content = elegido && color ? color : meta.dataset.original;
  }
}

function alCambiarTema() {
  // leaflet.heat solo puede redibujar si la capa está en el mapa; si no lo
  // está, el degradado nuevo se aplica al mostrarla (ver cambiarVista)
  if (capaCalor && mapa?.hasLayer(capaCalor)) capaCalor.setOptions({ gradient: degradadoCalor() });
  sincronizarColorTema();
}
new MutationObserver(alCambiarTema).observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", alCambiarTema);
sincronizarColorTema();

// Convierte una cantidad de reportes en un nivel de color (0 a 3)
export function nivelPorCantidad(cantidad) {
  if (cantidad === 0) return 0;
  if (cantidad <= 2) return 1;
  if (cantidad <= 5) return 2;
  return 3;
}

export function crearMapa(idContenedor, paraderos) {
  // El zoom va abajo a la derecha para que no tape la ventanita (popup)
  mapa = L.map(idContenedor, { zoomControl: false }).setView(CENTRO_MAPA, 17);
  L.control.zoom({ position: "bottomright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(mapa);

  // Las "teselas" son las imágenes del mapa base (calles), de OpenStreetMap.
  // Su color se ajusta a cada tema con un filtro en css/estilos.css
  // (.leaflet-tile-pane), así que cambiar de tema no necesita código aquí.
  // (Los mapas base de CARTO ahora piden una API key, por eso no se usan.)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  // Margen para que, al abrir una ventanita, el mapa se mueva y no quede
  // cortada ni tapada por los botones de zoom (abajo a la derecha)
  const opcionesPopup = {
    autoPanPaddingTopLeft: L.point(16, 24),
    autoPanPaddingBottomRight: L.point(64, 24),
    maxWidth: 280,
  };

  capaCirculos = L.layerGroup().addTo(mapa);
  for (const p of paraderos) {
    marcadores[p.codigo] = L.marker([p.lat, p.lng], {
      icon: iconoConteo(0, p.codigo),
      title: `${p.nombre} (${p.codigo})`,
      riseOnHover: true,
    })
      .bindPopup(() => contenidoPopup(p, marcadores[p.codigo].cantidad ?? 0), opcionesPopup)
      .addTo(capaCirculos);
    marcadores[p.codigo].paradero = p;
  }

  // CAI verificados (si hay en catalogos.js). Se ven en ambas vistas.
  // Son una placa de servicio rotulada "CAI" (sin número ni poste), y van
  // por DEBAJO de los paraderos (zIndexOffset) para no tapar ninguno.
  for (const cai of CAIS) {
    const marcadorCai = L.marker([cai.lat, cai.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="marcador-cai"><span class="cai-placa">${icono("shield")}CAI</span></div>`,
        iconSize: [60, 44], // recuadro táctil de 44 px de alto
        iconAnchor: [30, 22],
        popupAnchor: [0, -14],
      }),
      title: cai.nombre,
      zIndexOffset: -1000,
    })
      .bindPopup(() => {
        const div = document.createElement("div");
        div.className = "popup-paradero";
        div.innerHTML = `<strong class="popup-nombre"></strong>
          <a class="popup-enlace" target="_blank" rel="noopener">${icono("footprints")}<span>Cómo llegar</span>${icono("arrow-up-right", "ico ico-ir")}</a>`;
        div.querySelector("strong").textContent = cai.nombre;
        div.querySelector("a").href = enlaceComoLlegar(cai.lat, cai.lng);
        return div;
      }, opcionesPopup)
      .addTo(mapa);
    marcadorCai.getElement()?.setAttribute("aria-label", cai.nombre);
  }

  // El plugin de calor puede no cargar (sin internet); el resto sigue funcionando
  if (typeof L.heatLayer === "function") {
    capaCalor = L.heatLayer([], {
      radius: 45, blur: 30, maxZoom: 17, minOpacity: 0.35,
      // Escala de un solo sentido: ámbar (pocos) → rojo (muchos), según el tema
      gradient: degradadoCalor(),
    });
  }
}

// Marcador con forma de señal de paradero: una placa con el número de
// reportes (color según el nivel) y el código del paradero, sobre un poste.
// Mide ~68×44 px (todo el recuadro se puede tocar).
// Su aspecto está en css/estilos.css (.marcador-conteo).
function iconoConteo(cantidad, codigo) {
  // El código viene de la base de datos: se escapa antes de meterlo en HTML
  const codigoSeguro = String(codigo).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return L.divIcon({
    className: "",
    html: `<div class="marcador-conteo nivel-${nivelPorCantidad(cantidad)}">` +
      `<span class="marcador-placa"><span class="marcador-num">${cantidad}</span>` +
      `<span class="marcador-codigo">${codigoSeguro}</span></span>` +
      `<span class="marcador-poste"></span></div>`,
    iconSize: [68, 44],
    iconAnchor: [34, 44], // la base del poste cae justo en el paradero
    popupAnchor: [0, -40],

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
  div.className = `popup-paradero nivel-${nivelPorCantidad(cantidad)}`;
  div.innerHTML = `
    <div class="popup-cabeza"><span class="placa-codigo"></span><span class="popup-codigo">Paradero SITP</span></div>
    <strong class="popup-nombre"></strong>
    <div class="popup-cantidad"><span class="popup-nivel" aria-hidden="true"></span><span class="popup-cantidad-texto"></span></div>
    <a class="popup-enlace" target="_blank" rel="noopener">${icono("footprints")}<span>Cómo llegar</span>${icono("arrow-up-right", "ico ico-ir")}</a>
    <a class="popup-enlace" target="_blank" rel="noopener">${icono("shield")}<span>Buscar CAI cercano</span>${icono("arrow-up-right", "ico ico-ir")}</a>`;
  div.querySelector(".placa-codigo").textContent = p.codigo;
  div.querySelector("strong").textContent = p.nombre.replace(p.codigo, "").trim() || p.nombre;
  div.querySelector(".popup-nivel").textContent = cantidad;
  div.querySelector(".popup-cantidad-texto").textContent =
    `${cantidad} reporte${cantidad === 1 ? "" : "s"} activo${cantidad === 1 ? "" : "s"}`;
  const [llegar, cai] = div.querySelectorAll("a");
  llegar.href = enlaceComoLlegar(p.lat, p.lng);
  cai.href = enlaceBuscarCai(p.lat, p.lng);
  return div;
}

// Recibe { "481A00": 3, "504A00": 0, ... } y actualiza círculos y calor
export function actualizarMapa(conteoPorParadero) {
  const puntos = [];
  const maximo = Math.max(1, ...Object.values(conteoPorParadero));
  for (const [codigo, marcador] of Object.entries(marcadores)) {
    const cantidad = conteoPorParadero[codigo] ?? 0;
    marcador.cantidad = cantidad;
    marcador.setIcon(iconoConteo(cantidad, codigo));
    if (cantidad > 0) {
      const p = marcador.paradero;
      puntos.push([p.lat, p.lng, cantidad / maximo]);
    }
  }
  puntosCalor = puntos;
  // leaflet.heat falla si se redibuja estando fuera del mapa: solo se
  // actualiza si está visible; si no, los puntos se aplican al mostrarla
  if (capaCalor && mapa.hasLayer(capaCalor)) capaCalor.setLatLngs(puntosCalor);
}

// Cambia entre "circulos" y "calor"
export function cambiarVista(vista) {
  if (!mapa) return;
  if (vista === "calor" && capaCalor) {
    mapa.removeLayer(capaCirculos);
    capaCalor.addTo(mapa);
    capaCalor.setOptions({ gradient: degradadoCalor() }); // por si cambió el tema
    capaCalor.setLatLngs(puntosCalor);                     // por si llegaron reportes
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
