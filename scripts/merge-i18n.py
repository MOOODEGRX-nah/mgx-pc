"""Merge a dict of {"en": {...}, "ar": {...}} keys into the locale files (keeps 'common' last). Usage: python3 scripts/merge-i18n.py file.json"""
import json, sys, collections
OD = collections.OrderedDict
add = json.load(open(sys.argv[1]), object_pairs_hook=OD)
def merge(d, a):
    for k, v in a.items():
        if isinstance(v, dict):
            d.setdefault(k, OD()); merge(d[k], v)
        else:
            d[k] = v
for lang in ("en", "ar"):
    p = f"src/i18n/locales/{lang}.json"
    d = json.load(open(p), object_pairs_hook=OD)
    common = d.pop("common")
    merge(d, add[lang].get("_root", {}))
    merge(common, add[lang].get("common", {}))
    d["common"] = common
    with open(p, "w") as f:
        json.dump(d, f, ensure_ascii=False, indent=2); f.write("\n")
