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
    
    const formatDateEs = (jsDate) => {
        if (isNaN(jsDate.getTime())) return null;
        // Obligatorio uso de es-ES
        const formatter = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' });
        const parts = formatter.formatToParts(jsDate);
        let month = parts.find(p => p.type === 'month')?.value || '';
        // Forzamos formato estricto: sin puntos y 3 primeros caracteres en minúscula para evitar 'ene.'
        month = month.replace(/\./g, '').toLowerCase().substring(0, 3);
        const year = parts.find(p => p.type === 'year')?.value || '';
        return month && year ? `${month}-${year}` : null;
    };
    
    // 1. Si viene de input type="month" o formato YYYY-MM
    let match = strPeriod.match(/^(\d{4})[-\s/.](\d{1,2})$/);
    if (match) {
        const jsDate = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, 1));
        return formatDateEs(jsDate);
    }

    // 2. Si es Timestamp ISO o YYYY-MM-DD
    if (strPeriod.includes('t')) {
        strPeriod = strPeriod.split('t')[0];
    }
    match = strPeriod.match(/^(\d{4})[-\s/.](\d{1,2})[-\s/.](\d{1,2})$/);
    if (match) {
        const jsDate = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
        return formatDateEs(jsDate);
    }

    // 3. Fallback: Si viene de Excel numérico
    if (!isNaN(strPeriod) && Number(strPeriod) > 10000) {
        const jsDate = new Date(Math.round((Number(strPeriod) - 25569) * 86400 * 1000));
        return formatDateEs(jsDate);
    }

    // 4. Fallback formatos manuales (MM/YYYY)
    match = strPeriod.match(/^(\d{1,2})[-\s/.](\d{2,4})$/);
    if (match) {
        let year = parseInt(match[2]);
        if (year < 100) year += 2000;
        const jsDate = new Date(Date.UTC(year, parseInt(match[1]) - 1, 1));
        return formatDateEs(jsDate);
    }

    // 5. Fallback strings de palabras usando el MONTH_MAP existente
    match = strPeriod.match(/^([a-z]+)[-\s/.,]+(\d{2,4})$/);
    if (match) {
        const monthWord = match[1];
        let year = match[2];
        if (year.length === 4) year = year.slice(-2);
        const month = MONTHS_MAP[monthWord];
        if (month && year) return `${month}-${year}`;
    }

    return null; // Formato inválido
};

export const formatPeriod = (period) => {
    // Si ya viene pre-formateado a mmm-yy
    const parsed = parsePeriodToMmmYy(period);
    // Retornamos estrictamente el periodo en mmm-yy usando es-ES (que retornará el parsed)
    if (parsed) {
        return parsed;
    }
    return period;
};
