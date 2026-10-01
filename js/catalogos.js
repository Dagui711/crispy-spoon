// ============================================================
// Catálogos: datos fijos que la app necesita conocer.
// ============================================================

// Categorías de reporte (las mismas del prototipo de Figma).
// "id" es lo que se guarda en la base de datos (sin tildes ni espacios);
// "nombre" e "icono" son solo para mostrar en pantalla.
// ⚠️ Si agregas una categoría aquí, agrégala también en firestore.rules.
export const CATEGORIAS = [
  { id: "alumbrado",   nombre: "Alumbrado apagado",     icono: "💡" },
  { id: "zona_oscura", nombre: "Zona oscura",           icono: "🌑" },
  { id: "acoso",       nombre: "Acoso o inseguridad",   icono: "⚠️" },
  { id: "otro",        nombre: "Otro",                  icono: "📝" },
];

// Busca una categoría por su id. Si no existe devuelve una genérica.
export function categoriaPorId(id) {
  return CATEGORIAS.find((c) => c.id === id) ?? { id, nombre: id, icono: "•" };
}

// Paraderos para el MODO DEMO (sin Firebase).
// Con Firebase, los paraderos se leen de la colección "paraderos" de
// Firestore; esta lista es también la referencia de qué crear allá.
//
// ⚠️ COORDENADAS APROXIMADAS alrededor del campus. Antes de presentar,
//    verifiquen cada paradero en Google Maps (clic derecho → copiar
//    coordenadas) y actualicen lat/lng aquí y en Firestore.
// ⚠️ El cuarto paradero es un marcador de posición: cambien "codigo"
//    y "nombre" por el paradero real que agregaron al alcance.
export const PARADEROS_DEMO = [
  { codigo: "481A00", nombre: "Paradero 481A00", lat: 4.6031, lng: -74.0690 },
  { codigo: "504A00", nombre: "Paradero 504A00", lat: 4.6010, lng: -74.0705 },
  { codigo: "907A00", nombre: "Paradero 907A00", lat: 4.6045, lng: -74.0662 },
  { codigo: "PARADERO4", nombre: "Cuarto paradero (por definir)", lat: 4.6018, lng: -74.0672 },
];

// Centro del mapa: campus de la Tadeo (Cra. 4 # 22-61, Bogotá), aproximado.
export const CENTRO_MAPA = [4.6025, -74.0680];
