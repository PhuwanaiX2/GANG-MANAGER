CREATE TABLE `finance_collection_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`amount_per_member` integer NOT NULL,
	`total_members` integer DEFAULT 0 NOT NULL,
	`total_amount_due` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `finance_collection_batches_gang_id_idx` ON `finance_collection_batches` (`gang_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_batches_status_idx` ON `finance_collection_batches` (`status`);--> statement-breakpoint
CREATE INDEX `finance_collection_batches_created_at_idx` ON `finance_collection_batches` (`created_at`);--> statement-breakpoint
CREATE TABLE `finance_collection_members` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`gang_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount_due` integer NOT NULL,
	`amount_credited` integer DEFAULT 0 NOT NULL,
	`amount_settled` integer DEFAULT 0 NOT NULL,
	`amount_waived` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`settled_at` integer,
	`waived_at` integer,
	`last_settlement_transaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `finance_collection_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gang_id`) REFERENCES `gangs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_settlement_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `finance_collection_members_batch_id_idx` ON `finance_collection_members` (`batch_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_members_gang_id_idx` ON `finance_collection_members` (`gang_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_members_member_id_idx` ON `finance_collection_members` (`member_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_members_status_idx` ON `finance_collection_members` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `finance_collection_members_batch_member_unique` ON `finance_collection_members` (`batch_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `finance_collection_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`collection_member_id` text NOT NULL,
	`member_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `finance_collection_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_member_id`) REFERENCES `finance_collection_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `finance_collection_settlements_batch_id_idx` ON `finance_collection_settlements` (`batch_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_settlements_member_row_idx` ON `finance_collection_settlements` (`collection_member_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_settlements_member_id_idx` ON `finance_collection_settlements` (`member_id`);--> statement-breakpoint
CREATE INDEX `finance_collection_settlements_transaction_id_idx` ON `finance_collection_settlements` (`transaction_id`);