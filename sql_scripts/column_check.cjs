// Read-only check: every table/column the frontend (src/) selects or filters on must exist.
// For each table we ask Supabase for the columns with limit=0 (no rows are returned, nothing is
// written); a missing column makes PostgREST answer 400 "column ... does not exist".
//
//   node sql_scripts/column_check.cjs                         -> uses .env (testing)
//   node sql_scripts/column_check.cjs .env.production.local   -> production (file is git-ignored)
//
// The env file needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Only the project ref is printed.
const fs = require("node:fs");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const envFile = path.resolve(projectDir, process.argv[2] || ".env");
if (!fs.existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^VITE_SUPABASE_(URL|ANON_KEY)=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error(`${path.basename(envFile)} must contain VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY`);
  process.exit(1);
}
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` };

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });

// table -> column -> list of "file:line (kind)"
const uses = {};
const addUse = (table, col, where) => {
  ((uses[table] ||= {})[col] ||= []).push(where);
};

for (const file of walk(path.join(projectDir, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(projectDir, file).replace(/\\/g, "/");
  const lineOf = (idx) => src.slice(0, idx).split("\n").length;

  const consts = {};
  for (const m of src.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*\n?\s*(["'`])([^"'`]*)\2/g)) consts[m[1]] = m[3];

  for (const m of src.matchAll(/\.from\(\s*(["'`])([A-Za-z0-9_]+)\1\s*\)/g)) {
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    if (/storage/.test(before)) continue; // supabase.storage.from(bucket)
    const table = m[2];
    const where = `${rel}:${lineOf(m.index)}`;
    addUse(table, "__table__", where);

    const rest = src.slice(m.index + m[0].length);
    const end = rest.search(/\.from\(|;\s*\n|\n\s*\n/);
    const chain = end === -1 ? rest.slice(0, 1500) : rest.slice(0, end);

    const sel = chain.match(/\.select\(\s*(?:(["'`])([^"'`]*)\1|([A-Z_][A-Z0-9_]*))/);
    if (sel) {
      const list = sel[2] ?? consts[sel[3]] ?? "";
      if (!/\(/.test(list)) {
        for (let c of list.split(",")) {
          c = c.trim();
          if (!c || c === "*" || c.includes("${")) continue;
          if (c.includes(":")) c = c.split(":").pop().trim();
          c = c.replace(/::.*$/, "").replace(/^"|"$/g, "");
          addUse(table, c, `${where} (select)`);
        }
      }
    }
    for (const f of chain.matchAll(/\.(eq|neq|is|not|in|ilike|like|gte|lte|gt|lt|order|contains)\(\s*(["'`])([A-Za-z0-9_]+)\2/g)) {
      addUse(table, f[3], `${where} (${f[1]})`);
    }
  }
}

const probe = async (table, cols) => {
  const select = cols.map((c) => (/[A-Z]/.test(c) ? `"${c}"` : c)).join(",");
  const url = `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select || "*")}&limit=0`;
  const res = await fetch(url, { headers });
  return res.ok ? null : (await res.json().catch(() => ({}))).message || `HTTP ${res.status}`;
};

(async () => {
  console.log(`env file: ${path.basename(envFile)} | project: ${new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0]}`);
  const problems = [];
  let checked = 0;
  for (const [table, colMap] of Object.entries(uses).sort()) {
    const cols = Object.keys(colMap).filter((c) => c !== "__table__");
    const tableError = await probe(table, []);
    if (tableError) {
      problems.push(`TABLE ${table}: ${tableError}  <- ${colMap.__table__.slice(0, 3).join(", ")}`);
      continue;
    }
    checked += cols.length;
    if (!cols.length || !(await probe(table, cols))) continue;
    for (const c of cols) {
      const err = await probe(table, [c]);
      if (err) problems.push(`${table}.${c}: ${err}\n    used at ${colMap[c].join("; ")}`);
    }
  }
  console.log(`tables: ${Object.keys(uses).length}, columns checked: ${checked}`);
  console.log(problems.length ? `PROBLEMS (${problems.length}):\n` + problems.join("\n") : "No problems found");
})();
