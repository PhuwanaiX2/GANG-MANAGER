CREATE TABLE `subscription_payment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`request_ref` text NOT NULL,
	`actor_discord_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`tier` text DEFAULT 'PREMIUM' NOT NULL,
	`billing_period` text DEFAULT 'monthly' NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`provider` text DEFAULT 'PROMPTPAY_MANUAL' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`slip_payload` text,
	`slip_image_url` text,
	`slip_trans_ref` text,
	`provider_response` text,
	`verification_error` text,
	`submitted_at` integer,
	`verified_at` integer,
	`approved_at` integer,
	`approved_by_id` text,
	`rejected_at` integer,
	`rejected_by_id` text,
	`review_notes` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_payment_requests_request_ref_unique` ON `subscription_payment_requests` (`request_ref`);--> statement-breakpoint
CREATE INDEX `subscription_payment_requests_gang_status_idx` ON `subscription_payment_requests` (`gang_id`,`status`);--> statement-breakpoint
CREATE INDEX `subscription_payment_requests_status_created_at_idx` ON `subscription_payment_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_payment_requests_slip_trans_ref_unique` ON `subscription_payment_requests` (`slip_trans_ref`);