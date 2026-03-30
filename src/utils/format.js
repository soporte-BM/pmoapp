export const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
};

export const formatPercent = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(value / 100);
};

const MONTHS_MAP = {
    '01': 'ene', '1': 'ene', 'ene': 'ene', 'enero': 'ene', 'jan': 'ene', 'january': 'ene',
    '02': 'feb', '2': 'feb', 'feb': 'feb', 'febrero': 'feb', 'february': 'feb',
    '03': 'mar', '3': 'mar', 'mar': 'mar', 'marzo': 'mar', 'march': 'mar',
    '04': 'abr', '4': 'abr', 'abr': 'abr', 'abril': 'abr', 'apr': 'abr', 'april': 'abr',
    '05': 'may', '5': 'may', 'may': 'may', 'mayo': 'may',
    '06': 'jun', '6': 'jun', 'jun': 'jun', 'junio': 'jun', 'june': 'jun',
    '07': 'jul', '7': 'jul', 'jul': 'jul', 'julio': 'jul', 'july': 'jul',
    '08': 'ago', '8': 'ago', 'ago': 'ago', 'agosto': 'ago', 'aug': 'ago', 'august': 'ago',
    '09': 'sep', '9': 'sep', 'sep': 'sep', 'septiembre': 'sep', 'sept': 'sep', 'september': 'sep',
    '10': 'oct', 'oct': 'oct', 'octubre': 'oct', 'october': 'oct',
    '11': 'nov', 'nov': 'nov', 'noviembre': 'nov', 'november': 'nov',
    '12': 'dic', 'dic': 'dic', 'diciembre': 'dic', 'dec': 'dic', 'december': 'dic'
};

export const parsePeriodToMmmYy = (period) => {
    if (!period) return null;
    
    let strPeriod = String(period).trim().toLowerCase();
    
    // Si viene de Excel numérico
    if (!isNaN(strPeriod) && Number(strPeriod) > 10000) {
        const jsDate = new Date(Math.round((Number(strPeriod) - 25569) * 86400 * 1000));
        const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
        const y = String(jsDate.getUTCFullYear()).slice(-2);
        return `${MONTHS_MAP[m]}-${y}`;
    }

    // Format: YYYY-MM or YYYY-M (e.g. 2023-10, 2023/10, 2023 10)
    let match = strPeriod.match(/^(\d{4})[-\s/.](\d{1,2})$/);
    if (match) {
        const year = match[1].slice(-2);
        const month = MONTHS_MAP[match[2].padStart(2, '0')];
        if (month) return `${month}-${year}`;
    }

    // Format: MM-YYYY or M-YYYY (e.g. 10-2023)
    match = strPeriod.match(/^(\d{1,2})[-\s/.](\d{4})$/);
    if (match) {
        const year = match[2].slice(-2);
        const month = MONTHS_MAP[match[1].padStart(2, '0')];
        if (month) return `${month}-${year}`;
    }
    
    // Format: MM-YY or M-YY (e.g. 10-23)
    match = strPeriod.match(/^(\d{1,2})[-\s/.](\d{2})$/);
    if (match) {
        const year = match[2];
        const month = MONTHS_MAP[match[1].padStart(2, '0')];
        if (month) return `${month}-${year}`;
    }

    // Format: YYYY-MM-DD or ISO
    match = strPeriod.match(/^(\d{4})-(\d{2})-\d{2}/);
    if (match) {
        const year = match[1].slice(-2);
        const month = MONTHS_MAP[match[2]];
        if (month) return `${month}-${year}`;
    }

    // Format: mmm-yy, mmm yy, mmmmm yyyy (e.g. ene-25, enero 2025)
    match = strPeriod.match(/^([a-z]+)[-\s/.,]+(\d{2,4})$/);
    if (match) {
        const monthWord = match[1];
        let year = match[2];
        if (year.length === 4) year = year.slice(-2);
        const month = MONTHS_MAP[monthWord];
        if (month && year) return `${month}-${year}`;
    }

    // Format: yy-mmm (e.g. 25-ene)
    match = strPeriod.match(/^(\d{2,4})[-\s/.,]+([a-z]+)$/);
    if (match) {
        let year = match[1];
        if (year.length === 4) year = year.slice(-2);
        const monthWord = match[2];
        const month = MONTHS_MAP[monthWord];
        if (month && year) return `${month}-${year}`;
    }

    return null; // Invalid format
};

export const formatPeriod = (period) => {
    const parsed = parsePeriodToMmmYy(period);
    return parsed ? parsed : period;
};

const MONTHS_MAP_REVERSE = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
};

export const toSqlDate = (period) => {
    if (!period) return null;
    const parsed = parsePeriodToMmmYy(period); // normalize to mmm-yy first
    if (!parsed) return period;
    const parts = parsed.split('-');
    if (parts.length === 2) {
        const monthNum = MONTHS_MAP_REVERSE[parts[0]];
        const yearSub = parts[1];
        if (monthNum && yearSub) {
            return `20${yearSub}-${monthNum}-01`;
        }
    }
    return period;
};
