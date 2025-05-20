// util.string.js
// 字符串处理工具库

/**
 * HTML转义
 * @param {string} str - 输入字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];
  });
}

/**
 * 将纯文本转换为HTML（包括换行符处理）
 * @param {string} text - 输入文本
 * @returns {string} 格式化的HTML
 */
export function textToHTML(text) {
  if (typeof text !== 'string') return '';
  return escapeHTML(text).replace(/\n/g, '<br>');
}

/**
 * 截断长文本并添加省略号
 * @param {string} text - 输入文本
 * @param {number} [maxLength=100] - 最大长度
 * @returns {string} 截断后的文本
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 生成随机字符串
 * @param {number} [length=8] - 字符串长度
 * @param {string} [chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'] - 字符集
 * @returns {string} 随机字符串
 */
export function randomString(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
}

/**
 * 格式化日期时间
 * @param {Date|number} [date=new Date()] - 日期对象或时间戳
 * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - 格式化模板
 * @returns {string} 格式化后的日期时间
 */
export function formatDate(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (num) => String(num).padStart(2, '0');
  
  return format
    .replace(/YYYY/g, d.getFullYear())
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}
