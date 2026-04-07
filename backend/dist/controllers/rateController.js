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
exports.deleteRate = exports.saveRates = exports.getRates = exports.getAllRates = void 0;
const rateRepository_1 = require("../repositories/rateRepository");
const getAllRates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rates = yield rateRepository_1.RateRepository.getAll();
        res.json(rates);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching all rates', error });
    }
});
exports.getAllRates = getAllRates;
const getRates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { period } = req.query;
        if (!period) {
            return res.status(400).json({ message: 'Period is required (YYYY-MM-01)' });
        }
        const rates = yield rateRepository_1.RateRepository.getByPeriod(period);
        res.json(rates);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching rates', error });
    }
});
exports.getRates = getRates;
const saveRates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { period, rates } = req.body; // rates: [{ resourceName, directRate, indirectRate }]
        if (!period || !Array.isArray(rates)) {
            return res.status(400).json({ message: 'Invalid payload. Period and rates array required.' });
        }
        const results = [];
        for (const rate of rates) {
            try {
                yield rateRepository_1.RateRepository.upsertRate(rate.resourceName, period, rate.directRate, rate.indirectRate);
                results.push({ resourceName: rate.resourceName, status: 'success' });
            }
            catch (e) {
                results.push({ resourceName: rate.resourceName, status: 'error', error: e.message });
            }
        }
        res.json({ message: 'Rates processing complete', results });
    }
    catch (error) {
        res.status(500).json({ message: 'Error saving rates', error });
    }
});
exports.saveRates = saveRates;
const deleteRate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { period } = req.query;
        if (!id || !period) {
            return res.status(400).json({ message: 'Missing id or period' });
        }
        yield rateRepository_1.RateRepository.deleteRate(Number(id), period);
        res.json({ message: 'Rate deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting rate', error: error.message });
    }
});
exports.deleteRate = deleteRate;
