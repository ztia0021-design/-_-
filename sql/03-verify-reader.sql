-- Run using analytics_reader in the configured database.
-- This script is read-only. Expected: approved database, SELECT only on approved table.
SELECT DB_NAME() AS CurrentDatabase, ORIGINAL_LOGIN() AS LoginName;
SELECT permission_name FROM sys.fn_my_permissions(NULL,'SERVER');
SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE');
SELECT subentity_name,permission_name FROM sys.fn_my_permissions(N'analytics.DailyFacts','OBJECT');
-- The application rejects administrative/write permissions before executing a model query.
-- Administrator should additionally verify the login has no unintended access in other databases.
