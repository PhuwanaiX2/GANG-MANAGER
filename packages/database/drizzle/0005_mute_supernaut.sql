CREATE TABLE IF NOT EXISTS `system_announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'INFO' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`expires_at` integer,
	`created_by` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "records_session_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "records_member_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "records_session_member_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_status_start_time_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_status_end_time_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_actor_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_target_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feature_flags_key_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "gang_roles_gang_role_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "gang_settings_gang_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "gangs_discord_guild_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_member_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_member_id_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "leaves_gang_id_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "licenses_key_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "members_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_discord_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_is_active_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_gang_discord_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_gang_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_member_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_created_by_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_batch_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_settled_at_idx";--> statement-breakpoint
ALTER TABLE `attendance_records` ALTER COLUMN "penalty_amount" TO "penalty_amount" integer NOT NULL;--> statement-breakpoint
CREATE INDEX `records_session_id_idx` ON `attendance_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `records_member_id_idx` ON `attendance_records` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_session_member_unique` ON `attendance_records` (`session_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `sessions_gang_id_idx` ON `attendance_sessions` (`gang_id`);--> statement-breakpoint
CREATE INDEX `sessions_status_start_time_idx` ON `attendance_sessions` (`status`,`start_time`);--> statement-breakpoint
CREATE INDEX `sessions_status_end_time_idx` ON `attendance_sessions` (`status`,`end_time`);--> statement-breakpoint
CREATE INDEX `audit_gang_id_idx` ON `audit_logs` (`gang_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_id_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_target_id_idx` ON `audit_logs` (`target_id`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `feature_flags_key_unique` ON `feature_flags` (`key`);--> statement-breakpoint
CREATE INDEX `gang_roles_gang_role_idx` ON `gang_roles` (`gang_id`,`discord_role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gang_settings_gang_id_unique` ON `gang_settings` (`gang_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gangs_discord_guild_id_unique` ON `gangs` (`discord_guild_id`);--> statement-breakpoint
CREATE INDEX `leaves_gang_id_idx` ON `leave_requests` (`gang_id`);--> statement-breakpoint
CREATE INDEX `leaves_member_id_idx` ON `leave_requests` (`member_id`);--> statement-breakpoint
CREATE INDEX `leaves_status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE INDEX `leaves_member_id_status_idx` ON `leave_requests` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `leaves_gang_id_status_idx` ON `leave_requests` (`gang_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_key_unique` ON `licenses` (`key`);--> statement-breakpoint
CREATE INDEX `members_gang_id_idx` ON `members` (`gang_id`);--> statement-breakpoint
CREATE INDEX `members_discord_id_idx` ON `members` (`discord_id`);--> statement-breakpoint
CREATE INDEX `members_is_active_idx` ON `members` (`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_gang_discord_unique` ON `members` (`gang_id`,`discord_id`);--> statement-breakpoint
CREATE INDEX `transactions_gang_id_idx` ON `transactions` (`gang_id`);--> statement-breakpoint
CREATE INDEX `transactions_member_id_idx` ON `transactions` (`member_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_by_id_idx` ON `transactions` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_at_idx` ON `transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_batch_id_idx` ON `transactions` (`batch_id`);--> statement-breakpoint
CREATE INDEX `transactions_settled_at_idx` ON `transactions` (`settled_at`);--> statement-breakpoint
ALTER TABLE `attendance_sessions` ALTER COLUMN "late_penalty" TO "late_penalty" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ALTER COLUMN "absent_penalty" TO "absent_penalty" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `gang_settings` ALTER COLUMN "default_late_penalty" TO "default_late_penalty" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `gang_settings` ALTER COLUMN "default_absent_penalty" TO "default_absent_penalty" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `gangs` ALTER COLUMN "balance" TO "balance" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ALTER COLUMN "balance" TO "balance" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ALTER COLUMN "amount" TO "amount" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ALTER COLUMN "balance_before" TO "balance_before" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ALTER COLUMN "balance_after" TO "balance_after" integer NOT NULL;