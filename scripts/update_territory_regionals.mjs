/**
 * Sincronização Canônica de Regionais e Vínculos Territoriais
 * Atualiza os nomes canônicos das 9 Regionais, aplica a marcação (Exclusivo B2B)
 * nas 14 cidades designadas e assegura todos os vínculos cidade -> regional.
 */

import pg from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

export const REGIONAL_NAME_UPDATES = [
  { id: 7, name: "Metropolitana SUB 1", code: "SMPM1", providerId: 2 },
  { id: 6, name: "Metropolitana SUB 2", code: "SMPM2", providerId: 2 },
  { id: 5, name: "Metropolitana SUB 3", code: "CMPM3", providerId: 2 },
  { id: 9, name: "Oeste de Minas", code: "SMPODM", providerId: 2 },
  { id: 8, name: "Sul de Minas", code: "SMPSDM", providerId: 2 },
];

export const B2B_CITIES = [
  { id: 7, name: "Dores do Indaiá (Exclusivo B2B)" },
  { id: 8, name: "Luz (Exclusivo B2B)" },
  { id: 10, name: "Moema (Exclusivo B2B)" },
  { id: 20, name: "Biquinhas (Exclusivo B2B)" },
  { id: 25, name: "Belo Horizonte (Exclusivo B2B)" },
  { id: 34, name: "Itatiaiuçu (Exclusivo B2B)" },
  { id: 48, name: "Lagoa Santa (Exclusivo B2B)" },
  { id: 57, name: "Paraopeba (Exclusivo B2B)" },
  { id: 65, name: "Nova Serrana (Exclusivo B2B)" },
  { id: 69, name: "Bambuí (Exclusivo B2B)" },
  { id: 74, name: "Carmo do Cajuru (Exclusivo B2B)" },
  { id: 77, name: "Doresópolis (Exclusivo B2B)" },
  { id: 96, name: "São João Del Rei (Exclusivo B2B)" },
  { id: 106, name: "Passa Tempo (Exclusivo B2B)" },
];

export const CITY_REGIONAL_BINDINGS = [
  // Central Mineira (3) - 20 cidades
  [4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],[17,3],[18,3],[19,3],[20,3],[21,3],[22,3],[23,3],
  // Metropolitana SUB 1 (7) - 13 cidades
  [25,7],[26,7],[27,7],[3,7],[28,7],[29,7],[30,7],[31,7],[32,7],[33,7],[34,7],[35,7],[36,7],
  // Metropolitana SUB 2 (6) - 11 cidades
  [37,6],[38,6],[39,6],[40,6],[41,6],[42,6],[43,6],[44,6],[45,6],[46,6],[47,6],
  // Metropolitana SUB 3 (5) - 15 cidades
  [48,5],[49,5],[50,5],[51,5],[52,5],[53,5],[54,5],[55,5],[56,5],[57,5],[58,5],[59,5],[60,5],[61,5],[62,5],
  // Oeste de Minas (9) - 17 cidades
  [63,9],[64,9],[65,9],[66,9],[67,9],[68,9],[69,9],[70,9],[71,9],[72,9],[73,9],[74,9],[75,9],[76,9],[77,9],[78,9],[79,9],
  // Centro Oeste (4) - 13 cidades
  [81,4],[82,4],[83,4],[84,4],[85,4],[86,4],[87,4],[88,4],[89,4],[90,4],[91,4],[92,4],[93,4],
  // Sul de Minas (8) - 21 cidades
  [94,8],[95,8],[96,8],[97,8],[98,8],[99,8],[100,8],[101,8],[102,8],[103,8],[104,8],[105,8],[106,8],[107,8],[108,8],[109,8],[110,8],[111,8],[112,8],[113,8],[114,8],
  // OnNet Patrocínio (1) - 15 cidades
  [126,1],[129,1],[124,1],[115,1],[128,1],[122,1],[127,1],[117,1],[121,1],[123,1],[125,1],[116,1],[120,1],[118,1],[119,1],
  // OnNet Uberlândia (2) - 5 cidades
  [130,2],[134,2],[132,2],[133,2],[131,2]
];

export async function syncTerritory(pool) {
  console.log("[TerritorySync] Iniciando sincronização canônica de território...");

  // 1. Atualização dos nomes canônicos das Regionais
  for (const reg of REGIONAL_NAME_UPDATES) {
    const res = await pool.query(
      `UPDATE "regionals"
       SET "name" = $1,
           "providerId" = COALESCE($2, "providerId")
       WHERE "id" = $3 AND ("name" != $1 OR ("providerId" IS NULL AND $2 IS NOT NULL))`,
      [reg.name, reg.providerId, reg.id]
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`[TerritorySync] Regional #${reg.id} atualizada para "${reg.name}" (Provedor #${reg.providerId})`);
    }
  }

  // 2. Atualização das 14 cidades designadas Exclusivo B2B
  for (const b2b of B2B_CITIES) {
    const res = await pool.query(
      `UPDATE "cities"
       SET "name" = $1,
           "locationNotes" = CASE 
             WHEN "locationNotes" IS NULL OR "locationNotes" = '' THEN 'Exclusivo B2B'
             WHEN "locationNotes" NOT LIKE '%Exclusivo B2B%' THEN "locationNotes" || ' | Exclusivo B2B'
             ELSE "locationNotes"
           END,
           "updatedAt" = NOW()
       WHERE "id" = $2 AND ("name" != $1 OR "locationNotes" IS NULL OR "locationNotes" NOT LIKE '%Exclusivo B2B%')`,
      [b2b.name, b2b.id]
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`[TerritorySync] Cidade B2B #${b2b.id} atualizada para "${b2b.name}"`);
    }
  }

  // 3. Garantia de todos os 130 vínculos cidade -> regional
  let bindingUpdates = 0;
  for (const [cityId, regionalId] of CITY_REGIONAL_BINDINGS) {
    const res = await pool.query(
      `UPDATE "cities"
       SET "regionalId" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2 AND "regionalId" != $1`,
      [regionalId, cityId]
    );
    if (res.rowCount && res.rowCount > 0) bindingUpdates++;
  }

  if (bindingUpdates > 0) {
    console.log(`[TerritorySync] ${bindingUpdates} vínculos de cidades corrigidos.`);
  } else {
    console.log("[TerritorySync] Todos os 130 vínculos de cidades já estavam em conformidade.");
  }

  console.log("[TerritorySync] Sincronização territorial concluída com sucesso.");
}

// Execução direta via CLI se DATABASE_URL estiver presente
if (process.argv[1]?.endsWith("update_territory_regionals.mjs") && connectionString) {
  const { Pool } = pg;
  const pool = new Pool({ connectionString });
  try {
    await syncTerritory(pool);
  } finally {
    await pool.end();
  }
}
