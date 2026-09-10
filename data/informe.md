# Radiografía del precio de los carburantes en España

**Fuente:** API pública de precios de carburantes del Ministerio para la Transición Ecológica y el Reto Demográfico (datos abiertos, sin clave de API).  
**Fecha de los datos:** 10/09/2026 22:31:58  
**Volumen:** 11.496 estaciones de servicio · 3.259 municipios · 52 provincias · 2.419 rótulos distintos  
**Generado por:** `analyze.py` (análisis) → `informe.py` (este documento) → dashboard en `web/`

## 1. Resumen ejecutivo

- El precio de la **gasolina 95** tiene una mediana de **1,889 €/L** y va de 1,289 a 2,299 €/L: un **rango de 1,01 €/L**, es decir **50,50 € de diferencia** al llenar un depósito de 50 litros.
- El **gasóleo A** se mueve entre 1,429 y 2,249 €/L, con mediana 1,849 €/L.
- La brecha media dentro de un mismo municipio (con 4 o más estaciones) es de **0,208 €/L** en gasolina 95; el caso más extremo llega a **0,539 €/L** (26,95 € por depósito).
- Diferencias fiscales: **Canarias** marca la mediana más baja (1,484 €/L) y **Baleares** la más alta (1,985 €/L) — 0,50 €/L de diferencia estructural.
- El diésel ya no siempre es más barato: en el **17,60 %** de las estaciones con ambos precios el gasóleo A cuesta más que la gasolina 95; de media, el diésel está 0,029 €/L por debajo.
- **5.359 estaciones (46,62 %)** abren 24 h y, contra el tópico, su mediana es más barata que la de las estaciones con horario limitado (1,799 frente a 1,919 €/L en gasolina 95).

## 2. Cobertura por combustible

| Combustible | Estaciones con precio |
|---|---:|
| Gasóleo A (diésel) | 11.281 |
| Gasolina 95 (E5) | 10.934 |
| Gasóleo Premium | 5.920 |
| Gasolina 98 (E5) | 5.505 |
| AdBlue | 2.937 |
| Gasóleo B (agrícola) | 2.280 |
| GLP (autogas) | 998 |
| Gas natural comprimido | 141 |
| Gas natural licuado | 98 |
| Gasolina 95 (E10) | 29 |
| Biodiésel | 29 |
| Bioetanol | 1 |
| Hidrogeno | 0 (no se comercializa en ninguna estación) |
| Amoniaco | 0 (no se comercializa en ninguna estación) |
| Metanol | 0 (no se comercializa en ninguna estación) |

## 3. Distribución de precios por combustible

| Combustible | n | mín | p05 | p25 | mediana | media | p75 | p95 | máx | desv. típica |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gasolina 95 (E5) | 10.934 | 1,289 | 1,615 | 1,769 | 1,889 | 1,848 | 1,949 | 1,989 | 2,299 | 0,128 |
| Gasóleo A (diésel) | 11.281 | 1,429 | 1,629 | 1,739 | 1,849 | 1,818 | 1,899 | 1,939 | 2,249 | 0,101 |
| Gasolina 98 (E5) | 5.505 | 1,387 | 1,629 | 1,989 | 2,059 | 2,008 | 2,095 | 2,135 | 2,379 | 0,143 |
| Gasóleo Premium | 5.920 | 1,469 | 1,699 | 1,840 | 1,945 | 1,909 | 1,985 | 2,029 | 2,209 | 0,106 |
| Gasolina 95 (E10) | 29 | 1,598 | 1,693 | 1,778 | 1,969 | 1,910 | 1,999 | 2,062 | 2,069 | 0,133 |
| GLP (autogas) | 998 | 0,781 | 0,898 | 1,029 | 1,125 | 1,092 | 1,169 | 1,199 | 1,290 | 0,097 |
| Gasóleo B (agrícola) | 2.280 | 0,999 | 1,360 | 1,495 | 1,627 | 1,608 | 1,729 | 1,809 | 2,199 | 0,151 |
| AdBlue | 2.937 | 0,424 | 0,576 | 0,799 | 0,899 | 0,939 | 1,029 | 1,330 | 3,413 | 0,250 |
| Gas natural comprimido | 141 | 1,299 | 1,660 | 1,725 | 1,804 | 1,789 | 1,826 | 1,999 | 1,999 | 0,112 |
| Biodiésel | 29 | 1,639 | 1,669 | 1,699 | 1,699 | 1,765 | 1,799 | 1,990 | 2,029 | 0,115 |
| Gas natural licuado | 98 | 1,239 | 1,586 | 1,755 | 1,759 | 1,739 | 1,819 | 1,820 | 1,849 | 0,101 |
| Bioetanol | 1 | 2,399 | 2,399 | 2,399 | 2,399 | 2,399 | 2,399 | 2,399 | 2,399 | 0,000 |

