CREATE INDEX `records_session_status_idx` ON `attendance_records` (`session_id`,`status`);--> statement-breakpoint
CREATE INDEX `sessions_gang_status_date_idx` ON `attendance_sessions` (`gang_id`,`status`,`session_date`);--> statement-breakpoint
CREATE INDEX `finance_collection_members_gang_status_created_at_idx` ON `finance_collection_members` (`gang_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `members_gang_status_active_idx` ON `members` (`gang_id`,`status`,`is_active`);--> statement-breakpoint
CREATE INDEX `transactions_gang_status_created_at_idx` ON `transactions` (`gang_id`,`status`,`created_at`);