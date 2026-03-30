import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RateRepository } from '../repositories/rateRepository';

export const getAllRates = async (req: AuthRequest, res: Response) => {
    try {
        const rates = await RateRepository.getAllRates();
        res.json(rates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all rates', error });
    }
};

export const getRates = async (req: AuthRequest, res: Response) => {
    try {
        const { period } = req.query;
        if (!period) {
            return res.status(400).json({ message: 'Period is required (YYYY-MM-01)' });
        }
        const rates = await RateRepository.getByPeriod(period as string);
        res.json(rates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching rates', error });
    }
};

export const saveRates = async (req: AuthRequest, res: Response) => {
    try {
        const { period, rates } = req.body; // rates: [{ resourceName, directRate, indirectRate }]

        if (!period || !Array.isArray(rates)) {
            return res.status(400).json({ message: 'Invalid payload. Period and rates array required.' });
        }

        const results = [];
        for (const rate of rates) {
            try {
                await RateRepository.upsertRate(rate.resourceName, period, rate.directRate, rate.indirectRate);
                results.push({ resourceName: rate.resourceName, status: 'success' });
            } catch (e: any) {
                results.push({ resourceName: rate.resourceName, status: 'error', error: e.message });
            }
        }

        res.json({ message: 'Rates processing complete', results });

    } catch (error) {
        res.status(500).json({ message: 'Error saving rates', error });
    }
};
