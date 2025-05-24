import './NodeCrypt.js';
import {
	setupImageSend
} from './util.image.js';
import {
	setupEmojiPicker
} from './util.emoji.js';
import {
	openSettingsPanel,
	closeSettingsPanel,
	initSettings,
	notifyMessage
} from './util.settings.js';
import {
	$,
	$id,
	removeClass
} from './util.dom.js';
import {
	roomsData,
	activeRoomIndex,
	joinRoom
} from './room.js';
import {
	addMsg,
	addSystemMsg,
	setupImagePreview,
	setupInputPlaceholder
} from './chat.js';
import {
	renderUserList,
	renderMainHeader,
	setupMoreBtnMenu,
	preventSpaceInput,
	loginFormHandler,
	openLoginModal,
	setupTabs,
	autofillRoomPwd
} from './ui.js';
window.config = {
	wsAddress: 'wss://crypt.works/ws',
	debug: false
};
window.addSystemMsg = addSystemMsg;
window.joinRoom = joinRoom;
window.notifyMessage = notifyMessage;
window.setupEmojiPicker = setupEmojiPicker;
window.addEventListener('DOMContentLoaded', () => {
	const loginContainer = $id('login-container');
	const chatContainer = $id('chat-container');
	const loginForm = $id('login-form');
	if (loginForm) {
		loginForm.addEventListener('submit', loginFormHandler(null))
	}
	const joinBtn = $('.join-room');
	if (joinBtn) {
		joinBtn.onclick = openLoginModal
	}
	preventSpaceInput($id('userName'));
	preventSpaceInput($id('roomName'));
	preventSpaceInput($id('password'));
	autofillRoomPwd();
	setupInputPlaceholder();
	setupMoreBtnMenu();
	setupImagePreview();
	setupEmojiPicker();
	initSettings();
	const settingsBtn = $id('settings-btn');
	if (settingsBtn) {
		settingsBtn.onclick = (e) => {
			e.stopPropagation();
			openSettingsPanel()
		}
	}
	document.addEventListener('click', (ev) => {
		const panel = $id('settings-panel');
		if (panel && panel.style.display === 'block') {
			const card = panel.querySelector('.settings-panel-card');
			if (card && !card.contains(ev.target) && ev.target.id !== 'settings-btn') {
				closeSettingsPanel()
			}
		}
	});
	const input = document.querySelector('.input-message-input');
	if (input) {
		input.focus();
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				const text = input.innerText.trim();
				const rd = roomsData[activeRoomIndex];
				if (text && rd && rd.chat) {
					if (rd.privateChatTargetId) {
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
							addMsg(text, false, 'text_private')
						} else {
							addSystemMsg(`Cannot send private message to ${rd.privateChatTargetName}.User might not be fully connected.`)
						}
					} else {
						rd.chat.sendChannelMessage('text', text);
						addMsg(text)
					}
					input.innerText = '';
					input.dispatchEvent(new Event('input'))
				}
			}
		})
	}
	setupImageSend({
		inputSelector: '.input-message-input',
		attachBtnSelector: '.chat-attach-btn',
		fileInputSelector: '.new-message-wrapper input[type="file"]',
		onSend: (dataUrl) => {
			const rd = roomsData[activeRoomIndex];
			if (rd && rd.chat) {
				if (rd.privateChatTargetId) {
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
						addMsg(dataUrl, false, 'image_private')
					} else {
						addSystemMsg(`Cannot send private image to ${rd.privateChatTargetName}.User might not be fully connected.`)
					}
				} else {
					rd.chat.sendChannelMessage('image', dataUrl);
					addMsg(dataUrl, false, 'image')
				}
			}
		}
	});
	const isMobile = () => window.innerWidth <= 768;
	renderMainHeader();
	renderUserList();
	setupTabs();
	const roomList = $id('room-list');
	const sidebar = $id('sidebar');
	const rightbar = $id('rightbar');
	const sidebarMask = $id('mobile-sidebar-mask');
	const rightbarMask = $id('mobile-rightbar-mask');
	if (roomList) {
		roomList.addEventListener('click', () => {
			if (isMobile()) {
				sidebar?.classList.remove('mobile-open');
				sidebarMask?.classList.remove('active')
			}
		})
	}
	const memberTabs = $id('member-tabs');
	if (memberTabs) {
		memberTabs.addEventListener('click', () => {
			if (isMobile()) {
				removeClass(rightbar, 'mobile-open');
				removeClass(rightbarMask, 'active')
			}
		})
	}
});