*Precios en €/L. El sesgo es claro: la media queda por debajo de la mediana porque hay una cola de estaciones muy baratas (sobre todo Canarias e instalaciones automatizadas) mientras la mayoría se concentra en la parte alta de la horquilla.*

## 4. Geografía del precio

### 4.1 Provincias — gasolina 95

| Más baratas | n | mediana | | Más caras | n | mediana |
|---|---:|---:|---|---|---:|---:|
| Las Palmas | 254 | 1,469 | | Illes Balears | 215 | 1,985 |
| Melilla | 12 | 1,490 | | Palencia | 66 | 1,959 |
| Santa Cruz de Tenerife | 241 | 1,515 | | Guadalajara | 86 | 1,959 |
| Ceuta | 10 | 1,648 | | Cantabria | 167 | 1,950 |
| Almería | 216 | 1,809 | | Burgos | 134 | 1,949 |
| Valencia | 617 | 1,820 | | Asturias | 225 | 1,949 |

### 4.2 Provincias — gasóleo A

| Más baratas | n | mediana | | Más caras | n | mediana |
|---|---:|---:|---|---|---:|---:|
| Melilla | 12 | 1,472 | | Illes Balears | 215 | 1,929 |
| Las Palmas | 254 | 1,570 | | Palencia | 68 | 1,909 |
| Santa Cruz de Tenerife | 240 | 1,619 | | Málaga | 307 | 1,899 |
| Ceuta | 10 | 1,678 | | Cantabria | 168 | 1,899 |
| Navarra | 237 | 1,779 | | Cáceres | 158 | 1,899 |
| Lleida | 180 | 1,794 | | Ávila | 72 | 1,899 |

### 4.3 Comunidades autónomas y grandes zonas (gasolina 95)

| Comunidad | n | mediana |
|---|---:|---:|
| Canarias | 495 | 1,484 |
| Melilla | 12 | 1,490 |
| Ceuta | 10 | 1,648 |
| País Vasco | 213 | 1,859 |
| Extremadura | 1284 | 1,879 |
| Andalucía | 2069 | 1,879 |
| Cataluña | 1409 | 1,879 |
| Navarra | 430 | 1,881 |
| Galicia | 386 | 1,889 |
| Castilla-La Mancha | 765 | 1,899 |
| Aragón | 395 | 1,899 |
| Comunitat Valenciana | 80 | 1,899 |
| Castilla y León | 875 | 1,915 |
| Madrid | 721 | 1,919 |
| Murcia | 858 | 1,919 |
| La Rioja | 325 | 1,939 |
| Asturias | 225 | 1,949 |
| Cantabria | 167 | 1,950 |
| Baleares | 215 | 1,985 |

| Zona | n | mediana |
|---|---:|---:|
| Canarias | 495 | 1,484 |
| Melilla | 12 | 1,490 |
| Ceuta | 10 | 1,648 |
| Península | 10202 | 1,899 |
| Baleares | 215 | 1,985 |

## 5. Marcas y rótulos

Comparar marcas exige controlar el territorio: la red de una marca puede concentrarse donde los impuestos son menores. Por eso se muestran **solo estaciones de la Península** (Canarias, Ceuta y Melilla tienen fiscalidad propia sobre hidrocarburos).

### 5.1 Gasolina 95 — Península

| Rótulo | n | mediana | | Rótulo | n | mediana |
|---|---:|---:|---|---|---:|---:|
| BonÀrea | 65 | 1,678 | | Valcarce | 48 | 1,949 |
| Gasexpress | 40 | 1,729 | | Moeve | 548 | 1,949 |
| Plenergy | 365 | 1,739 | | Repsol | 2653 | 1,949 |
| Ballenoil | 414 | 1,739 | | Petronor | 159 | 1,945 |
| Petroprix | 173 | 1,739 | | BP | 577 | 1,939 |
| Alcampo | 55 | 1,743 | | Cepsa | 556 | 1,931 |

### 5.2 Gasóleo A — Península

| Rótulo | n | mediana | | Rótulo | n | mediana |
|---|---:|---:|---|---|---:|---:|
| BonÀrea | 68 | 1,623 | | Petrocat | 18 | 1,907 |
| Petromiralles | 16 | 1,689 | | Moeve | 558 | 1,904 |
| Alcampo | 55 | 1,693 | | Valcarce | 52 | 1,899 |
| Esclatoil | 71 | 1,699 | | Cepsa | 564 | 1,899 |
| Eroski | 36 | 1,709 | | Repsol | 2659 | 1,899 |
| Gasexpress | 40 | 1,713 | | Petronor | 160 | 1,895 |

