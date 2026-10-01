// ============================================================
// Análisis de reportes: funciones "puras" (reciben datos y
// devuelven resultados, sin tocar la pantalla ni la base de datos).
// Las usan la lista, el mapa y el resumen.
// ============================================================
import { DIAS_RECIENTES } from "./config.js";

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

// Hora (0 a 23) en Bogotá, sin importar la zona horaria del celular
export function horaBogota(fecha) {
  return Number(new Intl.DateTimeFormat("es-CO", {
    hour: "numeric", hourCycle: "h23", timeZone: "America/Bogota",
  }).format(fecha));
}

// Franja del día. Sirve para comparar con la encuesta (mañana/tarde/noche).
export const FRANJAS = [
  { id: "manana", nombre: "Mañana", rango: "5 a. m. – 12 m." },
  { id: "tarde",  nombre: "Tarde",  rango: "12 m. – 6 p. m." },
  { id: "noche",  nombre: "Noche",  rango: "6 p. m. – 5 a. m." },
];
export function franjaDeHora(hora) {
  if (hora >= 5 && hora < 12) return "manana";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noche";
}

// "ahora", "hace 5 min", "hace 2 h", "hace 3 días"
export function tiempoRelativo(fecha) {
  const minutos = Math.floor((Date.now() - fecha) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------
// Indicador de transparencia: ¿qué tan confiable es cada reporte?
// Combina dos cosas: cuántas personas lo confirmaron y qué tan viejo es.
// ------------------------------------------------------------
export function estadoReporte(r) {
  if (r.resuelto > 0 && r.resuelto >= r.vigente) {
    return { id: "resuelto", texto: `Posiblemente resuelto (${r.resuelto})` };
  }
  if (r.vigente >= 2) {
    return { id: "confirmado", texto: `Confirmado por ${r.vigente} personas` };
  }
  if (r.vigente === 1) {
    return { id: "confirmado", texto: "Confirmado por 1 persona" };
  }
  return { id: "sin-confirmar", texto: "Sin confirmar" };
}

export function frescura(r) {
  const edad = Date.now() - r.creadoEn;
  if (edad < 3 * HORA_MS) return { id: "fresco", texto: "Reciente" };
  if (edad < DIA_MS) return { id: "hoy", texto: "Del último día" };
  return { id: "viejo", texto: "Puede estar desactualizado" };
}

// Un reporte cuenta para el mapa si es de los últimos días y no fue resuelto
export function estaActivo(r) {
  return Date.now() - r.creadoEn < DIAS_RECIENTES * DIA_MS
    && estadoReporte(r).id !== "resuelto";
}

// Cuenta reportes por una propiedad: contarPor(reportes, r => r.categoria)
export function contarPor(reportes, clave) {
  const conteo = {};
  for (const r of reportes) {
    const k = clave(r);
    conteo[k] = (conteo[k] ?? 0) + 1;
  }
  return conteo;
}

// Resumen de transparencia para la cabecera de la lista y el mapa
export function resumenTransparencia(reportes) {
  const activos = reportes.filter(estaActivo);
  return {
    activos: activos.length,
    confirmados: activos.filter((r) => r.vigente > 0).length,
    ultimo: reportes.length ? reportes[0].creadoEn : null, // vienen ordenados del más nuevo
  };
}

// ------------------------------------------------------------
// Resumen semanal: esta semana (últimos 7 días) vs. la anterior
// ------------------------------------------------------------
export function resumenSemanal(reportes) {
  const ahora = Date.now();
  const estaSemana = reportes.filter((r) => ahora - r.creadoEn < 7 * DIA_MS);
  const anterior = reportes.filter((r) => {
    const edad = ahora - r.creadoEn;
    return edad >= 7 * DIA_MS && edad < 14 * DIA_MS;
  });

  const porHora = Array(24).fill(0);
  for (const r of estaSemana) porHora[horaBogota(r.creadoEn)] += 1;

  return {
    total: estaSemana.length,
    totalAnterior: anterior.length,
    porCategoria: contarPor(estaSemana, (r) => r.categoria),
    porParadero: contarPor(estaSemana, (r) => r.paraderoId),
    porFranja: contarPor(estaSemana, (r) => franjaDeHora(horaBogota(r.creadoEn))),
    porHora,
  };
}
