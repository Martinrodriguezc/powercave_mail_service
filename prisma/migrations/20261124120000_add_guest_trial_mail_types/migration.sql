-- AlterEnum
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'guest_trial_confirmation';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'guest_trial_cancelled';
