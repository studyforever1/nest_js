// src/modules/sj-config/utils/format-raw.util.ts

import { SjRawMaterial } from '../../sj-raw-material/entities/sj-raw-material.entity';

export function formatRaw(raw: SjRawMaterial) {
  const { id, category, name, origin, remark, inventory, composition } = raw;

  // composition 为空时直接返回基本字段
  if (!composition) {
    return { id, category, name, origin, remark, inventory };
  }

  const {
    TFe = null,
    H2O = null,
    烧损 = null,
    价格 = null,
    ...otherComposition
  } = composition as Record<string, any>;

  return {
    id,
    category,
    name,
    TFe,
    ...otherComposition,
    H2O,
    烧损,
    价格,
    inventory,
    origin,
    remark,
    
  };
}
