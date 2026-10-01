// ============================================================
// Lógica principal: conecta la pantalla (HTML) con los datos y el mapa.
// ============================================================
import { motor, modoDemo } from "./datos.js";
import { CATEGORIAS, categoriaPorId } from "./catalogos.js";
import { crearMapa, actualizarColores, refrescarTamano } from "./mapa.js";

// Atajo para buscar elementos por id
const $ = (id) => document.getElementById(id);

// Estado de la app (lo que el usuario ha elegido)
let categoriaElegida = null;
let paraderos = [];

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
// 2. Formulario de reporte
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
    console.error(e);
    mostrarError("No se pudo enviar el reporte. Revisa tu conexión e intenta de nuevo.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviar reporte";
  }
}

function mostrarConfirmacion(paraderoId, categoria) {
  const p = paraderos.find((x) => x.codigo === paraderoId);
  $("conf-paradero").textContent = p ? `${p.nombre} (${p.codigo})` : paraderoId;
  $("conf-hora").textContent = new Date().toLocaleTimeString("es-CO",
    { hour: "numeric", minute: "2-digit" });
  $("conf-categoria").textContent = categoriaPorId(categoria).nombre;
  $("form-reporte").hidden = true;
  $("confirmacion").hidden = false;
}

function reiniciarFormulario() {
  $("form-reporte").reset();
  $("contador-caracteres").textContent = "0";
  categoriaElegida = null;
  document.querySelectorAll(".categoria").forEach((b) => b.classList.remove("seleccionada"));
  $("descripcion-opcional").textContent = "(opcional)";
  pintarParaderos(); // vuelve a aplicar la preselección del QR, si la hay
  $("confirmacion").hidden = true;
  $("form-reporte").hidden = false;
}

// ------------------------------------------------------------
// 3. Lista de reportes recientes
// ------------------------------------------------------------

// "hace 5 min", "hace 2 h", "hace 3 días"
function tiempoRelativo(fecha) {
  const minutos = Math.floor((Date.now() - fecha) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

function pintarListaReportes(reportes) {
  const lista = $("lista-reportes");
  lista.innerHTML = "";
  if (reportes.length === 0) {
    lista.innerHTML = '<li class="vacio">Aún no hay reportes. ¡Sé el primero!</li>';
    return;
  }
  for (const r of reportes.slice(0, 30)) {
    const cat = categoriaPorId(r.categoria);
    const p = paraderos.find((x) => x.codigo === r.paraderoId);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="reporte-cabecera">
        <span class="reporte-categoria"></span>
        <span class="reporte-tiempo"></span>
      </div>
      <div class="reporte-paradero"></div>
      <p class="reporte-descripcion"></p>`;
    // Usamos textContent (no innerHTML) para el texto que escribió el usuario:
    // así, si alguien escribe código HTML malicioso, se muestra como texto y no se ejecuta.
    li.querySelector(".reporte-categoria").textContent = `${cat.icono} ${cat.nombre}`;
    li.querySelector(".reporte-tiempo").textContent = tiempoRelativo(r.creadoEn);
    li.querySelector(".reporte-tiempo").title = r.creadoEn.toLocaleString("es-CO");
    li.querySelector(".reporte-paradero").textContent = p ? p.nombre : r.paraderoId;
    const desc = li.querySelector(".reporte-descripcion");
    if (r.descripcion) desc.textContent = r.descripcion;
    else desc.remove();
    lista.appendChild(li);
  }
}

// Cuenta reportes por paradero: { "481A00": 3, "504A00": 1, ... }
function contarPorParadero(reportes) {
  const conteo = {};
  for (const r of reportes) {
    conteo[r.paraderoId] = (conteo[r.paraderoId] ?? 0) + 1;
  }
  return conteo;
}

// ------------------------------------------------------------
// 4. Arranque de la app
// ------------------------------------------------------------
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
    mostrarError("No hay paraderos en la base de datos. Créalos en Firestore (ver docs/GUIA-FIREBASE.md).");
  }
  pintarParaderos();

  // Si el mapa falla (ej: sin internet para cargar Leaflet), el resto
  // de la app debe seguir funcionando.
  let hayMapa = true;
  try {
    crearMapa("contenedor-mapa", paraderos);
  } catch (e) {
    console.error("No se pudo crear el mapa:", e);
    hayMapa = false;
    $("contenedor-mapa").textContent = "No se pudo cargar el mapa. Revisa tu conexión.";
  }

  // Cada vez que llegan reportes nuevos, actualizamos lista y mapa
  motor.escucharReportesRecientes((reportes) => {
    pintarListaReportes(reportes);
    if (hayMapa) actualizarColores(contarPorParadero(reportes));
  });
}

iniciar();
