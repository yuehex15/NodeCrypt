import { processImage, setupImageSend } from './util.image.js';
import { setupEmojiPicker } from './util.emoji.js';
import { openSettingsPanel, closeSettingsPanel, initSettings, notifyMessage } from './util.settings.js';
import { 
  roomsData, 
  activeRoomIndex, 
  getNewRoomData, 
  joinRoom, 
  togglePrivateChat, 
  setStatus 
} from './room.js';
import { 
  renderChatArea, 
  addMsg, 
  addSystemMsg, 
  setupImagePreview, 
  updateChatInputStyle, 
  setupInputPlaceholder 
} from './chat.js';
import { 
  escapeHTML,
  renderUserList, 
  renderMainHeader, 
  setupMoreBtnMenu,
  preventSpaceInput, 
  loginFormHandler,
  openLoginModal,
  setupTabs,
  autofillRoomPwd
} from './ui.js';

// 全局配置
window.config = {
  rsaPublic: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7+gGYn7Wavs/WpcubvlJX9IBhv4eQtOdcedmquodYVQl5l2Jd64cNj/okIxMpQqtvJW/zvN6BNHAgBKyB5D6Yf9qHN0FwdXnAsSVxlAHA2guMOpXQFjyYj01BRrRAGMOyYkYlhQ+cvgoJzaE2skO/aYqYzrqOnexaUFLYN+1xEITqrTwpKnCPdlhGArrXYFTmloBOJy18CYlNyJkdbsUN/Q7Lxyq3bkLsPx2Gr80wh4rUQltc+VY5CYqjxuRwV65o04hspfS9VHXnT5OSAElDDNBys1u3hr3j1WDXSB9+v9ksA8NCi8j+iN7ADaqMGPA82EaSbYcFpd9alLHBGa9GwIDAQAB', 
  wsAddress: 'wss://crypt.works/ws',
  debug: true
};

// 将关键函数暴露给全局，以便其他模块调用
window.addSystemMsg = addSystemMsg;
window.joinRoom = joinRoom; 
window.notifyMessage = notifyMessage;
window.setupEmojiPicker = setupEmojiPicker;

// 页面初始化
window.addEventListener('DOMContentLoaded', () => {
  const loginContainer = document.getElementById('login-container');
  const chatContainer = document.getElementById('chat-container');
  const loginForm = document.getElementById('login-form');

  // 绑定初始登录表单
  if (loginForm) {
    loginForm.addEventListener('submit', loginFormHandler(null));
  }
  
  // 绑定"进入新房间"按钮
  const joinBtn = document.querySelector('.join-room');
  if (joinBtn) joinBtn.onclick = openLoginModal;

  // 禁止主登录页输入框输入空格
  preventSpaceInput(document.getElementById('userName'));
  preventSpaceInput(document.getElementById('roomName'));
  preventSpaceInput(document.getElementById('password'));

  // 自动填充URL参数中的房间信息
  autofillRoomPwd();

  // 设置各种UI组件
  setupInputPlaceholder();
  setupMoreBtnMenu();
  setupImagePreview();
  setupEmojiPicker();

  // 初始化设置
  initSettings();

  // 设置按钮点击事件
  let settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = (e) => {
      e.stopPropagation();
      openSettingsPanel();
    };
  }

  // 点击其它区域关闭设置面板
  document.addEventListener('click', function(ev) {
    const panel = document.getElementById('settings-panel');
    if (panel && panel.style.display === 'block') {
      const card = panel.querySelector('.settings-panel-card');
      if (card && !card.contains(ev.target) && ev.target.id !== 'settings-btn') {
        closeSettingsPanel();
      }
    }
  });

  // 自动聚焦到输入框并设置消息发送逻辑
  const input = document.querySelector('.input-message-input');
  if (input) {
    input.focus();
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.innerText.trim();
        const rd = roomsData[activeRoomIndex];
        if (text && rd && rd.chat) {
          if (rd.privateChatTargetId) {
            const targetClient = rd.chat.channel[rd.privateChatTargetId];
            if (targetClient && targetClient.shared) {
              const clientMessagePayload = { a: 'm', t: 'text_private', d: text };
              const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
              const serverRelayPayload = { a: 'c', p: encryptedClientMessage, c: rd.privateChatTargetId };
              const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
              rd.chat.sendMessage(encryptedMessageForServer);
              addMsg(text, false, 'text_private');
            } else {
              addSystemMsg(`Cannot send private message to ${rd.privateChatTargetName}. User might not be fully connected.`);
            }
          } else {
            rd.chat.sendChannelMessage('text', text);
            addMsg(text);
          }
          input.innerText = '';
          input.dispatchEvent(new Event('input')); // To update placeholder
        }
      }
    });
  }

  // 附件按钮和图片发送、粘贴图片功能
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
            const clientMessagePayload = { a: 'm', t: 'image_private', d: dataUrl };
            const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
            const serverRelayPayload = { a: 'c', p: encryptedClientMessage, c: rd.privateChatTargetId };
            const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
            rd.chat.sendMessage(encryptedMessageForServer);
            addMsg(dataUrl, false, 'image_private');
          } else {
            addSystemMsg(`Cannot send private image to ${rd.privateChatTargetName}. User might not be fully connected.`);
          }
        } else {
          rd.chat.sendChannelMessage('image', dataUrl);
          addMsg(dataUrl, false, 'image');
        }
      }
    }
  });

  // 初始化UI
  renderMainHeader();
  renderUserList();  setupTabs();
  
  // 监听房间点击和成员tab点击（移动端）
  const roomList = document.getElementById('room-list');
  const sidebar = document.getElementById('sidebar');
  const rightbar = document.getElementById('rightbar');
  const sidebarMask = document.getElementById('mobile-sidebar-mask');
  const rightbarMask = document.getElementById('mobile-rightbar-mask');
  
  const isMobile = () => {
    return window.innerWidth <= 768;
  }
  
  if (roomList) {
    roomList.addEventListener('click', function() {
      if (isMobile()) {
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (sidebarMask) sidebarMask.classList.remove('active');
      }
    });
  }
  
  const memberTabs = document.getElementById('member-tabs');
  if (memberTabs) {
    memberTabs.addEventListener('click', function() {
      if (isMobile()) {
        if (rightbar) rightbar.classList.remove('mobile-open');
        if (rightbarMask) rightbarMask.classList.remove('active');
      }
    });
  }
});

// 清空消息区（UI占位）
function clearChat() {
  document.getElementById("chat-area").innerHTML = "";
}

// Telegram风格输入框占位符逻辑
function autoGrowInput() {
  const input = document.querySelector('.input-message-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}