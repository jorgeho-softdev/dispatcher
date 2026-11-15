-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'fleet_manager', 'dispatcher', 'driver');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('cargo_van', 'sprinter', 'box_truck', 'dry_van', 'reefer', 'flatbed');

-- CreateEnum
CREATE TYPE "LoadSource" AS ENUM ('simulated', 'manual', 'loadlink', 'dat', 'truckstop', 'loadboard_123', 'broker_direct');

-- CreateEnum
CREATE TYPE "LoadStatus" AS ENUM ('available', 'negotiating', 'booked', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('CAD', 'USD');

-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('assisted', 'semi_auto', 'auto');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'CA',
    "currency" "Currency" NOT NULL DEFAULT 'CAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "equipment" "EquipmentType" NOT NULL,
    "plate" TEXT,
    "capacity_kg" INTEGER NOT NULL,
    "cost_per_km" DECIMAL(6,2) NOT NULL,
    "home_base_city" TEXT,
    "home_base_province" CHAR(2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brokers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mc_number" TEXT,
    "rating_avg" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loads" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "source" "LoadSource" NOT NULL,
    "external_id" TEXT,
    "is_simulated" BOOLEAN NOT NULL DEFAULT false,
    "status" "LoadStatus" NOT NULL DEFAULT 'available',
    "origin_city" TEXT NOT NULL,
    "origin_province" CHAR(2) NOT NULL,
    "origin_lat" DOUBLE PRECISION NOT NULL,
    "origin_lng" DOUBLE PRECISION NOT NULL,
    "destination_city" TEXT NOT NULL,
    "destination_province" CHAR(2) NOT NULL,
    "destination_lat" DOUBLE PRECISION NOT NULL,
    "destination_lng" DOUBLE PRECISION NOT NULL,
    "pickup_at" TIMESTAMP(3) NOT NULL,
    "distance_km" DECIMAL(8,1) NOT NULL,
    "weight_kg" INTEGER NOT NULL,
    "equipment" "EquipmentType" NOT NULL,
    "posted_rate" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'CAD',
    "broker_id" UUID,
    "notes" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "autonomy_level" "AutonomyLevel" NOT NULL DEFAULT 'assisted',
    "min_rate_per_km" DECIMAL(6,2) NOT NULL DEFAULT 2.50,
    "min_margin_pct" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "max_counter_offer_pct" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "max_deadhead_km" INTEGER NOT NULL DEFAULT 150,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_organization_id_idx" ON "memberships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles"("organization_id");

-- CreateIndex
CREATE INDEX "loads_status_pickup_at_idx" ON "loads"("status", "pickup_at");

-- CreateIndex
CREATE INDEX "loads_equipment_status_idx" ON "loads"("equipment", "status");

-- CreateIndex
CREATE INDEX "loads_organization_id_idx" ON "loads"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "loads_source_external_id_key" ON "loads"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_settings_organization_id_key" ON "ai_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
