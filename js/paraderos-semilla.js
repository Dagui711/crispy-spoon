// =============================================================
// DATOS INICIALES ("SEMILLA") DE LOS PARADEROS
// -------------------------------------------------------------
// Esta lista solo se usa UNA VEZ, desde sembrar.html, para crear
// los documentos de la colección "paraderos" en Firestore.
// Después, la app lee los paraderos directamente de Firestore.
//
// Coordenadas verificadas en Google Maps (clic derecho sobre
// cada paradero real) el 1/10/2026.
//
// Para agregar el 5.º paradero: copia uno de los bloques { ... },
// pégalo al final y cambia sus datos.
// =============================================================

export const PARADEROS_SEMILLA = [
  {
    codigo: "481A00",
    nombre: "U. Jorge Tadeo Lozano (Cra 5)",
    direccion: "Carrera 5 con Calle 22/23",
    lat: 4.607891187072479,
    lng: -74.06873441620392,
    activo: true
  },
  {
    codigo: "504A00",
    nombre: "U. Jorge Tadeo Lozano (Cra 4)",
    direccion: "Carrera 4 con Calle 22/23",
    lat: 4.606975419584897,
    lng: -74.06745538416442,
    activo: true
  },
  {
    codigo: "664A00",
    nombre: "Estación Universidades",
    direccion: "Carrera 3 (estación TransMilenio Universidades)",
    lat: 4.605146708561095,
    lng: -74.06722341866632,
    activo: true
  },
  {
    codigo: "113A00",
    nombre: "Br. Las Nieves",
    direccion: "Calle 24 con Carrera 4/5",
    lat: 4.608110479244784,
    lng: -74.06717069923171,
    activo: true
  }
  // , { codigo: "XXXA00", nombre: "...", direccion: "...", lat: 4.60, lng: -74.06, activo: true }
];
