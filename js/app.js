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

const nombreParadero = (codigo) => paraderos.find((p) => p.codigo === codigo)?.nombre ?? codigo;

// ------------------------------------------------------------
// 1. Pestañas
// ------------------------------------------------------------
function mostrarSeccion(nombre) {
  document.querySelectorAll(".pestana").forEach((b) =>
    b.classList.toggle("activa", b.dataset.seccion === nombre));
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
  $("boton-tema").textContent = noche ? "☀️" : "🌙";
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
    boton.innerHTML = `<span class="icono">${cat.icono}</span>${cat.nombre}`;
    boton.addEventListener("click", () => elegirCategoria(cat.id));
    contenedor.appendChild(boton);
  }
}

function elegirCategoria(id) {
  categoriaElegida = id;
  document.querySelectorAll(".categoria").forEach((b) =>
    b.classList.toggle("seleccionada", b.dataset.id === id));
  // Si eligen "Otro", la descripción se vuelve obligatoria
  $("descripcion-opcional").textContent = id === "otro" ? "(obligatoria)" : "(opcional)";
}

function pintarParaderos() {
  const select = $("campo-paradero");
  select.innerHTML = '<option value="">Elige un paradero…</option>';
  for (const p of paraderos) {
    const opcion = document.createElement("option");
    opcion.value = p.codigo;
    opcion.textContent = `${p.nombre} (${p.codigo})`;
    select.appendChild(opcion);
  }

  // Si se abrió desde el QR del paradero (ej: ...?paradero=481A00),
  // lo dejamos preseleccionado.
  const desdeQR = new URLSearchParams(location.search).get("paradero");
  if (desdeQR && paraderos.some((p) => p.codigo === desdeQR)) {
    select.value = desdeQR;
  }
}

function mostrarError(texto) {
  const caja = $("mensaje-error");
  caja.textContent = texto;
  caja.hidden = !texto;
}

// Revisa el formulario. Devuelve un texto de error, o null si todo está bien.
function validar(paraderoId, descripcion) {
  if (!paraderoId) return "Elige el paradero.";
  if (!categoriaElegida) return "Elige qué está pasando.";
  if (categoriaElegida === "otro" && descripcion === "") {
    return "Cuéntanos brevemente qué pasa (categoría «Otro»).";
  }
  return null;
}

async function enviarReporte(evento) {
  evento.preventDefault(); // evita que la página se recargue
  const paraderoId = $("campo-paradero").value;
  const descripcion = $("campo-descripcion").value.trim();

  const error = validar(paraderoId, descripcion);
  mostrarError(error);
  if (error) return;

  const boton = $("boton-enviar");
  boton.disabled = true;
  boton.textContent = "Enviando…";
  try {
    await motor.crearReporte({ paraderoId, categoria: categoriaElegida, descripcion });
    mostrarConfirmacion(paraderoId, categoriaElegida);
  } catch (e) {
    if (e instanceof EsperaError) {
      // No es un error del sistema: es el anti-spam funcionando
      const min = Math.floor(e.segundos / 60);
      const seg = e.segundos % 60;
      const tiempo = [min > 0 ? `${min} min` : "", seg > 0 ? `${seg} s` : ""].filter(Boolean).join(" ");
      mostrarError(`Para evitar reportes repetidos, espera ${tiempo} antes de enviar otro.`);
    } else if (e.message.includes("Anónimo")) {
      console.error(e);
      mostrarError(e.message);
    } else {
      console.error(e);
      mostrarError("No se pudo enviar el reporte. Revisa tu conexión e intenta de nuevo.");
    }
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviar reporte";
  }
}

// Enlace de WhatsApp con el texto ya escrito (la persona elige a quién enviarlo)
function enlaceWhatsApp(texto) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

function textoParaCompartir(paraderoId, categoria, cuando) {
  const cat = categoriaPorId(categoria);
  return `⚠️ ${cat.icono} ${cat.nombre} en el paradero ${nombreParadero(paraderoId)} (${paraderoId}), ${cuando}\n` +
    `Mira los reportes o confirma si sigue: ${URL_PUBLICA}?paradero=${paraderoId}`;
}

function mostrarConfirmacion(paraderoId, categoria) {
  const hora = new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  $("conf-paradero").textContent = `${nombreParadero(paraderoId)} (${paraderoId})`;
  $("conf-hora").textContent = hora;
  $("conf-categoria").textContent = categoriaPorId(categoria).nombre;
  $("boton-whatsapp").href = enlaceWhatsApp(textoParaCompartir(paraderoId, categoria, `hoy a las ${hora}`));
  $("form-reporte").hidden = true;
  $("confirmacion").hidden = false;
}

function reiniciarFormulario() {
  $("form-reporte").reset();
  $("contador-caracteres").textContent = "0";
  categoriaElegida = null;
  document.querySelectorAll(".categoria").forEach((b) => b.classList.remove("seleccionada"));
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
    `${t.confirmados} confirmado${t.confirmados === 1 ? "" : "s"} por la comunidad · ` +
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
    li.innerHTML = `
      <div class="reporte-cabecera">
        <span class="reporte-categoria"></span>
        <span class="reporte-tiempo"></span>
      </div>
      <div class="reporte-paradero"></div>
      <p class="reporte-descripcion"></p>
      <div class="chips">
        <span class="chip chip-estado"></span>
        <span class="chip chip-frescura"></span>
      </div>
      <div class="acciones-reporte">
        <button type="button" class="boton-voto" data-tipo="vigente">👀 Sigue así</button>
        <button type="button" class="boton-voto" data-tipo="resuelto">✅ Ya se resolvió</button>
        <a class="boton-compartir" target="_blank" rel="noopener" aria-label="Compartir por WhatsApp">Compartir</a>
      </div>`;
    // Usamos textContent (no innerHTML) para el texto que escribió el usuario:
    // así, si alguien escribe código HTML malicioso, se muestra como texto y no se ejecuta.
    li.querySelector(".reporte-categoria").textContent = `${cat.icono} ${cat.nombre}`;
    li.querySelector(".reporte-tiempo").textContent = tiempoRelativo(r.creadoEn);
    li.querySelector(".reporte-tiempo").title = r.creadoEn.toLocaleString("es-CO");
    li.querySelector(".reporte-paradero").textContent = nombreParadero(r.paraderoId);
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
          boton.textContent += " · tu voto";
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
    alert(e.message.includes("Anónimo") ? e.message : "No se pudo registrar tu confirmación. Intenta de nuevo.");
  }
}

// ------------------------------------------------------------
// 5. Mapa
// ------------------------------------------------------------
document.querySelectorAll(".opcion-vista").forEach((boton) =>
  boton.addEventListener("click", () => {
    const vista = boton.dataset.vista;
    document.querySelectorAll(".opcion-vista").forEach((b) => b.classList.toggle("activa", b === boton));
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
  $("campo-descripcion").addEventListener("input", (e) => {
    $("contador-caracteres").textContent = e.target.value.length;
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
