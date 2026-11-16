-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('scheduled', 'at_pickup', 'in_transit', 'delivered', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('rate_confirmation', 'bol', 'pod', 'receipt', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'uploaded');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('fuel', 'tolls', 'parking', 'maintenance', 'lumper', 'other');

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "sequence" SERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "negotiation_id" UUID,
    "load_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'scheduled',
    "currency" "Currency" NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "planned_km" DECIMAL(8,1) NOT NULL,
    "cost_per_km" DECIMAL(6,2) NOT NULL,
    "last_lat" DOUBLE PRECISION,
    "last_lng" DOUBLE PRECISION,
    "last_speed_kmh" DOUBLE PRECISION,
    "last_at" TIMESTAMP(3),
    "remaining_km" DECIMAL(8,1),
    "eta_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_locations" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed_kmh" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_documents" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "trip_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_expenses" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "note" TEXT,
    "incurred_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_ratings" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "broker_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trips_sequence_key" ON "trips"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trips_negotiation_id_key" ON "trips"("negotiation_id");

-- CreateIndex
CREATE INDEX "trips_organization_id_status_idx" ON "trips"("organization_id", "status");

-- CreateIndex
CREATE INDEX "trip_locations_trip_id_recorded_at_idx" ON "trip_locations"("trip_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "trip_documents_storage_key_key" ON "trip_documents"("storage_key");

-- CreateIndex
CREATE INDEX "trip_documents_trip_id_type_idx" ON "trip_documents"("trip_id", "type");

-- CreateIndex
CREATE INDEX "trip_expenses_trip_id_idx" ON "trip_expenses"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "broker_ratings_trip_id_key" ON "broker_ratings"("trip_id");

-- CreateIndex
CREATE INDEX "broker_ratings_broker_id_idx" ON "broker_ratings"("broker_id");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_load_id_fkey" FOREIGN KEY ("load_id") REFERENCES "loads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trip codes start at TR-1001.
ALTER SEQUENCE "trips_sequence_seq" RESTART WITH 1001;
