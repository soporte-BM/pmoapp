import { ClosureRepository } from './repositories/closureRepository';

const testGetAll = async () => {
    try {
        const closures = await ClosureRepository.getAll();
        console.log("Total closures:", closures.length);
        
        const prjClosures = closures.filter(c => c.project_code === 'BM25-AMS40-ING');
        console.log("Closures for BM25-AMS40-ING:", prjClosures.length);
        
        let grossRevenue = 0;
        let grossInternal = 0;
        let grossThirdParty = 0;

        for (const c of prjClosures) {
            console.log(`Period: ${c.period}`);
            console.log(`  Revenue: ${c.revenue}`);
            const ts = c.resources.reduce((s: number, r: any) => s + (r.hours * (r.rate_snapshot_direct + r.rate_snapshot_indirect)), 0);
            console.log(`  Internal: ${ts}`);
            
            grossRevenue += parseFloat(c.revenue) || 0;
            grossInternal += ts;
            grossThirdParty += parseFloat(c.third_party_costs) || 0;
        }

        console.log(`Total Revenue: ${grossRevenue}`);
        console.log(`Total Internal: ${grossInternal}`);
        
        const totalCost = grossInternal + grossThirdParty;
        const margin = grossRevenue - totalCost;
        const rentabilidad = grossRevenue > 0 ? (margin / grossRevenue) * 100 : 0;
        console.log(`Rentabilidad: ${rentabilidad}%`);

        process.exit(0);
    } catch(err) {
        console.log(err);
        process.exit(1);
    }
}

import { connectDB } from './db/index';
connectDB().then(testGetAll);
