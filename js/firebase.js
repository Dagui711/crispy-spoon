// =============================================================
// CONEXIÓN CON FIREBASE
// -------------------------------------------------------------
// Este archivo "enciende" Firebase una sola vez y exporta `db`
// (la base de datos Firestore) para que los demás archivos la usen.
// Las librerías se cargan directo desde internet (CDN), por eso
// no hay que instalar nada.
// =============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// ¿Ya pegaste tu configuración? Si no, avisamos en pantalla.
export const configuracionLista = !firebaseConfig.apiKey.includes("PEGA_AQUI");

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
