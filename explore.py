import json, collections

RAW = r"C:\Users\Javi\Desktop\carburantes-espana\data\raw_estaciones.json"
with open(RAW, encoding="utf-8") as fh:
    raw = json.load(fh)

print("top-level keys:", list(raw.keys()))
print("fecha:", raw.get("Fecha"), "| nota:", raw.get("Nota"))
lst = raw["ListaEESSPrecio"]
print("n registros:", len(lst))

keys = collections.Counter()
for it in lst:
    keys.update(it.keys())
for k, v in keys.most_common():
    print(f"  {v:6d}  {k}")

print("\nEJEMPLO:")
print(json.dumps(lst[0], ensure_ascii=False, indent=1))
print("\nEJEMPLO 2:")
print(json.dumps(lst[5000], ensure_ascii=False, indent=1))
