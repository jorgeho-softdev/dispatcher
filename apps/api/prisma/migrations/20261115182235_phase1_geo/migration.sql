-- PostGIS (already present in the postgis image; required on managed Postgres).
CREATE EXTENSION IF NOT EXISTS postgis;

-- AlterTable
ALTER TABLE "ai_settings" ADD COLUMN     "avoid_provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferred_provinces" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "loads" ADD COLUMN     "origin_geo" geography(Point, 4326);

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "home_base_lat" DOUBLE PRECISION,
ADD COLUMN     "home_base_lng" DOUBLE PRECISION,
ADD COLUMN     "last_lat" DOUBLE PRECISION,
ADD COLUMN     "last_lng" DOUBLE PRECISION,
ADD COLUMN     "last_location_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "loads_origin_geo_idx" ON "loads" USING GIST ("origin_geo");

-- Keep loads.origin_geo in sync with origin_lat/origin_lng for EVERY write
-- path (Prisma, seed, raw SQL, future ingestion workers). Prisma does not
-- model triggers, so this lives only in SQL. See docs/adr/0012-matching-and-geo.md.
CREATE OR REPLACE FUNCTION loads_sync_origin_geo() RETURNS trigger AS $$
BEGIN
  NEW.origin_geo := ST_SetSRID(ST_MakePoint(NEW.origin_lng, NEW.origin_lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loads_sync_origin_geo
BEFORE INSERT OR UPDATE OF origin_lat, origin_lng ON "loads"
FOR EACH ROW EXECUTE FUNCTION loads_sync_origin_geo();

-- Backfill existing rows.
UPDATE "loads"
SET origin_geo = ST_SetSRID(ST_MakePoint(origin_lng, origin_lat), 4326)::geography
WHERE origin_geo IS NULL;
