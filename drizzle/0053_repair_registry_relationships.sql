-- Corrige vínculos cadastrais opcionais e tabelas de associação.
-- Registros operacionais/históricos continuam com RESTRICT; apenas relações N:N
-- e referências cadastrais opcionais são desvinculadas automaticamente.

DO $$
DECLARE
  item record;
  constraint_name text;
BEGIN
  FOR item IN
    SELECT *
    FROM (VALUES
      ('partners', 'cities', 'cityId'),
      ('product_media_types', 'media_types', 'mediaTypeId'),
      ('suppliers', 'cities', 'cityId'),
      ('supplier_cities', 'cities', 'cityId'),
      ('supplier_media_types', 'media_types', 'mediaTypeId'),
      ('supplier_service_types', 'service_types', 'serviceTypeId'),
      ('campaign_regionals', 'regionals', 'regionalId'),
      ('campaign_cities', 'cities', 'cityId'),
      ('campaign_promotion_cities', 'cities', 'cityId'),
      ('stock_items', 'cities', 'cityId'),
      ('media_campaign_city_distributions', 'cities', 'cityId')
    ) AS relations(table_name, referenced_table, column_name)
  LOOP
    FOR constraint_name IN
      SELECT con.conname
      FROM pg_constraint con
      WHERE con.conrelid = to_regclass(item.table_name)
        AND con.confrelid = to_regclass(item.referenced_table)
        AND con.contype = 'f'
        AND pg_get_constraintdef(con.oid) LIKE format('%%("%s")%%', item.column_name)
    LOOP
      EXECUTE format(
        'ALTER TABLE %I DROP CONSTRAINT %I',
        item.table_name,
        constraint_name
      );
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE partners
  ADD CONSTRAINT partners_city_id_cities_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE SET NULL;

ALTER TABLE product_media_types
  ADD CONSTRAINT product_media_types_media_type_id_fk
  FOREIGN KEY ("mediaTypeId") REFERENCES media_types(id) ON DELETE CASCADE;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_city_id_cities_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE SET NULL;

ALTER TABLE supplier_cities
  ADD CONSTRAINT supplier_cities_city_id_cities_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE CASCADE;

ALTER TABLE supplier_media_types
  ADD CONSTRAINT supplier_media_types_media_type_id_fk
  FOREIGN KEY ("mediaTypeId") REFERENCES media_types(id) ON DELETE CASCADE;

ALTER TABLE supplier_service_types
  ADD CONSTRAINT supplier_service_types_service_type_id_fk
  FOREIGN KEY ("serviceTypeId") REFERENCES service_types(id) ON DELETE CASCADE;

ALTER TABLE campaign_regionals
  ADD CONSTRAINT campaign_regionals_regional_id_fk
  FOREIGN KEY ("regionalId") REFERENCES regionals(id) ON DELETE CASCADE;

ALTER TABLE campaign_cities
  ADD CONSTRAINT campaign_cities_city_id_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE CASCADE;

ALTER TABLE campaign_promotion_cities
  ADD CONSTRAINT campaign_promotion_cities_city_id_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE CASCADE;

ALTER TABLE stock_items
  ADD CONSTRAINT stock_items_city_id_cities_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE SET NULL;

ALTER TABLE media_campaign_city_distributions
  ADD CONSTRAINT media_campaign_city_distributions_city_id_fk
  FOREIGN KEY ("cityId") REFERENCES cities(id) ON DELETE CASCADE;
