-- SQL authentication must be enabled. Replace the placeholder password first.
USE master;
GO
CREATE LOGIN analytics_reader WITH PASSWORD = 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD', CHECK_POLICY = ON;
GO
USE ProductAnalyticsDemo;
GO
CREATE USER analytics_reader FOR LOGIN analytics_reader;
GRANT SELECT ON OBJECT::analytics.DailyFacts TO analytics_reader;
DENY INSERT, UPDATE, DELETE ON OBJECT::analytics.DailyFacts TO analytics_reader;
-- Do not assign db_owner or db_datareader. This login reads only the approved aggregate.
GO
