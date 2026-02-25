import { USA_TRADE_CONFIG } from "./config.js";
import { COUNTRY_CODE_MAP } from "./countryCodes.js";
import { USA_PROGRAM_COUNTRIES } from "./programCountries.js";
import { getCountryOverrides } from "./countryDutyOverrides.js";


export const USA_ENGINE = {
    name: "USA",

    getImportingCountry() {
        return "USA";
    },

    getTradeConfig() {
        return USA_TRADE_CONFIG;
    },

    getRateColumn(countryName, item, findParentWithRateFn) {

        if (!item) return "general";
    
        const trade = this.getTradeConfig();
    
        // 1️⃣ Column 2 sanctions (highest priority)
        if (trade.column2Countries.includes(countryName)) {
            return "other";
        }
    
        // ISO code (AF, JO, AU etc)
        const iso = COUNTRY_CODE_MAP[countryName];
        if (!iso) return "general";
    
        // 2️⃣ Get SPECIAL column text (inherit if empty)
        let specialText = item.special || "";
    
        if (!specialText || specialText === "N/A") {
            const parent = findParentWithRateFn?.(item, "special");
            if (parent?.special) specialText = parent.special;
        }
    
        if (!specialText) return "general";
    
        specialText = specialText.toUpperCase();
    
        // 3️⃣ Direct FTA match (JO, AU, SG, S, P etc)
        const isoRegex = new RegExp(`\\b${iso}\\b`, "i");
        if (isoRegex.test(specialText)) {
            return "special";
        }
    
        // 4️⃣ Program match (loop through USA_PROGRAM_COUNTRIES)
        for (const [programCode, countries] of Object.entries(USA_PROGRAM_COUNTRIES)) {
    
            // is this country part of this program?
            if (!countries.includes(countryName)) continue;
    
            // does the HS row allow this program?
            const progRegex = new RegExp(`\\b${programCode}\\b`, "i");
            if (progRegex.test(specialText)) {
                return "special";
            }
        }
    
        // 5️⃣ fallback → General column
        return "general";
    },
    

    // ⭐ PRIVATE — inherit rate from parent nodes
    inheritRate(item, rateField, findParentWithRateFn) {
        const parent = findParentWithRateFn(item, rateField);

        if (!parent) return null;

        return parent[rateField] || null;
    },

    // ⭐ MAIN ENGINE FUNCTION (UI will call ONLY this)
    getDutyRate(item, exportingCountry, findParentWithRateFn) {

        // 🛡️ SAFETY GUARD (VERY IMPORTANT)
        if (!item) {
            return {
                value: "N/A",
                inherited: false,
                column: "general",
                additionalDuty: null,
                reciprocalTariff: null,
                totalDuty: "N/A"
            };
        }
    
        const rateField = this.getRateColumn(exportingCountry, item, findParentWithRateFn);
    
        let rate = item[rateField];
    
        if (!rate || rate === "" || rate === "N/A") {
            const inheritedRate = this.inheritRate(item, rateField, findParentWithRateFn);
    
            if (inheritedRate) {
                // include overrides and compute totals even for inherited rates
                const overrides = getCountryOverrides(exportingCountry) || {};
                const additional = overrides.additionalDuty ?? null;
                const reciprocal = overrides.reciprocalTariff ?? null;

                const parseNum = (v) => {
                    if (v === null || v === undefined) return NaN;
                    if (typeof v === 'number') return v;
                    const m = String(v).match(/-?\d+(?:\.\d+)?/);
                    return m ? parseFloat(m[0]) : NaN;
                };

                const baseNum = parseNum(inheritedRate);
                const addNum = parseNum(additional);
                const recNum = parseNum(reciprocal);
                const totalNum = Number.isFinite(baseNum) ?
                    (Number.isFinite(addNum) ? baseNum + addNum + (Number.isFinite(recNum) ? recNum : 0) : (Number.isFinite(recNum) ? baseNum + recNum : NaN))
                    : NaN;

                return {
                    value: inheritedRate,
                    inherited: true,
                    column: rateField,
                    additionalDuty: additional,
                    reciprocalTariff: reciprocal,
                    totalDuty: Number.isFinite(totalNum) ? totalNum : "N/A"
                };
            }
    
            return {
                value: "N/A",
                inherited: false,
                column: rateField,
                additionalDuty: null,
                reciprocalTariff: null,
                totalDuty: "N/A"
            };
        }

        // Have a direct rate value — include overrides and compute total
        const overrides = getCountryOverrides(exportingCountry) || {};
        const additional = overrides.additionalDuty ?? null;
        const reciprocal = overrides.reciprocalTariff ?? null;

        const parseNum = (v) => {
            if (v === null || v === undefined) return NaN;
            if (typeof v === 'number') return v;
            const m = String(v).match(/-?\d+(?:\.\d+)?/);
            return m ? parseFloat(m[0]) : NaN;
        };

        const baseNum = parseNum(rate);
        const addNum = parseNum(additional);
        const recNum = parseNum(reciprocal);
        const totalNum = Number.isFinite(baseNum) ?
            (Number.isFinite(addNum) ? baseNum + addNum + (Number.isFinite(recNum) ? recNum : 0) : (Number.isFinite(recNum) ? baseNum + recNum : NaN))
            : NaN;

        return {
            value: rate,
            inherited: false,
            column: rateField,
            additionalDuty: additional,
            reciprocalTariff: reciprocal,
            totalDuty: Number.isFinite(totalNum) ? totalNum : "N/A"
        };
    }
};