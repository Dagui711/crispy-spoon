// ============================================================
// Pestaña "Resumen": totales de la semana y patrones por hora.
// Los gráficos son barras hechas con HTML y CSS (sin librerías):
// cada barra es un <div> cuyo alto o ancho es un porcentaje.
// ============================================================
import { resumenSemanal, FRANJAS } from "./analisis.js";
import { CATEGORIAS } from "./catalogos.js";

// Crea un elemento con clase y texto (el texto nunca se interpreta como HTML)
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Barras horizontales: una fila por elemento, con su nombre y su valor.
// filas = [{ nombre, valor }]
function barrasHorizontales(titulo, filas) {
  const bloque = crear("section", "bloque-resumen");
  bloque.appendChild(crear("h3", "", titulo));
  const maximo = Math.max(1, ...filas.map((f) => f.valor));
  const lista = crear("ul", "barras");
  for (const f of filas) {
    const li = crear("li", "fila-barra");
    li.title = `${f.nombre}: ${f.valor}`;
    li.appendChild(crear("span", "nombre-barra", f.nombre));
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
  const bloque = crear("section", "bloque-resumen");
  bloque.appendChild(crear("h3", "", "Patrón por hora del día"));

  const maximo = Math.max(...porHora);
  const formatoHora = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "a. m." : "p. m."}`;
  // Puede haber empate entre varias horas
  const horasPico = porHora.map((v, h) => (v === maximo ? h : -1)).filter((h) => h >= 0);
  let textoPico = "Aún no hay reportes esta semana.";
  if (maximo > 0 && horasPico.length === 1) {
    textoPico = `Hora con más reportes: ${formatoHora(horasPico[0])} (${maximo}).`;
  } else if (maximo > 0 && horasPico.length <= 4) {
    textoPico = `Horas con más reportes (${maximo} cada una): ${horasPico.map(formatoHora).join(", ")}.`;
  } else if (maximo > 0) {
    textoPico = `${horasPico.length} horas empatan con ${maximo} reportes; aún no hay una hora pico clara.`;
  }
  bloque.appendChild(crear("p", "nota", textoPico));

  const grafico = crear("div", "grafico-horas");
  grafico.setAttribute("role", "img");
  grafico.setAttribute("aria-label", "Reportes por hora del día: " +
    porHora.map((v, h) => `${formatoHora(h)}: ${v}`).join(", "));
  porHora.forEach((valor, hora) => {
    const col = crear("div", "columna-hora");
    col.title = `${formatoHora(hora)}: ${valor} reporte${valor === 1 ? "" : "s"}`;
    const barra = crear("div", "barra-hora" + (valor === maximo && maximo > 0 ? " pico" : ""));
    barra.style.height = maximo > 0 ? `${(valor / maximo) * 100}%` : "0";
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
  return bloque;
}

export function pintarResumen(contenedor, reportes, paraderos) {
  const datos = resumenSemanal(reportes);
  contenedor.innerHTML = "";

  // Número grande: total de la semana y comparación con la anterior
  const cifra = crear("div", "cifra-semana");
  cifra.appendChild(crear("span", "numero-grande", String(datos.total)));
  cifra.appendChild(crear("span", "", `reporte${datos.total === 1 ? "" : "s"} esta semana`));
  const diferencia = datos.total - datos.totalAnterior;
  const comparacion = diferencia === 0
    ? `Igual que la semana anterior (${datos.totalAnterior})`
    : `${diferencia > 0 ? "▲" : "▼"} ${Math.abs(diferencia)} ${diferencia > 0 ? "más" : "menos"} que la semana anterior (${datos.totalAnterior})`;
  cifra.appendChild(crear("span", "nota", comparacion));
  contenedor.appendChild(cifra);

  if (datos.total < 10) {
    contenedor.appendChild(crear("p", "aviso-pocos-datos",
      "Con pocos reportes los patrones todavía no son concluyentes. Úsalos como referencia, no como conclusión."));
  }

  const franjas = barrasHorizontales("Por franja del día",
    FRANJAS.map((f) => ({ nombre: f.nombre, valor: datos.porFranja[f.id] ?? 0 })));
  franjas.appendChild(crear("p", "nota", FRANJAS.map((f) => `${f.nombre}: ${f.rango}`).join(" · ")));
  contenedor.appendChild(franjas);

  contenedor.appendChild(graficoPorHora(datos.porHora));

  contenedor.appendChild(barrasHorizontales("Por categoría",
    CATEGORIAS.map((c) => ({ nombre: `${c.icono} ${c.nombre}`, valor: datos.porCategoria[c.id] ?? 0 }))
      .sort((a, b) => b.valor - a.valor)));

  contenedor.appendChild(barrasHorizontales("Por paradero",
    paraderos.map((p) => ({ nombre: p.nombre, valor: datos.porParadero[p.codigo] ?? 0 }))
      .sort((a, b) => b.valor - a.valor)));
}
