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
const testGetAll = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const closures = yield closureRepository_1.ClosureRepository.getAll();
        console.log("Total closures:", closures.length);
        const prjClosures = closures.filter(c => c.project_code === 'BM25-AMS40-ING');
        console.log("Closures for BM25-AMS40-ING:", prjClosures.length);
        let grossRevenue = 0;
        let grossInternal = 0;
        let grossThirdParty = 0;
        for (const c of prjClosures) {
            console.log(`Period: ${c.period}`);
            console.log(`  Revenue: ${c.revenue}`);
            const ts = c.resources.reduce((s, r) => s + (r.hours * (r.rate_snapshot_direct + r.rate_snapshot_indirect)), 0);
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
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }
});
const index_1 = require("./db/index");
(0, index_1.connectDB)().then(testGetAll);
