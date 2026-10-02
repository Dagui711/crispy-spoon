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
const todosLosMarcadores = []; // paraderos y CAI (para el teclado)
let marcadorAbierto = null;    // marcador cuya ventanita está abierta
let autoPaneando = false;      // el mapa se está moviendo para mostrar una ventanita

// ¿La persona pidió menos movimiento? Entonces el mapa no anima nada.
const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // El zoom va abajo a la derecha para que no tape la ventanita (popup).
  // Con "menos movimiento" no hay zoom animado, desvanecidos ni inercia.
  const sinAnimar = quieto();
  mapa = L.map(idContenedor, {
    zoomControl: false,
    zoomAnimation: !sinAnimar,
    fadeAnimation: !sinAnimar,
    markerZoomAnimation: !sinAnimar,
    inertia: !sinAnimar,
  }).setView(CENTRO_MAPA, 17);
  if (sinAnimar) {
    // Leaflet no trae opción para que el desplazamiento automático de la
    // ventanita (autoPan) sea instantáneo: todo desplazamiento del mapa pasa
    // por panBy, así que aquí se le quita la animación.
    const panBy = mapa.panBy;
    mapa.panBy = function (desplazamiento, opciones) {
      return panBy.call(this, desplazamiento, { ...opciones, animate: false });
    };
  }
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
    prepararMarcador(marcadores[p.codigo]);
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
        // Misma cabecera de placa que el popup del paradero ("481A00 · PARADERO SITP")
        const div = document.createElement("div");
        div.className = "popup-paradero popup-cai";
        div.innerHTML = `
          <div class="popup-cabeza"><span class="cai-placa" aria-hidden="true">${icono("shield")}CAI</span><span class="popup-codigo">CAI de Policía</span></div>
          <strong class="popup-nombre"></strong>
          <a class="popup-enlace" target="_blank" rel="noopener">${icono("footprints")}<span>Cómo llegar</span>${icono("arrow-up-right", "ico ico-ir")}</a>`;
        div.querySelector("strong").textContent = cai.nombre;
        div.querySelector("a").href = enlaceComoLlegar(cai.lat, cai.lng);
        return div;
      }, opcionesPopup)
      .addTo(mapa);
    marcadorCai.getElement()?.setAttribute("aria-label", cai.nombre);
    prepararMarcador(marcadorCai);
  }

  prepararTeclado();

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
// Mide ~74×44 px (todo el recuadro se puede tocar).
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
    iconSize: [74, 44],
    iconAnchor: [37, 44], // la base del poste cae justo en el paradero
    popupAnchor: [0, -40],
  });
}

// ------------------------------------------------------------
// Teclado: los marcadores se recorren con Tab y se abren con Enter
// ------------------------------------------------------------
function prepararMarcador(marcador) {
  todosLosMarcadores.push(marcador);
  marcador.on("popupopen", (e) => alAbrirVentanita(marcador, e.popup));
  marcador.on("popupclose", () => {
    if (marcadorAbierto === marcador) marcadorAbierto = null;
  });
}

function prepararTeclado() {
  const contenedor = mapa.getContainer();
  mapa.on("autopanstart", () => (autoPaneando = true));
  mapa.on("moveend", () => (autoPaneando = false));

  // Al llegar con Tab a un marcador que está recortado por el borde del mapa,
  // el mapa se mueve hasta mostrarlo completo
  contenedor.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!el.classList.contains("leaflet-marker-icon") || !el.matches(":focus-visible")) return;
    const marcador = todosLosMarcadores.find((m) => m.getElement() === el);
    if (marcador) mostrarMarcador(marcador, el);
  });

  // Escape cierra la ventanita y devuelve el foco al marcador
  contenedor.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !marcadorAbierto) return;
    const marcador = marcadorAbierto;
    mapa.closePopup();
    marcador.getElement()?.focus();
  });
}

function mostrarMarcador(marcador, el) {
  const margen = 12;
  const caja = mapa.getContainer().getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const dentro = r.left - caja.left >= margen && r.top - caja.top >= margen &&
    caja.right - r.right >= margen && caja.bottom - r.bottom >= margen;
  if (dentro) return; // ya se ve: el navegador hizo el resto al enfocarlo
  // El punto del marcador no es el centro del dibujo (en los paraderos es la
  // base del poste): el margen se calcula con el recuadro real del ícono
  const punto = mapa.latLngToContainerPoint(marcador.getLatLng());
  const izq = punto.x - (r.left - caja.left), arriba = punto.y - (r.top - caja.top);
  const der = r.right - caja.left - punto.x, abajo = r.bottom - caja.top - punto.y;
  // Cuando el mapa termine de moverse, la página también lo deja a la vista
  const verEnPagina = () => el.scrollIntoView({ block: "nearest", behavior: quieto() ? "auto" : "smooth" });
  let seMovio = false;
  const alEmpezar = () => (seMovio = true);
  mapa.once("movestart", alEmpezar);
  mapa.once("moveend", verEnPagina);
  mapa.panInside(marcador.getLatLng(), {
    paddingTopLeft: [izq + margen, arriba + margen],
    paddingBottomRight: [der + margen, abajo + margen],
    animate: !quieto(),
  });
  // Si al final no hizo falta moverlo, no se queda esperando
  mapa.off("movestart", alEmpezar);
  if (!seMovio) mapa.off("moveend", verEnPagina);
}

function alAbrirVentanita(marcador, popup) {
  marcadorAbierto = marcador;
  const ventana = popup.getElement();
  ventana.querySelector(".leaflet-popup-close-button")?.setAttribute("aria-label", "Cerrar");
  // Si se abrió con el teclado (Enter sobre el marcador), el foco entra a la
  // ventanita; así sus enlaces no quedan después de todos los demás marcadores
  const elMarcador = marcador.getElement();
  if (!elMarcador || elMarcador !== document.activeElement || !elMarcador.matches(":focus-visible")) return;
  const enfocar = () => ventana.querySelector(".popup-enlace")?.focus();
  if (autoPaneando) mapa.once("moveend", enfocar); // espera a que el mapa se acomode
  else enfocar();
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
