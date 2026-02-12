ALTER TABLE `audit_logs` ADD `details` text;--> statement-breakpoint
ALTER TABLE `gangs` ADD `balance` real DEFAULT 0 NOT NULL;