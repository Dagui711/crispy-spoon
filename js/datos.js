// =============================================================
// CAPA DE DATOS
// -------------------------------------------------------------
// Todo lo que lee o escribe en Firestore pasa por este archivo.
// Así, si mañana cambiamos algo de la base de datos, solo
// tocamos aquí y no toda la app.
//
// Colecciones:
//   paraderos/{codigo}  -> un documento por paradero (id = código SITP)
//   reportes/{idAuto}   -> un documento por reporte; se relaciona con
//                          su paradero mediante el campo `paraderoId`
// =============================================================

import { db } from "./firebase.js";
import {
  collection, doc, getDocs, setDoc, addDoc, updateDoc, increment,
  query, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Categorías de reporte. Se agregó "hurto" porque es el tema central
// del proyecto (percepción de inseguridad por robos), que no estaba
// en las 4 categorías originales del prototipo de Figma.
// `id` es lo que se guarda en la base de datos (sin tildes ni espacios);
// `texto` es lo que ve la persona.
export const CATEGORIAS = [
  { id: "hurto",       texto: "Hurto o robo",           icono: "🚨" },
  { id: "alumbrado",   texto: "Alumbrado apagado",      icono: "💡" },
  { id: "zona_oscura", texto: "Zona oscura",            icono: "🌑" },
  { id: "acoso",       texto: "Acoso o inseguridad",    icono: "⚠️" },
  { id: "otro",        texto: "Otro",                   icono: "📝" }
];

export function textoCategoria(id) {
  const c = CATEGORIAS.find((cat) => cat.id === id);
  return c ? `${c.icono} ${c.texto}` : id;
}

// Hora actual en Bogotá (0 a 23), sin importar la zona del celular.
function horaBogota(fecha = new Date()) {
  return Number(
    new Intl.DateTimeFormat("es-CO", {
      hour: "numeric", hourCycle: "h23", timeZone: "America/Bogota"
    }).format(fecha)
  );
}

// Franja del día: sirve para comparar mañana / tarde / noche,
// tal como pidió el profesor para la encuesta.
export function franjaDeHora(hora) {
  if (hora >= 5 && hora < 12) return "manana";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noche";
}

// ---------- PARADEROS ----------

// Lee todos los paraderos una vez y los devuelve como lista.
export async function obtenerParaderos() {
  const resultado = await getDocs(collection(db, "paraderos"));
  return resultado.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.activo !== false)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Solo la usa sembrar.html para crear los paraderos la primera vez.
export async function guardarParadero(p) {
  await setDoc(doc(db, "paraderos", p.codigo), p);
}

// ---------- REPORTES ----------

// Crea un reporte nuevo. Devuelve los datos para la confirmación.
export async function crearReporte({ paraderoId, categoria, descripcion }) {
  const hora = horaBogota();
  const reporte = {
    paraderoId,
    categoria,
    descripcion: (descripcion || "").trim().slice(0, 280),
    hora,
    franja: franjaDeHora(hora),
    creadoEn: serverTimestamp(), // la hora la pone el servidor de Google, no el celular
    // Confirmación comunitaria: cuántas personas dicen que el reporte
    // sigue vigente o que ya se resolvió. Empiezan en 0.
    confirmVigente: 0,
    confirmResuelto: 0
  };
  const ref = await addDoc(collection(db, "reportes"), reporte);
  return { id: ref.id, ...reporte, creadoEn: new Date() };
}

// Confirmación comunitaria: alguien dice que un reporte sigue vigente
// o que ya se resolvió. Solo suma +1 al contador correspondiente;
// las reglas de Firestore no dejan tocar ningún otro campo.
export async function confirmarReporte(reporteId, tipo) {
  const campo = tipo === "vigente" ? "confirmVigente" : "confirmResuelto";
  await updateDoc(doc(db, "reportes", reporteId), { [campo]: increment(1) });
}

// "Escucha" los reportes más recientes EN TIEMPO REAL:
// cada vez que alguien crea un reporte, `alCambiar` se vuelve a ejecutar
// con la lista actualizada. Devuelve una función para dejar de escuchar.
export function escucharReportesRecientes(alCambiar, alFallar, cantidad = 200) {
  const q = query(
    collection(db, "reportes"),
    orderBy("creadoEn", "desc"),
    limit(cantidad)
  );
  return onSnapshot(
    q,
    (resultado) => {
      const lista = resultado.docs.map((d) => {
        // "estimate": mientras el servidor confirma la hora, usa una estimada
        const datos = d.data({ serverTimestamps: "estimate" });
        return {
          id: d.id,
          ...datos,
          creadoEn: datos.creadoEn ? datos.creadoEn.toDate() : new Date(),
          confirmVigente: datos.confirmVigente || 0,
          confirmResuelto: datos.confirmResuelto || 0
        };
      });
      alCambiar(lista);
    },
    alFallar
  );
}
