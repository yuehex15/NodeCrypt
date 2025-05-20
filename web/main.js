/**
 * NodeCrypt 聊天应用主入口文件
 * 负责初始化界面、绑定事件及协调各模块功能
 */

// === 工具模块导入 ===
import { processImage, setupImageSend } from './util.image.js';
import { setupEmojiPicker } from './util.emoji.js';
import { openSettingsPanel, closeSettingsPanel, initSettings, notifyMessage } from './util.settings.js';
import { escapeHTML, textToHTML } from './util.string.js';
import { $, $$, $id, on, off, addClass, removeClass } from './util.dom.js';

// === 核心功能模块导入 ===
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
// === 界面相关模块导入 ===
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

// === 全局配置 ===

/**
 * 应用全局配置
 * rsaPublic: RSA公钥，用于加密通信
 * wsAddress: WebSocket服务器地址
 * debug: 是否开启调试模式
 */
window.config = {
  rsaPublic: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7+gGYn7Wavs/WpcubvlJX9IBhv4eQtOdcedmquodYVQl5l2Jd64cNj/okIxMpQqtvJW/zvN6BNHAgBKyB5D6Yf9qHN0FwdXnAsSVxlAHA2guMOpXQFjyYj01BRrRAGMOyYkYlhQ+cvgoJzaE2skO/aYqYzrqOnexaUFLYN+1xEITqrTwpKnCPdlhGArrXYFTmloBOJy18CYlNyJkdbsUN/Q7Lxyq3bkLsPx2Gr80wh4rUQltc+VY5CYqjxuRwV65o04hspfS9VHXnT5OSAElDDNBys1u3hr3j1WDXSB9+v9ksA8NCi8j+iN7ADaqMGPA82EaSbYcFpd9alLHBGa9GwIDAQAB', 
  wsAddress: 'wss://crypt.works/ws',
  debug: true
};

// === 全局函数导出 ===

/**
 * 将核心函数暴露给全局作用域，便于跨模块调用
 */
window.addSystemMsg = addSystemMsg;
window.joinRoom = joinRoom; 
window.notifyMessage = notifyMessage;
window.setupEmojiPicker = setupEmojiPicker;

// 页面初始化
window.addEventListener('DOMContentLoaded', () => {
  // 获取主要UI元素
  const loginContainer = $id('login-container');
  const chatContainer = $id('chat-container');
  const loginForm = $id('login-form');

  // === 登录相关初始化 ===
  
  // 绑定初始登录表单
  if (loginForm) {
    loginForm.addEventListener('submit', loginFormHandler(null));
  }
  
  // 绑定"进入新房间"按钮
  const joinBtn = $('.join-room');
  if (joinBtn) {
    joinBtn.onclick = openLoginModal;
  }

  // 禁止主登录页输入框输入空格
  preventSpaceInput($id('userName'));
  preventSpaceInput($id('roomName'));
  preventSpaceInput($id('password'));

  // 自动填充URL参数中的房间信息
  autofillRoomPwd();
  // === 界面组件初始化 ===
  
  // 设置各种UI组件
  setupInputPlaceholder();
  setupMoreBtnMenu();
  setupImagePreview();
  setupEmojiPicker();

  // 初始化设置
  initSettings();

  // 设置按钮点击事件
  const settingsBtn = $id('settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = (e) => {
      e.stopPropagation();
      openSettingsPanel();
    };
  }
  // 点击其它区域关闭设置面板
  document.addEventListener('click', (ev) => {
    const panel = $id('settings-panel');
    if (panel && panel.style.display === 'block') {
      const card = panel.querySelector('.settings-panel-card');
      if (card && !card.contains(ev.target) && ev.target.id !== 'settings-btn') {
        closeSettingsPanel();
      }
    }
  });
  // === 消息收发功能 ===

  // 自动聚焦到输入框并设置消息发送逻辑
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

  // 图片发送功能
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

    // 移动端适配辅助函数
  const isMobile = () => {
    return window.innerWidth <= 768;
  };
  
  // 初始化UI组件
  renderMainHeader();
  renderUserList();
  setupTabs();
  
  // 移动端侧边栏处理
  const roomList = $id('room-list');
  const sidebar = $id('sidebar');
  const rightbar = $id('rightbar');
  const sidebarMask = $id('mobile-sidebar-mask');
  const rightbarMask = $id('mobile-rightbar-mask');
  
  // 监听房间列表点击（移动端）
  if (roomList) {
    roomList.addEventListener('click', () => {
      if (isMobile()) {
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (sidebarMask) sidebarMask.classList.remove('active');
      }
    });
  }
  
  // 监听成员标签点击（移动端）
  const memberTabs = $id('member-tabs');
  if (memberTabs) {
    memberTabs.addEventListener('click', () => {
      if (isMobile()) {
        if (rightbar) removeClass(rightbar, 'mobile-open');
        if (rightbarMask) removeClass(rightbarMask, 'active');
      }
    });
  }
});

// === 辅助函数 ===

/**
 * 清空消息区域
 * 用于UI重置或切换房间
 */
function clearChat() {
  $id("chat-area").innerHTML = "";
}

/**
 * Telegram风格输入框自动增高
 * 随着用户输入内容增加，输入框自动调整高度
 */
function autoGrowInput() {
  const input = $('.input-message-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}