// Escape HTML special characters
// 转义 HTML 特殊字符
export function escapeHTML(str) {
	if (typeof str !== 'string') return '';
	return str.replace(/[&<>"']/g, function(c) {
		return {
			'&': '&amp;', // & to &amp;  // & 转为 &amp;
			'<': '&lt;',   // < to &lt;  // < 转为 &lt;
			'>': '&gt;',   // > to &gt;  // > 转为 &gt;
			'"': '&quot;', // " to &quot; // " 转为 &quot;
			'\'': '&#39;'  // ' to &#39;  // ' 转为 &#39;
		} [c]
	})
}
// Convert text to HTML, preserving line breaks
// 将文本转换为 HTML，保留换行符
export function textToHTML(text) {
	if (typeof text !== 'string') return '';
	return escapeHTML(text).replace(/\n/g, '<br>')
}