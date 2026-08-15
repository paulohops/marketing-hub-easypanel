import pg from "pg";

const { Client } = pg;
const dryRun = process.argv.includes("--dry-run");

const territories = [
  { code: "ONN-AP", name: "Alto Paranaíba — OnNet", cities: ["Patrocínio", "Patos de Minas", "Abadia dos Dourados", "Presidente Olegário", "Lagoa Formosa", "Guimarânia", "Cruzeiro da Fortaleza", "Iraí de Minas"] },
  { code: "ONN-NO", name: "Noroeste — OnNet", cities: ["João Pinheiro", "Varjão de Minas", "São Gonçalo", "Três Marias"] },
  { code: "ONN-NM", name: "Norte de Minas — OnNet", cities: ["Pirapora", "Buritizeiro", "Várzea da Palma"] },
  { code: "ONN-TM", name: "Triângulo Mineiro — OnNet", cities: ["Uberlândia", "Prata", "Tupaciguara", "Monte Alegre de Minas"] },
];

async function findOrCreateProvider(client) {
  const found = await client.query('SELECT id FROM providers WHERE lower(name) = lower($1) LIMIT 1', ["OnNet Telecom"]);
  if (found.rowCount) return { id: found.rows[0].id, created: false };
  if (dryRun) return { id: -1, created: true };
  const created = await client.query('INSERT INTO providers (name, "legalName", active) VALUES ($1, $2, true) RETURNING id', ["OnNet Telecom", "OnNet Telecom"]);
  return { id: created.rows[0].id, created: true };
}

async function upsertRegional(client, providerId, regional, summary) {
  const found = await client.query('SELECT id FROM regionals WHERE code = $1 LIMIT 1', [regional.code]);
  if (found.rowCount) {
    if (!dryRun) await client.query('UPDATE regionals SET "providerId" = $1, name = $2, active = true, "updatedAt" = NOW() WHERE id = $3', [providerId, regional.name, found.rows[0].id]);
    return found.rows[0].id;
  }
  summary.regionalsCreated += 1;
  if (dryRun) return -(summary.regionalsCreated + 10);
  const created = await client.query('INSERT INTO regionals ("providerId", name, code, active) VALUES ($1, $2, $3, true) RETURNING id', [providerId, regional.name, regional.code]);
  return created.rows[0].id;
}

async function upsertCity(client, regionalId, city, summary) {
  const found = await client.query('SELECT id FROM cities WHERE "regionalId" = $1 AND lower(name) = lower($2) AND state = $3 LIMIT 1', [regionalId, city, "MG"]);
  const note = "Referência pública OnNet Telecom — cidade de cobertura/loja, revisável em Cadastros.";
  if (found.rowCount) {
    if (!dryRun) await client.query('UPDATE cities SET active = true, "locationNotes" = COALESCE("locationNotes", $1), "updatedAt" = NOW() WHERE id = $2', [note, found.rows[0].id]);
    return found.rows[0].id;
  }
  summary.citiesCreated += 1;
  if (dryRun) return -(summary.citiesCreated + 100);
  const created = await client.query('INSERT INTO cities ("regionalId", name, state, "locationNotes", active) VALUES ($1, $2, $3, $4, true) RETURNING id', [regionalId, city, "MG", note]);
  return created.rows[0].id;
}

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: true } });
  const summary = { mode: dryRun ? "dry-run" : "import", providerCreated: false, regionalsCreated: 0, citiesCreated: 0, regionals: [] };
  await client.connect();
  try {
    if (!dryRun) await client.query("BEGIN");
    const provider = await findOrCreateProvider(client);
    summary.providerCreated = provider.created;
    for (const regional of territories) {
      const regionalId = await upsertRegional(client, provider.id, regional, summary);
      for (const city of regional.cities) await upsertCity(client, regionalId, city, summary);
      summary.regionals.push({ code: regional.code, name: regional.name, cities: regional.cities.length });
    }
    if (!dryRun) await client.query("COMMIT");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (!dryRun) await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
