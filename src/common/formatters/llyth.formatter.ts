// gl.formatter.ts

// ================= 常量 =================
const mainUnitMap: Record<string, string> = {
  综合入炉品位: '综合入炉品位(%)',
  吨材毛利润: '吨材毛利润(元/t)',
  本月毛利: '本月毛利(亿元/月)',
  边际效益: '边际效益(亿元/月)',
  吨铁成本: '吨铁成本(元/t)',
  铁水日产: '铁水日产(t/d)',
  吨钢成本: '吨钢成本(元/t)',
  钢坯日产: '钢坯日产(t/d)',
  吨坯毛利润: '吨坯毛利润(元/t)',
  吨材成本: '吨材成本(元/t)',
  带钢日产: '带钢日产(t/d)',
  矿耗: '矿耗(t/t)',
  燃料比: '燃料比(kg/t)',
  焦比: '焦比(t/t)',
  综合焦比: '综合焦比(t/t)',
  煤比: '煤比(t/t)',
};


const fixedLoadOrder = ['S负荷', 'P负荷', 'Mn负荷', '碱金属负荷', 'Zn负荷', 'Ti负荷'];
const fixedIronOrder = ['P', 'Ti', 'Mn', 'Pb', 'Cr', 'Ni'];
const fixedSlagOrder = ['FeO', 'CaO', 'SiO2', 'MgO', 'Al2O3', 'S', 'TiO2', 'MnO', 'R2', 'R3', 'R4', '镁铝比', '总渣量'];

// ================= 工具函数 =================
function extractMaterialNames(materials: Record<string, any>) {
  return Object.values(materials).map((m: any) => m?.name).filter(Boolean);
}

function buildLLYTHMainOrder(rawNames: string[], fuelNames: string[]) {
  const order: string[] = [];
  order.push('综合入炉品位(%)');
  order.push('吨材毛利润(元/t)');
  order.push('本月毛利(亿元/月)');
  order.push('边际效益(亿元/月)');
  rawNames.forEach(name => {
    order.push(`${name}(%)`)
  });

  rawNames.forEach(name => {
    order.push(`${name}矿耗(t/t)`);
  });

  order.push('吨铁成本(元/t)');
  order.push('铁水日产(t/d)');
  order.push('吨钢成本(元/t)');
  order.push('钢坯日产(t/d)');
  order.push('吨坯毛利润(元/t)');
  order.push('吨材成本(元/t)');
  order.push('吨钢成本(元/t)');
  order.push('带钢日产(t/d)');
  order.push('矿耗(t/t)', '燃料比(kg/t)', '综合焦比(t/t)', '焦比(t/t)');
  fuelNames.forEach(name => {
    order.push(`${name}(%)`);
  });

  fuelNames.forEach(name => {
    order.push(`${name}矿耗(t/t)`);
  });
  order.push('煤比(t/t)');
  return order;
}

function sortByOrder(source: Record<string, any>, order: string[]) {
  const sorted: Record<string, any> = {};
  order.forEach(key => {
    if (source?.[key] !== undefined) sorted[key] = source[key];
  });
  Object.keys(source || {}).forEach(key => {
    if (!(key in sorted)) sorted[key] = source[key];
  });
  return sorted;
}

function sortMainParameters(params: Record<string, any>, order: string[]) {
  const sorted: Record<string, any> = {};
  order.forEach(key => {
    if (params?.[key] !== undefined) sorted[key] = params[key];
  });
  Object.keys(params || {}).forEach(key => {
    if (!(key in sorted)) sorted[key] = params[key];
  });
  return sorted;
}

// ================= 排序整个方案 =================
export function sortLLYTHResult(scheme: any) {
  // 提取原料和燃料的矿耗数据
  const raw = scheme["原料配比和矿耗"] || {};
  const fuel = scheme["燃料配比和矿耗"] || {};

  // 获取原料和燃料的名字
  const rawNames = Object.entries(raw).map(([id, val]: [string, any]) => val.name);
  const fuelNames = Object.entries(fuel).map(([id, val]: [string, any]) => val.name);

  // 构建主要参数排序的顺序
  const mainParamOrder = buildLLYTHMainOrder(rawNames, fuelNames);

  // 返回排序后的结果
  return {
    ...scheme,
    主要参数: sortMainParameters(scheme["主要参数"] || {}, mainParamOrder),
    负荷: sortByOrder(scheme["负荷"] || {}, fixedLoadOrder),
    铁水含量: sortByOrder(scheme["铁水含量"] || {}, fixedIronOrder),
    炉渣成分: sortByOrder(scheme["炉渣成分"] || {}, fixedSlagOrder),
  };
}

