// ============================================================
// Lógica principal: conecta la pantalla (HTML) con los datos y el mapa.
// ============================================================
import { motor, modoDemo, EsperaError } from "./datos.js";
import { CATEGORIAS, CAIS, categoriaPorId } from "./catalogos.js";
import { URL_PUBLICA } from "./config.js";
import { crearMapa, actualizarMapa, cambiarVista, calorDisponible, refrescarTamano } from "./mapa.js";
import {
  tiempoRelativo, estadoReporte, frescura, estaActivo, contarPor, resumenTransparencia,
} from "./analisis.js";
import { pintarResumen } from "./resumen.js";

// Atajo para buscar elementos por id
const $ = (id) => document.getElementById(id);

// Estado de la app
let categoriaElegida = null;
let paraderos = [];
let reportes = [];     // historial completo (2 semanas), del más nuevo al más viejo
let hayMapa = false;
let cuentaRegresiva = null; // intervalo de la cuenta regresiva del anti-spam
let finEspera = 0;          // cuándo termina la espera del anti-spam (ms)
let enviando = false;       // hay un envío en curso
let campoConError = null;   // campo marcado como inválido mientras dure el error

const nombreParadero = (codigo) => paraderos.find((p) => p.codigo === codigo)?.nombre ?? codigo;

