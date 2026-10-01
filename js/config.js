// ============================================================
// Configuración de Firebase
// ------------------------------------------------------------
// Estos datos los copias desde la consola de Firebase:
//   Configuración del proyecto (⚙️) → General → "Tus apps" → App web → SDK setup → "Config"
// Ver docs/GUIA-FIREBASE.md, paso 3.
//
// ¿Es peligroso subir esto a GitHub? No: la apiKey de Firebase web NO es
// una contraseña, solo identifica tu proyecto. Lo que protege tus datos
// son las reglas de seguridad (archivo firestore.rules).
//
// Mientras apiKey esté vacía, la app funciona en "MODO DEMO": guarda los
// reportes solo en tu navegador (localStorage). Así puedes probar ya mismo.
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDYG8DoIhjFe7DxtuBq8eESuxy-HCP6ICQ",
  authDomain: "paradero-seguro-tadeo.firebaseapp.com",
  projectId: "paradero-seguro-tadeo",
  storageBucket: "paradero-seguro-tadeo.firebasestorage.app",
  messagingSenderId: "1073506245745",
  appId: "1:1073506245745:web:4c9114d2fe651ff5edcfd0",
};

// true cuando ya pegaste tu configuración real
export const usarFirebase = firebaseConfig.apiKey !== "";

// Cuántos días hacia atrás mostramos en la lista y en el mapa
export const DIAS_RECIENTES = 7;

// El resumen semanal compara esta semana con la anterior, así que
// descargamos 2 semanas de reportes.
export const DIAS_HISTORIAL = 14;

// Anti-spam: minutos de espera entre reportes de un mismo celular.
// ⚠️ Debe coincidir con duration.value(2, 'm') en firestore.rules.
export const ESPERA_MINUTOS = 2;

// Dirección pública de la app (para los QR y los mensajes de WhatsApp)
export const URL_PUBLICA = "https://dagui711.github.io/crispy-spoon/";
