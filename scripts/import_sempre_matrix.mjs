import pg from "pg";
import XLSX from "xlsx";

const source = "/home/ubuntu/upload/MatrizdeTrade-SMP2026.xlsx";
const dryRun = process.argv.includes("--dry-run");
const { Client } = pg;

const normalize = value => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("pt-BR");

const clean = value => String(value ?? "")
  .replace(/\s+/g, " ")
  .trim();

const territorialNames = new Map([
  ["central mineira", { name: "Central Mineira", code: "CMI" }],
  ["metropolitana 1", { name: "Metropolitana 1", code: "MET1" }],
  ["metropolitana sub 1", { name: "Metropolitana 1", code: "MET1" }],
  ["metrolitana 2", { name: "Metropolitana 2", code: "MET2" }],
  ["metropolitana 2", { name: "Metropolitana 2", code: "MET2" }],
  ["metropolitana 3", { name: "Metropolitana 3", code: "MET3" }],
  ["oeste de minas", { name: "Oeste de Minas", code: "ODM" }],
  ["centro oeste", { name: "Centro-Oeste", code: "COM" }],
  ["centro-oeste", { name: "Centro-Oeste", code: "COM" }],
  ["sul de minas", { name: "Sul de Minas", code: "SUM" }],
]);

const excludedSupplierNames = new Set([
  "a definir", "nao informado", "não informado", "n/a", "sem fornecedor", "-",
]);

function canonicalRegional(value) {
  return territorialNames.get(normalize(value)) ?? null;
}

function parseCity(value) {
  const original = clean(value);
  if (!original) return null;
  const exclusiveB2b = /\(\s*exclusivo\s*b2b\s*\)/i.test(original);
  const name = clean(original.replace(/\(\s*exclusivo\s*b2b\s*\)/gi, ""));
  return name ? { name, exclusiveB2b } : null;
}

function parseMatrix() {
  const workbook = XLSX.readFile(source, { cellDates: true });
  const territorySheet = workbook.Sheets.REGIONAIS26;
  const supplierSheet = workbook.Sheets.Fornecedores;
  if (!territorySheet || !supplierSheet) throw new Error("A matriz deve conter as abas REGIONAIS26 e Fornecedores.");

  const territoryRows = XLSX.utils.sheet_to_json(territorySheet, { header: 1, defval: null });
  const matrixHeader = territoryRows[0] ?? [];
  const territories = new Map();

  matrixHeader.forEach((header, index) => {
    const regional = canonicalRegional(header);
    if (!regional) return;
    territories.set(regional.code, { ...regional, cities: new Map() });
    for (const row of territoryRows.slice(1)) {
      const city = parseCity(row[index]);
      if (city) territories.get(regional.code).cities.set(normalize(city.name), city);
    }
  });

  const supplierRows = XLSX.utils.sheet_to_json(supplierSheet, { defval: null });
  const supplierEntries = supplierRows
    .map(row => ({
      regional: canonicalRegional(row.REGIONAL),
      city: parseCity(row.CIDADE),
      service: clean(row["SERVIÇO"]),
      name: clean(row.FORNECEDOR),
      phone: clean(row.TELEFONE),
    }))
    .filter(item => item.regional && item.city && item.service && item.name && !excludedSupplierNames.has(normalize(item.name)));

  return { territories: [...territories.values()], supplierEntries };
}

async function findOrCreateProvider(client, summary) {
  const existing = await client.query(
    'SELECT id FROM providers WHERE lower(name) = lower($1) LIMIT 1',
    ["Sempre Internet"],
  );
  if (existing.rowCount) return existing.rows[0].id;
  summary.providersCreated += 1;
  if (dryRun) return -1;
  const inserted = await client.query(
    'INSERT INTO providers (name, "legalName", active) VALUES ($1, $2, true) RETURNING id',
    ["Sempre Internet", "Sempre Internet"],
  );
  return inserted.rows[0].id;
}

async function upsertRegional(client, providerId, regional, summary) {
  const found = await client.query(
    'SELECT id FROM regionals WHERE lower(name) = lower($1) LIMIT 1',
    [regional.name],
  );
  if (found.rowCount) {
    if (!dryRun) await client.query('UPDATE regionals SET "providerId" = $1, code = $2, active = true WHERE id = $3', [providerId, regional.code, found.rows[0].id]);
    return found.rows[0].id;
  }
  summary.regionalsCreated += 1;
  if (dryRun) return -(summary.regionalsCreated + 10);
  const inserted = await client.query(
    'INSERT INTO regionals ("providerId", name, code, active) VALUES ($1, $2, $3, true) RETURNING id',
    [providerId, regional.name, regional.code],
  );
  return inserted.rows[0].id;
}

