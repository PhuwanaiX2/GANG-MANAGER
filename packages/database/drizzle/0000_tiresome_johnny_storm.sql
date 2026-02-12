CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text NOT NULL,
	`checked_in_at` integer,
	`penalty_amount` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`session_name` text NOT NULL,
	`session_date` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`allow_late` integer DEFAULT true NOT NULL,
	`late_threshold` integer DEFAULT 15 NOT NULL,
	`late_penalty` real DEFAULT 0 NOT NULL,
	`absent_penalty` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`discord_channel_id` text,
	`discord_message_id` text,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`old_value` text,
	`new_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gang_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`discord_role_id` text NOT NULL,
	`permission_level` text NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gang_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`require_photo_default` integer DEFAULT false NOT NULL,
	`late_threshold_minutes` integer DEFAULT 15 NOT NULL,
	`default_late_penalty` real DEFAULT 0 NOT NULL,
	`default_absent_penalty` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`register_channel_id` text,
	`attendance_channel_id` text,
	`finance_channel_id` text,
	`log_channel_id` text,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gang_settings_gang_id_unique` ON `gang_settings` (`gang_id`);--> statement-breakpoint
CREATE TABLE `gangs` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_guild_id` text NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`subscription_tier` text DEFAULT 'TRIAL' NOT NULL,
	`license_key` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gangs_discord_guild_id_unique` ON `gangs` (`discord_guild_id`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`gang_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`requested_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by_id` text,
	`review_notes` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`tier` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`max_members` integer DEFAULT 20 NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_key_unique` ON `licenses` (`key`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`discord_id` text,
	`name` text NOT NULL,
	`nickname` text,
	`discord_username` text,
	`discord_avatar` text,
	`is_active` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`gang_role` text DEFAULT 'MEMBER' NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text,
	`description` text NOT NULL,
	`member_id` text,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`approved_by_id` text,
	`approved_at` integer,
	`balance_before` real NOT NULL,
	`balance_after` real NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
