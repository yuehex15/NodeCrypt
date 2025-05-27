// 导入 NodeCrypt 模块（加密功能模块）
// Import the NodeCrypt module (used for encryption)
import './NodeCrypt.js';

// 从 util.image.js 中导入设置图片发送的函数
// Import setupImageSend function from util.image.js
import {
	setupImageSend
} from './util.image.js';

// 从 util.emoji.js 中导入设置表情选择器的函数
// Import setupEmojiPicker function from util.emoji.js
import {
	setupEmojiPicker
} from './util.emoji.js';

// 从 util.settings.js 中导入设置面板的功能函数
// Import functions for settings panel from util.settings.js
import {
	openSettingsPanel,   // 打开设置面板 / Open settings panel
	closeSettingsPanel,  // 关闭设置面板 / Close settings panel
	initSettings,         // 初始化设置 / Initialize settings
	notifyMessage         // 通知信息提示 / Display notification message
} from './util.settings.js';

// 从 util.dom.js 中导入常用 DOM 操作函数
// Import common DOM manipulation functions from util.dom.js
import {
	$,         // 简化的 document.querySelector / Simplified selector
	$id,       // document.getElementById 的简写 / Shortcut for getElementById
	removeClass // 移除类名 / Remove a CSS class
} from './util.dom.js';

// 从 room.js 中导入房间管理相关变量和函数
// Import room-related variables and functions from room.js
import {
	roomsData,         // 当前所有房间的数据 / Data of all rooms
	activeRoomIndex,   // 当前激活的房间索引 / Index of the active room
	joinRoom           // 加入房间的函数 / Function to join a room
} from './room.js';

// 从 chat.js 中导入聊天功能相关的函数
// Import chat-related functions from chat.js
import {
	addMsg,               // 添加普通消息到聊天窗口 / Add a normal message to chat
	addSystemMsg,         // 添加系统消息 / Add a system message
	setupImagePreview,    // 设置图片预览功能 / Setup image preview
	setupInputPlaceholder // 设置输入框的占位提示 / Setup placeholder for input box
} from './chat.js';

// 从 ui.js 中导入 UI 界面相关的功能
// Import user interface functions from ui.js
import {	renderUserList,       // 渲染用户列表 / Render user list
	renderMainHeader,     // 渲染主标题栏 / Render main header
	setupMoreBtnMenu,     // 设置更多按钮的下拉菜单 / Setup "more" button menu
	preventSpaceInput,    // 防止输入空格 / Prevent space input in form fields
	loginFormHandler,     // 登录表单提交处理器 / Login form handler
	openLoginModal,       // 打开登录窗口 / Open login modal
	setupTabs,            // 设置页面标签切换 / Setup tab switching
	autofillRoomPwd,      // 自动填充房间密码 / Autofill room password
	generateLoginForm,    // 生成登录表单HTML / Generate login form HTML
	initLoginForm         // 初始化登录表单 / Initialize login form
} from './ui.js';

