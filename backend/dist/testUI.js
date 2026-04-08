"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const closureRepository_1 = require("./repositories/closureRepository");
const testUI = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const closures = yield closureRepository_1.ClosureRepository.getAll();
        // Emulate frontend map
        const mappedEntries = closures.map(c => ({
            id: String(c.id),
            projectCode: c.project_code,
            project: c.project_name,
            // period comes out as a Javascript Date object from tedious driver? 
            // Yes! tedious/mssql returns Date object for DATE type unless it's cast.
            period: c.period,
            month: "todo-calc",
            revenue: Number(c.revenue) || 0,
            thirdPartyCosts: Number(c.third_party_costs) || 0,
            professionals: (c.resources || []).map((r) => ({
                name: r.resource_name,
                hours: Number(r.hours),
                rate: Number(r.rate_snapshot_direct) + Number(r.rate_snapshot_indirect)
            })),
            tipoRegistro: c.status === 'VALIDATED' ? 'REAL' : 'PROYECCION'
        }));
        // Wait! In frontend it receives over API. So Date is ISO string.
        mappedEntries.forEach(e => {
            const isoStr = e.period instanceof Date ? e.period.toISOString() : String(e.period);
            // mock format
            const match = isoStr.split('T')[0].match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (match) {
                const map = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                e.month = `${map[parseInt(match[2]) - 1]}-${match[1].slice(2)}`;
            }
        });
        // Dedup
        let realEntriesMap = new Map();
        mappedEntries.forEach(entry => {
            if (entry.tipoRegistro !== 'REAL')
                return;
            const key = `${entry.project}_${entry.month}`;
            if (!realEntriesMap.has(key)) {
                realEntriesMap.set(key, entry);
            }
            else {
                const existing = realEntriesMap.get(key);
                const isExcelE = existing.professionals && existing.professionals.length === 1 && existing.professionals[0].name.includes("Histórica");
                const isExcelNew = entry.professionals && entry.professionals.length === 1 && entry.professionals[0].name.includes("Histórica");
                if (isExcelE && !isExcelNew) {
                    realEntriesMap.set(key, entry);
                }
                else if (isExcelE === isExcelNew) {
                    realEntriesMap.set(key, entry);
                }
            }
        });
        const validRealEntries = Array.from(realEntriesMap.values());
        console.log(`Valid real entries:`, validRealEntries.filter(e => e.projectCode === 'BM25-AMS40-ING').length);
        const projectStats = {};
        validRealEntries.forEach(entry => {
            const internalCost = entry.professionals.reduce((sum, p) => sum + (p.hours * p.rate), 0);
            const totalCost = internalCost + entry.thirdPartyCosts;
            const margin = entry.revenue - totalCost;
            if (!projectStats[entry.project])
                projectStats[entry.project] = { totalRevenue: 0, totalMargin: 0 };
            projectStats[entry.project].totalRevenue += entry.revenue;
            projectStats[entry.project].totalMargin += margin;
        });
        const codeMap = closures.reduce((m, c) => (Object.assign(Object.assign({}, m), { [c.project_name]: c.project_code })), {});
        Object.keys(projectStats).forEach(project => {
            if (codeMap[project] === 'BM25-AMS40-ING') {
                const stats = projectStats[project];
                const profitability = stats.totalRevenue > 0 ? (stats.totalMargin / stats.totalRevenue) * 100 : 0;
                console.log(`Proyecto: ${project}`);
                console.log(`  Revenue: ${stats.totalRevenue}`);
                console.log(`  Margin: ${stats.totalMargin}`);
                console.log(`  Profitability: ${profitability}%`);
            }
        });
        process.exit(0);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
});
const index_1 = require("./db/index");
(0, index_1.connectDB)().then(testUI);