async function findOrCreateCity(client, regionalId, city, summary) {
  const found = await client.query(
    'SELECT id, "locationNotes" FROM cities WHERE "regionalId" = $1 AND lower(name) = lower($2) AND state = $3 LIMIT 1',
    [regionalId, city.name, "MG"],
  );
  const notes = city.exclusiveB2b ? "Exclusivo B2B — importado da Matriz de Trade SMP 2026." : null;
  if (found.rowCount) {
    if (!dryRun && notes && !String(found.rows[0].locationNotes ?? "").includes("Exclusivo B2B")) {
      await client.query('UPDATE cities SET "locationNotes" = $1, active = true, "updatedAt" = NOW() WHERE id = $2', [notes, found.rows[0].id]);
    }
    return found.rows[0].id;
  }
  summary.citiesCreated += 1;
  if (dryRun) return -(summary.citiesCreated + 100);
  const inserted = await client.query(
    'INSERT INTO cities ("regionalId", name, state, "locationNotes", active) VALUES ($1, $2, $3, $4, true) RETURNING id',
    [regionalId, city.name, "MG", notes],
  );
  return inserted.rows[0].id;
}

async function findOrCreateService(client, name, summary) {
  const found = await client.query('SELECT id FROM service_types WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (found.rowCount) return found.rows[0].id;
  summary.servicesCreated += 1;
  if (dryRun) return -(summary.servicesCreated + 1000);
  const inserted = await client.query('INSERT INTO service_types (name, active) VALUES ($1, true) RETURNING id', [name]);
  return inserted.rows[0].id;
}

async function findOrCreateSupplier(client, providerId, entry, cityId, summary) {
  const found = await client.query('SELECT id, phone FROM suppliers WHERE lower("displayName") = lower($1) LIMIT 1', [entry.name]);
  if (found.rowCount) {
    if (!dryRun && entry.phone && !found.rows[0].phone) {
      await client.query('UPDATE suppliers SET phone = $1, "providerId" = $2, "cityId" = COALESCE("cityId", $3), active = true, "updatedAt" = NOW() WHERE id = $4', [entry.phone, providerId, cityId, found.rows[0].id]);
    }
    return found.rows[0].id;
  }
  summary.suppliersCreated += 1;
  if (dryRun) return -(summary.suppliersCreated + 10000);
  const inserted = await client.query(
    'INSERT INTO suppliers ("providerId", "cityId", "displayName", "contactName", phone, active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id',
    [providerId, cityId, entry.name, entry.name, entry.phone || null],
  );
  return inserted.rows[0].id;
}

async function execute() {
  const { territories, supplierEntries } = parseMatrix();
  const client = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: true } });
  const summary = { providersCreated: 0, regionalsCreated: 0, citiesCreated: 0, servicesCreated: 0, suppliersCreated: 0, supplierCityLinks: 0, supplierServiceLinks: 0, testCandidates: [] };

  await client.connect();
  try {
    const testCandidates = await client.query(`
      SELECT 'providers' AS entity, id, name AS label FROM providers WHERE lower(name) LIKE '%teste%'
      UNION ALL SELECT 'regionals', id, name FROM regionals WHERE lower(name) LIKE '%teste%'
      UNION ALL SELECT 'cities', id, name FROM cities WHERE lower(name) LIKE '%teste%'
      UNION ALL SELECT 'suppliers', id, "displayName" FROM suppliers WHERE lower("displayName") LIKE '%teste%'
      UNION ALL SELECT 'service_types', id, name FROM service_types WHERE lower(name) LIKE '%teste%'
    `);
    summary.testCandidates = testCandidates.rows;

    if (!dryRun) await client.query("BEGIN");
    const providerId = await findOrCreateProvider(client, summary);
    const cityIds = new Map();
    for (const regional of territories) {
      const regionalId = await upsertRegional(client, providerId, regional, summary);
      for (const city of regional.cities.values()) {
        const cityId = await findOrCreateCity(client, regionalId, city, summary);
        cityIds.set(`${regional.code}:${normalize(city.name)}`, cityId);
      }
    }

    const supplierCache = new Map();
    const serviceCache = new Map();
    for (const entry of supplierEntries) {
      const cityId = cityIds.get(`${entry.regional.code}:${normalize(entry.city.name)}`);
      if (!cityId) continue;
      const serviceKey = normalize(entry.service);
      const supplierKey = normalize(entry.name);
      const serviceId = serviceCache.get(serviceKey) ?? await findOrCreateService(client, entry.service, summary);
      serviceCache.set(serviceKey, serviceId);
      const supplierId = supplierCache.get(supplierKey) ?? await findOrCreateSupplier(client, providerId, entry, cityId, summary);
      supplierCache.set(supplierKey, supplierId);
      if (!dryRun) {
        const cityLink = await client.query('INSERT INTO supplier_cities ("supplierId", "cityId") VALUES ($1, $2) ON CONFLICT ("supplierId", "cityId") DO NOTHING', [supplierId, cityId]);
        const serviceLink = await client.query('INSERT INTO supplier_service_types ("supplierId", "serviceTypeId") VALUES ($1, $2) ON CONFLICT ("supplierId", "serviceTypeId") DO NOTHING', [supplierId, serviceId]);
        summary.supplierCityLinks += cityLink.rowCount;
        summary.supplierServiceLinks += serviceLink.rowCount;
      }
    }
    if (!dryRun) await client.query("COMMIT");
    console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "import", source, territories: territories.map(item => ({ regional: item.name, cities: item.cities.size })), supplierRows: supplierEntries.length, ...summary }, null, 2));
  } catch (error) {
    if (!dryRun) await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

execute().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
