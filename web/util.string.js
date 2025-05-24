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


