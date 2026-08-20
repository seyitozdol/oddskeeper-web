#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PostgREST 1000-cap bekcisi (C-2, 2026-08-20).

Supabase/PostgREST db-max-rows=1000: sinirsiz .select ilk 1000 satiri doner,
.limit(N>1000) SESSIZCE 1000'e kirpilir. Iki kural:

  KURAL 1 (sifir tolerans): .limit(N>1000) YASAK. Boyle bir limit hicbir zaman
    calismaz; 1000+ veri icin fetchAllPaged (.range + stabil .order) kullan.
  KURAL 2 (ratchet): sinirlayicisiz .from() zinciri (limit/range/single/
    maybeSingle/1000-cap markeri yok) dosya basina BASELINE'i asamaz; yeni
    dosyada hic olamaz. Mevcut ihlaller donduruldu, zamanla eritilir.
    Bilincli kucuk-tablo okumasi icin zincire "// 1000-cap: <gerekce>" yaz.

Baseline: .github/postgrest-limits-baseline.txt ("sayi<TAB>dosya").
Guncelleme: python check_postgrest_limits.py --write-baseline
"""
import io, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
FRONTEND = os.path.join(ROOT, "oddskeeper-web", "frontend")
BASELINE = os.path.join(ROOT, ".github", "postgrest-limits-baseline.txt")
DIRS = ["app", "components", "features", "lib"]
OK_TOKENS = (".limit(", ".range(", ".single(", ".maybeSingle(", "1000-cap", "count:", "head: true")
BIG_LIMIT = re.compile(r"\.limit\(\s*(\d+)")

def scan_file(path):
    lines = io.open(path, encoding="utf-8").read().split("\n")
    unbounded, big = [], []
    for i, ln in enumerate(lines):
        # Array.from(...) PostgREST zinciri degildir (2026-08-20 yanlis pozitifi).
        if not re.search(r"(?<!Array)\.from\(", ln):
            continue
        # zincir penceresi: .from satirindan ';' ile biten satira kadar (maks 40)
        j = i
        while j < min(i + 40, len(lines)) and not lines[j].rstrip().endswith(";"):
            j += 1
        window = "\n".join(lines[max(0, i - 3): j + 1])
        for m in BIG_LIMIT.finditer(window):
            if int(m.group(1)) > 1000:
                big.append(i + 1)
        if not any(t in window for t in OK_TOKENS):
            unbounded.append(i + 1)
    return unbounded, big

def collect():
    per_file = {}
    for d in DIRS:
        base = os.path.join(FRONTEND, d)
        for dirpath, _dirs, files in os.walk(base):
            if "node_modules" in dirpath or os.sep + ".next" in dirpath:
                continue
            for f in files:
                if not f.endswith((".ts", ".tsx")):
                    continue
                p = os.path.join(dirpath, f)
                rel = os.path.relpath(p, ROOT).replace("\\", "/")
                ub, big = scan_file(p)
                if ub or big:
                    per_file[rel] = (ub, big)
    return per_file

def main():
    per_file = collect()
    if "--write-baseline" in sys.argv:
        with io.open(BASELINE, "w", encoding="utf-8", newline="\n") as fh:
            fh.write("# sinirlayicisiz .from() zinciri sayisi (ratchet; azaltmak serbest, artirmak CI kirar)\n")
            for rel in sorted(per_file):
                ub, _big = per_file[rel]
                if ub:
                    fh.write(f"{len(ub)}\t{rel}\n")
        print(f"baseline yazildi: {sum(len(v[0]) for v in per_file.values())} sinirsiz zincir")
        return 0

    fail = False
    for rel in sorted(per_file):
        _ub, big = per_file[rel]
        for line in big:
            print(f"HATA [.limit>1000, sessiz kirpilir]: {rel}:{line}  -> fetchAllPaged kullan")
            fail = True

    baseline = {}
    if os.path.exists(BASELINE):
        for ln in io.open(BASELINE, encoding="utf-8"):
            ln = ln.strip()
            if not ln or ln.startswith("#"):
                continue
            n, rel = ln.split("\t", 1)
            baseline[rel] = int(n)
    for rel in sorted(per_file):
        ub, _big = per_file[rel]
        allowed = baseline.get(rel, 0)
        if len(ub) > allowed:
            print(f"HATA [sinirsiz .select, ratchet {allowed} -> {len(ub)}]: {rel} satirlar {ub}")
            print("   -> .limit/.range/fetchAllPaged ekle ya da bilincli kucuk tablo icin '// 1000-cap: <gerekce>' yaz")
            fail = True
    if fail:
        return 1
    total = sum(len(v[0]) for v in per_file.values())
    print(f"OK: .limit>1000 yok; sinirsiz zincir {total} (baseline icinde)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
