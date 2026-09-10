# -*- coding: utf-8 -*-
"""Convierte el GeoJSON de provincias en contornos compactos para el mapa."""
import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(BASE, "data", "spain-provinces.geojson")
dst = os.path.join(BASE, "web", "data", "provincias.json")

with open(src, encoding="utf-8") as fh:
    geo = json.load(fh)

def rings(geom):
    t = geom["type"]; c = geom["coordinates"]
    if t == "Polygon":
        return [c]
    return c  # MultiPolygon

out, npts = [], 0
for f in geo["features"]:
    prov = {"c": f["properties"]["cod_prov"], "n": f["properties"]["name"], "r": []}
    for poly in rings(f["geometry"]):
        for ring in poly:
            flat = []
            prev = None
            for lon, lat in ring:
                p = (round(lon, 3), round(lat, 3))
                if p == prev:
                    continue
                prev = p
                flat.extend(p)
            if len(flat) >= 8:
                prov["r"].append(flat)
                npts += len(flat) // 2
    out.append(prov)

with open(dst, "w", encoding="utf-8") as fh:
    json.dump({"provincias": out}, fh, ensure_ascii=False, separators=(",", ":"))
print("provincias:", len(out), "| puntos:", npts, "| tamaño:", round(os.path.getsize(dst) / 1024), "KB")
