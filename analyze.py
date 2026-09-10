# -*- coding: utf-8 -*-
"""
Analisis del dataset publico de precios de carburantes en Espana.
Fuente: API REST publica del Ministerio para la Transicion Ecologica
        (sedeaplicaciones.minetur.gob.es) - datos abiertos, sin clave.
Salidas: web/data/dataset.json (datos compactos para la web),
         data/analysis.json (agregados) e data/informe.md (informe).
"""
import json, os, re, statistics as st, collections, math

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "data", "raw_estaciones.json")
WEBDATA = os.path.join(BASE, "web", "data")
os.makedirs(WEBDATA, exist_ok=True)

# ---------------------------------------------------------------- utilidades
def num(s):
    """'1,749' -> 1.749 ; '' -> None"""
    if s is None:
        return None
    s = str(s).strip()
    if not s:
        return None
    try:
        return float(s.replace(".", "").replace(",", "."))
    except ValueError:
        return None

def cents(x):
    return None if x is None else int(round(x * 1000))  # milesimas de euro

def pct(values, q):
    if not values:
        return None
    v = sorted(values)
    if len(v) == 1:
        return v[0]
    pos = (len(v) - 1) * q
    lo = math.floor(pos); hi = math.ceil(pos)
    if lo == hi:
        return v[int(pos)]
    return v[lo] + (v[hi] - v[lo]) * (pos - lo)

def r(x, n=3):
    return None if x is None else round(x, n)

def strip_acc(s):
    rep = str.maketrans("áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇºª",
                        "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNCoo")
    return s.translate(rep)

CONECTORES = {"de", "del", "la", "las", "los", "el", "y", "e", "en", "al", "i", "l", "d"}
def title_es(s):
    """MAYÚSCULAS -> Mayúsculas con conectores en minúscula."""
    parts = re.split(r"([\s\-/,]+)", (s or "").lower())
    out, first = [], True
    for p in parts:
        if not p.strip() or re.fullmatch(r"[\s\-/,]+", p):
            out.append(p)
            continue
        out.append(p if (not first and p in CONECTORES) else p[:1].upper() + p[1:])
        first = False
    return "".join(out).strip()

PROV_FIX = {
    "ARABA/ÁLAVA": "Álava", "BALEARS (ILLES)": "Illes Balears", "CASTELLÓN / CASTELLÓ": "Castellón",
    "CORUÑA (A)": "A Coruña", "PALMAS (LAS)": "Las Palmas", "RIOJA (LA)": "La Rioja",
    "VALENCIA / VALÈNCIA": "Valencia",
}

def fix_ine(s):
    """'Palmas de Gran Canaria (las)' -> 'Las Palmas de Gran Canaria';
       'Alcora (l')' -> "l'Alcora"."""
    m = re.match(r"^(.*?)\s*\((l|i|el|la|las|els|les|los|lo|a|as|o|os|es|sa|ses|son|na)'?\)\s*$",
                 s or "", re.I)
    if not m:
        return s
    art = m.group(2)
    if art.lower() in ("l", "i"):
        return f"{art.lower()}'{m.group(1)}"
    return f"{art.capitalize()} {m.group(1)}"

# ---------------------------------------------------------------- carga
with open(RAW, encoding="utf-8") as fh:
    raw = json.load(fh)
FECHA = raw["Fecha"]
lst = raw["ListaEESSPrecio"]

FUEL_DEFS = [
    ("Precio Gasolina 95 E5",          "Gasolina 95",   "Gasolina 95 (E5)"),
    ("Precio Gasoleo A",               "Gasoleo A",     "Gasóleo A (diésel)"),
    ("Precio Gasolina 98 E5",          "Gasolina 98",   "Gasolina 98 (E5)"),
    ("Precio Gasoleo Premium",         "Gasoleo Premium", "Gasóleo Premium"),
    ("Precio Gasolina 95 E10",         "Gasolina 95 E10", "Gasolina 95 (E10)"),
    ("Precio Gases licuados del petroleo", "GLP",       "GLP (autogas)"),
    ("Precio Gasoleo B",               "Gasoleo B",     "Gasóleo B (agrícola)"),
    ("Precio Adblue",                  "AdBlue",        "AdBlue"),
    ("Precio Gas Natural Comprimido",  "GNC",           "Gas natural comprimido"),
    ("Precio Biodiesel",               "Biodiesel",     "Biodiésel"),
    ("Precio Gas Natural Licuado",     "GNL",           "Gas natural licuado"),
    ("Precio Bioetanol",               "Bioetanol",     "Bioetanol"),
    ("Precio Hidrogeno",               "Hidrogeno",     "Hidrógeno"),
    ("Precio Amoniaco",                "Amoniaco",      "Amoniaco"),
    ("Precio Metanol",                 "Metanol",       "Metanol"),
]
# el campo real de GLP lleva acento en la fuente
FUEL_DEFS[5] = ("Precio Gases licuados del petr\u00f3leo", "GLP", "GLP (autogas)")

