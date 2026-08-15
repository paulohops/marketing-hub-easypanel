import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: true },
});

try {
  const [providers, regionals, cities, suppliers, mediaTypes, serviceTypes] = await Promise.all([
    pool.query('SELECT id, name, active FROM providers ORDER BY name'),
    pool.query('SELECT r.id, r.name, r."code", r.active, p.name AS "providerName" FROM regionals r LEFT JOIN providers p ON p.id = r."providerId" ORDER BY p.name NULLS LAST, r.name'),
    pool.query('SELECT c.id, c.name, c.state, c.active, r.name AS "regionalName", p.name AS "providerName" FROM cities c JOIN regionals r ON r.id = c."regionalId" LEFT JOIN providers p ON p.id = r."providerId" ORDER BY p.name NULLS LAST, r.name, c.name'),
    pool.query('SELECT s.id, s."displayName", s.phone, s."mainService", s.active, c.name AS "cityName", p.name AS "providerName" FROM suppliers s LEFT JOIN cities c ON c.id = s."cityId" LEFT JOIN providers p ON p.id = s."providerId" ORDER BY s."displayName"'),
    pool.query('SELECT id, name, "operationCategory", "parentMediaTypeId", active FROM media_types ORDER BY "operationCategory", name'),
    pool.query('SELECT id, name, active FROM service_types ORDER BY name'),
  ]);

  console.log(JSON.stringify({
    providers: providers.rows,
    regionals: regionals.rows,
    cities: cities.rows,
    suppliers: suppliers.rows,
    mediaTypes: mediaTypes.rows,
    serviceTypes: serviceTypes.rows,
  }, null, 2));
} finally {
  await pool.end();
}
