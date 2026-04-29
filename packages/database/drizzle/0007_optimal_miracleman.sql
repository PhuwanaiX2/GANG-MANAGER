ALTER TABLE `attendance_sessions` DROP COLUMN `allow_late`;--> statement-breakpoint
ALTER TABLE `attendance_sessions` DROP COLUMN `late_threshold`;--> statement-breakpoint
ALTER TABLE `attendance_sessions` DROP COLUMN `late_penalty`;--> statement-breakpoint
ALTER TABLE `gang_settings` DROP COLUMN `late_threshold_minutes`;--> statement-breakpoint
ALTER TABLE `gang_settings` DROP COLUMN `default_late_penalty`;