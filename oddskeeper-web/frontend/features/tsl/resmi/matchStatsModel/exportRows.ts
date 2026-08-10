// Excel Module12 (KartiVerileriAktar_FinalMidOnly4) export mantığının web karşılığı.
// 9 blok = [FT,1H,2H] × [Total,Home,Away]; template sırası birebir aynı.
import type { ModelOutput, SelectionLines } from "@/features/match-stats-model/engine";

export interface ImportRow {
  fixtureId: string;
  matchLabel: string; // maç kimliği (dedup + görüntüleme; xlsx'e YAZILMAZ)
  market: string; // görüntüleme için (xlsx'e YAZILMAZ)
  template: string;
  line: number;
  status: string; // "" | "SU"
  sel1Name: string; // "Over"
  sel1Price: number;
  sel2Name: string; // "Under" | "" (yarıda Under kapalıysa boş)
  sel2Price: number | null; // Under kapalıysa null
}

// Blok sırası (template listesiyle birebir): FT-T, FT-H, FT-A, 1H-T, 1H-H, 1H-A, 2H-T, 2H-H, 2H-A.
const BLOCKS: Array<["ft" | "h1" | "h2", "total" | "home" | "away"]> = [
  ["ft", "total"], ["ft", "home"], ["ft", "away"],
  ["h1", "total"], ["h1", "home"], ["h1", "away"],
  ["h2", "total"], ["h2", "home"], ["h2", "away"],
];

// Dengeli çizgi etrafında n çizgi (n=1 → sadece mid; 3 → ±1; 5 → ±2).
function centerLines(sel: SelectionLines, n: number) {
  const idx = sel.lines.findIndex((l) => l.line === sel.balancedLine);
  if (idx < 0) return sel.lines.slice(0, n);
  const half = Math.floor(n / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(sel.lines.length, start + n);
  return sel.lines.slice(start, end);
}

export interface ExportMarketCfg {
  lineCount: number; // FT blokları
  sendHalves: boolean;
  midOnly: boolean;
  // Yarı-bazlı kontrol (Config Markets): blok başına çizgi sayısı + Under.
  lineCount1h: number;
  lineCount2h: number;
  under1h: boolean;
  under2h: boolean;
}

export function buildImportRows(
  out: ModelOutput,
  cfg: ExportMarketCfg,
  templates: string[], // markete ait template kodları, blok sırasında
  externalFixtureId: string,
  market: string,
  matchLabel: string
): ImportRow[] {
  const rows: ImportRow[] = [];
  const lastBlk = cfg.sendHalves ? 8 : 2;
  for (let blk = 0; blk <= lastBlk; blk++) {
    const template = templates[blk];
    if (!template) continue; // market bu blok için template tanımlamamış (ör. Corner)
    const [seg, group] = BLOCKS[blk];
    const sel = out[seg][group];
    // Çizgi sayısı: mid-only → 1; FT (blk<3) → lineCount; 1H → lineCount1h; 2H → lineCount2h.
    const nLines = cfg.midOnly ? 1 : blk < 3 ? cfg.lineCount : blk < 6 ? cfg.lineCount1h : cfg.lineCount2h;
    // Under seçimi: FT'de her zaman; yarılarda markete göre açık/kapalı.
    const withUnder = blk < 3 ? true : blk < 6 ? cfg.under1h : cfg.under2h;
    for (const ln of centerLines(sel, nLines)) {
      rows.push({
        fixtureId: externalFixtureId,
        matchLabel,
        market,
        template,
        line: ln.line,
        status: ln.suspended ? "SU" : "",
        sel1Name: "Over",
        sel1Price: ln.overOdds,
        sel2Name: withUnder ? "Under" : "",
        sel2Price: withUnder ? ln.underOdds : null,
      });
    }
  }
  return rows;
}

export function importRowsToCsv(rows: ImportRow[]): string {
  const header = [
    "Fixture ID", "Market Template", "Line", "Market Status",
    "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.fixtureId, r.template, r.line, r.status,
      r.sel1Name, r.sel1Price.toFixed(2), r.sel2Name, r.sel2Price != null ? r.sel2Price.toFixed(2) : "",
    ].join(","));
  }
  return lines.join("\n");
}
