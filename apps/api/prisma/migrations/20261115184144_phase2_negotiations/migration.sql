-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('awaiting_send_approval', 'contacting_broker', 'awaiting_booking_approval', 'booking_requested', 'booked', 'rejected', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "NegotiationEventType" AS ENUM ('ai_proposed', 'ai_countered', 'ai_accepted', 'ai_walked_away', 'policy_adjusted', 'policy_blocked', 'user_approved_send', 'user_adjusted', 'user_approved_booking', 'user_cancelled', 'offer_sent', 'broker_countered', 'broker_accepted', 'broker_rejected', 'booking_requested', 'booking_confirmed', 'booking_declined', 'load_unavailable');

-- CreateEnum
CREATE TYPE "NegotiationActor" AS ENUM ('ai', 'user', 'broker', 'system');

-- CreateEnum
CREATE TYPE "NegotiationStrategy" AS ENUM ('claude', 'rules');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android');

-- CreateTable
CREATE TABLE "negotiations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "load_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "NegotiationStatus" NOT NULL,
    "autonomy_level" "AutonomyLevel" NOT NULL,
    "strategy" "NegotiationStrategy" NOT NULL,
    "currency" "Currency" NOT NULL,
    "posted_rate" DECIMAL(12,2) NOT NULL,
    "floor_rate" DECIMAL(12,2) NOT NULL,
    "ceiling_rate" DECIMAL(12,2) NOT NULL,
    "deadhead_km" DECIMAL(8,1) NOT NULL,
    "cost_per_km" DECIMAL(6,2) NOT NULL,
    "min_rate_per_km" DECIMAL(6,2) NOT NULL,
    "min_margin_pct" DECIMAL(5,2) NOT NULL,
    "max_counter_pct" DECIMAL(5,2) NOT NULL,
    "current_offer" DECIMAL(12,2),
    "broker_offer" DECIMAL(12,2),
    "agreed_rate" DECIMAL(12,2),
    "round" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_events" (
    "id" UUID NOT NULL,
    "negotiation_id" UUID NOT NULL,
    "type" "NegotiationEventType" NOT NULL,
    "actor" "NegotiationActor" NOT NULL,
    "amount" DECIMAL(12,2),
    "reason_code" TEXT,
    "reason_params" JSONB,
    "rationale" TEXT,
    "broker_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "negotiations_organization_id_status_idx" ON "negotiations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "negotiations_load_id_idx" ON "negotiations"("load_id");

-- CreateIndex
CREATE INDEX "negotiation_events_negotiation_id_created_at_idx" ON "negotiation_events"("negotiation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_load_id_fkey" FOREIGN KEY ("load_id") REFERENCES "loads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_events" ADD CONSTRAINT "negotiation_events_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
