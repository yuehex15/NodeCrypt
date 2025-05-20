// 聊天显示逻辑管理模块
import { createAvatarSVG } from './util.avatar.js';
import { roomsData, activeRoomIndex } from './room.js';
import { escapeHTML, textToHTML } from './util.string.js';
import { $, $$, $id, createElement, on, off, addClass, removeClass } from './util.dom.js';

/**
 * 渲染当前房间消息区
 */
export function renderChatArea() {
  const chatArea = $id('chat-area');
  if (!chatArea) return;
  
  if (activeRoomIndex < 0 || !roomsData[activeRoomIndex]) {
    chatArea.innerHTML = '';
    return;
  }
  
  chatArea.innerHTML = '';
  roomsData[activeRoomIndex].messages.forEach(m => {
    if (m.type === 'me') addMsg(m.text, true, m.msgType || 'text', m.timestamp);
    else if (m.type === 'system') addSystemMsg(m.text, true, m.timestamp);
    else addOtherMsg(m.text, m.userName, m.avatar, true, m.msgType || 'text', m.timestamp);
  });
    // 表情选择器已在main.js中全局初始化一次，此处不需要重复初始化
  // if (window.setupEmojiPicker) window.setupEmojiPicker();
}

/**
 * 添加自己发送的消息
 * @param {string} text 消息文本
 * @param {boolean} isHistory 是否为历史消息
 * @param {string} msgType 消息类型
 * @param {number} timestamp 时间戳
 */
