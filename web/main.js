import config from './config.js';
import { processImage } from './util.image.js';

// Dicebear Micah 头像生成依赖
let dicebear = null;
let micah = null;
// 页面加载时立即加载依赖
(async function preloadDicebear() {
  dicebear = await import('https://cdn.jsdelivr.net/npm/@dicebear/core@9.2.2/+esm');
  micah = (await import('https://cdn.jsdelivr.net/npm/@dicebear/collection@9.2.2/+esm')).micah;
})();
async function ensureDicebear() {
  if (!dicebear || !micah) {
    dicebear = await import('https://cdn.jsdelivr.net/npm/@dicebear/core@9.2.2/+esm');
    micah = (await import('https://cdn.jsdelivr.net/npm/@dicebear/collection@9.2.2/+esm')).micah;
  }
}
// 根据用户名生成 SVG 头像
async function createAvatarSVG(seed) {
  await ensureDicebear();
  return dicebear.createAvatar(micah, { seed, baseColor: ["ac6651", "f9c9b6"] }).toString();
}

// 多房间状态管理
let roomsData = [];
let activeRoomIndex = -1;
function getNewRoomData() {
  return { room: '', userList: [], userMap: {}, myId: null, myName: '', chat: null, messages: [] };
}
// 切换房间并恢复上下文，更新 UI
function switchRoom(index) {
  if (index < 0 || index >= roomsData.length) return;
  activeRoomIndex = index;
  const rd = roomsData[index];
  // 同步更新sidebar用户名和头像
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = rd.myName;
  setSidebarAvatar(rd.myName);
  renderRooms(index);
  renderMainHeader();
  renderUserList();
  renderChatArea();
}

// 渲染当前房间消息区
function renderChatArea() {
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  if (activeRoomIndex < 0 || !roomsData[activeRoomIndex]) {
    chatArea.innerHTML = '';
    return;
  }
  chatArea.innerHTML = '';
  roomsData[activeRoomIndex].messages.forEach(m => {
    if (m.type === 'me') addMsg(m.text, true, m.msgType || 'text');
    else addOtherMsg(m.text, m.name, m.avatar, true, m.msgType || 'text');
  });
}

