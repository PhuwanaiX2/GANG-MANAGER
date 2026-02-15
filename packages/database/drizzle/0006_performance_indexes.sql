-- Performance indexes based on Turso AI Insights (top slow queries)

-- attendance_sessions: full table scan on status + start_time (277ms avg, 114s total)
CREATE INDEX IF NOT EXISTS `sessions_gang_id_idx` ON `attendance_sessions` (`gang_id`);
CREATE INDEX IF NOT EXISTS `sessions_status_start_time_idx` ON `attendance_sessions` (`status`, `start_time`);
CREATE INDEX IF NOT EXISTS `sessions_status_end_time_idx` ON `attendance_sessions` (`status`, `end_time`);

-- members: count(*) where is_active takes 2s without index
CREATE INDEX IF NOT EXISTS `members_is_active_idx` ON `members` (`is_active`);

-- gang_roles: full scan on gang_id + discord_role_id lookup
CREATE INDEX IF NOT EXISTS `gang_roles_gang_role_idx` ON `gang_roles` (`gang_id`, `discord_role_id`);

-- leave_requests: count where gang_id + status = 1.7s (has separate indexes but no composite)
CREATE INDEX IF NOT EXISTS `leaves_gang_id_status_idx` ON `leave_requests` (`gang_id`, `status`);
