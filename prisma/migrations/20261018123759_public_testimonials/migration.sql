-- AlterTable
ALTER TABLE "user_submissions" ADD COLUMN     "author_role" TEXT DEFAULT '',
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 5,
ALTER COLUMN "user_id" DROP NOT NULL;
