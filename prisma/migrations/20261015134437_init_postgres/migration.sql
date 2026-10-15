-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "email_verified_at" TIMESTAMP(3),
    "google_id" TEXT,
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" TEXT DEFAULT '',
    "user_agent" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT DEFAULT '',
    "service" TEXT DEFAULT '',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'nuevo',
    "ip" TEXT DEFAULT '',
    "user_agent" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3),

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" SERIAL NOT NULL,
    "bucket" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "window_start" INTEGER NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "skey" TEXT NOT NULL,
    "svalue" TEXT,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("skey")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" SERIAL NOT NULL,
    "ctype" TEXT NOT NULL,
    "title" TEXT DEFAULT '',
    "subtitle" TEXT DEFAULT '',
    "body" TEXT,
    "meta" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_submissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stype" TEXT NOT NULL,
    "title" TEXT DEFAULT '',
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "score" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "user_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL DEFAULT 0,
    "target_label" TEXT DEFAULT '',
    "rating" INTEGER NOT NULL DEFAULT 5,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT DEFAULT '',
    "comment" TEXT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "ip" TEXT DEFAULT '',
    "user_agent" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "title" TEXT DEFAULT '',
    "excerpt" TEXT,
    "body" TEXT,
    "category" TEXT DEFAULT '',
    "author" TEXT DEFAULT '',
    "image" TEXT DEFAULT '',
    "meta" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "name" TEXT DEFAULT '',
    "role" TEXT DEFAULT '',
    "bio" TEXT,
    "email" TEXT DEFAULT '',
    "phone" TEXT DEFAULT '',
    "avatar" TEXT DEFAULT '',
    "meta" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_reviews" (
    "id" SERIAL NOT NULL,
    "review_key" TEXT NOT NULL,
    "author" TEXT DEFAULT '',
    "rating" INTEGER NOT NULL DEFAULT 5,
    "body" TEXT,
    "photo" TEXT DEFAULT '',
    "profile_url" TEXT DEFAULT '',
    "relative_time" TEXT DEFAULT '',
    "sort_ts" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3),

    CONSTRAINT "google_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "tokens_token_hash_idx" ON "tokens"("token_hash");

-- CreateIndex
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_bucket_ip_key" ON "rate_limits"("bucket", "ip");

-- CreateIndex
CREATE INDEX "content_items_ctype_idx" ON "content_items"("ctype");

-- CreateIndex
CREATE INDEX "user_submissions_stype_status_idx" ON "user_submissions"("stype", "status");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_target_type_target_id_idx" ON "reviews"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "blog_posts_is_active_published_at_idx" ON "blog_posts"("is_active", "published_at");

-- CreateIndex
CREATE INDEX "team_members_is_active_sort_order_idx" ON "team_members"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "google_reviews_review_key_key" ON "google_reviews"("review_key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_submissions" ADD CONSTRAINT "user_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
