import {
	$,
	on
} from './util.dom.js';
import 'emoji-picker-element';
const addEmojiPickerStyles = () => {
	if (document.querySelector('#emoji-picker-styles')) return;
	const style = document.createElement('style');
	style.id = 'emoji-picker-styles';
	style.textContent = `emoji-picker{--background:#fff;--border-color:rgba(0,0,0,0.1);--border-radius:10px;--emoji-padding:0.4rem;--category-emoji-size:1.2rem;--font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;position:absolute;bottom:60px;left:22px;z-index:5;box-shadow:0 3px 12px rgba(0,0,0,0.15);animation:emoji-panel-fade-in 0.18s;width:320px;display:none}@keyframes emoji-panel-fade-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
	document.head.appendChild(style)
};
export function setupEmojiPicker({
	btnSelector = '.chat-emoji-btn',
	inputSelector = '.input-message-input'
} = {}) {
	const btn = $(btnSelector);
	const input = $(inputSelector);
	if (!btn || !input) return;
	try {
		addEmojiPickerStyles();
		const oldPicker = $('emoji-picker', btn.parentNode);
		if (oldPicker) oldPicker.remove();
		const picker = document.createElement('emoji-picker');
		picker.style.display = 'none';
		btn.parentNode.style.position = 'relative';
		btn.parentNode.appendChild(picker);
		picker.addEventListener('emoji-click', event => {
			insertEmoji(input, event.detail.unicode);
			picker.style.display = 'none'
		});
		on(btn, 'click', (ev) => {
			ev.stopPropagation();
			picker.style.display = picker.style.display === 'none' ? 'block' : 'none'
		});
		on(document, 'click', (ev) => {
			if (!picker.contains(ev.target) && ev.target !== btn) {
				picker.style.display = 'none'
			}
		});
		console.log('Emoji picker initialized successfully')
	} catch (error) {
		console.error('Failed to initialize emoji picker:', error)
	}
}

function insertEmoji(input, emoji) {
	input.focus();
	if (document.getSelection && window.getSelection) {
		let sel = window.getSelection();
		if (!sel.rangeCount) return;
		let range = sel.getRangeAt(0);
		range.deleteContents();
		range.insertNode(document.createTextNode(emoji));
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range)
	} else {
		input.innerText += emoji
	}
	input.dispatchEvent(new Event('input'))
}