CCAA = {
    "01": "Andalucía", "02": "Aragón", "03": "Asturias", "04": "Baleares",
    "05": "Canarias", "06": "Cantabria", "07": "Castilla-La Mancha",
    "08": "Castilla y León", "09": "Cataluña", "10": "Extremadura",
    "11": "Galicia", "12": "Madrid", "13": "Murcia", "14": "Navarra",
    "15": "País Vasco", "16": "La Rioja", "17": "Comunitat Valenciana",
    "18": "Ceuta", "19": "Melilla",
}
ZONA = {"04": "Baleares", "05": "Canarias", "18": "Ceuta", "19": "Melilla"}

BRAND_RULES = [
    ("REPSOL", "Repsol"), ("CEPSA", "Cepsa"), ("MOEVE", "Moeve"),
    ("PETRONOR", "Petronor"), ("BP", "BP"), ("SHELL", "Shell"),
    ("GALP", "Galp"), ("PETROPRIX", "Petroprix"), ("BALLENOIL", "Ballenoil"),
    ("PLENOIL", "Plenoil"), ("CARREFOUR", "Carrefour"), ("ALCAMPO", "Alcampo"),
    ("LECLERC", "E.Leclerc"), ("COSTCO", "Costco"), ("TAMOIL", "Tamoil"),
    ("CAMPSA", "Campsa"), ("DISA", "Disa"), ("BONAREA", "BonÀrea"),
    ("Q8", "Q8"), ("AGLA", "Agla"), ("REPSOL BUTANO", "Repsol"),
    ("SHELL", "Shell"), ("CARBURANTES", None), ("E.S.", None),
    ("ESTACION DE SERVICIO", None), ("GASOLINERA", None),
]

