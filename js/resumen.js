// ============================================================
// Pestaña "Resumen": totales de la semana y patrones por hora.
// Los gráficos son barras hechas con HTML y CSS (sin librerías):
// cada barra es un <div> cuyo alto o ancho es un porcentaje.
// ============================================================
import { resumenSemanal, FRANJAS, franjaDeHora } from "./analisis.js";
import { CATEGORIAS } from "./catalogos.js";

// Ícono del sprite de index.html (el nombre siempre viene de nuestro código)
const icono = (nombre) => `<svg class="ico" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;

// Crea un elemento con clase y texto (el texto nunca se interpreta como HTML)
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Barras horizontales: una fila por elemento, con su nombre y su valor.
// filas = [{ nombre, valor, categoria?, codigo? }]
// "categoria" y "codigo" son opcionales: solo dibujan la placa de color o
// la placa con el código del paradero al lado del nombre.
function barrasHorizontales(titulo, filas, clase = "") {
  const bloque = crear("section", `bloque-resumen ${clase}`.trim());
  bloque.appendChild(crear("h3", "", titulo));
  const maximo = Math.max(1, ...filas.map((f) => f.valor));
  const lista = crear("ul", "barras");
  for (const f of filas) {
    const li = crear("li", "fila-barra");
    li.title = `${f.codigo ? `${f.codigo} ` : ""}${f.nombre}: ${f.valor}`;
    const nombre = crear("span", "nombre-barra");
    if (f.categoria) {
      const placa = crear("span", "placa-categoria placa-mini");
      placa.dataset.categoria = f.categoria.id;
      placa.innerHTML = icono(f.categoria.svg);
      nombre.appendChild(placa);
    }
    if (f.codigo) nombre.appendChild(crear("span", "placa-codigo", f.codigo));
    if (f.nombre) nombre.appendChild(crear("span", "texto-barra", f.nombre));
    li.appendChild(nombre);
    const pista = crear("span", "pista-barra");
    const barra = crear("span", "barra");
    barra.style.width = `${(f.valor / maximo) * 100}%`;
    pista.appendChild(barra);
    li.appendChild(pista);
    li.appendChild(crear("span", "valor-barra", String(f.valor)));
    lista.appendChild(li);
  }
  bloque.appendChild(lista);
  return bloque;
}

// Barras verticales de las 24 horas del día
function graficoPorHora(porHora) {
  const bloque = crear("section", "bloque-resumen bloque-horas");
  bloque.appendChild(crear("h3", "", "Patrón por hora del día"));

  const maximo = Math.max(...porHora);
  const formatoHora = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "a. m." : "p. m."}`;
  // Puede haber empate entre varias horas
  const horasPico = porHora.map((v, h) => (v === maximo ? h : -1)).filter((h) => h >= 0);
  let textoPico = "Aún no hay reportes esta semana.";
  if (maximo > 0 && horasPico.length === 1) {
    textoPico = `Hora con más reportes: ${formatoHora(horasPico[0])} (${maximo})`;
  } else if (maximo > 0 && horasPico.length <= 4) {
    // (sin punto final extra: la última hora ya termina en "m.")
    textoPico = `Horas con más reportes (${maximo} cada una): ${horasPico.map(formatoHora).join(", ")}`;
  } else if (maximo > 0) {
    textoPico = `${horasPico.length} horas empatan con ${maximo} reportes; aún no hay una hora pico clara.`;
  }
  bloque.appendChild(crear("p", "nota texto-pico", textoPico));

  const grafico = crear("div", "grafico-horas");
  grafico.setAttribute("role", "img");
  grafico.setAttribute("aria-label", "Reportes por hora del día: " +
    porHora.map((v, h) => `${formatoHora(h)}: ${v}`).join(", "));
  porHora.forEach((valor, hora) => {
    // Las horas de la franja "noche" llevan un fondo sombreado (solo visual)
    const col = crear("div", "columna-hora" + (franjaDeHora(hora) === "noche" ? " es-noche" : ""));
    col.title = `${formatoHora(hora)}: ${valor} reporte${valor === 1 ? "" : "s"}`;
    const esPico = valor === maximo && maximo > 0;
    const barra = crear("div", "barra-hora" + (esPico ? " pico" : ""));
    barra.style.height = maximo > 0 ? `${(valor / maximo) * 100}%` : "0";
    // El valor se escribe solo encima de la(s) hora(s) pico, para no saturar
    if (esPico && horasPico.length <= 4) barra.appendChild(crear("span", "valor-pico", String(valor)));
    col.appendChild(barra);
    grafico.appendChild(col);
  });
  bloque.appendChild(grafico);

  // Etiquetas del eje: solo algunas horas, para que no se amontonen
  const eje = crear("div", "eje-horas");
  for (const h of [0, 6, 12, 18, 23]) {
    const marca = crear("span", "", formatoHora(h));
    marca.style.left = `${((h + 0.5) / 24) * 100}%`;
    eje.appendChild(marca);
  }
  bloque.appendChild(eje);
  const noche = FRANJAS.find((f) => f.id === "noche");
  const leyenda = crear("p", "nota leyenda-noche");
  leyenda.appendChild(crear("span", "muestra-noche"));
  leyenda.appendChild(document.createTextNode(`Fondo sombreado: ${noche.nombre.toLowerCase()} (${noche.rango})`));
  bloque.appendChild(leyenda);
  return bloque;
}