export function addMsg(text, isHistory = false, msgType = 'text', timestamp = null) {
  let ts;
  if (isHistory) {
    ts = timestamp;
  } else {
    ts = timestamp || Date.now();
    if (activeRoomIndex >= 0) {
      roomsData[activeRoomIndex].messages.push({ type: 'me', text, msgType, timestamp: ts });
    }
  }
  
  // 只用传入的 timestamp，不再 fallback 到 Date.now()，避免多余逻辑
  if (!ts) return;
  
  const chatArea = $id('chat-area');
  if (!chatArea) return;
  
  const className = 'bubble me' + (msgType.includes('_private') ? ' private-message' : '');
  
  const date = new Date(ts);
  const time = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
    let contentHtml = '';
  if (msgType === 'image' || msgType === 'image_private') {
    // 处理图片URL，确保只允许安全的数据URL或HTTPS链接
    const safeImgSrc = escapeHTML(text).replace(/javascript:/gi, '');
    contentHtml = `<img src="${safeImgSrc}" alt="image" class="bubble-img">`;
  } else {
    contentHtml = textToHTML(text);
  }
  
  const div = createElement('div', { class: className }, 
    `<span class="bubble-content">${contentHtml}</span><span class="bubble-meta">${time}</span>`
  );
  
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * 添加其他人发送的消息
 * @param {string|object} msg 消息内容
 * @param {string} userName 用户名
 * @param {string} avatar 头像
 * @param {boolean} isHistory 是否为历史消息
 * @param {string} msgType 消息类型
 * @param {number} timestamp 时间戳
 */
export function addOtherMsg(msg, userName = '', avatar = '', isHistory = false, msgType = 'text', timestamp = null) {
  if (!userName && activeRoomIndex >= 0) {
    const rd = roomsData[activeRoomIndex];
    if (rd && msg && msg.clientId && rd.userMap[msg.clientId]) {
      userName = rd.userMap[msg.clientId].userName || rd.userMap[msg.clientId].username || rd.userMap[msg.clientId].name || 'Anonymous';
    }
  }
  
  if (!userName) userName = 'Anonymous';
  
  let ts;
  if (isHistory) {
    ts = timestamp;
  } else {
    ts = timestamp || Date.now();
    if (activeRoomIndex >= 0) {
      roomsData[activeRoomIndex].messages.push({ type: 'other', text: msg, userName, avatar, msgType, timestamp: ts });
    }
  }
  
  if (!ts) return;
  
  const chatArea = $id('chat-area');
  if (!chatArea) return;
  
  const bubbleWrap = createElement('div', { class: 'bubble-other-wrap' });
    let contentHtml = '';
  if (msgType === 'image' || msgType === 'image_private') {
    // 处理图片URL，确保只允许安全的数据URL或HTTPS链接
    const safeImgSrc = escapeHTML(msg).replace(/javascript:/gi, '');
    contentHtml = `<img src="${safeImgSrc}" alt="image" class="bubble-img">`;
  } else {
    contentHtml = textToHTML(msg);
  }
  
  const safeUserName = escapeHTML(userName);
  const date = new Date(ts);
  const time = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');

  // 确定气泡样式类，私聊消息添加 private-message 类
  let bubbleClasses = 'bubble other';
  if (msgType && msgType.includes('_private')) {
    bubbleClasses += ' private-message';
  }

  bubbleWrap.innerHTML = `
    <span class="avatar"></span>
    <div class="bubble-other-main">
      <div class="${bubbleClasses}">
        <div class="bubble-other-name">${safeUserName}</div>
        <span class="bubble-content">${contentHtml}</span>
        <span class="bubble-meta">${time}</span>
      </div>
    </div>
  `;
  
  createAvatarSVG(userName).then(svg => {
    const avatarEl = $('.avatar', bubbleWrap);
    if (avatarEl) {
      // 清理SVG，移除任何可能的脚本内容
      const cleanSvg = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      avatarEl.innerHTML = cleanSvg;
    }
  });
  
  chatArea.appendChild(bubbleWrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * 添加系统信息消息
 * @param {string} text 消息文本
 * @param {boolean} isHistory 是否为历史消息
 * @param {number} timestamp 时间戳
 */
export function addSystemMsg(text, isHistory = false, timestamp = null) {
  if (!isHistory && activeRoomIndex >= 0) {
    const ts = timestamp || Date.now();
    roomsData[activeRoomIndex].messages.push({ type: 'system', text, timestamp: ts });
  }
  
  const chatArea = $id('chat-area');
  if (!chatArea) return;
  
  const safeText = textToHTML(text);
  const div = createElement('div', { class: 'bubble system' }, `<span class="bubble-content">${safeText}</span>`);
  
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * 清空聊天区域
 */
export function clearChat() {
  const chatArea = document.getElementById("chat-area");
  if (chatArea) {
    chatArea.innerHTML = "";
  }
}

/**
 * 更新聊天输入框样式
 */
export function updateChatInputStyle() {
  const rd = roomsData[activeRoomIndex];
  const chatInputArea = $('.chat-input-area');
  const placeholder = $('.input-field-placeholder');
  const inputMessageInput = $('.input-message-input');

  if (!chatInputArea || !placeholder || !inputMessageInput) return;

  if (rd && rd.privateChatTargetId) {
    addClass(chatInputArea, 'private-mode');
    addClass(inputMessageInput, 'private-mode');
    placeholder.textContent = `Private Message to ${escapeHTML(rd.privateChatTargetName)}`;
  } else {
    removeClass(chatInputArea, 'private-mode');
    removeClass(inputMessageInput, 'private-mode');
    placeholder.textContent = 'Message';
  }
  
  // 确保占位符可见性在文本更改后正确更新
  const html = inputMessageInput.innerHTML.replace(/<br\s*\/?>(\s*)?/gi, '').replace(/&nbsp;/g, '').replace(/\u200B/g, '').trim();
  placeholder.style.opacity = (html === '') ? '1' : '0';
}

/**
 * 图片气泡点击预览
 */
export function setupImagePreview() {
  on($id('chat-area'), 'click', function(e) {
    const target = e.target;
    if (target.tagName === 'IMG' && target.closest('.bubble-content')) {
      showImageModal(target.src);
    }
  });
}

/**
 * 显示图片预览模态框
 * @param {string} src 图片源
 */
export function showImageModal(src) {
  const modal = createElement('div', { class: 'img-modal-bg' }, `
    <div class="img-modal-blur"></div>
    <div class="img-modal-content img-modal-content-overflow">
      <img src="${src}" class="img-modal-img" />
      <span class="img-modal-close">&times;</span>
    </div>
  `);
  
  document.body.appendChild(modal);
  
  // 关闭逻辑
  on($('.img-modal-close', modal), 'click', () => modal.remove());
  on(modal, 'click', (e) => { if (e.target === modal) modal.remove(); });
  
  // 支持缩放和拖动
  const img = $('img', modal);
  let scale = 1;
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let offsetX = 0, offsetY = 0;
  
  img.ondragstart = function(e) { e.preventDefault(); };
  
  on(img, 'wheel', function(ev) {
    ev.preventDefault();
    const prevScale = scale;
    scale += ev.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.max(0.2, Math.min(5, scale));
    
    // 缩放以图片中心为基准
    if (scale === 1) {
      offsetX = 0;
      offsetY = 0;
    }
    
    updateTransform();
  });

  function updateTransform() {
    img.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
    img.style.cursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';
  }

  on(img, 'mousedown', function(ev) {
    if (scale <= 1) return;
    isDragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    img.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });

  function onMouseMove(ev) {
    if (!isDragging) return;
    offsetX += ev.clientX - lastX;
    offsetY += ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    updateTransform();
  }

  function onMouseUp() {
    if (isDragging) {
      isDragging = false;
      img.style.cursor = 'grab';
      document.body.style.userSelect = '';
    }
  }
  
  on(window, 'mousemove', onMouseMove);
  on(window, 'mouseup', onMouseUp);
  
  // 双击还原
  on(img, 'dblclick', function() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  });
  
  // 关闭时清理事件
  const cleanup = () => {
    off(window, 'mousemove', onMouseMove);
    off(window, 'mouseup', onMouseUp);
    document.body.style.userSelect = '';
  };
  
  on(modal, 'remove', cleanup);
  on($('.img-modal-close', modal), 'click', cleanup);
  
  // 初始化
  updateTransform();
}

/**
 * 设置自动调整输入框高度
 */
export function autoGrowInput() {
  const input = $('.input-message-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}

/**
 * 设置输入框占位符逻辑
 */
export function setupInputPlaceholder() {
  const input = $('.input-message-input');
  const placeholder = $('.input-field-placeholder');
  
  if (!input || !placeholder) return;
  
  function checkEmpty() {
    // 判断内容是否为空（忽略所有空白、<br>、&nbsp;等）
    const html = input.innerHTML.replace(/<br\s*\/?>(\s*)?/gi, '').replace(/&nbsp;/g, '').replace(/\u200B/g, '').trim();
    if (html === '') {
      placeholder.style.opacity = '1';
    } else {
      placeholder.style.opacity = '0';
    }
    autoGrowInput();
  }
  
  on(input, 'input', checkEmpty);
  on(input, 'blur', checkEmpty);
  on(input, 'focus', checkEmpty);
  
  // 初始化
  checkEmpty();
  autoGrowInput();
  updateChatInputStyle();
}