// 根据字符串生成固定颜色
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // 生成明亮的色相，避免太灰
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 75%)`;
}

// 获取用户名首字母（前2位大写）
function getInitials(name) {
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
}
// 简单转义，防止XSS
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];
  });
}

// 渲染在线用户列表（右侧Members）
function renderUserList() {
  const userListEl = document.getElementById('member-list');
  userListEl.innerHTML = '';
  const rd = roomsData[activeRoomIndex];
  if (!rd) return;
  let me = rd.userList.find(u => u.clientId === rd.myId);
  let others = rd.userList.filter(u => u.clientId !== rd.myId);
  if (me) userListEl.appendChild(createUserItem(me, true));
  others.forEach(u => userListEl.appendChild(createUserItem(u, false)));
  renderMainHeader(); // 在线用户变化时刷新
}
function createUserItem(user, isMe) {
  let div = document.createElement('div');
  div.className = 'member' + (isMe ? ' me' : '');
  const safeUsername = escapeHTML(user.username);
  // 头像 SVG
  createAvatarSVG(user.username).then(svg => {
    div.querySelector('.avatar').innerHTML = svg;
  });
  div.innerHTML = `
    <span class="avatar"></span>
    <div class="member-info">
      <div class="member-name">${safeUsername}${isMe ? ' (我)' : ''}</div>
    </div>
  `;
  return div;
}

// 处理服务器推送的在线用户列表
function handleClientList(idx, list, selfId) {
  const rd = roomsData[idx];
  if (!rd) return;
  rd.userList = list;
  rd.userMap = {};
  list.forEach(u => {
    rd.userMap[u.clientId] = u;
  });
  rd.myId = selfId;
  if (activeRoomIndex === idx) renderUserList();
}
// 新用户上线或资料变更
function handleClientSecured(idx, user) {
  const rd = roomsData[idx];
  if (!rd) return;
  let uidx = rd.userList.findIndex(u => u.clientId === user.clientId);
  if (uidx === -1) {
    rd.userList.push(user);
  } else {
    rd.userList[uidx] = user;
  }
  rd.userMap[user.clientId] = user;
  if (activeRoomIndex === idx) renderUserList();
}
// 用户下线
function handleClientLeft(idx, clientId) {
  const rd = roomsData[idx];
  if (!rd) return;
  rd.userList = rd.userList.filter(u => u.clientId !== clientId);
  delete rd.userMap[clientId];
  if (activeRoomIndex === idx) renderUserList();
}

function setStatus(text) {
  let statusBar = document.getElementById('status-bar');
  if (!statusBar) {
    statusBar = document.createElement('div');
    statusBar.id = 'status-bar';
    statusBar.style = 'color:green;padding:4px 10px;font-size:13px;';
    document.body.appendChild(statusBar);
  }
  statusBar.innerText = text;
}

function addMsg(text, isHistory = false, msgType = 'text') {
    if (!isHistory && activeRoomIndex >= 0) roomsData[activeRoomIndex].messages.push({ type: 'me', text, msgType });
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  const div = document.createElement('div');
  div.className = 'bubble me';
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  let contentHtml = '';
  if (msgType === 'image' && text.startsWith('data:image/')) {
    contentHtml = `<img src="${text}" alt="image" style="max-width:220px;max-height:180px;border-radius:8px;">`;
  } else {
  const safeText = escapeHTML(text).replace(/\n/g, '<br>');
contentHtml = safeText;
  }
  div.innerHTML = `<span class="bubble-content">${contentHtml}</span><span class="bubble-meta">${time}</span>`;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addOtherMsg(msg, name = 'Anonymous', avatar = '', isHistory = false, msgType = 'text') {
    if (!isHistory && activeRoomIndex >= 0) roomsData[activeRoomIndex].messages.push({ type: 'other', text: msg, name, avatar, msgType });
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-other-wrap';
  let contentHtml = '';
  if (msgType === 'image' && msg.startsWith('data:image/')) {
    contentHtml = `<img src="${msg}" alt="image" style="max-width:220px;max-height:180px;border-radius:8px;">`;
  } else {
  const safeMsg = escapeHTML(msg).replace(/\n/g, '<br>');
contentHtml = safeMsg;
  }
  const safeName = escapeHTML(name);
  bubbleWrap.innerHTML = `
    <span class="avatar"></span>
    <div class="bubble-other-main">
      <div class="bubble other">
        <div class="bubble-other-name">${safeName}</div>
        <span class="bubble-content">${contentHtml}</span>
        <span class="bubble-meta">${(new Date()).getHours().toString().padStart(2, '0')}:${(new Date()).getMinutes().toString().padStart(2, '0')}</span>
      </div>
    </div>
  `;
  // 头像 SVG
  createAvatarSVG(name).then(svg => {
    bubbleWrap.querySelector('.avatar').innerHTML = svg;
  });
  chatArea.appendChild(bubbleWrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 渲染房间列表（动态多房间）
function renderRooms(activeId = 0) {
  const roomList = document.getElementById('room-list');
  roomList.innerHTML = '';
  roomsData.forEach((rd, i) => {
    const div = document.createElement('div');
    div.className = 'room' + (i === activeId ? ' active' : '');
    const safeRoom = escapeHTML(rd.room);
    div.innerHTML = `
      <div class="info">
        <div class="title">#${safeRoom}</div>
      </div>
    `;
    div.onclick = () => switchRoom(i);
    roomList.appendChild(div);
  });
}

// 登录表单提交处理
function loginFormHandler(modal) {
  return function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const room = document.getElementById('room').value.trim();
    const password = document.getElementById('password').value.trim();
    joinRoom(username, room, password, modal);
  };
}

function setSidebarAvatar(username) {
  if (!username) return;
  createAvatarSVG(username).then(svg => {
    const el = document.getElementById('sidebar-user-avatar');
    if (el) el.innerHTML = svg;
  });
}

function joinRoom(username, room, password, modal = null) {
  // 生成房间数据并切换
  const newRd = getNewRoomData();
  newRd.room = room;
  newRd.myName = username;
  roomsData.push(newRd);
  const idx = roomsData.length - 1;
  switchRoom(idx);
  // 更新侧边栏
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = username;
  setSidebarAvatar(username);
  // 隐藏登录界面或关闭modal
  if (modal) modal.remove();
  else document.getElementById('login-container').style.display = 'none';
  document.getElementById('chat-container').style.display = '';
  setStatus('Connecting...');
  // 初始化 ChatCrypt
  const callbacks = {
    onServerClosed: () => setStatus('Node connection closed'),
    onServerSecured: () => setStatus('Secure connection to node'),
    onClientSecured: (user) => handleClientSecured(idx, user),
    onClientList: (list, selfId) => handleClientList(idx, list, selfId),
    onClientLeft: (clientId) => handleClientLeft(idx, clientId),
    onClientMessage: (msg) => {
      if (msg.username === newRd.myName) return;
// 判断消息类型
      let msgType = msg.type || (msg.data && msg.data.startsWith('data:image/') ? 'image' : 'text');
      roomsData[idx].messages.push({ type: 'other', text: msg.data, name: msg.username, avatar: msg.username, msgType });
      if (activeRoomIndex === idx) renderChatArea();
    }
  };
  const chatInst = new window.ChatCrypt(config, callbacks);
  chatInst.setCredentials(username, room, password);
  chatInst.connect();
  roomsData[idx].chat = chatInst;
}

// 禁止输入框输入空格的工具函数
function preventSpaceInput(input) {
  if (!input) return;
  input.addEventListener('keydown', function(e) {
    if (e.key === ' ') e.preventDefault();
  });
  input.addEventListener('input', function(e) {
    if (input.value && input.value.includes(' ')) {
      input.value = input.value.replace(/\s+/g, '');
    }
  });
}

// 打开新房间登录模态
function openLoginModal() {
  const loginContainer = document.getElementById('login-container');
  // 创建一个新的modal，内容copy（不是复用）初始登录页面
  const modal = document.createElement('div');
  modal.className = 'login-modal';
  // 复制登录表单内容
  modal.innerHTML = `
    <div class="login-modal-bg"></div>
    <div class="login-modal-card">
      <button class="login-modal-close" style="position:absolute;right:10px;top:10px;font-size:22px;background:none;border:none;cursor:pointer;">&times;</button>
      <h1>Enter a Node</h1>
      <form id="login-form-modal">
        <div class="input-group">
          <label for="username-modal">Username</label>
          <input id="username-modal" type="text" autocomplete="username" required="">
        </div>
        <div class="input-group">
          <label for="room-modal">Node Name</label>
          <input id="room-modal" type="text" required="">
        </div>
        <div class="input-group">
          <label for="password-modal">Node Password <span class="optional">(optional)</span></label>
          <input id="password-modal" type="password" autocomplete="off">
        </div>
        <button type="submit" class="login-btn">ENTER</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  // 关闭按钮
  modal.querySelector('.login-modal-close').onclick = () => modal.remove();
  // 禁止弹窗登录页输入框输入空格
  preventSpaceInput(modal.querySelector('#username-modal'));
  preventSpaceInput(modal.querySelector('#room-modal'));
  preventSpaceInput(modal.querySelector('#password-modal'));
  // 表单提交逻辑，复用loginFormHandler但传入modal
  const form = modal.querySelector('#login-form-modal');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    // 获取输入
    const username = document.getElementById('username-modal').value.trim();
    const room = document.getElementById('room-modal').value.trim();
    const password = document.getElementById('password-modal').value.trim();
    joinRoom(username, room, password, modal);
  });
}