def norm_brand(rotulo):
    t = strip_acc(str(rotulo or "")).upper()
    t = re.sub(r"[^A-Z0-9Ñ ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    for key, name in BRAND_RULES:
        if key in t:
            if name is None:          # rotulo generico -> no es una marca comercial
                return "Independiente (sin marca)"
            return name
    if not t or re.match(r"^N\s*[ºO]?\s*\d", t) or re.match(r"^\d", t) or len(t) <= 3:
        return "Independiente (sin marca)"
    return t.title()

# ---------------------------------------------------------------- parseo
stations, bad_coords, seen_ids = [], 0, collections.Counter()
for it in lst:
    lat, lon = num(it.get("Latitud")), num(it.get("Longitud (WGS84)"))
    if lat is None or lon is None:
        bad_coords += 1
        continue
    seen_ids[it.get("IDEESS")] += 1
    rawprov = (it.get("Provincia") or "").strip()
    prices = {}
    for key, short, _ in FUEL_DEFS:
        v = num(it.get(key))
        if v is not None and 0.2 < v < 6:
            prices[short] = cents(v)
    stations.append({
        "id": it.get("IDEESS"),
        "prov": PROV_FIX.get(rawprov, title_es(rawprov)),
        "muni": fix_ine(re.sub(r"\s+", " ", (it.get("Municipio") or "").strip())),
        "brand": norm_brand(it.get("Rótulo")),
        "rotulo": title_es(it.get("Rótulo")),
        "addr": title_es(it.get("Dirección")),
        "cp": it.get("C.P."),
        "hora": (it.get("Horario") or "").strip(),
        "abierta24": "24H" in (it.get("Horario") or "").upper(),
        "venta": it.get("Tipo Venta"),
        "ccaa": CCAA.get(it.get("IDCCAA"), "?"),
        "zona": ZONA.get(it.get("IDCCAA"), "Península"),
        "idprov": it.get("IDProvincia"),
        "fuel": prices,
        "bioetanol": num(it.get("% BioEtanol")),
        "ester": num(it.get("% éster metílico")),
        "lat": lat, "lon": lon,
    })

# cobertura por combustible
coverage = {short: sum(1 for s in stations if short in s["fuel"]) for _, short, _ in FUEL_DEFS}
FUELS = [(k, s, l) for k, s, l in FUEL_DEFS if coverage[s] >= 25]
MAIN = [s for _, s, _ in FUELS]
print("Estaciones validas:", len(stations))
print("Cobertura:", json.dumps(coverage, ensure_ascii=False, indent=None))

def series(short):
    return [s["fuel"][short] / 1000 for s in stations if short in s["fuel"]]

def stats_for(short):
    v = series(short)
    if not v:
        return None
    return {
        "n": len(v), "min": r(min(v)), "p05": r(pct(v, .05)), "p25": r(pct(v, .25)),
        "mediana": r(st.median(v)), "media": r(st.fmean(v)), "p75": r(pct(v, .75)),
        "p95": r(pct(v, .95)), "max": r(max(v)),
        "sd": r(st.pstdev(v) if len(v) > 1 else 0.0),
        "rango": r(max(v) - min(v)),
    }

resumen = {short: stats_for(short) for _, short, _ in FUEL_DEFS if coverage[short]}

# ---------------------------------------------------------------- agregados
def group_stats(key_fn, short, min_n=1, keep=lambda s: True):
    groups = collections.defaultdict(list)
    for s in stations:
        if short in s["fuel"] and keep(s):
            k = key_fn(s)
            if k is None:
                continue
            groups[k].append(s["fuel"][short] / 1000)
    out = []
    for g, v in groups.items():
        if len(v) >= min_n:
            out.append({"grupo": g, "n": len(v), "mediana": r(st.median(v)),
                        "media": r(st.fmean(v)), "min": r(min(v)), "max": r(max(v))})
    return out

prov_g95 = sorted(group_stats(lambda s: s["prov"], "Gasolina 95", 5), key=lambda d: d["mediana"])
prov_ga = sorted(group_stats(lambda s: s["prov"], "Gasoleo A", 5), key=lambda d: d["mediana"])
ccaa_g95 = sorted(group_stats(lambda s: s["ccaa"], "Gasolina 95", 5), key=lambda d: d["mediana"])
zona_g95 = sorted(group_stats(lambda s: s["zona"], "Gasolina 95", 3), key=lambda d: d["mediana"])

brand_counts = collections.Counter(s["brand"] for s in stations)
big_brands = {b for b, n in brand_counts.items() if n >= 15 and b != "Independiente (sin marca)"}
brand_g95 = sorted([g for g in group_stats(lambda s: s["brand"] if s["brand"] in big_brands else "Otras marcas", "Gasolina 95", 5)],
                   key=lambda d: d["mediana"])
brand_ga = sorted([g for g in group_stats(lambda s: s["brand"] if s["brand"] in big_brands else "Otras marcas", "Gasoleo A", 5)],
                  key=lambda d: d["mediana"])
# ranking comparable: solo Peninsula (Canarias/Ceuta/Melilla tienen fiscalidad propia)
brand_g95_pen = sorted(group_stats(lambda s: s["brand"] if s["brand"] in big_brands else "Otras marcas",
                                   "Gasolina 95", 5, keep=lambda s: s["zona"] == "Península"),
                       key=lambda d: d["mediana"])
brand_ga_pen = sorted(group_stats(lambda s: s["brand"] if s["brand"] in big_brands else "Otras marcas",
                                  "Gasoleo A", 5, keep=lambda s: s["zona"] == "Península"),
                      key=lambda d: d["mediana"])

# dispersion dentro del mismo municipio
def spread_by_muni(short, min_n=4):
    g = collections.defaultdict(list)
    for s in stations:
        if short in s["fuel"]:
            g[(s["prov"], s["muni"])].append((s["fuel"][short] / 1000, s))
    out = []
    for (prov, muni), v in g.items():
        if len(v) < min_n:
            continue
        prices = [p for p, _ in v]
        lo = min(v, key=lambda t: t[0]); hi = max(v, key=lambda t: t[0])
        out.append({"municipio": f"{muni} ({prov})", "n": len(v),
                    "min": r(min(prices)), "max": r(max(prices)),
                    "gap": r(max(prices) - min(prices)),
                    "ahorro50": r((max(prices) - min(prices)) * 50, 2),
                    "barata": lo[1]["brand"], "barata_rotulo": lo[1]["rotulo"],
                    "barata_dir": lo[1]["addr"],
                    "cara": hi[1]["brand"], "cara_rotulo": hi[1]["rotulo"],
                    "cara_dir": hi[1]["addr"]})
    return sorted(out, key=lambda d: -d["gap"])

spread_g95 = spread_by_muni("Gasolina 95")
spread_ga = spread_by_muni("Gasoleo A")

# 24h vs no
def split_median(short, flag_fn):
    a, b = [], []
    for s in stations:
        if short in s["fuel"]:
            (a if flag_fn(s) else b).append(s["fuel"][short] / 1000)
    f = lambda v: {"n": len(v), "mediana": r(st.median(v))} if v else None
    return f(a), f(b)

h24_g95 = split_median("Gasolina 95", lambda s: s["abierta24"])
h24_ga = split_median("Gasoleo A", lambda s: s["abierta24"])
venta_g95 = split_median("Gasolina 95", lambda s: s["venta"] == "R")
venta_ga = split_median("Gasoleo A", lambda s: s["venta"] == "R")

# gasoleo A vs gasolina 95 en la misma estacion
both = [(s["fuel"]["Gasoleo A"] / 1000, s["fuel"]["Gasolina 95"] / 1000)
        for s in stations if "Gasoleo A" in s["fuel"] and "Gasolina 95" in s["fuel"]]
diffs = [g - b for g, b in both]
diesel_caro = sum(1 for d in diffs if d > 0)

# outliers y calidad
g95 = series("Gasolina 95")
outliers = sorted([s for s in stations if "Gasolina 95" in s["fuel"]],
                  key=lambda s: s["fuel"]["Gasolina 95"])
calidad = {
    "sin_coords": bad_coords,
    "ids_duplicados": sum(1 for k, v in seen_ids.items() if v > 1),
    "sin_horario": sum(1 for s in stations if not s["hora"]),
    "precio_min_extremo": r(g95[0] if g95 else None),
    "precio_max_extremo": r(g95[-1] if g95 else None),
}

resumen_txt = {
    "fecha_datos": FECHA,
    "estaciones": len(stations),
    "municipios": len({(s["prov"], s["muni"]) for s in stations}),
    "provincias": len({s["prov"] for s in stations}),
    "marcas": len(brand_counts),
    "abiertas_24h": sum(1 for s in stations if s["abierta24"]),
    "venta_restringida": sum(1 for s in stations if s["venta"] == "R"),
    "gap_medio_municipio_g95": r(st.fmean([d["gap"] for d in spread_g95]) if spread_g95 else None, 3),
    "gap_max_municipio_g95": r(spread_g95[0]["gap"] if spread_g95 else None, 3),
    "pct_diesel_mas_caro": r(100 * diesel_caro / len(diffs), 1) if diffs else None,
    "dif_media_diesel_gasolina": r(st.fmean(diffs), 3) if diffs else None,
    "cobertura": coverage,
}

analysis = {
    "resumen": resumen_txt, "estadisticas_combustible": resumen,
    "provincias_g95": prov_g95, "provincias_ga": prov_ga,
    "ccaa_g95": ccaa_g95, "zonas_g95": zona_g95,
    "marcas_g95": brand_g95, "marcas_ga": brand_ga,
    "marcas_g95_peninsula": brand_g95_pen, "marcas_ga_peninsula": brand_ga_pen,
    "dispersion_municipios_g95": spread_g95[:25],
    "dispersion_municipios_ga": spread_ga[:25],
    "horario24_g95": h24_g95, "horario24_ga": h24_ga,
    "venta_restringida_g95": venta_g95, "venta_restringida_ga": venta_ga,
    "calidad": calidad,
}
with open(os.path.join(BASE, "data", "analysis.json"), "w", encoding="utf-8") as fh:
    json.dump(analysis, fh, ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- datos web
provs = sorted({s["prov"] for s in stations})
ccaas = sorted({s["ccaa"] for s in stations})
brands = sorted(big_brands) + ["Independiente (sin marca)", "Otras marcas"]
munis = sorted({s["muni"] for s in stations})
p_idx = {p: i for i, p in enumerate(provs)}
c_idx = {c: i for i, c in enumerate(ccaas)}
b_idx = {b: i for i, b in enumerate(brands)}
m_idx = {m: i for i, m in enumerate(munis)}
fuel_order = [s for _, s, _ in FUELS]

packed = []
for s in stations:
    packed.append([
        s["id"], round(s["lat"], 5), round(s["lon"], 5),
        p_idx[s["prov"]], c_idx[s["ccaa"]], m_idx[s["muni"]],
        b_idx.get(s["brand"], b_idx["Otras marcas"]),
        s["rotulo"] if s["brand"] in ("Independiente (sin marca)",) else "",
        s["addr"], s["cp"], s["hora"], 1 if s["abierta24"] else 0,
        [s["fuel"].get(f, 0) for f in fuel_order],
        s["idprov"],
    ])

webdata = {
    "meta": {"fecha": FECHA, "n": len(stations),
             "fuente": "Ministerio para la Transición Ecológica y el Reto Demográfico — datos abiertos (precios de carburantes en estaciones de servicio)",
             "url": "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/",
             "unidad": "milesimas de euro por litro (entero)"},
    "combustibles": [{"key": s, "label": l, "n": coverage[s]} for _, s, l in FUELS],
    "combustibles_otros": [{"key": s, "label": l, "n": coverage[s]}
                           for _, s, l in FUEL_DEFS if coverage[s] and coverage[s] < 25],
    "provincias": provs, "ccaas": ccaas, "marcas": brands, "municipios": munis,
    "marca_destacada": sorted(big_brands),
    "estaciones": packed,
}
with open(os.path.join(WEBDATA, "dataset.json"), "w", encoding="utf-8") as fh:
    json.dump(webdata, fh, ensure_ascii=False, separators=(",", ":"))
print("dataset.json:", round(os.path.getsize(os.path.join(WEBDATA, "dataset.json")) / 1024), "KB")
print("resumen:", json.dumps(resumen_txt, ensure_ascii=False))
