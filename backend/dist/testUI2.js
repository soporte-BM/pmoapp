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
const testUI2 = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const closures = yield closureRepository_1.ClosureRepository.getAll();
        const prj = closures.filter(c => c.project_code === 'BM25-AMS40-ING');
        console.log("Total DB rows for PRJ:", prj.length);
        prj.forEach(c => {
            const isoStr = c.period instanceof Date ? c.period.toISOString() : String(c.period);
            console.log(`DB row ID ${c.id}: period = ${isoStr}, revenue = ${c.revenue}, status = ${c.status}`);
        });
        process.exit(0);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
});
const index_1 = require("./db/index");
(0, index_1.connectDB)().then(testUI2);
