# -*- coding: utf-8 -*-
"""Genera data/informe.md (informe escrito) a partir de data/analysis.json."""
import json, os, statistics as st

BASE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(BASE, "data", "analysis.json"), encoding="utf-8"))
R = A["resumen"]
OUT = os.path.join(BASE, "data", "informe.md")

def n3(x):
    return "—" if x is None else f"{x:.3f}".replace(".", ",")

def n2(x):
    return "—" if x is None else f"{x:.2f}".replace(".", ",")

def miles(x):
    return f"{x:,}".replace(",", ".")

L = []
w = L.append

w("# Radiografía del precio de los carburantes en España\n")
w(f"**Fuente:** API pública de precios de carburantes del Ministerio para la Transición Ecológica y el "
  f"Reto Demográfico (datos abiertos, sin clave de API).  \n"
  f"**Fecha de los datos:** {R['fecha_datos']}  \n"
  f"**Volumen:** {miles(R['estaciones'])} estaciones de servicio · {miles(R['municipios'])} municipios · "
  f"{R['provincias']} provincias · {miles(R['marcas'])} rótulos distintos  \n"
  f"**Generado por:** `analyze.py` (análisis) → `informe.py` (este documento) → dashboard en `web/`\n")

w("## 1. Resumen ejecutivo\n")
g95 = A["estadisticas_combustible"]["Gasolina 95"]
ga = A["estadisticas_combustible"]["Gasoleo A"]
w(f"- El precio de la **gasolina 95** tiene una mediana de **{n3(g95['mediana'])} €/L** y va de "
  f"{n3(g95['min'])} a {n3(g95['max'])} €/L: un **rango de {n2(g95['rango'])} €/L**, es decir "
  f"**{n2(g95['rango'] * 50)} € de diferencia** al llenar un depósito de 50 litros.")
w(f"- El **gasóleo A** se mueve entre {n3(ga['min'])} y {n3(ga['max'])} €/L, con mediana {n3(ga['mediana'])} €/L.")
w(f"- La brecha media dentro de un mismo municipio (con 4 o más estaciones) es de "
  f"**{n3(R['gap_medio_municipio_g95'])} €/L** en gasolina 95; el caso más extremo llega a "
  f"**{n3(R['gap_max_municipio_g95'])} €/L** ({n2(R['gap_max_municipio_g95'] * 50)} € por depósito).")
zonas = A["zonas_g95"]
w(f"- Diferencias fiscales: **{zonas[0]['grupo']}** marca la mediana más baja ({n3(zonas[0]['mediana'])} €/L) y "
  f"**{zonas[-1]['grupo']}** la más alta ({n3(zonas[-1]['mediana'])} €/L) — "
  f"{n2(zonas[-1]['mediana'] - zonas[0]['mediana'])} €/L de diferencia estructural.")
w(f"- El diésel ya no siempre es más barato: en el **{n2(R['pct_diesel_mas_caro'])} %** de las estaciones con "
  f"ambos precios el gasóleo A cuesta más que la gasolina 95; de media, el diésel está "
  f"{n3(abs(R['dif_media_diesel_gasolina']))} €/L {'por debajo' if R['dif_media_diesel_gasolina'] < 0 else 'por encima'}.")
w(f"- **{miles(R['abiertas_24h'])} estaciones ({n2(100*R['abiertas_24h']/R['estaciones'])} %)** abren 24 h y, "
  f"contra el tópico, su mediana es más barata que la de las estaciones con horario limitado "
  f"({n3(A['horario24_g95'][0]['mediana'])} frente a {n3(A['horario24_g95'][1]['mediana'])} €/L en gasolina 95).")
w("")

w("## 2. Cobertura por combustible\n")
w("| Combustible | Estaciones con precio |")
w("|---|---:|")
etiquetas = {"Gasolina 95": "Gasolina 95 (E5)", "Gasoleo A": "Gasóleo A (diésel)",
             "Gasolina 98": "Gasolina 98 (E5)", "Gasoleo Premium": "Gasóleo Premium",
             "Gasolina 95 E10": "Gasolina 95 (E10)", "GLP": "GLP (autogas)", "Gasoleo B": "Gasóleo B (agrícola)",
             "AdBlue": "AdBlue", "GNC": "Gas natural comprimido", "Biodiesel": "Biodiésel", "GNL": "Gas natural licuado"}
