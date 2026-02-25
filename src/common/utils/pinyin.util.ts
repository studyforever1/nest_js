import pinyin from 'pinyin';

/**
 * 获取中文字符串的拼音首字母（大写）
 * @param str 中文字符串
 */
export function getPinyinInitials(str: string): string {
  if (!str) return '';

  // 去掉首尾空格
  const cleanStr = str.trim();

  // 获取首字母
  const result = pinyin(cleanStr, {
    style: pinyin.STYLE_FIRST_LETTER, // 只取首字母
    heteronym: false,                 // 不考虑多音字，取第一个读音
    segment: true,                    // 分词，对中文拼音更准确
  })
    .flat()
    .map(s => s.toUpperCase())         // 每个首字母大写
    .join('');

  return result;
}