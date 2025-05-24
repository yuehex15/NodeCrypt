// Import DOM utility functions
// 导入 DOM 工具函数
import {
	$,
	$$,
	$id,
	createElement,
	on,
	off,
	addClass,
	removeClass
} from './util.dom.js';
// Default settings
// 默认设置
const DEFAULT_SETTINGS = {
	notify: false,
	sound: false
};

// Load settings from localStorage
// 从 localStorage 加载设置
function loadSettings() {
	let s = localStorage.getItem('settings');
	try {
		s = s ? JSON.parse(s) : {}
	} catch {
		s = {}
	}
	return {
		...DEFAULT_SETTINGS,
		...s
	}
}

// Save settings to localStorage
// 保存设置到 localStorage
function saveSettings(settings) {
	const {
		notify,
		sound
	} = settings;
	localStorage.setItem('settings', JSON.stringify({
		notify,
		sound
	}))
}

// Apply settings to the document
// 应用设置到文档
function applySettings(settings) {
	document.documentElement.lang = 'en'
}

// Ask for browser notification permission
// 请求浏览器通知权限
function askNotificationPermission(callback) {
	if (Notification.requestPermission.length === 0) {
		Notification.requestPermission().then(callback)
	} else {
		Notification.requestPermission(callback)
	}
}

// Setup the settings panel UI
// 设置设置面板 UI
function setupSettingsPanel() {
	let panel = $id('settings-panel');
	if (!panel) {
		panel = createElement('div', {
			id: 'settings-panel',
			class: 'settings-panel'
		}, `<div class="settings-panel-card"><div class="settings-title">Settings</div><div class="settings-item"><span>Desktop Notification</span><label class="switch"><input type="checkbox"id="settings-notify"><span class="slider"></span></label></div><div class="settings-item"><span>Sound Notification</span><label class="switch"><input type="checkbox"id="settings-sound"><span class="slider"></span></label></div></div>`);
		document.body.appendChild(panel)
	}
	const settings = loadSettings();
	const notifyCheckbox = $('#settings-notify', panel);
	const soundCheckbox = $('#settings-sound', panel);
	if (notifyCheckbox) notifyCheckbox.checked = !!settings.notify;
	if (soundCheckbox) soundCheckbox.checked = !!settings.sound;
	on(notifyCheckbox, 'change', e => {
		const checked = e.target.checked;
		if (checked) {
			if (!('Notification' in window)) {
				alert('Notifications are not supported by your browser.');
				e.target.checked = false;
				return
			}
			askNotificationPermission(permission => {
				if (permission === 'granted') {
					settings.notify = true;
					settings.sound = false;
					if (soundCheckbox) soundCheckbox.checked = false;
					saveSettings(settings);
					applySettings(settings);
					// 防止重复通知，添加一个标志位
					if (!panel._notificationShown) {
						new Notification('Notifications enabled', {
							body: 'You will receive alerts here.'
						});
						panel._notificationShown = true; // 设置标志位
					}
				} else {
					settings.notify = false;
					e.target.checked = false;
					saveSettings(settings);
					applySettings(settings);
					alert('Please allow notifications in your browser settings.')
				}
			})
		} else {
			settings.notify = false;
			saveSettings(settings);
			applySettings(settings);
			// 重置标志位
			if (panel._notificationShown) {
				panel._notificationShown = false;
			}
		}
	});
	on(soundCheckbox, 'change', e => {
		settings.sound = e.target.checked;
		if (settings.sound) {
			settings.notify = false;
			if (notifyCheckbox) notifyCheckbox.checked = false;
		}
		saveSettings(settings);
		applySettings(settings)
	});
}

// Open the settings panel
// 打开设置面板
function openSettingsPanel() {
	setupSettingsPanel();
	const panel = $id('settings-panel');
	const btn = $id('settings-btn');
	if (!btn || !panel) return;
	if (panel.style.display === 'block') return;
	const btnRect = btn.getBoundingClientRect();
	panel.style.display = 'block';
	const card = $('.settings-panel-card', panel);
	if (!card) return;
	card.style.position = 'fixed';
	card.style.left = btnRect.left + 'px';
	card.style.top = (btnRect.bottom + 8) + 'px';
	card.style.transform = 'translateX(0)';
	removeClass(card, 'close-anim');
	// 强制触发重绘，然后添加打开动画
	card.offsetHeight; // 强制重绘
	addClass(card, 'open-anim');
}

// Close the settings panel
// 关闭设置面板
function closeSettingsPanel() {
	const panel = $id('settings-panel');
	if (!panel) return;
	const card = $('.settings-panel-card', panel);
	if (!card) return;
	removeClass(card, 'open-anim');
	addClass(card, 'close-anim');
	setTimeout(() => {
		panel.style.display = 'none';
		removeClass(card, 'close-anim')
	}, 300)
}

// Initialize settings on page load
// 页面加载时初始化设置
function initSettings() {
	const settings = loadSettings();
	applySettings(settings)
}

// Maximum notification text length
// 通知文本最大长度
const MAX_NOTIFY_TEXT_LEN = 100;

// Truncate text for notifications
// 截断通知文本
function truncateText(text) {
	return text.length > MAX_NOTIFY_TEXT_LEN ? text.slice(0, MAX_NOTIFY_TEXT_LEN) + '...' : text
}

// Play sound notification
// 播放声音通知
function playSoundNotification() {
	try {
		const ctx = new(window.AudioContext || window.webkitAudioContext)();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = 1000;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
		setTimeout(() => {
			osc.stop();
			ctx.close()
		}, 600)
	} catch (e) {
		console.error('Sound notification failed', e)
	}
}

// Show desktop notification
// 显示桌面通知
function showDesktopNotification(roomName, text, msgType, sender) {
	if (!('Notification' in window) || Notification.permission !== 'granted') return;
	let body;
	const senderPrefix = sender ? `${sender}:` : '';
	if (msgType === 'image' || msgType === 'private image') {
		body = `${senderPrefix}[image]`;
		if (msgType === 'private image') {
			body = `(Private)${body}`
		}
	} else if (msgType === 'text' || msgType === 'private text') {
		body = `${senderPrefix}${truncateText(text)}`;
		if (msgType === 'private text') {
			body = `(Private)${body}`
		}
	} else {
		body = truncateText(text)
	}
	new Notification(`#${roomName}`, {
		body
	})
}

// Notify message entry point
// 通知消息主入口
export function notifyMessage(roomName, msgType, text, sender) {
	const settings = loadSettings();
	if (settings.notify) {
		showDesktopNotification(roomName, text, msgType, sender)
	} else if (settings.sound) {
		playSoundNotification()
	}
}
export {
	openSettingsPanel,
	closeSettingsPanel,
	initSettings
};