// 渲染主面板房间头部（UI占位）
function renderMainHeader() {
  const rd = roomsData[activeRoomIndex];
  let roomName = rd ? rd.room : 'Room';
  let onlineCount = rd && rd.userList ? rd.userList.length : 0;
  if (rd && !rd.userList.some(u => u.clientId === rd.myId)) {
    onlineCount += 1;
  }
  const safeRoomName = escapeHTML(roomName);
  document.getElementById("main-header").innerHTML = `
    <div style="display: flex; align-items: center;">
      <div class="group-title" style="font-size: 1.22em; font-weight: bold;">#${safeRoomName}</div>
      <span style="margin-left:10px;font-size:13px;color:#888;">${onlineCount} members</span>
    </div>
    <div class="main-header-actions">
      <button class="more-btn" id="more-btn" aria-label="More">
        <span class="more-btn-dot"></span>
        <span class="more-btn-dot"></span>
        <span class="more-btn-dot"></span>
      </button>
      <div class="more-menu" id="more-menu">
        <div class="more-menu-item" data-action="share">Share</div>
        <div class="more-menu-item" data-action="exit">Quit</div>
      </div>
    </div>
  `;
  setupMoreBtnMenu();
}

// 清空消息区（UI占位）
function clearChat() {
  document.getElementById("chat-area").innerHTML = "";
}

