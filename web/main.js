import config from './config.js';
import { processImage } from './util.image.js';
import { createAvatarSVG } from './util.avatar.js';

// 多房间状态管理
let roomsData = [];
let activeRoomIndex = -1;
function getNewRoomData() {
  return { roomName: '', userList: [], userMap: {}, myId: null, myUserName: '', chat: null, messages: [], prevUserList: [], knownUserIds: new Set() };
}
// 切换房间并恢复上下文，更新 UI
function switchRoom(index) {
  if (index < 0 || index >= roomsData.length) return;
  activeRoomIndex = index;
  const rd = roomsData[index];
  // 恢复 sidebar-username、sidebar-user-avatar id
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = rd.myUserName;
  setSidebarAvatar(rd.myUserName);
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
    else if (m.type === 'system') addSystemMsg(m.text, true); // 这里加 true
    else addOtherMsg(m.text, m.userName, m.avatar, true, m.msgType || 'text');
  });
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
  // 兼容 userName/username/name
  const rawName = user.userName || user.username || user.name || '';
  const safeUserName = escapeHTML(rawName);
  // 头像 SVG
  createAvatarSVG(rawName).then(svg => {
    div.querySelector('.avatar').innerHTML = svg;
  });
  div.innerHTML = `
    <span class="avatar"></span>
    <div class="member-info">
      <div class="member-name">${safeUserName}${isMe ? ' (我)' : ''}</div>
    </div>
  `;
  return div;
}

