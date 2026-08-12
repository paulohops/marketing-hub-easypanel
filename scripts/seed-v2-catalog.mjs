import pg from "pg";

const { Client } = pg;
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL is required to seed the V2 catalog.");
}

const catalog = {
  action_types: [
    "Promoção do Mês — Loja",
    "Promoção do Mês — Rua",
    "Promoção do Mês — Parceiro",
    "Blitz",
    "Ação em Praça",
    "Ação Externa",
    "Ação em Bairro",
    "Ação em Supermercado",
    "Dominando Território",
    "Loja Móvel",
    "Lançamentos",
    "Inaugurações",
  ],
  media_types: [
    "Carro de Som",
    "Moto Som",
    "Panfletagem",
    "Outdoor",
    "Painéis",
    "Backbus",
    "Pintura de Muro",
    "Rádio",
    "Mídias Visuais e Gráficas",
  ],
  service_types: [
    "Locução",
    "Pipoca e Algodão Doce",
    "Padaria / Coffee Break",
    "Arco de Balões / Decoração",
    "Gráficas / Silk",
    "Fornecedores de Áudio (Carro/Moto Som)",
  ],
};

const permissions = [
  ["admin", "read", true], ["admin", "create", true], ["admin", "update", true], ["admin", "delete", true],
  ["regional_manager", "read", true], ["regional_manager", "create", true], ["regional_manager", "update", true], ["regional_manager", "delete", false],
  ["operator", "read", true], ["operator", "create", true], ["operator", "update", true], ["operator", "delete", false],
  ["viewer", "read", true], ["viewer", "create", false], ["viewer", "update", false], ["viewer", "delete", false],
  ["user", "read", true], ["user", "create", false], ["user", "update", false], ["user", "delete", false],
];

const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
await client.connect();

try {
  await client.query("BEGIN");
  for (const [table, names] of Object.entries(catalog)) {
    for (const name of names) {
      await client.query(`INSERT INTO ${table} ("name", "active") VALUES ($1, true) ON CONFLICT ("name") DO UPDATE SET "active" = true`, [name]);
    }
  }
  for (const [role, action, allowed] of permissions) {
    await client.query(
      `INSERT INTO role_permissions ("role", "module", "action", "allowed") VALUES ($1, 'operations', $2, $3) ON CONFLICT ("role", "module", "action") DO NOTHING`,
      [role, action, allowed],
    );
  }
  await client.query("COMMIT");
  console.log("Catálogo V2 e permissões de operações preparados com sucesso.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
