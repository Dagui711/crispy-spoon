// =============================================================
// LÓGICA PRINCIPAL DE LA APP
// -------------------------------------------------------------
// Conecta la pantalla (HTML) con los datos (datos.js) y el mapa.
// Tres vistas: Reportar, Recientes y Mapa (+ la de Confirmación).
// =============================================================

import { configuracionLista } from "./firebase.js";
import {
  CATEGORIAS, textoCategoria, obtenerParaderos, crearReporte, escucharReportesRecientes,
  confirmarReporte
} from "./datos.js";
import { crearMapa, actualizarMapa, refrescarTamano } from "./mapa.js";

// Atajo para buscar elementos del HTML por su id
const $ = (id) => document.getElementById(id);

let paraderos = [];      // se llena desde Firestore
let reportes = [];       // se actualiza en tiempo real
let mapaCreado = false;

// ---------- NAVEGACIÓN ENTRE VISTAS ----------

function mostrarVista(nombre) {
  document.querySelectorAll(".vista").forEach((v) => v.hidden = v.id !== `vista-${nombre}`);
  document.querySelectorAll(".pestana").forEach((b) =>
    b.classList.toggle("activa", b.dataset.vista === nombre)
  );
  if (nombre === "mapa") {
    if (!mapaCreado && paraderos.length > 0) {
      crearMapa("mapa", paraderos);
      mapaCreado = true;
      actualizarMapa(paraderos, reportes);
    }
    refrescarTamano();
  }
}

document.querySelectorAll(".pestana").forEach((boton) =>
  boton.addEventListener("click", () => mostrarVista(boton.dataset.vista))
);

// ---------- UTILIDADES ----------

function nombreParadero(id) {
  const p = paraderos.find((x) => x.id === id);
  return p ? `${p.nombre} (${p.codigo})` : id;
}

function formatoHora(fecha) {
  return fecha.toLocaleString("es-CO", {
    timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short"
  });
}

function haceCuanto(fecha) {
  const min = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

// Evita que texto escrito por usuarios se interprete como HTML
function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function mostrarAviso(mensaje) {
  const aviso = $("aviso");
  aviso.textContent = mensaje;
  aviso.hidden = false;
}

// ---------- FORMULARIO DE REPORTE ----------

function pintarFormulario() {
  // Lista desplegable de paraderos
  $("paradero").innerHTML =
    `<option value="">Elige el paradero…</option>` +
    paraderos.map((p) => `<option value="${p.id}">${p.nombre} · ${p.codigo}</option>`).join("");

  // Si se entró escaneando el QR del paradero (…/index.html?paradero=481A00),
  // lo dejamos ya seleccionado.
  const desdeQR = new URLSearchParams(location.search).get("paradero");
  if (desdeQR && paraderos.some((p) => p.id === desdeQR)) $("paradero").value = desdeQR;

  // Botones grandes de categoría
  $("categorias").innerHTML = CATEGORIAS.map((c) => `
    <label class="categoria">
      <input type="radio" name="categoria" value="${c.id}" required>
      <span><span class="icono">${c.icono}</span>${c.texto}</span>
    </label>`).join("");
}

$("form-reporte").addEventListener("submit", async (evento) => {
  evento.preventDefault(); // evita que la página se recargue

  const paraderoId = $("paradero").value;
  const categoria = document.querySelector('input[name="categoria"]:checked')?.value;
  const descripcion = $("descripcion").value;

  if (!paraderoId || !categoria) {
    alert("Elige el paradero y la categoría.");
    return;
  }

  const boton = $("btn-enviar");
  boton.disabled = true;           // evita reportes dobles por doble clic
  boton.textContent = "Enviando…";

  try {
    const r = await crearReporte({ paraderoId, categoria, descripcion });
    // Pantalla de confirmación (como en el prototipo de Figma)
    $("conf-paradero").textContent = nombreParadero(r.paraderoId);
    $("conf-hora").textContent = formatoHora(r.creadoEn);
    $("conf-categoria").textContent = textoCategoria(r.categoria);
    $("form-reporte").reset();
    mostrarVista("confirmacion");
  } catch (error) {
    console.error(error);
    alert("No se pudo enviar el reporte. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviar reporte";
  }
});

$("btn-otro").addEventListener("click", () => mostrarVista("reportar"));
$("btn-ver-mapa").addEventListener("click", () => mostrarVista("mapa"));

// ---------- LISTA DE RECIENTES ----------

// Confirmación comunitaria: recuerda en este navegador qué reportes
// ya confirmó esta persona, para no dejarla votar varias veces por el
// mismo. Es una ayuda, no un candado de seguridad (eso lo hacen las
// reglas de Firestore limitando a +1 por vez).
const CLAVE_CONFIRMADOS = "av_confirmados";

function yaConfirmo(reporteId) {
  return cargarConfirmados().includes(reporteId);
}

function cargarConfirmados() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CONFIRMADOS) || "[]");
  } catch {
    return [];
  }
}