// --- Ayudas de presentación (no cambian datos) ---
// Ícono del sprite de index.html. "nombre" siempre viene de nuestro código
// (catalogos.js), nunca de lo que escribe el usuario.
const icono = (nombre) => `<svg class="ico" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;
// Algunos nombres ya traen el código ("U. Jorge Tadeo Lozano 481A00"); como el
// código se muestra aparte en su "placa", aquí se quita para no repetirlo.
const nombreSinCodigo = (codigo) => nombreParadero(codigo).replace(codigo, "").trim();
// ¿La persona pidió menos movimiento? Entonces los desplazamientos son instantáneos.
const menosMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------
// 1. Pestañas
// ------------------------------------------------------------
function mostrarSeccion(nombre) {
  document.querySelectorAll(".pestana").forEach((b) => {
    const activa = b.dataset.seccion === nombre;
    b.classList.toggle("activa", activa);
    // Para lectores de pantalla: cuál es la pestaña actual
    if (activa) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.querySelectorAll(".seccion").forEach((s) =>
    s.classList.toggle("activa", s.id === nombre));
  if (nombre === "mapa") refrescarTamano();
}

document.querySelectorAll(".pestana").forEach((boton) =>
  boton.addEventListener("click", () => mostrarSeccion(boton.dataset.seccion)));

// ------------------------------------------------------------
// 2. Modo noche (alto contraste)
// ------------------------------------------------------------
// Si la persona no ha elegido, se sigue la configuración del celular.
function temaActual() {
  return document.documentElement.dataset.tema
    ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "noche" : "claro");
}

function pintarBotonTema() {
  const noche = temaActual() === "noche";
  $("boton-tema").innerHTML =
    `${icono(noche ? "sun" : "moon")}<span class="tema-texto">${noche ? "Modo claro" : "Modo noche"}</span>`;
  $("boton-tema").setAttribute("aria-label", noche ? "Cambiar a modo claro" : "Cambiar a modo noche");
}

$("boton-tema").addEventListener("click", () => {
  const nuevo = temaActual() === "noche" ? "claro" : "noche";
  document.documentElement.dataset.tema = nuevo;
  try { localStorage.setItem("paradero-seguro-tema", nuevo); } catch {}
  pintarBotonTema();
});
pintarBotonTema();

// ------------------------------------------------------------
// 3. Formulario de reporte
// ------------------------------------------------------------
function pintarCategorias() {
  const contenedor = $("lista-categorias");
  for (const cat of CATEGORIAS) {
    const boton = document.createElement("button");
    boton.type = "button"; // para que no envíe el formulario
    boton.className = "categoria";
    boton.dataset.id = cat.id;
    boton.setAttribute("aria-pressed", "false");
    boton.innerHTML = `<span class="placa-categoria" aria-hidden="true">${icono(cat.svg)}</span>` +
      `<span class="categoria-nombre">${cat.nombre}</span>`;
    boton.addEventListener("click", () => elegirCategoria(cat.id));
    contenedor.appendChild(boton);
  }
}

function elegirCategoria(id) {
  categoriaElegida = id;
  mostrarError(null); // si había un mensaje, ya no aplica
  document.querySelectorAll(".categoria").forEach((b) => {
    b.classList.toggle("seleccionada", b.dataset.id === id);
    b.setAttribute("aria-pressed", String(b.dataset.id === id));
  });
  // Si eligen "Otro", la descripción se vuelve obligatoria
  $("descripcion-opcional").textContent = id === "otro" ? "(obligatoria)" : "(opcional)";
  // En celular, "Enviar reporte" se pega abajo en cuanto hay categoría: la
  // fila elegida (o, con "Otro", el detalle que ahora es obligatorio) se
  // lleva a la vista por encima de esa zona. Sin dar foco al detalle, para
  // no abrir el teclado del celular.
  const destino = id === "otro"
    ? $("campo-descripcion").closest(".parada")
    : document.querySelector(`.categoria[data-id="${id}"]`);
  destino.scrollIntoView({ block: "nearest", behavior: menosMovimiento() ? "auto" : "smooth" });
}

function pintarParaderos() {
  const select = $("campo-paradero");
  select.innerHTML = '<option value="">Elige un paradero…</option>';
  for (const p of paraderos) {
    const opcion = document.createElement("option");
    opcion.value = p.codigo;
    // Código primero, como en la placa del paradero (sin repetirlo si ya está en el nombre)
    opcion.textContent = `${p.codigo} · ${p.nombre.replace(p.codigo, "").trim() || p.nombre}`;
    select.appendChild(opcion);
  }

  // Si se abrió desde el QR del paradero (ej: ...?paradero=481A00),
  // lo dejamos preseleccionado.
  const desdeQR = new URLSearchParams(location.search).get("paradero");
  if (desdeQR && paraderos.some((p) => p.codigo === desdeQR)) {
    select.value = desdeQR;
  }
}

// Muestra (o esconde, con null) el mensaje del formulario.
// "espera" = true lo pinta como AVISO ámbar (anti-spam) y no como error rojo.
function mostrarError(texto, espera = false) {
  const caja = $("mensaje-error");
  caja.textContent = texto ?? "";
  caja.classList.toggle("es-espera", Boolean(texto) && espera);
  caja.hidden = !texto;
  marcarInvalido(null);
}

// Marca (o desmarca, con null) el campo que falta mientras dure el error:
// aria-invalid y aria-describedby para lectores de pantalla, y un borde rojo
// visible (en táctil no se ve el anillo de foco). Para las categorías se
// marca el grupo completo (fieldset).
function marcarInvalido(campo) {
  for (const el of document.querySelectorAll("#form-reporte [aria-invalid], #form-reporte .con-error")) {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("aria-describedby");
    el.classList.remove("con-error");
  }
  campoConError = campo;
  if (!campo) return;
  const marcado = campo.closest("fieldset") ?? campo;
  if (marcado === campo) campo.setAttribute("aria-invalid", "true");
  else marcado.classList.add("con-error");
  marcado.setAttribute("aria-describedby", "mensaje-error");
}

// Revisa el formulario. Devuelve { texto, campo } con el error y el campo
// que falta, o null si todo está bien.
function validar(paraderoId, descripcion) {
  if (!paraderoId) return { texto: "Elige el paradero.", campo: $("campo-paradero") };
  if (!categoriaElegida) return { texto: "Elige qué está pasando.", campo: document.querySelector(".categoria") };
  if (categoriaElegida === "otro" && descripcion === "") {
    return { texto: "Cuéntanos brevemente qué pasa (categoría «Otro»).", campo: $("campo-descripcion") };
  }
  return null;
}

// Lleva a la persona al campo que falta (sin animación si pidió menos movimiento)
function llevarA(campo) {
  if (!campo) return;
  campo.focus({ preventScroll: true });
  campo.scrollIntoView({ block: "center", behavior: menosMovimiento() ? "auto" : "smooth" });
}

// --- Cuenta regresiva del anti-spam: el botón dice "Espera 1:45" ---
// El botón queda "apagado" con aria-disabled (no con disabled): así no pierde
// el foco del teclado y el lector de pantalla lo sigue encontrando.
const segundosDeEspera = () => Math.max(0, Math.ceil((finEspera - Date.now()) / 1000));

// "1 min 45 s", "2 min", "40 s": se lee bien en voz alta (no como una hora)
function textoEspera(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return [min && `${min} min`, seg && `${seg} s`].filter(Boolean).join(" ") || "0 s";
}

// Aviso ámbar con el tiempo que falta. Se escribe una sola vez (no cada
// segundo) para que el lector de pantalla no lo repita sin parar.
function avisarEspera() {
  mostrarError(`Ya enviaste un reporte. Podrás enviar otro en ${textoEspera(segundosDeEspera())}.`, true);
}

function detenerCuentaRegresiva() {
  clearInterval(cuentaRegresiva);
  cuentaRegresiva = null;
  const boton = $("boton-enviar");
  boton.classList.remove("esperando");
  boton.removeAttribute("aria-disabled");
  boton.textContent = "Enviar reporte";
}

function iniciarCuentaRegresiva(segundos) {
  clearInterval(cuentaRegresiva);
  const boton = $("boton-enviar");
  finEspera = Date.now() + segundos * 1000;
  const pintar = () => {
    const faltan = segundosDeEspera();
    if (faltan === 0) {
      detenerCuentaRegresiva();
      if ($("mensaje-error").classList.contains("es-espera")) mostrarError(null);
      return;
    }
    boton.textContent = `Espera ${Math.floor(faltan / 60)}:${String(faltan % 60).padStart(2, "0")}`;
  };
  boton.setAttribute("aria-disabled", "true");
  boton.classList.add("esperando");
  pintar();
  cuentaRegresiva = setInterval(pintar, 1000);
}

async function enviarReporte(evento) {
  evento.preventDefault(); // evita que la página se recargue
  if (enviando) return;     // ya hay un envío en curso
  if (cuentaRegresiva) {    // anti-spam: el botón está apagado; se recuerda cuánto falta
    avisarEspera();
    return;
  }
  const paraderoId = $("campo-paradero").value;
  const descripcion = $("campo-descripcion").value.trim();

  const error = validar(paraderoId, descripcion);
  mostrarError(error?.texto ?? null);
  if (error) {
    marcarInvalido(error.campo);
    llevarA(error.campo);
    return;
  }

  const boton = $("boton-enviar");
  enviando = true;
  boton.setAttribute("aria-disabled", "true");
  boton.textContent = "Enviando…";
  try {
    await motor.crearReporte({ paraderoId, categoria: categoriaElegida, descripcion });
    mostrarConfirmacion(paraderoId, categoriaElegida);
  } catch (e) {
    if (e instanceof EsperaError) {
      // No es un error del sistema: es el anti-spam funcionando (aviso ámbar)
      iniciarCuentaRegresiva(e.segundos);
      avisarEspera();
    } else if (e.message.includes("Anónimo")) {
      console.error(e);
      mostrarError(e.message);
    } else {
      console.error(e);
      mostrarError("No se pudo enviar el reporte. Revisa tu conexión e intenta de nuevo.");
    }
  } finally {
    enviando = false;
    // Si arrancó la cuenta regresiva, ella misma reactiva el botón al llegar a 0
    if (!cuentaRegresiva) {
      boton.removeAttribute("aria-disabled");
      boton.textContent = "Enviar reporte";
    }
  }
}

// Enlace de WhatsApp con el texto ya escrito (la persona elige a quién enviarlo)
function enlaceWhatsApp(texto) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

function textoParaCompartir(paraderoId, categoria, cuando) {
  const cat = categoriaPorId(categoria);
  return `⚠️ ${cat.icono} ${cat.nombre} en el paradero ${nombreParadero(paraderoId)} (${paraderoId}), ${cuando}\n` +
    `Mira los reportes o indica si sigue ocurriendo: ${URL_PUBLICA}?paradero=${paraderoId}`;
}

function mostrarConfirmacion(paraderoId, categoria) {
  const hora = new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  $("conf-paradero").textContent = `${paraderoId} · ${nombreSinCodigo(paraderoId) || nombreParadero(paraderoId)}`;
  $("conf-hora").textContent = hora;
  $("conf-categoria").textContent = categoriaPorId(categoria).nombre;
  $("boton-whatsapp").href = enlaceWhatsApp(textoParaCompartir(paraderoId, categoria, `hoy a las ${hora}`));
  $("form-reporte").hidden = true;
  $("confirmacion").hidden = false;
}

function reiniciarFormulario() {
  detenerCuentaRegresiva();
  $("form-reporte").reset();
  $("contador-caracteres").textContent = "0";
  categoriaElegida = null;
  document.querySelectorAll(".categoria").forEach((b) => {
    b.classList.remove("seleccionada");
    b.setAttribute("aria-pressed", "false");
  });
  $("descripcion-opcional").textContent = "(opcional)";
  mostrarError(null);
  pintarParaderos(); // vuelve a aplicar la preselección del QR, si la hay
  $("confirmacion").hidden = true;
  $("form-reporte").hidden = false;
}

// ------------------------------------------------------------
// 4. Lista de reportes recientes (con confirmación comunitaria)
// ------------------------------------------------------------
function textoTransparencia() {
  const t = resumenTransparencia(reportes);
  if (!t.ultimo) return "Todavía no hay reportes.";
  return `${t.activos} reporte${t.activos === 1 ? "" : "s"} activo${t.activos === 1 ? "" : "s"} · ` +
    `${t.confirmados} ${t.confirmados === 1 ? "sigue" : "siguen"} ocurriendo según la comunidad · ` +
    `último ${tiempoRelativo(t.ultimo)}`;
}

function pintarListaReportes() {
  const lista = $("lista-reportes");
  const recientes = reportes.filter((r) => Date.now() - r.creadoEn < 7 * 24 * 60 * 60 * 1000);
  const votos = motor.misVotos();
  lista.innerHTML = "";
  if (recientes.length === 0) {
    lista.innerHTML = '<li class="vacio">Aún no hay reportes. ¡Sé el primero!</li>';
    return;
  }
  for (const r of recientes.slice(0, 40)) {
    const cat = categoriaPorId(r.categoria);
    const estado = estadoReporte(r);
    const fresco = frescura(r);
    const miVoto = votos[r.id];

    const li = document.createElement("li");
    li.className = `reporte estado-${estado.id}`;
    li.dataset.categoria = r.categoria; // solo para el color de la placa (CSS)
    li.innerHTML = `
      <span class="placa-categoria reporte-placa" aria-hidden="true">${icono(cat.svg ?? "message-square-more")}</span>
      <div class="reporte-cuerpo">
        <div class="reporte-cabecera">
          <div class="reporte-titulo">
            <span class="reporte-categoria"></span>
            <span class="reporte-tiempo"></span>
          </div>
          <a class="boton-compartir" target="_blank" rel="noopener" aria-label="Compartir por WhatsApp" title="Compartir por WhatsApp">${icono("whatsapp")}</a>
        </div>
        <div class="reporte-lugar">
          <span class="placa-codigo"></span>
          <span class="reporte-paradero"></span>
        </div>
        <p class="reporte-descripcion"></p>
        <div class="chips">
          <span class="chip chip-estado"></span>
          <span class="chip chip-frescura"></span>
        </div>
      </div>
      <div class="acciones-reporte">
        <button type="button" class="boton-voto" data-tipo="vigente">Sigue ocurriendo</button>
        <button type="button" class="boton-voto" data-tipo="resuelto">Ya se resolvió</button>
      </div>`;
    // Usamos textContent (no innerHTML) para el texto que escribió el usuario:
    // así, si alguien escribe código HTML malicioso, se muestra como texto y no se ejecuta.
    li.querySelector(".reporte-categoria").textContent = cat.nombre;
    li.querySelector(".reporte-tiempo").textContent = tiempoRelativo(r.creadoEn);
    li.querySelector(".reporte-tiempo").title = r.creadoEn.toLocaleString("es-CO");
    li.querySelector(".placa-codigo").textContent = r.paraderoId;
    li.querySelector(".reporte-paradero").textContent = nombreSinCodigo(r.paraderoId);
    const desc = li.querySelector(".reporte-descripcion");
    if (r.descripcion) desc.textContent = r.descripcion;
    else desc.remove();
    li.querySelector(".chip-estado").textContent = estado.texto;
    li.querySelector(".chip-frescura").textContent = fresco.texto;
    li.querySelector(".chip-frescura").classList.add(`frescura-${fresco.id}`);
    li.querySelector(".boton-compartir").href =
      enlaceWhatsApp(textoParaCompartir(r.paraderoId, r.categoria, tiempoRelativo(r.creadoEn)));

    for (const boton of li.querySelectorAll(".boton-voto")) {
      const tipo = boton.dataset.tipo;
      if (miVoto) {
        boton.disabled = true;
        if (miVoto === tipo) {
          boton.classList.add("votado");
          // Placa "TU VOTO" sobre el borde del botón (el espacio separa
          // las palabras para los lectores de pantalla)
          const placa = document.createElement("span");
          placa.className = "placa-voto";
          placa.textContent = "Tu voto";
          boton.append(" ", placa);
        }
      }
      boton.addEventListener("click", () => votar(r.id, tipo, li));
    }
    lista.appendChild(li);
  }
}

async function votar(reporteId, tipo, li) {
  li.querySelectorAll(".boton-voto").forEach((b) => (b.disabled = true));
  try {
    await motor.votar(reporteId, tipo);
    // La lista se repinta sola cuando Firestore avisa del cambio; por si el
    // contador no cambió (ya había votado), la repintamos igual.
    pintarListaReportes();
  } catch (e) {
    console.error(e);
    li.querySelectorAll(".boton-voto").forEach((b) => (b.disabled = false));
    alert(e.message.includes("Anónimo") ? e.message : "No se pudo registrar tu respuesta. Intenta de nuevo.");
  }
}

// ------------------------------------------------------------
// 5. Mapa
// ------------------------------------------------------------
document.querySelectorAll(".opcion-vista").forEach((boton) =>
  boton.addEventListener("click", () => {
    const vista = boton.dataset.vista;
    document.querySelectorAll(".opcion-vista").forEach((b) => {
      b.classList.toggle("activa", b === boton);
      b.setAttribute("aria-pressed", String(b === boton));
    });
    $("leyenda-circulos").hidden = vista === "calor";
    $("leyenda-calor").hidden = vista !== "calor";
    cambiarVista(vista);
  }));

// ------------------------------------------------------------
// 6. Botón de emergencia
// ------------------------------------------------------------
$("boton-sos").addEventListener("click", () => {
  $("estado-ubicacion").textContent = "";
  $("dialogo-sos").showModal();
});

// Solo se pide la ubicación si la persona toca este botón, y se envía
// únicamente a quien elija en WhatsApp (no se guarda en la base de datos).
$("boton-ubicacion").addEventListener("click", () => {
  const estado = $("estado-ubicacion");
  if (!navigator.geolocation) {
    estado.textContent = "Tu navegador no permite compartir ubicación.";
    return;
  }
  estado.textContent = "Obteniendo tu ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const texto = `🆘 Necesito ayuda. Estoy aquí: https://www.google.com/maps?q=${latitude},${longitude}`;
      estado.textContent = "";
      window.open(enlaceWhatsApp(texto), "_blank", "noopener");
    },
    () => (estado.textContent = "No se pudo obtener la ubicación. Revisa los permisos del navegador."),
    { enableHighAccuracy: true, timeout: 15000 },
  );
});

