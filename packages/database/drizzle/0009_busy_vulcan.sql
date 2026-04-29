CREATE TABLE `rate_limit_counters` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`subject` text NOT NULL,
	`window_start_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_counters_scope_expires_idx` ON `rate_limit_counters` (`scope`,`expires_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_counters_subject_expires_idx` ON `rate_limit_counters` (`subject`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_counters_scope_subject_window_unique` ON `rate_limit_counters` (`scope`,`subject`,`window_start_at`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text,
	`status` text DEFAULT 'PROCESSING' NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`processed_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhook_events_provider_status_idx` ON `webhook_events` (`provider`,`status`);--> statement-breakpoint
CREATE INDEX `webhook_events_created_at_idx` ON `webhook_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `webhook_events_updated_at_idx` ON `webhook_events` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_provider_event_unique` ON `webhook_events` (`provider`,`event_id`);
