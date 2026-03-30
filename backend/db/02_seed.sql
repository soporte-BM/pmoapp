-- 02_seed.sql

-- Seed Projects
INSERT INTO Projects (project_code, name) values 
('PROJ-001', 'Transformación Digital Banco X'),
('PROJ-002', 'Migración SAP Retail Y'),
('PROJ-003', 'Asesoría Agile Telco Z');
GO

-- Seed Resources
INSERT INTO Resources (resource_name, role) VALUES 
('Juan P.', 'Full Stack Developer'),
('Ana M.', 'UX Designer'),
('Carlos S.', 'Project Manager'),
('Elena R.', 'QA Lead'),
('Junior 1', 'Junior Developer'),
('Coach 1', 'Agile Coach');
GO

-- Seed Rates (Example for 2023-10-01)
DECLARE @Period DATE = '2023-10-01';

INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
SELECT id, @Period, 80, 20 FROM Resources WHERE resource_name = 'Juan P.';

INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
SELECT id, @Period, 90, 22.5 FROM Resources WHERE resource_name = 'Ana M.';

INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
SELECT id, @Period, 100, 25 FROM Resources WHERE resource_name = 'Carlos S.';

INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
SELECT id, @Period, 110, 27.5 FROM Resources WHERE resource_name = 'Elena R.';

INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
SELECT id, @Period, 40, 10 FROM Resources WHERE resource_name = 'Junior 1';

INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
SELECT id, @Period, 110, 27.5 FROM Resources WHERE resource_name = 'Coach 1';
GO