for k, v in sorted(R["cobertura"].items(), key=lambda kv: -kv[1]):
    if v:
        w(f"| {etiquetas.get(k, k)} | {miles(v)} |")
for k, v in R["cobertura"].items():
    if not v:
        w(f"| {etiquetas.get(k, k)} | 0 (no se comercializa en ninguna estación) |")
w("")

w("## 3. Distribución de precios por combustible\n")
w("| Combustible | n | mín | p05 | p25 | mediana | media | p75 | p95 | máx | desv. típica |")
w("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
for k, s in A["estadisticas_combustible"].items():
    if not s:
        continue
    w(f"| {etiquetas.get(k, k)} | {miles(s['n'])} | {n3(s['min'])} | {n3(s['p05'])} | {n3(s['p25'])} | "
      f"{n3(s['mediana'])} | {n3(s['media'])} | {n3(s['p75'])} | {n3(s['p95'])} | {n3(s['max'])} | {n3(s['sd'])} |")
w("\n*Precios en €/L. El sesgo es claro: la media queda por debajo de la mediana porque hay una cola de "
  "estaciones muy baratas (sobre todo Canarias e instalaciones automatizadas) mientras la mayoría se concentra "
  "en la parte alta de la horquilla.*\n")

w("## 4. Geografía del precio\n")
w("### 4.1 Provincias — gasolina 95\n")
prov = A["provincias_g95"]
w("| Más baratas | n | mediana | | Más caras | n | mediana |")
w("|---|---:|---:|---|---|---:|---:|")
for i in range(6):
    a, b = prov[i], prov[-1 - i]
    w(f"| {a['grupo']} | {a['n']} | {n3(a['mediana'])} | | {b['grupo']} | {b['n']} | {n3(b['mediana'])} |")
w("\n### 4.2 Provincias — gasóleo A\n")
prov = A["provincias_ga"]
w("| Más baratas | n | mediana | | Más caras | n | mediana |")
w("|---|---:|---:|---|---|---:|---:|")
for i in range(6):
    a, b = prov[i], prov[-1 - i]
    w(f"| {a['grupo']} | {a['n']} | {n3(a['mediana'])} | | {b['grupo']} | {b['n']} | {n3(b['mediana'])} |")
w("\n### 4.3 Comunidades autónomas y grandes zonas (gasolina 95)\n")
w("| Comunidad | n | mediana |")
w("|---|---:|---:|")
for c in A["ccaa_g95"]:
    w(f"| {c['grupo']} | {c['n']} | {n3(c['mediana'])} |")
w("\n| Zona | n | mediana |")
w("|---|---:|---:|")
for c in A["zonas_g95"]:
    w(f"| {c['grupo']} | {c['n']} | {n3(c['mediana'])} |")
w("")

w("## 5. Marcas y rótulos\n")
w("Comparar marcas exige controlar el territorio: la red de una marca puede concentrarse donde los impuestos "
  "son menores. Por eso se muestran **solo estaciones de la Península** (Canarias, Ceuta y Melilla tienen "
  "fiscalidad propia sobre hidrocarburos).\n")
w("### 5.1 Gasolina 95 — Península\n")
w("| Rótulo | n | mediana | | Rótulo | n | mediana |")
w("|---|---:|---:|---|---|---:|---:|")
pen = [m for m in A["marcas_g95_peninsula"] if m["grupo"] != "Otras marcas" and m["n"] >= 15]
for i in range(6):
    a, b = pen[i], pen[-1 - i]
    w(f"| {a['grupo']} | {a['n']} | {n3(a['mediana'])} | | {b['grupo']} | {b['n']} | {n3(b['mediana'])} |")
w("\n### 5.2 Gasóleo A — Península\n")
w("| Rótulo | n | mediana | | Rótulo | n | mediana |")
w("|---|---:|---:|---|---|---:|---:|")
pen = [m for m in A["marcas_ga_peninsula"] if m["grupo"] != "Otras marcas" and m["n"] >= 15]
for i in range(6):
    a, b = pen[i], pen[-1 - i]
    w(f"| {a['grupo']} | {a['n']} | {n3(a['mediana'])} | | {b['grupo']} | {b['n']} | {n3(b['mediana'])} |")
w("")

w("## 6. Misma ciudad, precios distintos\n")
w("Municipios con 4 o más estaciones, ordenados por la diferencia entre la más cara y la más barata "
  "(gasolina 95). Es el ahorro real que depende solo de elegir bien la estación.\n")
w("| Municipio | n | más barata | más cara | diferencia | ahorro 50 L | estación más barata |")
w("|---|---:|---:|---:|---:|---:|---|")
for d in A["dispersion_municipios_g95"][:12]:
    w(f"| {d['municipio']} | {d['n']} | {n3(d['min'])} | {n3(d['max'])} | **{n3(d['gap'])}** | "
      f"{n2(d['ahorro50'])} € | {d['barata_rotulo']} — {d['barata_dir']} |")
w("")

w("## 7. Horario, tipo de venta y contenido renovable\n")
h24, hno = A["horario24_g95"]
w(f"- **Abiertas 24 h (gasolina 95):** mediana {n3(h24['mediana'])} €/L sobre {miles(h24['n'])} estaciones.")
w(f"- **Horario limitado:** mediana {n3(hno['mediana'])} €/L sobre {miles(hno['n'])} estaciones. "
  f"La diferencia es de {n3(abs(h24['mediana'] - hno['mediana']))} €/L a favor de las que abren siempre "
  f"(las grandes cadenas automatizadas de bajo coste operan 24 h).")
w(f"- Ventas en régimen restringido (cooperativas, flotas): {miles(R['venta_restringida'])} estaciones. "
  f"En este volcado la totalidad de los registros son de venta al público.")
w("")

w("## 8. Diésel frente a gasolina\n")
w(f"- Estaciones con ambos precios publicados: {miles(A['estadisticas_combustible']['Gasoleo A']['n'])} (aprox.).")
w(f"- En el **{n2(R['pct_diesel_mas_caro'])} %** de ellas el gasóleo A es más caro que la gasolina 95.")
w(f"- Diferencia media (gasóleo A − gasolina 95): **{n3(R['dif_media_diesel_gasolina'])} €/L**.")
w("\n## 9. Calidad del dato\n")
c = A["calidad"]
w(f"- Registros descargados: 11.496. Estaciones sin coordenadas utilizables: {c['sin_coords']}.")
w(f"- Identificadores de estación duplicados: {c['ids_duplicados']}. Registros sin horario: {c['sin_horario']}.")
w(f"- Precios fuera del rango de filtro (0,20–6,00 €/L): ninguno relevante; los valores vacíos se tratan como "
  f"'producto no comercializado en esa estación'.")
w(f"- Los precios llegan como texto con coma decimal y las coordenadas en WGS84; ambos se normalizan en `analyze.py`.")
w("\n## 10. Metodología y reproducibilidad\n")
w("```\npython analyze.py     # normaliza el volcado crudo y genera data/analysis.json + web/data/dataset.json\n"
  "python prep_geo.py    # contornos provinciales simplificados -> web/data/provincias.json\n"
  "python informe.py     # este documento -> data/informe.md\n```")
w("Descarga original:\n")
w("```\ncurl -o data/raw_estaciones.json \\\n"
  "  https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/\n```")
w("\nEl archivo se actualiza cada media hora, por lo que las cifras son una **foto fija** del momento indicado "
  "en la cabecera: repetir la descarga dará cifras ligeramente distintas. Este documento es estadística "
  "descriptiva, no una recomendación de repostaje.\n")

open(OUT, "w", encoding="utf-8").write("\n".join(L))
print("informe.md:", round(os.path.getsize(OUT) / 1024, 1), "KB,", len(L), "líneas")
