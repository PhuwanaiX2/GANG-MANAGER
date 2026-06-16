ALTER TABLE `attendance_records` ADD `proof_type` text;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `proof_value` text;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD `verification_mode` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD `verification_code` text;