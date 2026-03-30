export const AnalyticsService = {
    calculateMetrics: (entry) => {
        const internalCost = entry.professionals.reduce((sum, p) => sum + (p.hours * p.rate), 0);
        const totalCost = internalCost + (entry.thirdPartyCosts || 0);
        const margin = entry.revenue - totalCost;
        const profitability = entry.revenue > 0 ? (margin / entry.revenue) * 100 : 0;

        return {
            ...entry,
            internalCost,
            totalCost,
            margin,
            profitability
        };
    },

    getHealthStatus: (profitability) => {
        if (profitability < 10) return { status: 'danger', label: 'Crítico' };
        if (profitability < 20) return { status: 'warning', label: 'Riesgo' };
        return { status: 'success', label: 'Saludable' };
    },

    generateInsights: (processedEntries) => {
        const insights = [];
        const criticalProjects = processedEntries.filter(e => e.profitability < 20);

        if (criticalProjects.length > 0) {
            insights.push({
                type: 'critical',
                title: `${criticalProjects.length} Proyectos en Riesgo`,
                details: criticalProjects.map(p => `${p.project}: ${p.profitability.toFixed(1)}% margen.`).slice(0, 3)
            });
        } else {
            insights.push({
                type: 'success',
                title: 'Cartera Saludable',
                details: ['Todos los proyectos superan el 20% de rentabilidad.']
            });
        }

        // Project specific analysis
        criticalProjects.forEach(p => {
            const laborShare = p.internalCost / p.revenue;
            if (laborShare > 0.8) {
                insights.push({
                    type: 'warning',
                    title: `Alerta: ${p.project}`,
                    details: [`Costo laboral excesivo (${(laborShare * 100).toFixed(0)}% del ingreso). Revisar asignación de horas.`]
                });
            }
        });

        return insights;
    }
};