function marcarConfirmado(reporteId) {
  try {
    const lista = cargarConfirmados();
    lista.push(reporteId);
    localStorage.setItem(CLAVE_CONFIRMADOS, JSON.stringify(lista));
  } catch { /* si el navegador bloquea localStorage, no pasa nada grave */ }
}

function pintarRecientes() {
  const ultimos = reportes.slice(0, 20);
  $("lista-recientes").innerHTML = ultimos.length === 0
    ? `<p class="vacio">Todavía no hay reportes. ¡Haz el primero!</p>`
    : ultimos.map((r) => {
        const confirmado = yaConfirmo(r.id);
        return `
      <article class="reporte">
        <div class="reporte-cat">${textoCategoria(r.categoria)}</div>
        <div class="reporte-paradero">${escaparHTML(nombreParadero(r.paraderoId))}</div>
        ${r.descripcion ? `<p class="reporte-desc">${escaparHTML(r.descripcion)}</p>` : ""}
        <time title="${formatoHora(r.creadoEn)}">${haceCuanto(r.creadoEn)}</time>
        <div class="confirmacion-comunitaria">
          <button class="boton-confirma vigente" data-id="${r.id}" data-tipo="vigente" ${confirmado ? "disabled" : ""}>
            👍 Sigue así (${r.confirmVigente || 0})
          </button>
          <button class="boton-confirma resuelto" data-id="${r.id}" data-tipo="resuelto" ${confirmado ? "disabled" : ""}>
            ✅ Ya se resolvió (${r.confirmResuelto || 0})
          </button>
        </div>
      </article>`;
      }).join("");
}

// Un solo "escuchador" para todos los botones de confirmar (los artículos
// se vuelven a pintar seguido, así que no conviene poner uno por botón).
$("lista-recientes").addEventListener("click", async (evento) => {
  const boton = evento.target.closest(".boton-confirma");
  if (!boton || boton.disabled) return;

  const { id, tipo } = boton.dataset;
  boton.disabled = true;
  try {
    await confirmarReporte(id, tipo);
    marcarConfirmado(id);
  } catch (error) {
    console.error(error);
    boton.disabled = false;
    alert("No se pudo registrar tu confirmación. Inténtalo de nuevo.");
  }
});

// ---------- ARRANQUE ----------

async function iniciar() {
  if (!configuracionLista) {
    mostrarAviso("Falta pegar la configuración de Firebase en js/firebase-config.js (mira el LEEME).");
    return;
  }

  try {
    paraderos = await obtenerParaderos();
  } catch (error) {
    console.error(error);
    mostrarAviso("No se pudieron cargar los paraderos. Revisa la configuración y las reglas de Firestore.");
    return;
  }

  if (paraderos.length === 0) {
    mostrarAviso("No hay paraderos en la base de datos. Abre sembrar.html una vez para crearlos.");
    return;
  }

  pintarFormulario();

  escucharReportesRecientes(
    (lista) => {
      reportes = lista;
      pintarRecientes();
      actualizarMapa(paraderos, reportes);
    },
    (error) => {
      console.error(error);
      mostrarAviso("No se pudieron leer los reportes en tiempo real.");
    }
  );
}

mostrarVista("reportar");
iniciar();
