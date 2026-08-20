DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'requests' AND column_name = 'actionId'
  ) THEN
    ALTER TABLE requests ADD COLUMN "actionId" integer;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'requests' AND column_name = 'eventId'
  ) THEN
    ALTER TABLE requests ADD COLUMN "eventId" integer;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'requests' AND column_name = 'mediaPointId'
  ) THEN
    ALTER TABLE requests ADD COLUMN "mediaPointId" integer;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'requests' AND column_name = 'mediaCampaignId'
  ) THEN
    ALTER TABLE requests ADD COLUMN "mediaCampaignId" integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requests_action_id_actions_id_fk') THEN
    ALTER TABLE requests ADD CONSTRAINT requests_action_id_actions_id_fk FOREIGN KEY ("actionId") REFERENCES actions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requests_event_id_events_id_fk') THEN
    ALTER TABLE requests ADD CONSTRAINT requests_event_id_events_id_fk FOREIGN KEY ("eventId") REFERENCES events(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requests_media_point_id_media_points_id_fk') THEN
    ALTER TABLE requests ADD CONSTRAINT requests_media_point_id_media_points_id_fk FOREIGN KEY ("mediaPointId") REFERENCES media_points(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requests_media_campaign_id_media_campaigns_id_fk') THEN
    ALTER TABLE requests ADD CONSTRAINT requests_media_campaign_id_media_campaigns_id_fk FOREIGN KEY ("mediaCampaignId") REFERENCES media_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE requests
SET "actionId" = CASE WHEN "linkedEntityType" = 'action' THEN "linkedEntityId" ELSE "actionId" END,
    "eventId" = CASE WHEN "linkedEntityType" = 'event' THEN "linkedEntityId" ELSE "eventId" END,
    "mediaPointId" = CASE WHEN "linkedEntityType" = 'media_point' THEN "linkedEntityId" ELSE "mediaPointId" END,
    "mediaCampaignId" = CASE WHEN "linkedEntityType" = 'media_campaign' THEN "linkedEntityId" ELSE "mediaCampaignId" END
WHERE "linkedEntityType" IN ('action', 'event', 'media_point', 'media_campaign')
  AND "linkedEntityId" IS NOT NULL;