export function pintarResumen(contenedor, reportes, paraderos) {
  const datos = resumenSemanal(reportes);
  contenedor.innerHTML = "";

  // Número grande: total de la semana y comparación con la anterior
  // (se presenta como un tablero de estación)
  const cifra = crear("div", "cifra-semana");
  cifra.appendChild(crear("span", "cifra-etiqueta", "Últimos 7 días"));
  cifra.appendChild(crear("span", "numero-grande", String(datos.total)));
  cifra.appendChild(crear("span", "cifra-texto", `reporte${datos.total === 1 ? "" : "s"} esta semana`));
  const diferencia = datos.total - datos.totalAnterior;
  const comparacion = diferencia === 0
    ? `Igual que la semana anterior (${datos.totalAnterior})`
    : `${Math.abs(diferencia)} ${diferencia > 0 ? "más" : "menos"} que la semana anterior (${datos.totalAnterior})`;
  const lineaComparacion = crear("span", "cifra-comparacion");
  lineaComparacion.innerHTML = icono(diferencia === 0 ? "equal" : diferencia > 0 ? "trending-up" : "trending-down");
  lineaComparacion.appendChild(document.createTextNode(comparacion));
  cifra.appendChild(lineaComparacion);
  contenedor.appendChild(cifra);

  if (datos.total < 10) {
    cifra.appendChild(crear("p", "aviso-pocos-datos",
      "Con pocos reportes los patrones todavía no son concluyentes. Úsalos como referencia, no como conclusión."));
  }

  const franjas = barrasHorizontales("Por franja del día",
    FRANJAS.map((f) => ({ nombre: f.nombre, valor: datos.porFranja[f.id] ?? 0 })), "bloque-franjas");
  // Cada rango va en su propio <span> para que no se parta a mitad de renglón
  const rangos = crear("p", "nota rangos-franjas");
  FRANJAS.forEach((f, i) => {
    if (i > 0) rangos.appendChild(document.createTextNode(" · "));
    rangos.appendChild(crear("span", "", `${f.nombre}: ${f.rango}`));
  });
  franjas.appendChild(rangos);
  contenedor.appendChild(franjas);

  contenedor.appendChild(graficoPorHora(datos.porHora));

  contenedor.appendChild(barrasHorizontales("Por categoría",
    CATEGORIAS.map((c) => ({ nombre: c.nombre, categoria: c, valor: datos.porCategoria[c.id] ?? 0 }))
      .sort((a, b) => b.valor - a.valor), "bloque-categorias"));

  contenedor.appendChild(barrasHorizontales("Por paradero",
    paraderos.map((p) => ({
      nombre: p.nombre.replace(p.codigo, "").trim(), codigo: p.codigo, valor: datos.porParadero[p.codigo] ?? 0,
    }))
      .sort((a, b) => b.valor - a.valor), "bloque-paraderos"));
}
