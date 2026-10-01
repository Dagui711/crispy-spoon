// ============================================================
// Catálogos: datos fijos que la app necesita conocer.
// ============================================================

// Categorías de reporte: las 4 del prototipo de Figma + "Hurto o robo",
// que se agregó porque el robo es el tema central del proyecto.
// "id" es lo que se guarda en la base de datos (sin tildes ni espacios);
// "nombre" e "icono" son solo para mostrar en pantalla.
// ⚠️ Si agregas una categoría aquí, agrégala también en firestore.rules.
// "svg" es el nombre del ícono (Lucide) dentro del sprite de index.html:
// la interfaz lo dibuja con <svg><use href="#i-..."/></svg>. El emoji se
// sigue usando en los mensajes de WhatsApp.
export const CATEGORIAS = [
  { id: "hurto",       nombre: "Hurto o robo",          icono: "🚨", svg: "siren" },
  { id: "alumbrado",   nombre: "Alumbrado apagado",     icono: "💡", svg: "lightbulb-off" },
  { id: "zona_oscura", nombre: "Zona oscura",           icono: "🌑", svg: "moon" },
  { id: "acoso",       nombre: "Acoso o inseguridad",   icono: "⚠️", svg: "triangle-alert" },
  { id: "otro",        nombre: "Otro",                  icono: "📝", svg: "message-square-more" },
];

// Busca una categoría por su id. Si no existe devuelve una genérica.
export function categoriaPorId(id) {
  return CATEGORIAS.find((c) => c.id === id) ?? { id, nombre: id, icono: "•" };
}

// Lista "semilla" de paraderos. Se usa para dos cosas:
//   1. En MODO DEMO (sin Firebase), la app lee los paraderos de aquí.
//   2. sembrar.html la usa UNA VEZ para crear los paraderos en Firestore
//      (codigo = id del documento). Después la app los lee de Firestore.
// Para agregar un paradero: copia una línea, cámbiale los datos y
// vuelve a sembrar (ver docs/GUIA-FIREBASE.md).
// Códigos SITP y coordenadas reales (Google Maps), verificados por el equipo.
export const PARADEROS_SEMILLA = [
  { codigo: "481A00", nombre: "U. Jorge Tadeo Lozano 481A00", lat: 4.607891187072479, lng: -74.06873441620392 },
  { codigo: "504A00", nombre: "U. Jorge Tadeo Lozano 504A00", lat: 4.606975419584897, lng: -74.06745538416442 },
  { codigo: "113A00", nombre: "Br. Las Nieves", lat: 4.608110479244784, lng: -74.06717069923171 },
  { codigo: "664A00", nombre: "Estación Universidades", lat: 4.605146708561095, lng: -74.06722341866632 },
];

// Centro del mapa: punto medio entre los 4 paraderos.
export const CENTRO_MAPA = [4.6068, -74.0677];

// CAI (Comandos de Atención Inmediata de la Policía) que se muestran en el mapa.
// ⚠️ Agreguen solo CAI verificados: busquen "CAI" en Google Maps cerca de la
//    Tadeo, confirmen que existe, y copien sus coordenadas (clic derecho).
// Mientras esta lista esté vacía, el mapa ofrece "Buscar CAI cercano",
// que abre Google Maps buscando CAI alrededor del paradero.
// Ejemplo:  { nombre: "CAI …", lat: 4.60…, lng: -74.06… },
export const CAIS = [];
