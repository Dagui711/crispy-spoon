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
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// true cuando ya pegaste tu configuración real
export const usarFirebase = firebaseConfig.apiKey !== "";

// Cuántos días hacia atrás mostramos en la lista y en el mapa
export const DIAS_RECIENTES = 7;
