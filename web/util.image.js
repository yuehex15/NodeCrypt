import {
	$,
	on,
	createElement
} from './util.dom.js';
export async function processImage(file, callback) {
	const img = new Image();
	img.onload = function() {
		const maxW = 1280,
			maxH = 1280;
		let w = img.naturalWidth,
			h = img.naturalHeight;
		if (w > maxW || h > maxH) {
			const scale = Math.min(maxW / w, maxH / h);
			w = Math.round(w * scale);
			h = Math.round(h * scale)
		}
		const canvas = createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0, w, h);
		let dataUrl;
		dataUrl = canvas.toDataURL('image/webp', 0.80);
		callback(dataUrl)
	};
	const reader = new FileReader();
	reader.onload = function(e) {
		img.src = e.target.result
	};
	reader.readAsDataURL(file)
}

function t(key) {
	const messages = {
		tooLarge: 'Image is too large (over 5MB)',
	};
	return messages[key] || key
}
export function setupImageSend({
	inputSelector,
	attachBtnSelector,
	fileInputSelector,
	onSend
}) {
	const input = $(inputSelector);
	const attachBtn = $(attachBtnSelector);
	const fileInput = $(fileInputSelector);
	if (fileInput) fileInput.setAttribute('accept', 'image/*');
	if (attachBtn && fileInput) {
		on(attachBtn, 'click', () => fileInput.click());
		on(fileInput, 'change', async function() {
			if (!fileInput.files || !fileInput.files.length) return;
			const file = fileInput.files[0];
			if (!file.type.startsWith('image/')) return;
			if (file.size > 5 * 1024 * 1024) {
				alert(t('tooLarge'));
				return
			}
			processImage(file, (dataUrl) => {
				if (typeof onSend === 'function') onSend(dataUrl)
			});
			fileInput.value = ''
		})
	}
	if (input) {
		on(input, 'paste', function(e) {
			if (!e.clipboardData) return;
			for (const item of e.clipboardData.items) {
				if (item.type.startsWith('image/')) {
					const file = item.getAsFile();
					if (!file) continue;
					if (file.size > 5 * 1024 * 1024) {
						alert(t('tooLarge'));
						continue
					}
					processImage(file, (dataUrl) => {
						if (typeof onSend === 'function') onSend(dataUrl)
					});
					e.preventDefault();
					break
				}
			}
		})
	}
}