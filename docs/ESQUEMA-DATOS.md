# Esquema de datos en Firestore

Firestore no usa tablas como Excel o SQL. Organiza los datos en **colecciones**
(como carpetas) que contienen **documentos** (como fichas). Cada documento tiene
**campos** (nombre → valor) y un **id** único.

Usamos las dos colecciones que el grupo ya había diseñado: `paraderos` y `reportes`.

```
paraderos (colección)                reportes (colección)
├── 481A00  (documento)              ├── a8Fk2…  (documento, id automático)
│   ├── nombre: "U. Jorge Tadeo…"    │   ├── paraderoId: "481A00"  ──┐
│   ├── lat: 4.6078911…              │   ├── categoria: "alumbrado"  │ relación:
│   └── lng: -74.0687344…            │   ├── descripcion: "…"        │ apunta al id
├── 504A00                           │   └── creadoEn: 1 oct 2026…   │ del paradero
├── 113A00                           └── …                           │
└── 664A00  ◄────────────────────────────────────────────────────────┘
```

## Colección `paraderos`

El **id del documento es el código SITP** del paradero (ej. `481A00`). Así no hace
falta un campo extra para el código y la relación con los reportes es directa.

| ID                  | Nombre                       | lat                 | lng                  |
|---------------------|------------------------------|---------------------|----------------------|
| `481A00`            | U. Jorge Tadeo Lozano 481A00 | 4.607891187072479   | -74.06873441620392   |
| `504A00`            | U. Jorge Tadeo Lozano 504A00 | 4.606975419584897   | -74.06745538416442   |
| `113A00`            | Br. Las Nieves               | 4.608110479244784   | -74.06717069923171   |
| `664A00`            | Estación Universidades       | 4.605146708561095   | -74.06722341866632   |

| Campo    | Tipo   | Ejemplo             | Descripción                         |
|----------|--------|---------------------|-------------------------------------|
| `nombre` | string | `"Br. Las Nieves"`  | Nombre legible para mostrar         |
| `lat`    | number | `4.608110479244784` | Latitud (coordenada norte-sur)      |
| `lng`    | number | `-74.06717069923171`| Longitud (coordenada este-oeste)    |

Solo se crean/editan desde la consola de Firebase (la app no puede modificarlos).

## Colección `reportes`

Cada reporte es un documento con **id automático** (Firestore lo inventa).

| Campo         | Tipo      | Valores permitidos                                  |
|---------------|-----------|-----------------------------------------------------|
| `paraderoId`  | string    | id de un documento que exista en `paraderos`        |
| `categoria`   | string    | `hurto`, `alumbrado`, `zona_oscura`, `acoso`, `otro` |
| `descripcion` | string    | texto de 0 a 280 caracteres (puede ir vacío)        |
| `creadoEn`    | timestamp | hora del **servidor** en el momento de crear        |
| `vigente`     | number    | personas que confirmaron "sigue así" (arranca en 0) |
| `resuelto`    | number    | personas que dijeron "ya se resolvió" (arranca en 0)|

### Subcolección `reportes/{id}/votos`

Un documento por celular que votó en ese reporte; su id es el id anónimo del
celular. Como un documento con el mismo id no se puede crear dos veces, cada
celular vota **una sola vez** por reporte.

| Campo      | Tipo      | Valores                     |
|------------|-----------|-----------------------------|
| `tipo`     | string    | `vigente` o `resuelto`      |
| `creadoEn` | timestamp | hora del servidor           |

## Colección `limites` (anti-spam)

Un documento por celular (id = id anónimo). Guarda cuándo reportó por última vez.
Las reglas solo dejan crear un reporte si **en la misma operación** se actualiza
este documento, y solo dejan actualizarlo si pasaron **2 minutos**. Solo su dueño
lo puede leer: nadie más puede saber qué reportó cada celular.

| Campo           | Tipo      | Descripción                               |
|-----------------|-----------|-------------------------------------------|
| `ultimoReporte` | timestamp | hora del servidor del último reporte      |
| `reporteId`     | string    | id de ese reporte (impide colar varios reportes en una sola operación) |

## Identidad anónima

La app no pide registro. Firebase Authentication le da a cada celular un id al
azar (sin nombre, correo ni teléfono). Ese id **no se guarda en los reportes**,
solo en `limites` y `votos`, que nadie más puede leer.

### Decisiones de diseño (útiles para el documento escrito)

- **Relación por id (`paraderoId`)**: en lugar de copiar todos los datos del paradero
  en cada reporte, guardamos solo su código. Es como una *llave foránea* en SQL.
- **Categorías como ids sin tildes** (`zona_oscura`), y el texto bonito
  ("Zona oscura") vive en el código. Si cambian el texto, no hay que tocar los datos viejos.
- **La hora la pone el servidor**: si la pusiera el celular, alguien podría cambiar la
  hora de su teléfono y falsear reportes. Las reglas exigen `creadoEn == request.time`.
- **No guardamos franja (mañana/tarde/noche) ni hora**: se calculan a partir de
  `creadoEn` en hora de Bogotá (ver `js/analisis.js`). Guardar datos derivados puede
  crear inconsistencias, y si la calculara el celular, uno con la hora mal configurada
  guardaría datos falsos. La pestaña **Resumen** muestra las franjas y el patrón por
  hora, para comparar con la encuesta de Forms (hipótesis del profesor: menor
  percepción de riesgo de día).
- **Anti-spam en el servidor, no solo en la app**: un mensaje en la pantalla se puede
  saltar; una regla de Firestore no. La app además avisa cuánto falta esperar.
- **Transparencia**: cada reporte muestra si fue confirmado por la comunidad y qué tan
  reciente es. Los reportes marcados como resueltos no cuentan en el mapa.
- **El conteo por paradero no se guarda**: el mapa cuenta los reportes activos de los
  últimos 7 días en el navegador. Para el volumen de un piloto es más simple y siempre exacto.
- **Anónimo**: no se guarda nombre, correo, IP ni ubicación GPS de quien reporta. El
  botón SOS puede compartir la ubicación por WhatsApp, pero solo si la persona lo pide,
  y nunca se guarda en la base de datos.

### Reglas de seguridad (`firestore.rules`)

| Acción          | `paraderos` | `reportes`                                    | `limites` / `votos`          |
|-----------------|-------------|-----------------------------------------------|------------------------------|
| Leer            | todos       | todos                                         | solo el dueño                |
| Crear           | nadie       | con sesión, válido y respetando los 2 minutos | solo el dueño, con su reporte o voto |
| Editar          | nadie       | solo +1 a `vigente` o `resuelto`, 1 vez por celular | `limites`: tras 2 minutos |
| Borrar          | nadie       | nadie                                         | nadie                        |

"Válido" = exactamente los 6 campos, paradero existente, categoría conocida,
descripción ≤ 280 caracteres, hora del servidor y contadores en 0.
Las reglas tienen 31 pruebas automáticas (incluyen intentos de trampa: votar dos
veces, sumar +5, colar 2 reportes juntos, usar el límite de otro celular, etc.).
