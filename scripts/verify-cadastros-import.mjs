import pg from "pg";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: true },
});

const scalar = async sql => Number((await client.query(sql)).rows[0]?.count ?? 0);

async function run() {
  await client.connect();
  try {
    const onnetRegionals = await client.query(`
        SELECT r.id, r.name, r.code, COUNT(c.id)::int AS "cityCount"
        FROM regionals r
        JOIN providers p ON p.id = r."providerId"
        LEFT JOIN cities c ON c."regionalId" = r.id AND c.active = true
        WHERE lower(p.name) = lower('OnNet Telecom') AND r.code LIKE 'ONN-%'
        GROUP BY r.id, r.name, r.code
        ORDER BY r.code
      `);
    const alwaysSupplierSummary = await client.query(`
        SELECT
          COUNT(DISTINCT s.id)::int AS suppliers,
          COUNT(DISTINCT sc."cityId")::int AS coveredCities,
          COUNT(DISTINCT sst."serviceTypeId")::int AS linkedServices
        FROM suppliers s
        JOIN providers p ON p.id = s."providerId"
        LEFT JOIN supplier_cities sc ON sc."supplierId" = s.id
        LEFT JOIN supplier_service_types sst ON sst."supplierId" = s.id
        WHERE lower(p.name) = lower('Sempre Internet')
      `);
    const supplierSamples = await client.query(`
        SELECT
          s."displayName" AS supplier,
          array_remove(array_agg(DISTINCT c.name), NULL) AS cities,
          array_remove(array_agg(DISTINCT st.name), NULL) AS services
        FROM suppliers s
        JOIN providers p ON p.id = s."providerId"
        LEFT JOIN supplier_cities sc ON sc."supplierId" = s.id
        LEFT JOIN cities c ON c.id = sc."cityId"
        LEFT JOIN supplier_service_types sst ON sst."supplierId" = s.id
        LEFT JOIN service_types st ON st.id = sst."serviceTypeId"
        WHERE lower(p.name) = lower('Sempre Internet')
        GROUP BY s.id, s."displayName"
        HAVING COUNT(DISTINCT sc."cityId") > 0 OR COUNT(DISTINCT sst."serviceTypeId") > 0
        ORDER BY s."displayName"
        LIMIT 8
      `);
    const integrity = [
      await scalar('SELECT COUNT(*) FROM regionals WHERE "providerId" IS NULL'),
      await scalar('SELECT COUNT(*) FROM cities WHERE "regionalId" IS NULL'),
      await scalar('SELECT COUNT(*) FROM stores WHERE "cityId" IS NULL'),
      await scalar('SELECT COUNT(*) FROM suppliers WHERE "providerId" IS NULL'),
      await scalar('SELECT COUNT(*) FROM supplier_cities sc LEFT JOIN suppliers s ON s.id = sc."supplierId" LEFT JOIN cities c ON c.id = sc."cityId" WHERE s.id IS NULL OR c.id IS NULL'),
      await scalar('SELECT COUNT(*) FROM supplier_service_types sst LEFT JOIN suppliers s ON s.id = sst."supplierId" LEFT JOIN service_types st ON st.id = sst."serviceTypeId" WHERE s.id IS NULL OR st.id IS NULL'),
      await scalar('SELECT COUNT(*) FROM media_types mt LEFT JOIN media_types parent ON parent.id = mt."parentMediaTypeId" WHERE mt."parentMediaTypeId" IS NOT NULL AND parent.id IS NULL'),
    ];

    console.log(JSON.stringify({
      onnet: { regionalCount: onnetRegionals.rowCount, regionals: onnetRegionals.rows },
      sempreInternet: { ...alwaysSupplierSummary.rows[0], supplierExamples: supplierSamples.rows },
      integrity: {
        regionalsWithoutProvider: integrity[0],
        citiesWithoutRegional: integrity[1],
        storesWithoutCity: integrity[2],
        suppliersWithoutProvider: integrity[3],
        brokenSupplierCityLinks: integrity[4],
        brokenSupplierServiceLinks: integrity[5],
        brokenMediaTypeParents: integrity[6],
      },
    }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
