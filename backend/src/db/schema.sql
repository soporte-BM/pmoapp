-- schema.sql
-- Create Projects table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Projects' AND xtype='U')
BEGIN
    CREATE TABLE Projects (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    )
END;
GO

-- Create Resources table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Resources' AND xtype='U')
BEGIN
    CREATE TABLE Resources (
        id INT IDENTITY(1,1) PRIMARY KEY,
        resource_name VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(100),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    )
END;
GO

-- Create ResourceMonthlyRates table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ResourceMonthlyRates' AND xtype='U')
BEGIN
    CREATE TABLE ResourceMonthlyRates (
        id INT IDENTITY(1,1) PRIMARY KEY,
        resource_id INT NOT NULL FOREIGN KEY REFERENCES Resources(id),
        period DATE NOT NULL,
        direct_rate DECIMAL(15,2) DEFAULT 0,
        indirect_rate DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'CLP',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_ResourcePeriod UNIQUE(resource_id, period)
    )
END;
GO

-- Create MonthlyClosures table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MonthlyClosures' AND xtype='U')
BEGIN
    CREATE TABLE MonthlyClosures (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL FOREIGN KEY REFERENCES Projects(id),
        period DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'DRAFT',
        revenue DECIMAL(15,2) DEFAULT 0,
        third_party_costs DECIMAL(15,2) DEFAULT 0,
        created_by VARCHAR(100),
        validated_by VARCHAR(100),
        validated_at DATETIME,
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_ProjectPeriod UNIQUE(project_id, period)
    )
END;
GO

-- Create ClosureResourceHours table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClosureResourceHours' AND xtype='U')
BEGIN
    CREATE TABLE ClosureResourceHours (
        id INT IDENTITY(1,1) PRIMARY KEY,
        closure_id INT NOT NULL FOREIGN KEY REFERENCES MonthlyClosures(id) ON DELETE CASCADE,
        resource_id INT NOT NULL FOREIGN KEY REFERENCES Resources(id),
        hours DECIMAL(10,2) DEFAULT 0,
        rate_snapshot_direct DECIMAL(15,2) DEFAULT 0,
        rate_snapshot_indirect DECIMAL(15,2) DEFAULT 0
    )
END;
GO
