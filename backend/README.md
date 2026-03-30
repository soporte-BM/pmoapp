# PMO App Backend

Node.js + Express + TypeScript backend connected to Azure SQL Database.

## Setup

1.  **Install Dependencies**
    ```bash
    cd backend
    npm install
    ```

2.  **Environment Variables**
    Create a `.env` file in the `backend` directory (copy from `.env.example`):
    ```ini
    PORT=3000
    SQL_SERVER=your-server.database.windows.net
    SQL_DATABASE=your-db
    SQL_USER=your-user
    SQL_PASSWORD=your-password
    ```

3.  **Database Setup**
    Run the SQL scripts located in `backend/db/` on your Azure SQL Database:
    - `01_schema.sql`: Creates tables.
    - `02_seed.sql`: Inserts initial data.

4.  **Run Locally**
    ```bash
    npm run dev
    ```

## API Endpoints

### Projects
- `GET /api/projects`
- `POST /api/projects` (Admin)

### Resources
- `GET /api/resources`
- `POST /api/resources` (Admin/PMO)

### Rates
- `GET /api/rates?period=YYYY-MM-01`
- `POST /api/rates` (Admin/PMO)

### Closures
- `GET /api/closures?projectCode=...&period=YYYY-MM-01`
- `POST /api/closures` (Draft)
- `POST /api/closures/:id/validate`
- `POST /api/closures/:id/unvalidate`

## Authentication
Currently simulated via Headers for development:
- `x-user-role`: `ADMIN`, `PMO`, `DIRECTOR`, or `CONSULTA`.
- `x-user-name`: string
