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
├── LAS_NIEVES                       └── …                           │
└── EST_UNIVERSIDADES  ◄─────────────────────────────────────────────┘
```

## Colección `paraderos`

El **id del documento es el código SITP** del paradero (ej. `481A00`). Así no hace
falta un campo extra para el código y la relación con los reportes es directa.
Br. Las Nieves y Estación Universidades usan un id descriptivo (`LAS_NIEVES`,
`EST_UNIVERSIDADES`) porque no registramos su código SITP.

| ID                  | Nombre                       | lat                 | lng                  |
|---------------------|------------------------------|---------------------|----------------------|
| `481A00`            | U. Jorge Tadeo Lozano 481A00 | 4.607891187072479   | -74.06873441620392   |
| `504A00`            | U. Jorge Tadeo Lozano 504A00 | 4.606975419584897   | -74.06745538416442   |
| `LAS_NIEVES`        | Br. Las Nieves               | 4.608110479244784   | -74.06717069923171   |
| `EST_UNIVERSIDADES` | Estación Universidades       | 4.605146708561095   | -74.06722341866632   |

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
| `categoria`   | string    | `alumbrado`, `zona_oscura`, `acoso`, `otro`         |
| `descripcion` | string    | texto de 0 a 280 caracteres (puede ir vacío)        |
| `creadoEn`    | timestamp | hora del **servidor** en el momento de crear        |

### Decisiones de diseño (útiles para el documento escrito)

- **Relación por id (`paraderoId`)**: en lugar de copiar todos los datos del paradero
  en cada reporte, guardamos solo su código. Es como una *llave foránea* en SQL.
- **Categorías como ids sin tildes** (`zona_oscura`), y el texto bonito
  ("Zona oscura") vive en el código. Si cambian el texto, no hay que tocar los datos viejos.
- **La hora la pone el servidor**: si la pusiera el celular, alguien podría cambiar la
  hora de su teléfono y falsear reportes. Las reglas exigen `creadoEn == request.time`.
- **No guardamos franja (mañana/tarde/noche)**: se calcula a partir de `creadoEn`
  cuando se analicen los datos. Guardar datos derivados puede crear inconsistencias.
  Esto permitirá comparar con la encuesta de Forms (hipótesis del profesor: menor
  percepción de riesgo de día).
- **El conteo por paradero no se guarda**: el mapa cuenta los reportes de los últimos
  7 días en el navegador. Para el volumen de un piloto es más simple y siempre exacto.
- **Anónimo**: no se guarda nombre, correo, IP ni ubicación GPS de quien reporta.

### Reglas de seguridad (`firestore.rules`)

| Acción                  | `paraderos` | `reportes`                         |
|-------------------------|-------------|------------------------------------|
| Leer                    | todos       | todos                              |
| Crear                   | nadie       | todos, **si el reporte es válido** |
| Editar / borrar         | nadie       | nadie                              |

"Válido" = exactamente los 4 campos, paradero existente, categoría conocida,
descripción ≤ 280 caracteres y hora del servidor.

### Campos previstos para la Fase 2

- `reportes.confirmaciones` (número) y `reportes.ultimaConfirmacion` (timestamp) para la
  confirmación comunitaria y el indicador de transparencia.
- Una identidad anónima (Firebase Anonymous Auth) para el control anti-spam.
