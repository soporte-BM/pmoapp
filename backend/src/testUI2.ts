import { ClosureRepository } from './repositories/closureRepository';

const testUI2 = async () => {
    try {
        const closures = await ClosureRepository.getAll();
        
        const prj = closures.filter(c => c.project_code === 'BM25-AMS40-ING');
        console.log("Total DB rows for PRJ:", prj.length);

        prj.forEach(c => {
            const isoStr = c.period instanceof Date ? c.period.toISOString() : String(c.period);
            console.log(`DB row ID ${c.id}: period = ${isoStr}, revenue = ${c.revenue}, status = ${c.status}`);
        });

        process.exit(0);
    } catch(e) {
        console.log(e); process.exit(1);
    }
}

import { connectDB } from './db/index';
connectDB().then(testUI2);