// 设置全局配置参数
// Set global configuration parameters
window.config = {
	wsAddress: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`, // WebSocket 服务器地址 / WebSocket server address
	debug: true                       // 是否开启调试模式 / Enable debug mode
};

// 把一些函数挂载到 window 对象上供其他模块使用
// Expose functions to the global window object for accessibility
window.addSystemMsg = addSystemMsg;
window.joinRoom = joinRoom;
window.notifyMessage = notifyMessage;
window.setupEmojiPicker = setupEmojiPicker;

// 当 DOM 内容加载完成后执行初始化逻辑
// Run initialization logic when the DOM content is fully loaded
window.addEventListener('DOMContentLoaded', () => {
	// 初始化登录表单 / Initialize login form
	initLoginForm();

	const loginForm = $id('login-form');               // 登录表单 / Login form

	if (loginForm) {
		// 监听登录表单提交事件 / Listen to login form submission
		loginForm.addEventListener('submit', loginFormHandler(null))
	}

	const joinBtn = $('.join-room'); // 加入房间按钮 / Join room button
	if (joinBtn) {
		joinBtn.onclick = openLoginModal; // 点击打开登录窗口 / Click to open login modal
	}

	// 阻止用户输入用户名、房间名和密码时输入空格
	// Prevent space input for username, room name, and password fields
	preventSpaceInput($id('userName'));
	preventSpaceInput($id('roomName'));
	preventSpaceInput($id('password'));

	// 初始化辅助功能和界面设置
	// Initialize autofill, input placeholders, and menus
	autofillRoomPwd();
	setupInputPlaceholder();
	setupMoreBtnMenu();
	setupImagePreview();
	setupEmojiPicker();
	initSettings();

	const settingsBtn = $id('settings-btn'); // 设置按钮 / Settings button
	if (settingsBtn) {
		settingsBtn.onclick = (e) => {
			e.stopPropagation();  // 阻止事件冒泡 / Stop event from bubbling
			openSettingsPanel(); // 打开设置面板 / Open settings panel
		}
	}

	// 点击其他地方时关闭设置面板
	// Close settings panel when clicking outside
	document.addEventListener('click', (ev) => {
		const panel = $id('settings-panel');
		if (panel && panel.style.display === 'block') {
			const card = panel.querySelector('.settings-panel-card');
			if (card && !card.contains(ev.target) && ev.target.id !== 'settings-btn') {
				closeSettingsPanel();
			}
		}
	});

	const input = document.querySelector('.input-message-input'); // 消息输入框 / Message input box
	if (input) {
		input.focus(); // 自动聚焦 / Auto focus
		input.addEventListener('keydown', (e) => {
			// 按下 Enter 键并且不按 Shift，表示发送消息
			// Pressing Enter (without Shift) sends the message
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				const text = input.innerText.trim(); // 获取输入的文本 / Get input text
				const rd = roomsData[activeRoomIndex]; // 当前房间数据 / Current room data
				if (text && rd && rd.chat) {
					if (rd.privateChatTargetId) {
						// 私聊消息加密并发送
						// Encrypt and send private message
						const targetClient = rd.chat.channel[rd.privateChatTargetId];
						if (targetClient && targetClient.shared) {
							const clientMessagePayload = {
								a: 'm',
								t: 'text_private',
								d: text
							};
							const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
							const serverRelayPayload = {
								a: 'c',
								p: encryptedClientMessage,
								c: rd.privateChatTargetId
							};
							const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
							rd.chat.sendMessage(encryptedMessageForServer);
							addMsg(text, false, 'text_private');
						} else {
							addSystemMsg(`Cannot send private message to ${rd.privateChatTargetName}.User might not be fully connected.`)
						}
					} else {
						// 公共频道消息发送
						// Send public message
						rd.chat.sendChannelMessage('text', text);
						addMsg(text);
					}
					// 清空输入框并触发 input 事件
					// Clear input and trigger input event
					input.innerText = '';
					input.dispatchEvent(new Event('input'));
				}
			}
		});
	}

	// 设置发送图片功能
	// Setup image sending functionality
	setupImageSend({
		inputSelector: '.input-message-input', // 消息输入框选择器 / Message input selector
		attachBtnSelector: '.chat-attach-btn', // 附件按钮选择器 / Attach button selector
		fileInputSelector: '.new-message-wrapper input[type="file"]', // 文件输入框选择器 / File input selector
		onSend: (dataUrl) => {
			const rd = roomsData[activeRoomIndex];
			if (rd && rd.chat) {
				if (rd.privateChatTargetId) {
					// 私聊图片加密并发送
					// Encrypt and send private image
					const targetClient = rd.chat.channel[rd.privateChatTargetId];
					if (targetClient && targetClient.shared) {
						const clientMessagePayload = {
							a: 'm',
							t: 'image_private',
							d: dataUrl
						};
						const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
						const serverRelayPayload = {
							a: 'c',
							p: encryptedClientMessage,
							c: rd.privateChatTargetId
						};
						const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
						rd.chat.sendMessage(encryptedMessageForServer);
						addMsg(dataUrl, false, 'image_private');
					} else {
						addSystemMsg(`Cannot send private image to ${rd.privateChatTargetName}.User might not be fully connected.`)
					}
				} else {
					// 公共频道发送图片
					// Send image to public channel
					rd.chat.sendChannelMessage('image', dataUrl);
					addMsg(dataUrl, false, 'image');
				}
			}
		}
	});

	// 判断是否为移动端
	// Check if the device is mobile
	const isMobile = () => window.innerWidth <= 768;

	// 渲染主界面元素
	// Render main UI elements
	renderMainHeader();
	renderUserList();
	setupTabs();

	const roomList = $id('room-list');
	const sidebar = $id('sidebar');
	const rightbar = $id('rightbar');
	const sidebarMask = $id('mobile-sidebar-mask');
	const rightbarMask = $id('mobile-rightbar-mask');

	// 在移动端点击房间列表后关闭侧边栏
	// On mobile, clicking room list closes sidebar
	if (roomList) {
		roomList.addEventListener('click', () => {
			if (isMobile()) {
				sidebar?.classList.remove('mobile-open');
				sidebarMask?.classList.remove('active');
			}
		});
	}

	// 在移动端点击成员标签后关闭右侧面板
	// On mobile, clicking member tabs closes right panel
	const memberTabs = $id('member-tabs');
	if (memberTabs) {
		memberTabs.addEventListener('click', () => {
			if (isMobile()) {
				removeClass(rightbar, 'mobile-open');
				removeClass(rightbarMask, 'active');
			}
		});
	}
});