// ================= 完整格式化 =================
export function formatLLYTHResultFull(
  result: any,
  ingredientNameMap: Record<string, any>,
  fuelNameMap: Record<string, any>,
  rawLimits?: Record<string, any>,
  fuelLimits?: Record<string, any>,
  loadTopLimits?: Record<string, any>,
  ironWaterTopLimits?: Record<string, any>,
  slagLimits?: Record<string, any>,
) {
  const mapped: Record<string, any> = { ...result };

  // 原料配比和矿耗
  if (result["原料配比和矿耗"]) {
    const newRaw: Record<string, any> = {};
    Object.entries(result["原料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
      if (val?.矿耗 != null && val?.value != null) {
        const limits = rawLimits?.[id] || {};
        newRaw[id] = {
          name: ingredientNameMap[id],
          value: val?.value ?? '--',
          矿耗: val?.矿耗 ?? 0,
          日消耗: val?.日消耗 ?? 0,
          可用天数: val?.可用天数 ?? 0,
          low_limit: limits.low_limit ?? 0,
          top_limit: limits.top_limit ?? 100
        };
      }
    });
    mapped["原料配比和矿耗"] = newRaw;
  }

  // 燃料配比和矿耗
  if (result["燃料配比和矿耗"]) {
    const newFuel: Record<string, any> = {};
    Object.entries(result["燃料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
      const limits = fuelLimits?.[id] || {};
      newFuel[id] = {
        name: fuelNameMap[id],
        value: val?.value ?? '--',
        矿耗: val?.矿耗 ?? 0,
        日消耗: val?.日消耗 ?? 0,
        可用天数: val?.可用天数 ?? 0,
        low_limit: limits.low_limit ?? 0,
        top_limit: limits.top_limit ?? 100
      };
    });
    mapped["燃料配比和矿耗"] = newFuel;
  }

  // 主要参数
  if (result["主要参数"]) {
    const main = result["主要参数"];
    const raw = mapped["原料配比和矿耗"] || {};
    const fuel = mapped["燃料配比和矿耗"] || {};
    const newMain: Record<string, any> = {};

    // 主要参数格式化
    if (main.综合入炉品位 != null) newMain[mainUnitMap['综合入炉品位']] = main.综合入炉品位;
    if (main.吨材毛利润 != null) newMain[mainUnitMap['吨材毛利润']] = main.吨材毛利润;
    if (main.本月毛利 != null) newMain[mainUnitMap['本月毛利']] = main.本月毛利;
    if (main.边际效益 != null) newMain[mainUnitMap['边际效益']] = main.边际效益;

    // 原料相关
    Object.values(raw).forEach((r: any) => {
      if (r?.name && r?.value != null) newMain[`${r.name}(%)`] = r.value;
    });
    Object.values(raw).forEach((r: any) => {
      if (r?.name && r?.矿耗 != null) newMain[`${r.name}矿耗(t/t)`] = r.矿耗;
    });
    // 4️⃣ 固定中部字段
    if (main.吨铁成本 != null) newMain[mainUnitMap['吨铁成本']] = main.吨铁成本;
    if (main.铁水日产 != null) newMain[mainUnitMap['铁水日产']] = main.铁水日产;
    if (main.吨钢成本 != null) newMain[mainUnitMap['吨钢成本']] = main.吨钢成本;
    if (main.钢坯日产 != null) newMain[mainUnitMap['钢坯日产']] = main.钢坯日产;
    if (main.吨坯毛利润 != null) newMain[mainUnitMap['吨坯毛利润']] = main.吨坯毛利润;
    if (main.吨材成本 != null) newMain[mainUnitMap['吨材成本']] = main.吨材成本;
    if (main.带钢日产 != null) newMain[mainUnitMap['带钢日产']] = main.带钢日产;
    if (main.矿耗 != null) newMain[mainUnitMap["矿耗"]] = main.矿耗;

    // 燃料相关
    // 7️⃣ 燃料比 / 焦比 / 综合焦比
    if (main.燃料比 != null) newMain[mainUnitMap['燃料比']] = main.燃料比;
    if (main.焦比 != null) newMain[mainUnitMap['焦比']] = main.焦比;
    if (main.综合焦比 != null) newMain[mainUnitMap['综合焦比']] = main.综合焦比;


    Object.values(fuel).forEach((f: any) => {
      if (f?.name && f?.value != null) newMain[`${f.name}(%)`] = f.value;
    });
    Object.values(fuel).forEach((f: any) => {
      if (f?.name && f?.矿耗 != null) newMain[`${f.name}矿耗(t/t)`] = f.矿耗;
    });

    if (main.煤比 != null) newMain[mainUnitMap["煤比"]] = main.煤比;

    const mainParamOrder = buildLLYTHMainOrder(extractMaterialNames(raw), extractMaterialNames(fuel));
    mapped["主要参数"] = sortMainParameters(newMain, mainParamOrder);
  }

  // 负荷
  if (result["负荷"]) {
    const newLoad: Record<string, any> = {};
    Object.entries(result["负荷"]).forEach(([key, val]) => {
      const top = loadTopLimits?.[key];
      newLoad[key] = { value: val, low_limit: 0, top_limit: top ?? 100 };
    });
    mapped["负荷"] = newLoad;
  }

  // 铁水含量
  if (result["铁水含量"]) {
    const newIron: Record<string, any> = {};
    Object.entries(result["铁水含量"]).forEach(([key, val]) => {
      const top = ironWaterTopLimits?.[key] ?? 100;
      newIron[key] = { value: val, low_limit: 0, top_limit: top };
    });
    mapped["铁水含量"] = newIron;
  }

  // 炉渣成分
  if (result["炉渣成分"]) {
    const newSlag: Record<string, any> = {};
    Object.entries(result["炉渣成分"]).forEach(([key, val]) => {
      const limits = slagLimits?.[key] || {};
      newSlag[key] = { value: val, low_limit: limits.low_limit ?? 0, top_limit: limits.top_limit ?? 100 };
    });
    mapped["炉渣成分"] = newSlag;
  }

  return mapped;
}