-- Run in SQL Server Management Studio as an administrator.
-- This creates an isolated demo database, never modifies existing business tables.
IF DB_ID(N'ProductAnalyticsDemo') IS NULL
    CREATE DATABASE ProductAnalyticsDemo;
GO
USE ProductAnalyticsDemo;
GO
IF SCHEMA_ID(N'analytics') IS NULL
    EXEC(N'CREATE SCHEMA analytics');
GO
IF OBJECT_ID(N'analytics.DailyFacts', N'U') IS NULL
BEGIN
 CREATE TABLE analytics.DailyFacts (
    [Day] date NOT NULL,
    Channel nvarchar(40) NOT NULL,
    Device nvarchar(16) NOT NULL CHECK(Device IN(N'mobile',N'desktop')),
    NewUsers int NOT NULL CHECK(NewUsers>=0),
    ActivatedUsers int NOT NULL,
    PaidUsers int NOT NULL,
    Orders int NOT NULL CHECK(Orders>=0),
    Revenue decimal(18,2) NOT NULL CHECK(Revenue>=0),
    UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DailyFacts PRIMARY KEY ([Day],Channel,Device),
    CONSTRAINT CK_Funnel CHECK(ActivatedUsers BETWEEN 0 AND NewUsers AND PaidUsers BETWEEN 0 AND ActivatedUsers)
 );
END;
GO