// 右侧tab切换
function setupTabs() {
  const tabs = document.getElementById("member-tabs").children;
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].onclick = function() {
      for (let j = 0; j < tabs.length; j++) tabs[j].classList.remove("active");
      this.classList.add("active");
      // 这里只做UI切换，实际功能由你开发
    }
  }
}

// Telegram风格输入框占位符逻辑
function autoGrowInput() {
  const input = document.querySelector('.input-message-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}

function setupInputPlaceholder() {
  const input = document.querySelector('.input-message-input');
  const placeholder = document.querySelector('.input-field-placeholder');
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
  input.addEventListener('input', checkEmpty);
  input.addEventListener('blur', checkEmpty);
  input.addEventListener('focus', checkEmpty);
  // 初始化
  checkEmpty();
  autoGrowInput();
}

// 更多按钮菜单交互
function setupMoreBtnMenu() {
  const btn = document.getElementById('more-btn');
  const menu = document.getElementById('more-menu');
  if (!btn || !menu) return;
  let menuRect = null;
  let animating = false;
  let isMouseMoveBound = false;

  function onMouseMove(ev) {
    if (!menuRect) return;
    const mx = ev.clientX, my = ev.clientY;
    const btnRect = btn.getBoundingClientRect();
    const safe = 100;
    const inMenu =
      mx >= menuRect.left - safe && mx <= menuRect.right + safe &&
      my >= menuRect.top - safe && my <= menuRect.bottom + safe;
    const inBtn =
      mx >= btnRect.left - safe && mx <= btnRect.right + safe &&
      my >= btnRect.top - safe && my <= btnRect.bottom + safe;
    if (!inMenu && !inBtn) {
      closeMenu();
    }
  }

  function bindMouseMove() {
    if (!isMouseMoveBound) {
      window.addEventListener('mousemove', onMouseMove);
      isMouseMoveBound = true;
    }
  }
  function unbindMouseMove() {
    if (!isMouseMoveBound) {
      window.removeEventListener('mousemove', onMouseMove);
      isMouseMoveBound = false;
    }
  }

  function openMenu() {
    menu.classList.remove('close');
    menu.classList.add('open');
    menu.style.display = 'block';
    menuRect = menu.getBoundingClientRect();
    bindMouseMove();
  }
  function closeMenu() {
    if (animating) return;
    animating = true;
    menu.classList.remove('open');
    menu.classList.add('close');
    setTimeout(() => {
      if (menu.classList.contains('close')) menu.style.display = 'none';
      animating = false;
      unbindMouseMove();
    }, 180);
    menuRect = null;
  }

  btn.onclick = function(e) {
    e.stopPropagation();
    if (menu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  menu.onclick = function(e) {
    if (e.target.classList.contains('more-menu-item')) {
      if (e.target.dataset.action === 'share') {
        alert('分享功能待实现');
      } else if (e.target.dataset.action === 'exit') {
        // 退出功能待实现
      }
      closeMenu();
    }
  };

  document.addEventListener('click', function hideMenu(ev) {
    if (!menu.contains(ev.target) && ev.target !== btn) {
      closeMenu();
    }
  });

  // 动画结束后允许再次触发
  menu.addEventListener('animationend', function(e) {
    animating = false;
  });
  menu.addEventListener('transitionend', function(e) {
    animating = false;
  });
}

// 图片气泡点击预览
function setupImagePreview() {
  document.getElementById('chat-area').addEventListener('click', function(e) {
    const target = e.target;
    if (target.tagName === 'IMG' && target.closest('.bubble-content')) {
      showImageModal(target.src);
    }
  });
}
function showImageModal(src) {
  let modal = document.createElement('div');
  modal.className = 'img-modal-bg';
  modal.innerHTML = `
    <div class="img-modal-blur"></div>
    <div class="img-modal-content">
      <img src="${src}" style="max-width:90vw;max-height:90vh;" />
      <span class="img-modal-close">&times;</span>
    </div>
  `;
  document.body.appendChild(modal);
  // 关闭逻辑
  modal.querySelector('.img-modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  // 支持缩放
  const img = modal.querySelector('img');
  let scale = 1;
  img.onwheel = function(ev) {
    ev.preventDefault();
    scale += ev.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.max(0.2, Math.min(5, scale));
    img.style.transform = `scale(${scale})`;
  };
}

// 页面初始化
window.addEventListener('DOMContentLoaded', () => {
  const loginContainer = document.getElementById('login-container');
  const chatContainer = document.getElementById('chat-container');
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', loginFormHandler(null));
  }
  // 绑定“进入新房间”按钮
  const joinBtn = document.querySelector('.join-room');
  if (joinBtn) joinBtn.onclick = openLoginModal;

  // 禁止主登录页输入框输入空格
  preventSpaceInput(document.getElementById('username'));
  preventSpaceInput(document.getElementById('room'));
  preventSpaceInput(document.getElementById('password'));

  setupInputPlaceholder();
  setupMoreBtnMenu();
  setupImagePreview();

  // 自动聚焦到输入框
  const input = document.querySelector('.input-message-input');
  if (input) {
    input.focus();
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.innerText.trim();
        // 只用当前房间的 chat 实例
        if (text && roomsData[activeRoomIndex]?.chat) {
          roomsData[activeRoomIndex].chat.sendChannelMessage('text', text);
          addMsg(text);
          input.innerText = '';
          input.dispatchEvent(new Event('input'));
        }
      }
    });
  }

  // 附件按钮和图片发送功能
  const attachBtn = document.querySelector('.chat-attach-btn');
  const fileInput = document.querySelector('.new-message-wrapper input[type="file"]');
  if (fileInput) fileInput.setAttribute('accept', 'image/*');
  if (attachBtn && fileInput) {
    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = async function() {
      if (!fileInput.files || !fileInput.files.length) return;
      const file = fileInput.files[0];
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('图片过大（超过5MB），请压缩后再发送。');
        return;
      }
      processImage(file, (dataUrl) => {
        if (roomsData[activeRoomIndex]?.chat) {
          roomsData[activeRoomIndex].chat.sendChannelMessage('image', dataUrl);
          addMsg(dataUrl, false, 'image');
        }
      });
      fileInput.value = '';
    };
  }
  // 粘贴图片支持
  if (input) {
    input.addEventListener('paste', function(e) {
      if (!e.clipboardData) return;
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file.size > 5 * 1024 * 1024) {
            alert('图片过大（超过5MB），请压缩后再发送。');
            return;
          }
          processImage(file, (dataUrl) => {
            if (roomsData[activeRoomIndex]?.chat) {
              roomsData[activeRoomIndex].chat.sendChannelMessage('image', dataUrl);
              addMsg(dataUrl, false, 'image');
            }
          });
          e.preventDefault();
          break;
        }
      }
    });
  }

  // 初始化
  renderRooms(activeRoomIndex);
  renderMainHeader();
  renderUserList();
  setupTabs();
  renderChatArea();
});