-- Drop legacy audit_log table. Safe to run one release after audit_log_v2 backfill (Task 16).
-- All historical rows have been migrated to audit_log_v2.
DROP TABLE IF EXISTS audit_log;
