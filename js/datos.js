// ============================================================
// Capa de datos
// ------------------------------------------------------------
// Este archivo es el ÚNICO que habla con la base de datos.
// El resto de la app solo llama a estas funciones del "motor":
//
//   obtenerParaderos()            → lista de paraderos
//   crearReporte(datos)           → guarda un reporte nuevo (respeta el anti-spam)
//   escucharReportes(fn)          → llama a fn cada vez que cambian los reportes
//   votar(reporteId, tipo)        → indica "vigente" o "resuelto" (1 vez por sesión anónima)
//   misVotos()                    → { reporteId: tipo } de lo que votó esta sesión
//   guardarParadero(p)            → crea/actualiza un paradero (solo lo usa sembrar.html)
//
// Hay dos "motores" con las mismas funciones:
//   - Firebase (Firestore): datos compartidos entre todo el equipo.
//   - Demo (localStorage): datos solo en tu navegador, para probar sin Firebase.
// ============================================================
import { firebaseConfig, usarFirebase, DIAS_HISTORIAL, ESPERA_MINUTOS } from "./config.js";
import { PARADEROS_SEMILLA } from "./catalogos.js";

// Error especial para el anti-spam: lleva cuántos segundos faltan
export class EsperaError extends Error {
  constructor(segundos) {
    super(`Espera ${segundos} s para enviar otro reporte.`);
    this.segundos = segundos;
  }
}

const ESPERA_MS = ESPERA_MINUTOS * 60 * 1000;

// Fecha de hace N días (para filtrar el historial)
function inicioHistorial() {
  return new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000);
}

// Segundos que faltan para poder reportar, según la hora del último reporte
function segundosRestantes(ultimo) {
  if (!ultimo) return 0;
  return Math.max(0, Math.ceil((ultimo.getTime() + ESPERA_MS - Date.now()) / 1000));
}