// ------------------------------------------------------------
// 7. Arranque de la app
// ------------------------------------------------------------
function alCambiarReportes(nuevos) {
  reportes = nuevos;
  pintarListaReportes();
  const transparencia = textoTransparencia();
  $("transparencia-lista").textContent = transparencia;
  $("transparencia-mapa").textContent = transparencia;
  if (hayMapa) actualizarMapa(contarPor(reportes.filter(estaActivo), (r) => r.paraderoId));
  pintarResumen($("contenido-resumen"), reportes, paraderos);
}

async function iniciar() {
  if (modoDemo) {
    const aviso = $("aviso-modo");
    aviso.textContent = "Modo demo: los reportes se guardan solo en este navegador.";
    aviso.hidden = false;
  }

  pintarCategorias();
  $("form-reporte").addEventListener("submit", enviarReporte);
  // Al cambiar de paradero, el mensaje anterior ya no aplica
  $("campo-paradero").addEventListener("change", () => mostrarError(null));

  $("campo-descripcion").addEventListener("input", (e) => {
    $("contador-caracteres").textContent = e.target.value.length;
    // Si el error era que faltaba el detalle (categoría "Otro"), ya no aplica
    if (campoConError === e.target && e.target.value.trim()) mostrarError(null);
  });
  $("boton-otro").addEventListener("click", reiniciarFormulario);
  $("boton-ver-mapa").addEventListener("click", () => {
    reiniciarFormulario();
    mostrarSeccion("mapa");
  });

  try {
    paraderos = await motor.obtenerParaderos();
  } catch (e) {
    console.error(e);
    mostrarError("No se pudieron cargar los paraderos. Revisa la configuración de Firebase.");
    return;
  }
  if (paraderos.length === 0) {
    mostrarError("No hay paraderos en la base de datos. Créalos con sembrar.html (ver docs/GUIA-FIREBASE.md).");
  }
  pintarParaderos();

  // Si el mapa falla (ej: sin internet para cargar Leaflet), el resto
  // de la app debe seguir funcionando.
  try {
    crearMapa("contenedor-mapa", paraderos);
    hayMapa = true;
    if (!calorDisponible()) document.querySelector('[data-vista="calor"]').hidden = true;
  } catch (e) {
    console.error("No se pudo crear el mapa:", e);
    $("contenedor-mapa").textContent = "No se pudo cargar el mapa. Revisa tu conexión.";
  }
  // La leyenda del CAI solo tiene sentido si hay CAI en el mapa
  if (CAIS.length === 0) document.querySelector(".punto-cai").parentElement.remove();

  // Cada vez que llegan reportes nuevos, se actualiza todo
  motor.escucharReportes(alCambiarReportes);

  // Los "hace X min" envejecen aunque no lleguen reportes nuevos
  setInterval(() => alCambiarReportes(reportes), 60 * 1000);
}

iniciar();

// PWA: registra el "service worker", que permite instalar la app
// y abrirla aunque la conexión esté mala.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker:", e));
}
