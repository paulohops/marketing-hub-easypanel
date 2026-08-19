-- Catálogo integrado de mídias, serviços, subserviços, produtos e materiais.
-- A migração é idempotente: pode ser reaplicada sem duplicar cadastros.

DO $$
BEGIN
  ALTER TYPE "supplier_offering_kind" ADD VALUE IF NOT EXISTS 'subservice';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "subservice_types" (
  "id" serial PRIMARY KEY,
  "name" varchar(180) NOT NULL UNIQUE,
  "description" text,
  "unit" varchar(48) NOT NULL DEFAULT 'unidade',
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "service_subservices" (
  "id" serial PRIMARY KEY,
  "serviceTypeId" integer NOT NULL REFERENCES "service_types"("id") ON DELETE CASCADE,
  "subserviceTypeId" integer NOT NULL REFERENCES "subservice_types"("id") ON DELETE CASCADE,
  "active" boolean NOT NULL DEFAULT true,
  CONSTRAINT "service_subservices_uq" UNIQUE ("serviceTypeId", "subserviceTypeId")
);

CREATE TABLE IF NOT EXISTS "media_service_catalog" (
  "id" serial PRIMARY KEY,
  "mediaTypeId" integer NOT NULL REFERENCES "media_types"("id") ON DELETE CASCADE,
  "serviceTypeId" integer NOT NULL REFERENCES "service_types"("id") ON DELETE CASCADE,
  "subserviceTypeId" integer NOT NULL REFERENCES "subservice_types"("id") ON DELETE CASCADE,
  "productRequired" boolean NOT NULL DEFAULT false,
  "defaultUnit" varchar(48) NOT NULL DEFAULT 'unidade',
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "media_service_catalog_uq" UNIQUE ("mediaTypeId", "serviceTypeId", "subserviceTypeId")
);

CREATE TABLE IF NOT EXISTS "supplier_offering_price_history" (
  "id" serial PRIMARY KEY,
  "supplierOfferingId" integer NOT NULL REFERENCES "supplier_offerings"("id") ON DELETE CASCADE,
  "effectiveFrom" date NOT NULL,
  "effectiveTo" date,
  "unitPrice" numeric(14,2) NOT NULL,
  "source" varchar(80),
  "notes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "supplier_offering_price_history_uq" UNIQUE ("supplierOfferingId", "effectiveFrom")
);

CREATE TABLE IF NOT EXISTS "media_point_materials" (
  "id" serial PRIMARY KEY,
  "mediaPointId" integer NOT NULL REFERENCES "media_points"("id") ON DELETE CASCADE,
  "productTypeId" integer NOT NULL REFERENCES "product_types"("id") ON DELETE RESTRICT,
  "stockItemId" integer REFERENCES "stock_items"("id") ON DELETE SET NULL,
  "mediaCampaignId" integer REFERENCES "media_campaigns"("id") ON DELETE SET NULL,
  "invoiceItemId" integer REFERENCES "invoice_items"("id") ON DELETE SET NULL,
  "startsOn" date NOT NULL,
  "endsOn" date,
  "status" varchar(32) NOT NULL DEFAULT 'active',
  "specification" text,
  "evidenceUrl" text,
  "notes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "media_point_materials_active_uq" UNIQUE ("mediaPointId", "productTypeId", "startsOn")
);

ALTER TABLE "supplier_offerings"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_offerings"
  ADD COLUMN IF NOT EXISTS "mediaServiceCatalogId" integer REFERENCES "media_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "stock_items"
  ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;
ALTER TABLE "action_services"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "media_campaigns"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "media_campaigns"
  ADD COLUMN IF NOT EXISTS "mediaServiceCatalogId" integer REFERENCES "media_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "media_campaigns"
  ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_contract_items"
  ADD COLUMN IF NOT EXISTS "mediaServiceCatalogId" integer REFERENCES "media_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_contract_items"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_contract_items"
  ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;
ALTER TABLE "purchase_order_items"
  ADD COLUMN IF NOT EXISTS "mediaServiceCatalogId" integer REFERENCES "media_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "purchase_order_items"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "purchase_order_items"
  ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;
ALTER TABLE "invoice_items"
  ADD COLUMN IF NOT EXISTS "mediaServiceCatalogId" integer REFERENCES "media_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "invoice_items"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "invoice_items"
  ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;
ALTER TABLE "financial_cost_allocations"
  ADD COLUMN IF NOT EXISTS "mediaServiceCatalogId" integer REFERENCES "media_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "financial_cost_allocations"
  ADD COLUMN IF NOT EXISTS "subserviceTypeId" integer REFERENCES "subservice_types"("id") ON DELETE SET NULL;
ALTER TABLE "financial_cost_allocations"
  ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "media_service_catalog_media_idx"
  ON "media_service_catalog" ("mediaTypeId", "active");
CREATE INDEX IF NOT EXISTS "media_service_catalog_service_idx"
  ON "media_service_catalog" ("serviceTypeId", "subserviceTypeId", "active");
CREATE INDEX IF NOT EXISTS "supplier_offerings_catalog_idx"
  ON "supplier_offerings" ("mediaServiceCatalogId", "subserviceTypeId", "active");
CREATE INDEX IF NOT EXISTS "stock_items_product_type_idx"
  ON "stock_items" ("productTypeId", "active");
CREATE INDEX IF NOT EXISTS "media_point_materials_point_status_idx"
  ON "media_point_materials" ("mediaPointId", "status", "endsOn");
CREATE INDEX IF NOT EXISTS "media_campaigns_catalog_idx"
  ON "media_campaigns" ("mediaServiceCatalogId", "subserviceTypeId", "productTypeId");
CREATE INDEX IF NOT EXISTS "financial_cost_allocations_catalog_idx"
  ON "financial_cost_allocations" ("mediaServiceCatalogId", "subserviceTypeId", "productTypeId");

-- Tipos de mídia. Os nomes são deliberadamente estáveis para serem usados por importações e relatórios.
INSERT INTO "media_types" ("name", "operationCategory", "active") VALUES
  ('Outdoor', 'graphics', true),
  ('Frontlight', 'graphics', true),
  ('Painel de LED', 'graphics', true),
  ('Backbus', 'graphics', true),
  ('Busdoor', 'graphics', true),
  ('Mupi', 'graphics', true),
  ('Totem', 'graphics', true),
  ('Empena', 'graphics', true),
  ('Abrigo de ônibus', 'graphics', true),
  ('Rádio', 'audio_video', true),
  ('TV', 'audio_video', true),
  ('Jornal', 'audio_video', true),
  ('Revista', 'audio_video', true),
  ('Portal', 'audio_video', true),
  ('Podcast', 'audio_video', true),
  ('Carro de Som', 'sound_car', true),
  ('Moto Som', 'sound_car', true),
  ('Panfletagem', 'leafleting', true)
ON CONFLICT ("name") DO UPDATE SET
  "operationCategory" = EXCLUDED."operationCategory",
  "active" = true;

-- Serviços principais. Eles são globais; a matriz abaixo determina onde cada um é permitido.
INSERT INTO "service_types" ("name", "active") VALUES
  ('Locação de mídia', true),
  ('Veiculação', true),
  ('Produção Gráfica', true),
  ('Instalação', true),
  ('Produção de Áudio', true),
  ('Produção Audiovisual', true),
  ('Logística', true),
  ('Distribuição', true),
  ('Entrevista', true)
ON CONFLICT ("name") DO UPDATE SET "active" = true;

-- Subserviços reutilizáveis entre diferentes tipos de mídia.
INSERT INTO "subservice_types" ("name", "description", "unit", "active") VALUES
  ('Aluguel mensal', 'Locação mensal do espaço ou canal de mídia.', 'mês', true),
  ('Aluguel quinzenal', 'Locação por período de quinze dias.', 'quinzena', true),
  ('Aluguel semanal', 'Locação por período de sete dias.', 'semana', true),
  ('Aluguel diário', 'Locação por diária.', 'diária', true),
  ('Impressão em lona', 'Impressão de material para mídia externa.', 'm²', true),
  ('Impressão em papel', 'Impressão de papel, cartaz ou panfleto.', 'unidade', true),
  ('Impressão em adesivo', 'Impressão de adesivo ou vinil autocolante.', 'm²', true),
  ('Instalação de material', 'Aplicação ou instalação do material no ponto.', 'unidade', true),
  ('Montagem e desmontagem', 'Montagem, retirada ou substituição de estrutura/material.', 'unidade', true),
  ('Inserção de spot 15s', 'Veiculação de spot de quinze segundos.', 'inserção', true),
  ('Inserção de spot 30s', 'Veiculação de spot de trinta segundos.', 'inserção', true),
  ('Inserção de spot 60s', 'Veiculação de spot de sessenta segundos.', 'inserção', true),
  ('Veiculação de vídeo', 'Exibição de vídeo em canal tradicional ou digital.', 'inserção', true),
  ('Veiculação de arte digital', 'Exibição de uma arte estática ou digital.', 'inserção', true),
  ('Entrevista ao vivo', 'Participação em programa ou transmissão ao vivo.', 'inserção', true),
  ('Gravação de spot', 'Captação e edição de spot de áudio.', 'peça', true),
  ('Locução', 'Gravação de voz para peça de áudio ou vídeo.', 'peça', true),
  ('Produção de vídeo', 'Produção ou edição de peça audiovisual.', 'peça', true),
  ('Distribuição por milheiro', 'Distribuição de materiais por milheiro.', 'milheiro', true),
  ('Distribuição por hora', 'Distribuição ou ativação por hora trabalhada.', 'hora', true)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "unit" = EXCLUDED."unit",
  "active" = true;

-- Relações serviço/subserviço. A mesma modalidade pode ser reaproveitada em vários serviços.
INSERT INTO "service_subservices" ("serviceTypeId", "subserviceTypeId", "active")
SELECT st.id, ss.id, true
FROM (VALUES
  ('Locação de mídia', 'Aluguel mensal'),
  ('Locação de mídia', 'Aluguel quinzenal'),
  ('Locação de mídia', 'Aluguel semanal'),
  ('Locação de mídia', 'Aluguel diário'),
  ('Veiculação', 'Inserção de spot 15s'),
  ('Veiculação', 'Inserção de spot 30s'),
  ('Veiculação', 'Inserção de spot 60s'),
  ('Veiculação', 'Veiculação de vídeo'),
  ('Veiculação', 'Veiculação de arte digital'),
  ('Entrevista', 'Entrevista ao vivo'),
  ('Produção Gráfica', 'Impressão em lona'),
  ('Produção Gráfica', 'Impressão em papel'),
  ('Produção Gráfica', 'Impressão em adesivo'),
  ('Instalação', 'Instalação de material'),
  ('Instalação', 'Montagem e desmontagem'),
  ('Produção de Áudio', 'Gravação de spot'),
  ('Produção de Áudio', 'Locução'),
  ('Produção Audiovisual', 'Produção de vídeo'),
  ('Distribuição', 'Distribuição por milheiro'),
  ('Distribuição', 'Distribuição por hora'),
  ('Logística', 'Distribuição por hora')
) AS seed(service_name, subservice_name)
JOIN "service_types" st ON st."name" = seed.service_name
JOIN "subservice_types" ss ON ss."name" = seed.subservice_name
ON CONFLICT ("serviceTypeId", "subserviceTypeId") DO UPDATE SET "active" = true;

-- Produtos e materiais físicos. A especificação técnica fica na transação ou no histórico de instalação.
INSERT INTO "product_types" ("name", "description", "active") VALUES
  ('Lona 440g', 'Lona para impressão de mídia externa.', true),
  ('Lona 500g', 'Lona de maior gramatura para mídia externa.', true),
  ('Papel outdoor', 'Papel próprio para aplicação em outdoor.', true),
  ('Papel couchê', 'Papel para materiais gráficos e promocionais.', true),
  ('Adesivo vinil', 'Adesivo vinílico para aplicação em superfícies.', true),
  ('Panfleto A5', 'Panfleto no formato A5.', true),
  ('Panfleto A6', 'Panfleto no formato A6.', true),
  ('Banner', 'Material gráfico em lona ou tecido.', true),
  ('Faixa', 'Faixa impressa para comunicação promocional.', true)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "active" = true;

-- Compatibilidade entre produtos e tipos de mídia.
INSERT INTO "product_media_types" ("productTypeId", "mediaTypeId")
SELECT pt.id, mt.id
FROM (VALUES
  ('Lona 440g', 'Outdoor'), ('Lona 440g', 'Frontlight'), ('Lona 440g', 'Backbus'),
  ('Lona 440g', 'Busdoor'), ('Lona 440g', 'Mupi'), ('Lona 440g', 'Totem'),
  ('Lona 500g', 'Outdoor'), ('Lona 500g', 'Frontlight'), ('Lona 500g', 'Empena'),
  ('Papel outdoor', 'Outdoor'), ('Papel couchê', 'Panfletagem'),
  ('Adesivo vinil', 'Busdoor'), ('Adesivo vinil', 'Mupi'), ('Adesivo vinil', 'Totem'),
  ('Panfleto A5', 'Panfletagem'), ('Panfleto A6', 'Panfletagem'),
  ('Banner', 'Outdoor'), ('Banner', 'Totem'), ('Faixa', 'Outdoor')
) AS seed(product_name, media_name)
JOIN "product_types" pt ON pt."name" = seed.product_name
JOIN "media_types" mt ON mt."name" = seed.media_name
ON CONFLICT ("productTypeId", "mediaTypeId") DO NOTHING;

-- Matriz operacional/financeira. Produto é obrigatório apenas para produção gráfica.
INSERT INTO "media_service_catalog"
  ("mediaTypeId", "serviceTypeId", "subserviceTypeId", "productRequired", "defaultUnit", "active")
SELECT mt.id, st.id, ss.id, seed.product_required, ss."unit", true
FROM (VALUES
  ('Outdoor', 'Locação de mídia', 'Aluguel mensal', false),
  ('Outdoor', 'Locação de mídia', 'Aluguel quinzenal', false),
  ('Outdoor', 'Locação de mídia', 'Aluguel semanal', false),
  ('Outdoor', 'Produção Gráfica', 'Impressão em lona', true),
  ('Outdoor', 'Produção Gráfica', 'Impressão em papel', true),
  ('Outdoor', 'Instalação', 'Instalação de material', false),
  ('Outdoor', 'Instalação', 'Montagem e desmontagem', false),
  ('Frontlight', 'Locação de mídia', 'Aluguel mensal', false),
  ('Frontlight', 'Produção Gráfica', 'Impressão em lona', true),
  ('Painel de LED', 'Locação de mídia', 'Aluguel mensal', false),
  ('Painel de LED', 'Veiculação', 'Veiculação de vídeo', false),
  ('Painel de LED', 'Veiculação', 'Veiculação de arte digital', false),
  ('Backbus', 'Locação de mídia', 'Aluguel mensal', false),
  ('Backbus', 'Produção Gráfica', 'Impressão em lona', true),
  ('Backbus', 'Produção Gráfica', 'Impressão em adesivo', true),
  ('Busdoor', 'Locação de mídia', 'Aluguel mensal', false),
  ('Busdoor', 'Produção Gráfica', 'Impressão em adesivo', true),
  ('Mupi', 'Locação de mídia', 'Aluguel mensal', false),
  ('Mupi', 'Produção Gráfica', 'Impressão em lona', true),
  ('Totem', 'Locação de mídia', 'Aluguel mensal', false),
  ('Totem', 'Produção Gráfica', 'Impressão em lona', true),
  ('Empena', 'Locação de mídia', 'Aluguel mensal', false),
  ('Empena', 'Produção Gráfica', 'Impressão em lona', true),
  ('Abrigo de ônibus', 'Locação de mídia', 'Aluguel mensal', false),
  ('Abrigo de ônibus', 'Produção Gráfica', 'Impressão em lona', true),
  ('Rádio', 'Veiculação', 'Inserção de spot 15s', false),
  ('Rádio', 'Veiculação', 'Inserção de spot 30s', false),
  ('Rádio', 'Veiculação', 'Inserção de spot 60s', false),
  ('Rádio', 'Entrevista', 'Entrevista ao vivo', false),
  ('Rádio', 'Produção de Áudio', 'Gravação de spot', false),
  ('Rádio', 'Produção de Áudio', 'Locução', false),
  ('TV', 'Veiculação', 'Veiculação de vídeo', false),
  ('TV', 'Entrevista', 'Entrevista ao vivo', false),
  ('TV', 'Produção Audiovisual', 'Produção de vídeo', false),
  ('Jornal', 'Veiculação', 'Veiculação de arte digital', false),
  ('Revista', 'Veiculação', 'Veiculação de arte digital', false),
  ('Portal', 'Veiculação', 'Veiculação de arte digital', false),
  ('Podcast', 'Veiculação', 'Inserção de spot 30s', false),
  ('Podcast', 'Entrevista', 'Entrevista ao vivo', false),
  ('Carro de Som', 'Veiculação', 'Inserção de spot 30s', false),
  ('Carro de Som', 'Veiculação', 'Inserção de spot 60s', false),
  ('Carro de Som', 'Produção de Áudio', 'Gravação de spot', false),
  ('Carro de Som', 'Produção de Áudio', 'Locução', false),
  ('Moto Som', 'Veiculação', 'Inserção de spot 30s', false),
  ('Moto Som', 'Produção de Áudio', 'Gravação de spot', false),
  ('Panfletagem', 'Produção Gráfica', 'Impressão em papel', true),
  ('Panfletagem', 'Distribuição', 'Distribuição por milheiro', false),
  ('Panfletagem', 'Distribuição', 'Distribuição por hora', false),
  ('Panfletagem', 'Logística', 'Distribuição por hora', false)
) AS seed(media_name, service_name, subservice_name, product_required)
JOIN "media_types" mt ON mt."name" = seed.media_name
JOIN "service_types" st ON st."name" = seed.service_name
JOIN "subservice_types" ss ON ss."name" = seed.subservice_name
ON CONFLICT ("mediaTypeId", "serviceTypeId", "subserviceTypeId") DO UPDATE SET
  "productRequired" = EXCLUDED."productRequired",
  "defaultUnit" = EXCLUDED."defaultUnit",
  "active" = true;

-- Migração opcional de materiais de estoque já existentes pelo nome do produto.
UPDATE "stock_items" si
SET "productTypeId" = pt.id
FROM "product_types" pt
WHERE si."productTypeId" IS NULL
  AND lower(si."name") = lower(pt."name");

-- Registra o preço vigente conhecido no histórico sem substituir preços negociados existentes.
INSERT INTO "supplier_offering_price_history"
  ("supplierOfferingId", "effectiveFrom", "unitPrice", "source", "notes")
SELECT so.id, CURRENT_DATE, so."unitPrice", 'migration_0058', 'Snapshot inicial do preço vigente.'
FROM "supplier_offerings" so
WHERE NOT EXISTS (
  SELECT 1
  FROM "supplier_offering_price_history" h
  WHERE h."supplierOfferingId" = so.id
    AND h."effectiveFrom" = CURRENT_DATE
);

-- Atualiza relações legadas de serviços quando o nome do subserviço já existia no cadastro antigo.
INSERT INTO "service_subservices" ("serviceTypeId", "subserviceTypeId", "active")
SELECT parent.id, child_new.id, true
FROM "service_types" parent
JOIN "service_types" child_old ON child_old."parentServiceTypeId" = parent.id
JOIN "subservice_types" child_new ON lower(child_new."name") = lower(child_old."name")
ON CONFLICT ("serviceTypeId", "subserviceTypeId") DO UPDATE SET "active" = true;
