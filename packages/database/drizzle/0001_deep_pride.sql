CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`discord_message_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `gang_settings` ADD `announcement_channel_id` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `type` text DEFAULT 'FULL' NOT NULL;--> statement-breakpoint
CREATE INDEX `leaves_gang_id_idx` ON `leave_requests` (`gang_id`);--> statement-breakpoint
CREATE INDEX `leaves_member_id_idx` ON `leave_requests` (`member_id`);--> statement-breakpoint
CREATE INDEX `leaves_status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE INDEX `records_session_id_idx` ON `attendance_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `records_member_id_idx` ON `attendance_records` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_session_member_unique` ON `attendance_records` (`session_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `members_gang_id_idx` ON `members` (`gang_id`);--> statement-breakpoint
CREATE INDEX `members_discord_id_idx` ON `members` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_gang_discord_unique` ON `members` (`gang_id`,`discord_id`);--> statement-breakpoint
CREATE INDEX `transactions_gang_id_idx` ON `transactions` (`gang_id`);--> statement-breakpoint
CREATE INDEX `transactions_member_id_idx` ON `transactions` (`member_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_at_idx` ON `transactions` (`created_at`);