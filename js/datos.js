// ============================================================
// Capa de datos
// ------------------------------------------------------------
// Este archivo es el ÚNICO que habla con la base de datos.
// El resto de la app solo llama a estas 3 funciones:
//
//   obtenerParaderos()            → lista de paraderos
//   crearReporte(datos)           → guarda un reporte nuevo
//   escucharReportesRecientes(fn) → llama a fn cada vez que cambian los reportes
//   guardarParadero(p)            → crea/actualiza un paradero (solo lo usa sembrar.html)
//
// Hay dos "motores" con las mismas funciones:
//   - Firebase (Firestore): datos compartidos entre todo el equipo.
//   - Demo (localStorage): datos solo en tu navegador, para probar sin Firebase.
// ============================================================
import { firebaseConfig, usarFirebase, DIAS_RECIENTES } from "./config.js";
import { PARADEROS_SEMILLA } from "./catalogos.js";

// Fecha de hace N días (para filtrar "recientes")
function inicioPeriodo() {
  return new Date(Date.now() - DIAS_RECIENTES * 24 * 60 * 60 * 1000);
}

// ------------------------------------------------------------
// Motor 1: Firebase / Firestore
// ------------------------------------------------------------
async function crearMotorFirebase() {
  // Importamos Firebase directamente desde internet (CDN), sin instalar nada.
  const VERSION = "11.0.2";
  const { initializeApp } = await import(
    `https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`
  );
  const {
    getFirestore, collection, doc, getDocs, setDoc, addDoc, query, where, orderBy,
    limit, onSnapshot, serverTimestamp, Timestamp,
  } = await import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  return {
    async obtenerParaderos() {
      const resultado = await getDocs(collection(db, "paraderos"));
      // El id del documento ES el código del paradero (ej: "481A00")
      return resultado.docs.map((doc) => ({ codigo: doc.id, ...doc.data() }));
    },

    async guardarParadero({ codigo, nombre, lat, lng }) {
      // setDoc con un id fijo: si el paradero ya existe, lo reemplaza
      // (por eso se puede sembrar varias veces sin duplicar).
      await setDoc(doc(db, "paraderos", codigo), { nombre, lat, lng });
    },

    async crearReporte({ paraderoId, categoria, descripcion }) {
      await addDoc(collection(db, "reportes"), {
        paraderoId,
        categoria,
        descripcion,
        // La hora la pone el SERVIDOR, no el celular (así nadie la falsifica)
        creadoEn: serverTimestamp(),
      });
    },

    escucharReportesRecientes(alCambiar) {
      const consulta = query(
        collection(db, "reportes"),
        where("creadoEn", ">=", Timestamp.fromDate(inicioPeriodo())),
        orderBy("creadoEn", "desc"),
        limit(500),
      );
      // onSnapshot = "avísame cada vez que algo cambie" (tiempo real)
      return onSnapshot(
        consulta,
        (resultado) => {
          const reportes = resultado.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              paraderoId: d.paraderoId,
              categoria: d.categoria,
              descripcion: d.descripcion,
              // Justo después de crear, el servidor aún no ha puesto la hora
              // (creadoEn es null por un instante); usamos la hora local mientras tanto.
              creadoEn: d.creadoEn ? d.creadoEn.toDate() : new Date(),
            };
          });
          alCambiar(reportes);
        },
        (error) => console.error("Error escuchando reportes:", error),
      );
    },
  };
}

// ------------------------------------------------------------
// Motor 2: Demo (localStorage del navegador)
// ------------------------------------------------------------
function crearMotorDemo() {
  const CLAVE = "paradero-seguro-reportes-demo";
  const oyentes = [];

  function leerTodos() {
    try {
      const guardados = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
      // En localStorage las fechas se guardan como texto; las convertimos a Date
      return guardados.map((r) => ({ ...r, creadoEn: new Date(r.creadoEn) }));
    } catch {
      return [];
    }
  }

  function recientes() {
    const desde = inicioPeriodo();
    return leerTodos()
      .filter((r) => r.creadoEn >= desde)
      .sort((a, b) => b.creadoEn - a.creadoEn);
  }

  return {
    async obtenerParaderos() {
      return PARADEROS_SEMILLA;
    },

    async guardarParadero() {
      throw new Error("Estás en modo demo: primero pega tu configuración en js/config.js.");
    },

    async crearReporte({ paraderoId, categoria, descripcion }) {
      const todos = leerTodos();
      todos.push({
        id: crypto.randomUUID(),
        paraderoId,
        categoria,
        descripcion,
        creadoEn: new Date(),
      });
      localStorage.setItem(CLAVE, JSON.stringify(todos));
      oyentes.forEach((fn) => fn(recientes()));
    },

    escucharReportesRecientes(alCambiar) {
      oyentes.push(alCambiar);
      alCambiar(recientes());
    },
  };
}

// Elegimos el motor según si hay configuración de Firebase o no
export const motor = usarFirebase ? await crearMotorFirebase() : crearMotorDemo();
export const modoDemo = !usarFirebase;
