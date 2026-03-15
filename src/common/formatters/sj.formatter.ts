
const mainParamUnitMap: Record<string, string> = {
  成本: '成本(元/t)',
  吨度价: '吨度价',
  干基总消耗: '干基总消耗(t/t)',
  干基总残存: '干基总残存(%)',
  预测烧结烟气含流量: '预测烧结烟气含流量(mg/Nm3)',
};

export const chemicalOrder = [
  'TFe', 'SiO2', 'CaO', 'MgO', 'Al2O3', 'P', 'S', 'TiO2', 'K2O', 'Na2O', 'Zn', 'As', 'Pb', 'V2O5', 'R2', '镁铝比',
];

export const sjMainParamOrder = [
  '成本(元/t)', '吨度价', '干基总消耗(t/t)', '干基总残存(%)', '预测烧结烟气含流量(mg/Nm3)',
];

export function sortChemical(chem: Record<string, any>) {
  const sorted: Record<string, number> = {};
  chemicalOrder.forEach(key => {
    sorted[key] = Number(chem?.[key]) || 0;
  });
  return sorted;
}

export function formatSJResultFull(
  result: any,
  idNameMap?: Record<string, string>,
  idCategoryMap?: Record<string, string>,
  ingredientLimits?: Record<string, any>,
  chemicalLimits?: Record<string, any>,
  options?: { onlySort?: boolean } // 新增
) {
  const mapped: Record<string, any> = { ...result };

  // ================= 原料配比 =================
  if (result["原料配比"] && idNameMap && idCategoryMap && ingredientLimits) {
    const entries = Object.entries(result["原料配比"]);

    const getPriority = (id: string) => {
      const category = idCategoryMap[id] || '';
      if (category.startsWith('T')) return 1;
      if (category.startsWith('X')) return 2;
      if (category.startsWith('R')) return 3;
      if (category.startsWith('F')) return 4;
      return 5;
    };

    entries.sort(([idA], [idB]) => {
      const pA = getPriority(idA), pB = getPriority(idB);
      if (pA !== pB) return pA - pB;
      const catA = idCategoryMap[idA] || '';
      const catB = idCategoryMap[idB] || '';
      if (catA !== catB) return catA.localeCompare(catB);
      return Number(idA) - Number(idB);
    });

    const newMix: Record<string, any> = {};
    entries.forEach(([code, val], index) => {
      const rawValue = typeof val === 'object' && val !== null && 'value' in val ? val.value : val;

      // 仅排序模式也保留已有值
      const numValue = rawValue != null ? Number(rawValue) : null;
      const ratio = numValue != null ? Math.round(numValue * 100) / 100 : null;
      const limits = ingredientLimits?.[code] || {};
      newMix[code] = {
        ...(typeof val === 'object' && val !== null ? val : {}),
        name: idNameMap?.[code] || limits.name || code,
        value: ratio,
        sortIndex: index + 1,
        low_limit: !options?.onlySort ? (limits.low_limit ?? null) : undefined,
        top_limit: !options?.onlySort ? (limits.top_limit ?? null) : undefined,
      };
    });
    mapped["原料配比"] = newMix;
  }

  // ================= 化学成分 =================
  if (result["化学成分"]) {
    const chem: Record<string, any> = {};
    chemicalOrder.forEach(key => {
      const val = result["化学成分"][key];

      if (val != null) {
        if (typeof val === 'object' && val !== null && 'value' in val) {
          chem[key] = val;
        } else if (!options?.onlySort) {
          const numValue = val != null ? Math.round(Number(val) * 1000) / 1000 : null;
          chem[key] = {
            value: numValue,
            low_limit: chemicalLimits?.[key]?.low_limit ?? null,
            top_limit: chemicalLimits?.[key]?.top_limit ?? null,
          };
        } else {
          // 仅排序模式：保留原始值
          chem[key] = val;
        }
      }
    });
    mapped["化学成分"] = chem;
  }

  // ================= 主要参数 =================
  if (result["主要参数"]) {
    const mainParams: Record<string, any> = {};
    Object.keys(result["主要参数"]).forEach(key => {
      const newKey = mainParamUnitMap[key] || key;
      mainParams[newKey] = result["主要参数"][key];
    });

    const sortedMain: Record<string, any> = {};
    sjMainParamOrder.forEach(key => {
      if (mainParams[key] !== undefined) sortedMain[key] = mainParams[key];
    });

    Object.keys(mainParams).forEach(key => {
      if (!sortedMain.hasOwnProperty(key)) sortedMain[key] = mainParams[key];
    });

    mapped["主要参数"] = sortedMain;
  }

  return mapped;
}


export function sortSJResult(result: any) {
  const mapped: Record<string, any> = { ...result };

  /** ================= 化学成分排序 ================= */
  if (mapped["化学成分"]) {
    const sorted: Record<string, any> = {};
    chemicalOrder.forEach(key => {
      if (mapped["化学成分"][key] !== undefined) {
        sorted[key] = mapped["化学成分"][key];
      }
    });
    mapped["化学成分"] = sorted;
  }

  /** ================= 主要参数排序 ================= */
  if (mapped["主要参数"]) {
    const mainParams: Record<string, any> = {};

    Object.keys(mapped["主要参数"]).forEach(key => {
      const newKey = mainParamUnitMap[key] || key;
      let value = mapped["主要参数"][key];

      // ✅ 干基总残存保留2位小数
      if (newKey === "干基总残存(%)" && value != null) {
        value = Math.round(Number(value) * 100) / 100;
      }

      mainParams[newKey] = value;
    });

    const sortedMain: Record<string, any> = {};

    sjMainParamOrder.forEach(key => {
      if (mainParams[key] !== undefined) {
        sortedMain[key] = mainParams[key];
      }
    });

    Object.keys(mainParams).forEach(key => {
      if (!sortedMain.hasOwnProperty(key)) {
        sortedMain[key] = mainParams[key];
      }
    });

    mapped["主要参数"] = sortedMain;
  }

  return mapped;
}