export function escapeHTML(str) {
	if (typeof str !== 'string') return '';
	return str.replace(/[&<>"']/g, function(c) {
		return {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			'\'': '&#39;'
		} [c]
	})
}
export function textToHTML(text) {
	if (typeof text !== 'string') return '';
	return escapeHTML(text).replace(/\n/g, '<br>')
}