// Los votos de esta sesión también se recuerdan en el navegador, para
// pintar los botones sin preguntarle a la base de datos por cada reporte.
// (La regla de "1 voto por sesión anónima" la hace cumplir el servidor, no esto.)
const CLAVE_VOTOS = "paradero-seguro-mis-votos";
function leerVotosLocales() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VOTOS) ?? "{}");
  } catch {
    return {};
  }
}
function guardarVotoLocal(reporteId, tipo) {
  try {
    localStorage.setItem(CLAVE_VOTOS, JSON.stringify({ ...leerVotosLocales(), [reporteId]: tipo }));
  } catch {
    // Si el navegador no deja guardar (modo privado), no pasa nada grave
  }
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
  const { getAuth, signInAnonymously } = await import(
    `https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`
  );
  const {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, writeBatch, increment,
    query, where, orderBy, limit, onSnapshot, serverTimestamp, Timestamp,
  } = await import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Sesión anónima: Firebase le da a este navegador un id al azar (sin nombre
  // ni correo) y lo recuerda. Lo necesitan el anti-spam y los votos. Si alguien
  // borra los datos del navegador, recibe un id nuevo: es el límite de no pedir registro.
  // Se pide solo cuando hace falta (al reportar o votar), no al abrir la app.
  let promesaSesion = null;
  function sesion() {
    promesaSesion ??= signInAnonymously(auth)
      .then((cred) => cred.user.uid)
      .catch((e) => {
        promesaSesion = null; // para reintentar la próxima vez
        if (e.code === "auth/operation-not-allowed" || e.code === "auth/admin-restricted-operation") {
          throw new Error("Falta activar el acceso Anónimo en Firebase → Authentication.");
        }
        throw e;
      });
    return promesaSesion;
  }

  return {
    async obtenerParaderos() {
      const resultado = await getDocs(collection(db, "paraderos"));
      // El id del documento ES el código del paradero (ej: "481A00")
      return resultado.docs.map((d) => ({ codigo: d.id, ...d.data() }));
    },

    async guardarParadero({ codigo, nombre, lat, lng }) {
      // setDoc con un id fijo: si el paradero ya existe, lo reemplaza
      // (por eso se puede sembrar varias veces sin duplicar).
      await setDoc(doc(db, "paraderos", codigo), { nombre, lat, lng });
    },

    async crearReporte({ paraderoId, categoria, descripcion }) {
      const uid = await sesion();
      const refLimite = doc(db, "limites", uid);

      // Revisamos la espera ANTES de enviar, para mostrar un mensaje claro.
      const limite = await getDoc(refLimite);
      const faltan = segundosRestantes(limite.exists() ? limite.data().ultimoReporte?.toDate() : null);
      if (faltan > 0) throw new EsperaError(faltan);

      // El reporte y el límite se guardan JUNTOS (batch): o se guardan los
      // dos, o ninguno. Las reglas exigen que vayan juntos.
      const refReporte = doc(collection(db, "reportes"));
      const lote = writeBatch(db);
      lote.set(refReporte, {
        paraderoId,
        categoria,
        descripcion,
        // La hora la pone el SERVIDOR, no el celular (así nadie la falsifica)
        creadoEn: serverTimestamp(),
        vigente: 0,
        resuelto: 0,
      });
      lote.set(refLimite, { ultimoReporte: serverTimestamp(), reporteId: refReporte.id });
      try {
        await lote.commit();
      } catch (e) {
        // Si el reloj del celular está mal, el servidor puede rechazarlo
        // aunque aquí creyéramos que ya pasó la espera.
        if (e.code === "permission-denied") throw new EsperaError(ESPERA_MINUTOS * 60);
        throw e;
      }
    },

    escucharReportes(alCambiar) {
      const consulta = query(
        collection(db, "reportes"),
        where("creadoEn", ">=", Timestamp.fromDate(inicioHistorial())),
        orderBy("creadoEn", "desc"),
        limit(1000),
      );
      // onSnapshot = "avísame cada vez que algo cambie" (tiempo real)
      return onSnapshot(
        consulta,
        (resultado) => {
          const reportes = resultado.docs.map((d) => {
            const r = d.data();
            return {
              id: d.id,
              paraderoId: r.paraderoId,
              categoria: r.categoria,
              descripcion: r.descripcion,
              // Justo después de crear, el servidor aún no ha puesto la hora
              // (creadoEn es null por un instante); usamos la hora local mientras tanto.
              creadoEn: r.creadoEn ? r.creadoEn.toDate() : new Date(),
              // Los reportes viejos no tienen contadores: cuentan como 0
              vigente: r.vigente ?? 0,
              resuelto: r.resuelto ?? 0,
            };
          });
          alCambiar(reportes);
        },
        (error) => console.error("Error escuchando reportes:", error),
      );
    },

    async votar(reporteId, tipo) {
      const uid = await sesion();
      const refReporte = doc(db, "reportes", reporteId);
      // Contador +1 y "papeleta" del voto, juntos. Si esta sesión ya
      // votó, la papeleta ya existe y las reglas rechazan todo.
      const lote = writeBatch(db);
      lote.update(refReporte, { [tipo]: increment(1) });
      lote.set(doc(refReporte, "votos", uid), { tipo, creadoEn: serverTimestamp() });
      try {
        await lote.commit();
      } catch (e) {
        if (e.code === "permission-denied") {
          // Lo más probable: ya había votado (por ejemplo, desde otra pestaña)
          const previo = await getDoc(doc(refReporte, "votos", uid)).catch(() => null);
          if (previo?.exists()) {
            guardarVotoLocal(reporteId, previo.data().tipo);
            return;
          }
        }
        throw e;
      }
      guardarVotoLocal(reporteId, tipo);
    },

    misVotos() {
      return leerVotosLocales();
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
      return guardados.map((r) => ({ vigente: 0, resuelto: 0, ...r, creadoEn: new Date(r.creadoEn) }));
    } catch {
      return [];
    }
  }

  function guardarTodos(todos) {
    localStorage.setItem(CLAVE, JSON.stringify(todos));
    oyentes.forEach((fn) => fn(historial()));
  }

  function historial() {
    const desde = inicioHistorial();
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
      const ultimo = todos.reduce((max, r) => (r.creadoEn > max ? r.creadoEn : max), null);
      const faltan = segundosRestantes(ultimo);
      if (faltan > 0) throw new EsperaError(faltan);
      todos.push({
        id: crypto.randomUUID(),
        paraderoId,
        categoria,
        descripcion,
        creadoEn: new Date(),
        vigente: 0,
        resuelto: 0,
      });
      guardarTodos(todos);
    },

    escucharReportes(alCambiar) {
      oyentes.push(alCambiar);
      alCambiar(historial());
    },

    async votar(reporteId, tipo) {
      if (leerVotosLocales()[reporteId]) return; // ya votó
      const todos = leerTodos();
      const r = todos.find((x) => x.id === reporteId);
      if (!r) return;
      r[tipo] += 1;
      guardarVotoLocal(reporteId, tipo);
      guardarTodos(todos);
    },

    misVotos() {
      return leerVotosLocales();
    },
  };
}

// Elegimos el motor según si hay configuración de Firebase o no
export const motor = usarFirebase ? await crearMotorFirebase() : crearMotorDemo();
export const modoDemo = !usarFirebase;
