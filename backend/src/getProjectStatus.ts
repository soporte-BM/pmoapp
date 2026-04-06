import { connectDB } from './db/index';

const testMath = async () => {
    try {
        const pool = await connectDB();
        
        const closureResult = await pool.request()
            .query(`
            SELECT c.id, c.period, c.revenue, c.third_party_costs, p.project_code
            FROM MonthlyClosures c
            JOIN Projects p ON c.project_id = p.id
            WHERE p.project_code = 'BM25-AMS40-ING'
        `);

        let grossRevenue = 0;
        let grossDirect = 0;
        let grossThirdParty = 0;
        
        for (const c of closureResult.recordset) {
            const res = await pool.request()
                .input('cid', c.id)
                .query(`
                SELECT cr.hours, cr.rate_snapshot_direct
                FROM ClosureResourceHours cr
                WHERE cr.closure_id = @cid
                `);
            
            let totalDirect = 0;
            res.recordset.forEach((row: any) => {
                totalDirect += row.hours * row.rate_snapshot_direct;
            });
            
            grossRevenue += parseFloat(c.revenue) || 0;
            grossThirdParty += parseFloat(c.third_party_costs) || 0;
            grossDirect += totalDirect;
        }
        
        console.log(`--- SUMMARY BM25-AMS40-ING ---`);
        console.log(`Total Revenue: ${grossRevenue}`);
        console.log(`Total Labor Direct: ${grossDirect}`);
        console.log(`Total Third Party: ${grossThirdParty}`);
        const totalCost = grossDirect + grossThirdParty;
        const margin = grossRevenue - totalCost;
        const rentabilidad = grossRevenue > 0 ? (margin / grossRevenue) * 100 : 0;
        console.log(`Global Total Cost: ${totalCost}`);
        console.log(`Global Margin: ${margin}`);
        console.log(`Global Rentabilidad: ${rentabilidad}%`);
        
        process.exit(0);

    } catch(err) {
        console.log(err);
        process.exit(1);
    }
}
testMath();