// 处理服务器推送的在线用户列表
function handleClientList(idx, list, selfId) {
  const rd = roomsData[idx];
  if (!rd) return;
  // 记录旧用户ID集合
  const oldUserIds = new Set((rd.userList || []).map(u => u.clientId));
  // 新用户ID集合
  const newUserIds = new Set(list.map(u => u.clientId));
  // 检查退出用户（旧有，新没有）
  if (rd.isInitialized) {
    for (const oldId of oldUserIds) {
      if (!newUserIds.has(oldId)) {
        const user = rd.userMap[oldId];
        const name = user ? (user.userName || user.username || user.name || 'Anonymous') : 'Anonymous';
        const msg = `${name}已退出`;
        rd.messages.push({ type: 'system', text: msg });
        if (activeRoomIndex === idx) addSystemMsg(msg, true);
      }
    }
  }
  // 更新在线用户列表和映射
  rd.userList = list;
  rd.userMap = {};
  list.forEach(u => { rd.userMap[u.clientId] = u; });
  rd.myId = selfId;
  if (activeRoomIndex === idx) {
    renderUserList();
    renderMainHeader(); // 刷新顶部信息栏
  }
  // 初始化计数
  rd.initCount = (rd.initCount || 0) + 1;
  // 收到 2 次列表后标记初始化完成，并填充已知用户集合
  if (rd.initCount === 2) {
    rd.isInitialized = true;
    // 基准用户集合
    rd.knownUserIds = new Set(list.map(u => u.clientId));
  }
}
// 调整 handleClientSecured: 立即更新UI，仅在初始化完成后才处理加入提示
function handleClientSecured(idx, user) {
  const rd = roomsData[idx];
  if (!rd) return;
  
  // 无论初始化状态如何，始终更新用户映射
  rd.userMap[user.clientId] = user;
  
  // 检查用户是否已在列表中
  const existingUserIndex = rd.userList.findIndex(u => u.clientId === user.clientId);
  if (existingUserIndex === -1) {
    // 用户不在列表中，添加它
    rd.userList.push(user);
  } else {
    // 用户已在列表中，更新它
    rd.userList[existingUserIndex] = user;
  }
  
  // 无论初始化状态如何，始终刷新当前房间UI
  if (activeRoomIndex === idx) {
    renderUserList();
    renderMainHeader(); // 也刷新顶部信息栏
  }
  
  // 仅在初始化完成后才处理加入提示
  if (!rd.isInitialized) {
    return;
  }
  
  // 检测是否为已知用户集合中不存在的用户
  const isNew = !rd.knownUserIds.has(user.clientId);
  
  // 提示新用户加入
  if (isNew) {
    rd.knownUserIds.add(user.clientId);
    const name = user.userName || user.username || user.name || 'Anonymous';
    const msg = `${name}已加入`;
    rd.messages.push({ type: 'system', text: msg });
    if (activeRoomIndex === idx) addSystemMsg(msg, true);
  }
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

function addOtherMsg(msg, userName = '', avatar = '', isHistory = false, msgType = 'text') {
    // 修正：优先从userMap查找用户名，避免Anonymous
    if (!userName && activeRoomIndex >= 0) {
      const rd = roomsData[activeRoomIndex];
      if (rd && msg && msg.clientId && rd.userMap[msg.clientId]) {
        userName = rd.userMap[msg.clientId].userName || rd.userMap[msg.clientId].username || rd.userMap[msg.clientId].name || 'Anonymous';
      }
    }
    if (!userName) userName = 'Anonymous';
  if (!isHistory && activeRoomIndex >= 0) roomsData[activeRoomIndex].messages.push({ type: 'other', text: msg, userName, avatar, msgType });
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
  const safeUserName = escapeHTML(userName);
  bubbleWrap.innerHTML = `
    <span class="avatar"></span>
    <div class="bubble-other-main">
      <div class="bubble other">
        <div class="bubble-other-name">${safeUserName}</div>
        <span class="bubble-content">${contentHtml}</span>
        <span class="bubble-meta">${(new Date()).getHours().toString().padStart(2, '0')}:${(new Date()).getMinutes().toString().padStart(2, '0')}</span>
      </div>
    </div>
  `;
  // 头像 SVG
  createAvatarSVG(userName).then(svg => {
    bubbleWrap.querySelector('.avatar').innerHTML = svg;
  });
  chatArea.appendChild(bubbleWrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 添加系统信息消息
function addSystemMsg(text, isHistory = false) {
  if (!isHistory && activeRoomIndex >= 0) {
    roomsData[activeRoomIndex].messages.push({ type: 'system', text });
  }
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  const div = document.createElement('div');
  div.className = 'bubble system';
  const safeText = escapeHTML(text).replace(/\n/g, '<br>');
  div.innerHTML = `<span class="bubble-content">${safeText}</span>`;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 在控制台中添加全局方法
window.sendSystemMsg = function(message) {
  addSystemMsg(message);
};


// 渲染房间列表（动态多房间）
function renderRooms(activeId = 0) {
  const roomList = document.getElementById('room-list');
  roomList.innerHTML = '';
  roomsData.forEach((rd, i) => {
    const div = document.createElement('div');
    div.className = 'room' + (i === activeId ? ' active' : '');
    const safeRoomName = escapeHTML(rd.roomName);
    div.innerHTML = `
      <div class="info">
        <div class="title">#${safeRoomName}</div>
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
    let userName, roomName, password, btn;
    if (modal) {
      userName = document.getElementById('userName-modal').value.trim();
      roomName = document.getElementById('roomName-modal').value.trim();
      password = document.getElementById('password-modal').value.trim();
      btn = modal.querySelector('.login-btn');
    } else {
      userName = document.getElementById('userName').value.trim();
      roomName = document.getElementById('roomName').value.trim();
      password = document.getElementById('password').value.trim();
      btn = document.querySelector('#login-form .login-btn');
    }
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Connecting...';
    }
    joinRoom(userName, roomName, password, modal, function(success) {
      if (!success && btn) {
        btn.disabled = false;
        btn.innerText = 'ENTER';
      }
    });
  };
}

function setSidebarAvatar(userName) {
  if (!userName) return;
  createAvatarSVG(userName).then(svg => {
    const el = document.getElementById('sidebar-user-avatar');
    if (el) el.innerHTML = svg;
  });
}

function joinRoom(userName, roomName, password, modal = null, onResult) {
  // 生成房间数据并切换
  const newRd = getNewRoomData();
  newRd.roomName = roomName;
  newRd.myUserName = userName;
  newRd.password = password; // 保存密码
  roomsData.push(newRd);
  const idx = roomsData.length - 1;
  switchRoom(idx);
  // 更新侧边栏
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = userName;
  setSidebarAvatar(userName);
  // 初始化 ChatCrypt
  let closed = false;
  const callbacks = {
    onServerClosed: () => {
      setStatus('Node connection closed');
      if (onResult && !closed) { closed = true; onResult(false); }
    },
    onServerSecured: () => {
      setStatus('Secure connection to node');
      // 连接成功，隐藏登录界面或关闭modal
      if (modal) modal.remove();
      else document.getElementById('login-container').style.display = 'none';
      document.getElementById('chat-container').style.display = '';
      if (onResult && !closed) { closed = true; onResult(true); }
    },
    onClientSecured: (user) => handleClientSecured(idx, user),
    onClientList: (list, selfId) => handleClientList(idx, list, selfId),
    onClientLeft: (clientId) => handleClientLeft(idx, clientId),
    onClientMessage: (msg) => {
      if (msg.userName === newRd.myUserName) return;
      // 判断消息类型
      let msgType = msg.type || (msg.data && msg.data.startsWith('data:image/') ? 'image' : 'text');
      // 修正：如果msg.userName缺失，尝试从userMap查找
      let realUserName = msg.userName;
      if (!realUserName && msg.clientId && newRd.userMap[msg.clientId]) {
        realUserName = newRd.userMap[msg.clientId].userName || newRd.userMap[msg.clientId].username || newRd.userMap[msg.clientId].name;
      }
      roomsData[idx].messages.push({ type: 'other', text: msg.data, userName: realUserName, avatar: realUserName, msgType });
      if (activeRoomIndex === idx) renderChatArea();
    }
  };
  const chatInst = new window.ChatCrypt(config, callbacks);
  chatInst.setCredentials(userName, roomName, password);
  chatInst.connect();
  roomsData[idx].chat = chatInst;
}

// 禁止输入框输入空格的工具函数
function preventSpaceInput(input) {
  if (!input) return;
  input.addEventListener('keydown', function(e) {
    // 禁止空格和所有标点符号，允许英文单引号
    if (e.key === ' ' || (/[\u0000-\u007f]/.test(e.key) && /[\p{P}\p{S}]/u.test(e.key) && e.key !== "'")) {
      e.preventDefault();
    }
  });
  input.addEventListener('input', function(e) {
    // 替换所有空白和标点符号，允许英文单引号
    input.value = input.value.replace(/[\s\p{P}\p{S}]/gu, function(match) {
      return match === "'" ? "'" : '';
    });
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
          <label for="userName-modal">Username</label>
          <input id="userName-modal" type="text" autocomplete="username" required minlength="1" maxlength="15">
        </div>
        <div class="input-group">
          <label for="roomName-modal">Node Name</label>
          <input id="roomName-modal" type="text" required minlength="1" maxlength="15">
        </div>
        <div class="input-group">
          <label for="password-modal">Node Password <span class="optional">(optional)</span></label>
          <input id="password-modal" type="password" autocomplete="off" minlength="1" maxlength="15">
        </div>
        <button type="submit" class="login-btn">ENTER</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  // 关闭按钮
  modal.querySelector('.login-modal-close').onclick = () => modal.remove();
  // 禁止弹窗登录页输入框输入空格
  preventSpaceInput(modal.querySelector('#userName-modal'));
  preventSpaceInput(modal.querySelector('#roomName-modal'));
  preventSpaceInput(modal.querySelector('#password-modal'));
  // 表单提交逻辑，复用loginFormHandler但传入modal
  const form = modal.querySelector('#login-form-modal');
  form.addEventListener('submit', loginFormHandler(modal));
}

// 渲染主面板房间头部（UI占位）
function renderMainHeader() {
  const rd = roomsData[activeRoomIndex];
  let roomName = rd ? rd.roomName : 'Room';
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
        // 分享功能：生成带房间号和密码的链接
        if (activeRoomIndex >= 0 && roomsData[activeRoomIndex]) {
          const rd = roomsData[activeRoomIndex];
          const room = encodeURIComponent(rd.roomName || '');
          // 密码需要在 joinRoom 时存一份到 roomsData
          const pwd = encodeURIComponent(rd.password || '');
          const url = `${location.origin}${location.pathname}?node=${room}&pwd=${pwd}`;
          // 复制到剪贴板
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
              addSystemMsg('Share link copied!');
            }, () => {
              prompt('Copy failed, url:', url);
            });
          } else {
            prompt('Copy failed, url:', url);
          }
        }
        closeMenu();
      } else if (e.target.dataset.action === 'exit') {
        // 更彻底的退出/销毁逻辑
        if (activeRoomIndex >= 0 && roomsData[activeRoomIndex]) {
          const chatInst = roomsData[activeRoomIndex].chat;
          if (chatInst && typeof chatInst.destruct === 'function') {
            chatInst.destruct();
          } else if (chatInst && typeof chatInst.disconnect === 'function') {
            chatInst.disconnect();
          }
          roomsData[activeRoomIndex].chat = null;
          roomsData.splice(activeRoomIndex, 1);
          if (roomsData.length > 0) {
            switchRoom(0);
          } else {
            // 没有房间了，刷新页面
            location.reload();
          }
        }
        closeMenu();
      }
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
    <div class="img-modal-content" style="overflow:hidden;">
      <img src="${src}" style="max-width:90vw;max-height:90vh;cursor:grab;user-select:none;" />
      <span class="img-modal-close">&times;</span>
    </div>
  `;
  document.body.appendChild(modal);
  // 关闭逻辑
  modal.querySelector('.img-modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  // 支持缩放和拖动
  const img = modal.querySelector('img');
  let scale = 1;
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let offsetX = 0, offsetY = 0;
  img.ondragstart = function(e) { e.preventDefault(); };
  img.onwheel = function(ev) {
    ev.preventDefault();
    const prevScale = scale;
    scale += ev.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.max(0.2, Math.min(5, scale));
    // 缩放以图片中心为基准
    if (scale === 1) {
      offsetX = 0;
      offsetY = 0;
    } else if (prevScale !== scale) {
      // 缩放时保持当前偏移不变
    }
    updateTransform();
  };

  function updateTransform() {
    img.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
    img.style.cursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';
  }

  img.onmousedown = function(ev) {
    if (scale <= 1) return;
    isDragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    img.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };
  window.onmousemove = function(ev) {
    if (!isDragging) return;
    offsetX += ev.clientX - lastX;
    offsetY += ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    updateTransform();
  };
  window.onmouseup = function() {
    if (isDragging) {
      isDragging = false;
      img.style.cursor = 'grab';
      document.body.style.userSelect = '';
    }
  };
  // 双击还原
  img.ondblclick = function() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  };
  // 关闭时清理事件
  const cleanup = () => {
    window.onmousemove = null;
    window.onmouseup = null;
    document.body.style.userSelect = '';
  };
  modal.addEventListener('remove', cleanup);
  modal.querySelector('.img-modal-close').addEventListener('click', cleanup);
  // 初始化
  updateTransform();
}

// 自动填充房间号和密码（支持分享链接）
function autofillRoomPwd(formPrefix = '') {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('node');
  const pwd = params.get('pwd');
  if (room) {
    const roomInput = document.getElementById(formPrefix + 'roomName');
    if (roomInput) {
      roomInput.value = decodeURIComponent(room);
      roomInput.readOnly = true;
      roomInput.style.background = '#f5f5f5';
    }
  }
  if (pwd) {
    const pwdInput = document.getElementById(formPrefix + 'password');
    if (pwdInput) {
      pwdInput.value = decodeURIComponent(pwd);
      pwdInput.readOnly = true;
      pwdInput.style.background = '#f5f5f5';
    }
  }
  if (room || pwd) {
    window.history.replaceState({}, '', location.pathname);
  }
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
  preventSpaceInput(document.getElementById('userName'));
  preventSpaceInput(document.getElementById('roomName'));
  preventSpaceInput(document.getElementById('password'));

  autofillRoomPwd(); // 主登录页

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