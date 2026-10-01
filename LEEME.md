# Alerta Vial · MVP (fase 1)

App web para reportar incidentes en paraderos SITP cerca de la Tadeo.
Hecha con HTML + CSS + JavaScript puro, Firebase (Firestore) y Leaflet.

## Qué hay en cada archivo

```
alerta-vial/
├── index.html              La app (vistas: Reportar, Confirmación, Recientes, Mapa)
├── sembrar.html            Página de un solo uso para crear los paraderos en Firestore
├── firestore.rules         Reglas de seguridad para pegar en la consola de Firebase
├── css/
│   └── estilos.css         Colores y diseño (pensado para celular)
└── js/
    ├── firebase-config.js  TUS llaves de Firebase (las pegas tú)
    ├── firebase.js         Enciende Firebase y exporta la base de datos
    ├── datos.js            Todo lo que lee/escribe en Firestore
    ├── paraderos-semilla.js Lista inicial de paraderos (código, nombre, coordenadas)
    ├── mapa.js             Mapa Leaflet con colores según cantidad de reportes
    └── app.js              Conecta la pantalla con los datos
```

## Esquema de datos (Firestore)

**Colección `paraderos`**: el id de cada documento es el código SITP.

| Campo     | Tipo    | Ejemplo                         |
|-----------|---------|---------------------------------|
| codigo    | texto   | "481A00"                        |
| nombre    | texto   | "U. Jorge Tadeo Lozano (Cra 5)" |
| direccion | texto   | "Carrera 5 con Calle 22/23"     |
| lat, lng  | número  | 4.6040, -74.0685                |
| activo    | boolean | true                            |

**Colección `reportes`**: id automático. Se relaciona con su paradero por `paraderoId`.

| Campo       | Tipo      | Ejemplo / valores                              |
|-------------|-----------|------------------------------------------------|
| paraderoId  | texto     | "481A00" (= id del documento en `paraderos`)   |
| categoria   | texto     | alumbrado, zona_oscura, acoso, otro            |
| descripcion | texto     | opcional, máx. 280 caracteres                  |
| hora        | número    | 0 a 23 (hora de Bogotá)                        |
| franja      | texto     | manana, tarde, noche                           |
| creadoEn    | timestamp | lo pone el servidor de Google                  |

`hora` y `franja` quedan guardadas para poder comparar mañana / tarde / noche
(lo mismo que pidió el profesor en la encuesta) y para los "patrones por hora" de la fase 2.

## Puesta en marcha

1. **Crear el proyecto**: entra a https://console.firebase.google.com con tu cuenta de Google,
   "Crear proyecto", nombre `alerta-vial`. Google Analytics: puedes desactivarlo.
2. **Crear la base de datos**: menú Compilación > Firestore Database > Crear base de datos.
   Ubicación: `southamerica-east1` (São Paulo, la más cercana). Elige **modo de prueba**.
3. **Registrar la app web**: Configuración del proyecto (engranaje) > Tus apps > ícono `</>`.
   Nombre: `alerta-vial-web`. No marques Hosting por ahora. Copia el objeto `firebaseConfig`
   y pégalo en `js/firebase-config.js` reemplazando el que hay.
4. **Abrir la app con un servidor local** (no sirve abrir el .html con doble clic, porque los
   módulos de JavaScript necesitan un servidor):
   - Instala Visual Studio Code y la extensión **Live Server** (de Ritwick Dey).
   - Abre la carpeta `alerta-vial` en VS Code, clic derecho en `sembrar.html` > "Open with Live Server".
5. **Sembrar paraderos**: en `sembrar.html` pulsa "Crear paraderos". Verifica en la consola de
   Firebase que aparecieron en la colección `paraderos`.
6. **Publicar las reglas**: Firestore Database > Reglas, borra lo que hay, pega el contenido de
   `firestore.rules` y pulsa "Publicar". Desde aquí, `sembrar.html` ya no podrá escribir (correcto).
7. **Usar la app**: abre `index.html` con Live Server. Prueba un reporte y mira Recientes y Mapa.

## Truco del QR

Si abres `index.html?paradero=481A00`, el paradero queda preseleccionado.
Ese es el link que irá en el QR de cada paradero (como en el prototipo de Figma).

## Pendientes

- Verificar coordenadas reales de los paraderos (clic derecho en Google Maps) y agregar el 5.º.
- Publicar en internet (Firebase Hosting) para probar desde el celular.
