CREATE TABLE `feature_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_flags_key_unique` ON `feature_flags` (`key`);--> statement-breakpoint
DROP INDEX IF EXISTS "records_session_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "records_member_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "records_session_member_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_actor_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_target_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feature_flags_key_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "gang_settings_gang_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "gangs_discord_guild_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_member_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_member_id_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "licenses_key_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "members_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_discord_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_gang_discord_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_member_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_created_by_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_batch_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_settled_at_idx";--> statement-breakpoint
ALTER TABLE `gangs` ALTER COLUMN "subscription_tier" TO "subscription_tier" text NOT NULL DEFAULT 'FREE';--> statement-breakpoint
CREATE INDEX `records_session_id_idx` ON `attendance_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `records_member_id_idx` ON `attendance_records` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_session_member_unique` ON `attendance_records` (`session_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `audit_gang_id_idx` ON `audit_logs` (`gang_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_id_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_target_id_idx` ON `audit_logs` (`target_id`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `gang_settings_gang_id_unique` ON `gang_settings` (`gang_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gangs_discord_guild_id_unique` ON `gangs` (`discord_guild_id`);--> statement-breakpoint
CREATE INDEX `leaves_gang_id_idx` ON `leave_requests` (`gang_id`);--> statement-breakpoint
CREATE INDEX `leaves_member_id_idx` ON `leave_requests` (`member_id`);--> statement-breakpoint
CREATE INDEX `leaves_status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE INDEX `leaves_member_id_status_idx` ON `leave_requests` (`member_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_key_unique` ON `licenses` (`key`);--> statement-breakpoint
CREATE INDEX `members_gang_id_idx` ON `members` (`gang_id`);--> statement-breakpoint
CREATE INDEX `members_discord_id_idx` ON `members` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_gang_discord_unique` ON `members` (`gang_id`,`discord_id`);--> statement-breakpoint
CREATE INDEX `transactions_gang_id_idx` ON `transactions` (`gang_id`);--> statement-breakpoint
CREATE INDEX `transactions_member_id_idx` ON `transactions` (`member_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_by_id_idx` ON `transactions` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_at_idx` ON `transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_batch_id_idx` ON `transactions` (`batch_id`);--> statement-breakpoint
CREATE INDEX `transactions_settled_at_idx` ON `transactions` (`settled_at`);--> statement-breakpoint
ALTER TABLE `gangs` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `gangs` ADD `subscription_expires_at` integer;--> statement-breakpoint
ALTER TABLE `gangs` ADD `transfer_status` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `gangs` ADD `transfer_deadline` integer;--> statement-breakpoint
ALTER TABLE `gangs` ADD `transfer_started_at` integer;--> statement-breakpoint
ALTER TABLE `gangs` ADD `transfer_message_id` text;--> statement-breakpoint
ALTER TABLE `gangs` ADD `transfer_channel_id` text;--> statement-breakpoint
ALTER TABLE `gangs` ADD `dissolved_at` integer;--> statement-breakpoint
ALTER TABLE `gangs` ADD `dissolved_by` text;--> statement-breakpoint
ALTER TABLE `gangs` DROP COLUMN `license_key`;--> statement-breakpoint
ALTER TABLE `gang_settings` ADD `requests_channel_id` text;--> statement-breakpoint
ALTER TABLE `licenses` ADD `duration_days` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `transfer_status` text;--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `nickname`;--> statement-breakpoint
ALTER TABLE `transactions` ADD `batch_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `settled_at` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `settled_by_transaction_id` text;