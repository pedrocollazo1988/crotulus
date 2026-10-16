-- AlterTable
ALTER TABLE "users" ADD COLUMN     "two_factor_channel" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_phone" TEXT DEFAULT '',
ADD COLUMN     "two_factor_required" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "code_hash" TEXT NOT NULL,
    "challenge_hash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "destination" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "ip" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3),

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT DEFAULT '',
    "ip" TEXT DEFAULT '',
    "user_agent" TEXT DEFAULT '',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_codes_challenge_hash_idx" ON "otp_codes"("challenge_hash");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_purpose_idx" ON "otp_codes"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "trusted_devices_token_hash_idx" ON "trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
