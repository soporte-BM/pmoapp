-- 01_schema.sql

-- Projects Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Projects' AND xtype='U')
BEGIN
    CREATE TABLE Projects (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Resources Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Resources' AND xtype='U')
BEGIN
    CREATE TABLE Resources (
        id INT IDENTITY(1,1) PRIMARY KEY,
        resource_name VARCHAR(100) NOT NULL UNIQUE,
        role VARCHAR(50),
        status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- ResourceMonthlyRates Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ResourceMonthlyRates' AND xtype='U')
BEGIN
    CREATE TABLE ResourceMonthlyRates (
        id INT IDENTITY(1,1) PRIMARY KEY,
        resource_id INT NOT NULL FOREIGN KEY REFERENCES Resources(id),
        period DATE NOT NULL, -- Stored as YYYY-MM-01
        direct_rate DECIMAL(10, 2) NOT NULL CHECK (direct_rate >= 0),
        indirect_rate DECIMAL(10, 2) NOT NULL CHECK (indirect_rate >= 0),
        currency VARCHAR(3) DEFAULT 'CLP',
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_Resource_Period UNIQUE(resource_id, period)
    );
END
GO

-- MonthlyClosures Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MonthlyClosures' AND xtype='U')
BEGIN
    CREATE TABLE MonthlyClosures (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL FOREIGN KEY REFERENCES Projects(id),
        period DATE NOT NULL, -- Stored as YYYY-MM-01
        status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'VALIDATED')),
        revenue DECIMAL(15, 2) DEFAULT 0 CHECK (revenue >= 0),
        third_party_costs DECIMAL(15, 2) DEFAULT 0 CHECK (third_party_costs >= 0),
        
        -- Snapshot of calculated KPIs at time of validation (optional, can be calculated on fly)
        calc_labor_direct_cost DECIMAL(15, 2) DEFAULT 0,
        calc_labor_indirect_cost DECIMAL(15, 2) DEFAULT 0,
        calc_total_cost DECIMAL(15, 2) DEFAULT 0,
        calc_margin DECIMAL(15, 2) DEFAULT 0,
        calc_profitability_pct DECIMAL(5, 2) DEFAULT 0,

        created_by VARCHAR(100),
        validated_by VARCHAR(100),
        validated_at DATETIME,
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_Project_Period UNIQUE(project_id, period)
    );
END
GO

-- ClosureResourceHours Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClosureResourceHours' AND xtype='U')
BEGIN
    CREATE TABLE ClosureResourceHours (
        id INT IDENTITY(1,1) PRIMARY KEY,
        closure_id INT NOT NULL FOREIGN KEY REFERENCES MonthlyClosures(id) ON DELETE CASCADE,
        resource_id INT NOT NULL FOREIGN KEY REFERENCES Resources(id),
        hours DECIMAL(10, 2) NOT NULL CHECK (hours >= 0),
        
        -- Freeze rates at the time of closure (from ResourceMonthlyRates)
        rate_snapshot_direct DECIMAL(10, 2) NOT NULL,
        rate_snapshot_indirect DECIMAL(10, 2) NOT NULL,
        
        CONSTRAINT UQ_Closure_Resource UNIQUE(closure_id, resource_id)
    );
END
GO
