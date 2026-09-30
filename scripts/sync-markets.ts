/**
 * Fetches six ECB reference-rate series (foreign currency per 1 EUR) and caches
 * them under data/seed/markets/ecb-exr.json.
 *
 *   pnpm data:sync:markets                      # live: ECB Data Portal API
 *   pnpm data:sync:markets --from-file <csv>    # offline: ECB eurofxref-hist.csv
 *
 * The eurofxref-hist.csv file is the ECB's own full-history download
 * (https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SERIES = ["USD", "JPY", "GBP", "CHF", "NOK", "ZAR"] as const;
const START = "2021-01-01";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, "data/seed/markets/ecb-exr.json");

type Obs = { date: string; value: number };

async function fetchLive(): Promise<{ series: Record<string, Obs[]>; source: string }> {
  const series: Record<string, Obs[]> = {};
  for (const ccy of SERIES) {
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${ccy}.EUR.SP00.A?format=csvdata&startPeriod=${START}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ECB ${ccy}: HTTP ${res.status}`);
    const lines = (await res.text()).trim().split(/\r?\n/);
    const header = lines[0]!.split(",");
    const iDate = header.indexOf("TIME_PERIOD");
    const iVal = header.indexOf("OBS_VALUE");
    series[ccy] = lines
      .slice(1)
      .map((l) => l.split(","))
      .filter((c) => c[iVal] && c[iVal] !== "NaN")
      .map((c) => ({ date: c[iDate]!, value: Number(c[iVal]) }));
  }
  return { series, source: "ECB Data Portal API (EXR, daily reference rates)" };
}

function fromFile(path: string): { series: Record<string, Obs[]>; source: string } {
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const header = lines[0]!.split(",");
  const series: Record<string, Obs[]> = {};
  for (const ccy of SERIES) series[ccy] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const date = cells[0]!;
    if (date < START) continue;
    for (const ccy of SERIES) {
      const v = cells[header.indexOf(ccy)];
      if (v && v !== "N/A") series[ccy]!.push({ date, value: Number(v) });
    }
  }
  for (const ccy of SERIES) series[ccy]!.sort((a, b) => a.date.localeCompare(b.date));
  return { series, source: "ECB euro foreign exchange reference rates, eurofxref-hist.csv" };
}

async function main() {
  const i = process.argv.indexOf("--from-file");
  const { series, source } = i > 0 ? fromFile(process.argv[i + 1]!) : await fetchLive();
  mkdirSync(dirname(dest), { recursive: true });
  const out = {
    source,
    unit: "units of currency per 1 EUR",
    fetchedAt: new Date().toISOString(),
    series: Object.fromEntries(SERIES.map((c) => [c, series[c]!.map((o) => [o.date, o.value])])),
  };
  writeFileSync(dest, JSON.stringify(out));
  console.log(`wrote ${SERIES.map((c) => `${c}:${series[c]!.length}`).join(" ")} -> ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