## 6. Misma ciudad, precios distintos

Municipios con 4 o más estaciones, ordenados por la diferencia entre la más cara y la más barata (gasolina 95). Es el ahorro real que depende solo de elegir bien la estación.

| Municipio | n | más barata | más cara | diferencia | ahorro 50 L | estación más barata |
|---|---:|---:|---:|---:|---:|---|
| Badajoz (Badajoz) | 35 | 1,700 | 2,239 | **0,539** | 26,95 € | Cooperativa Colonos de Gévora — Ctra. Badajoz-Montijo Km 30.2 |
| Tarragona (Tarragona) | 28 | 1,465 | 1,989 | **0,524** | 26,20 € | Oil Prix — Calle Eix Transversal S/N, S/N |
| Mahón (Illes Balears) | 8 | 1,799 | 2,299 | **0,500** | 25,00 € | Autonetoil — Carrer Artruxt, 7 |
| Igualada (Barcelona) | 11 | 1,459 | 1,929 | **0,470** | 23,50 € | By Energy — Calle Prat de la Riba, S/N |
| Alhama de Murcia (Murcia) | 8 | 1,730 | 2,199 | **0,469** | 23,45 € | Juan Martinez Saura — Carretera Cartagena Km. 1,6 |
| Manresa (Barcelona) | 15 | 1,579 | 1,999 | **0,420** | 21,00 € | U.s. Manresa -Gas-Oils Rovira- — Carrer Dolors, 19 |
| Navalmoral de la Mata (Cáceres) | 8 | 1,639 | 2,059 | **0,420** | 21,00 € | Ballenoil — Carretera Madrid-Lisboa Km. 44 |
| Amposta (Tarragona) | 8 | 1,562 | 1,975 | **0,413** | 20,65 € | Gasamp — Calle Orleans, 2 |
| Carcaixent (Valencia) | 6 | 1,587 | 1,998 | **0,411** | 20,55 € | Family Energy — Avenida Boticari Bodi (c.c. Ribera del Xuquer), 28 |
| Cuevas del Almanzora (Almería) | 6 | 1,499 | 1,909 | **0,410** | 20,50 € | Es Borja - E.s.sobrado de Picato, S.l.u — Carretera A-332 Km. 11 |
| El Ejido (Almería) | 33 | 1,589 | 1,999 | **0,410** | 20,50 € | Econorias — Loma del Viento,  Nº 78 |
| Alzira (Valencia) | 11 | 1,587 | 1,992 | **0,405** | 20,25 € | Plenergy — Calle Benito Perez Galdos, 68 |

## 7. Horario, tipo de venta y contenido renovable

- **Abiertas 24 h (gasolina 95):** mediana 1,799 €/L sobre 4.971 estaciones.
- **Horario limitado:** mediana 1,919 €/L sobre 5.963 estaciones. La diferencia es de 0,120 €/L a favor de las que abren siempre (las grandes cadenas automatizadas de bajo coste operan 24 h).
- Ventas en régimen restringido (cooperativas, flotas): 0 estaciones. En este volcado la totalidad de los registros son de venta al público.

## 8. Diésel frente a gasolina

- Estaciones con ambos precios publicados: 11.281 (aprox.).
- En el **17,60 %** de ellas el gasóleo A es más caro que la gasolina 95.
- Diferencia media (gasóleo A − gasolina 95): **-0,029 €/L**.

## 9. Calidad del dato

- Registros descargados: 11.496. Estaciones sin coordenadas utilizables: 0.
- Identificadores de estación duplicados: 0. Registros sin horario: 0.
- Precios fuera del rango de filtro (0,20–6,00 €/L): ninguno relevante; los valores vacíos se tratan como 'producto no comercializado en esa estación'.
- Los precios llegan como texto con coma decimal y las coordenadas en WGS84; ambos se normalizan en `analyze.py`.

## 10. Metodología y reproducibilidad

```
python analyze.py     # normaliza el volcado crudo y genera data/analysis.json + web/data/dataset.json
python prep_geo.py    # contornos provinciales simplificados -> web/data/provincias.json
python informe.py     # este documento -> data/informe.md
```
Descarga original:

```
curl -o data/raw_estaciones.json \
  https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/
```

El archivo se actualiza cada media hora, por lo que las cifras son una **foto fija** del momento indicado en la cabecera: repetir la descarga dará cifras ligeramente distintas. Este documento es estadística descriptiva, no una recomendación de repostaje.
