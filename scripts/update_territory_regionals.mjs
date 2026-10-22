/**
 * Sincronização Canônica de Regionais e Vínculos Territoriais
 * Consolidação territorial aprovada: 6 Regionais Operacionais e 135 cidades.
 * 1. Metropolitana (Fusão SUB 1 + SUB 2)
 * 2. Central Mineira (Central Mineira + SUB 3)
 * 3. Oeste de Minas (Oeste de Minas + Polo Formiga/Arcos/Oliveira)
 * 4. Sul de Minas (Sul de Minas + Polo Campo Belo/Cristais)
 * 5. OnNet Patrocínio
 * 6. OnNet Uberlândia
 */

import pg from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

export const REGIONAL_NAME_UPDATES = [
  { id: 7, name: "Metropolitana", code: "SMPMET", providerId: 2, active: true },
  { id: 3, name: "Central Mineira", code: "SMPCM", providerId: 2, active: true },
  { id: 9, name: "Oeste de Minas", code: "SMPODM", providerId: 2, active: true },
  { id: 8, name: "Sul de Minas", code: "SMPSDM", providerId: 2, active: true },
  { id: 1, name: "OnNet Patrocínio", code: "ONPTC", providerId: 1, active: true },
  { id: 2, name: "OnNet Uberlândia", code: "ONUDI", providerId: 1, active: true },
  // Regionais antigas fundidas (inativadas)
  { id: 4, name: "Centro Oeste (Fundida)", code: "SMPCO", providerId: 2, active: false },
  { id: 5, name: "Metropolitana SUB 3 (Fundida)", code: "CMPM3", providerId: 2, active: false },
  { id: 6, name: "Metropolitana SUB 2 (Fundida)", code: "SMPM2", providerId: 2, active: false },
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
  // Central Mineira (3) - 39 cidades
  [13,3],[21,3],[9,3],[58,3],[20,3],[4,3],[55,3],[51,3],[22,3],[19,3],[60,3],[24,3],[7,3],[54,3],[59,3],[11,3],[52,3],[56,3],[61,3],[48,3],[17,3],[8,3],[12,3],[50,3],[10,3],[23,3],[16,3],[6,3],[57,3],[5,3],[14,3],[137,3],[53,3],[18,3],[62,3],[15,3],[135,3],[136,3],[49,3],
  // Metropolitana (7) - 24 cidades
  [25,7],[44,7],[3,7],[46,7],[40,7],[26,7],[36,7],[33,7],[27,7],[42,7],[28,7],[38,7],[29,7],[34,7],[30,7],[41,7],[32,7],[45,7],[37,7],[47,7],[35,7],[43,7],[31,7],[39,7],
  // Oeste de Minas (9) - 24 cidades
  [81,9],[69,9],[78,9],[86,9],[74,9],[71,9],[70,9],[91,9],[63,9],[77,9],[83,9],[72,9],[73,9],[66,9],[76,9],[64,9],[65,9],[84,9],[85,9],[79,9],[80,9],[67,9],[68,9],[75,9],
  // Sul de Minas (8) - 28 cidades
  [93,8],[105,8],[82,8],[92,8],[89,8],[100,8],[111,8],[87,8],[103,8],[98,8],[113,8],[107,8],[109,8],[94,8],[112,8],[108,8],[104,8],[106,8],[99,8],[97,8],[88,8],[101,8],[102,8],[90,8],[96,8],[114,8],[110,8],[95,8],
  // OnNet Patrocínio (1) - 15 cidades
  [128,1],[122,1],[127,1],[126,1],[129,1],[124,1],[123,1],[115,1],[117,1],[121,1],[125,1],[116,1],[118,1],[120,1],[119,1],
  // OnNet Uberlândia (2) - 5 cidades
  [134,2],[131,2],[132,2],[133,2],[130,2]
];

export async function syncTerritory(pool) {
  console.log("[TerritorySync] Iniciando sincronização canônica de território...");

  // 1. Atualização dos nomes e status das Regionais
  for (const reg of REGIONAL_NAME_UPDATES) {
    const res = await pool.query(
      `UPDATE "regionals"
       SET "name" = $1,
           "code" = COALESCE($2, "code"),
           "providerId" = COALESCE($3, "providerId"),
           "active" = COALESCE($4, "active")
       WHERE "id" = $5 AND ("name" != $1 OR "active" != $4)`,
      [reg.name, reg.code, reg.providerId, reg.active, reg.id]
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`[TerritorySync] Regional #${reg.id} atualizada para "${reg.name}" (Ativa: ${reg.active})`);
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

  // 3. Garantia de todos os 135 vínculos cidade -> regional
  let bindingUpdates = 0;
  for (const [cityId, regionalId] of CITY_REGIONAL_BINDINGS) {
    const res = await pool.query(
      `UPDATE "cities"
       SET "regionalId" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2 AND "regionalId" != $1`,
      [regionalId, cityId]
    );
    if (res.rowCount && res.rowCount > 0) {
      bindingUpdates++;
    }
  }

  console.log(`[TerritorySync] Sincronização concluída com sucesso! (${bindingUpdates} vínculos atualizados).`);
}

// Execução direta via CLI se chamado via node
if (process.argv[1] && process.argv[1].endsWith("update_territory_regionals.mjs")) {
  if (!connectionString) {
    console.error("[TerritorySync] DATABASE_URL não encontrada no ambiente.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString });
  syncTerritory(pool)
    .then(() => pool.end())
    .catch((err) => {
      console.error("[TerritorySync] Erro fatal:", err);
      pool.end();
      process.exit(1);
    });
}
