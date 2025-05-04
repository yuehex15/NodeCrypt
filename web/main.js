import config from './config.js';

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
  currentRoom = rd.room;
  userList = rd.userList;
  userMap = rd.userMap;
  myId = rd.myId;
  myName = rd.myName;
  chat = rd.chat;
  // 同步更新sidebar用户名和头像
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = rd.myName;
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (avatarEl) avatarEl.innerHTML = getSvgAvatar(rd.myName, 44);
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
    if (m.type === 'me') addMsg(m.text, true);
    else addOtherMsg(m.text, m.name, m.avatar, true);
  });
}

// 生成简易SVG头像
function getSvgAvatar(text, size = 42) {
  const color = "#30a8f7";
  // 只取第一个字母大写
  const letter = text ? text[0].toUpperCase() : "?";
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/>
      <text x="50%" y="57%" text-anchor="middle" dominant-baseline="middle" font-size="${size/2}" fill="#fff" font-family="Arial, sans-serif">${letter}</text>
    </svg>
  `.replace(/\n/g, '');
}

// 在线用户列表数据结构
let userList = [];
let userMap = {};
let myId = null;
let currentRoom = '';

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
  div.innerHTML = `
    <span class="avatar">${getSvgAvatar(getInitials(user.username), 38)}</span>
    <div class="member-info">
      <div class="member-name">${escapeHTML(user.username)}${isMe ? ' (我)' : ''}</div>
    </div>
  `;
  // 不可点击
  return div;
}

// 处理服务器推送的在线用户列表
function handleClientList(idx, list, selfId) {
  const rd = roomsData[idx];
  if (!rd) return;
  rd.userList = list;
  rd.userMap = {};
  list.forEach(u => { rd.userMap[u.clientId] = u; });
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

let chat = null;
let myName = '';

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

function addMsg(text, isHistory = false) {
  // 只有新消息才记录
  if (!isHistory && activeRoomIndex >= 0) roomsData[activeRoomIndex].messages.push({ type: 'me', text });
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  const div = document.createElement('div');
  div.className = 'bubble me';
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  div.innerHTML = `<span class="bubble-content">${text}</span><span class="bubble-meta">${time}</span>`;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addOtherMsg(msg, name = '匿名', avatar = '', isHistory = false) {
  // 只有新消息才记录
  if (!isHistory && activeRoomIndex >= 0) roomsData[activeRoomIndex].messages.push({ type: 'other', text: msg, name, avatar });
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-other-wrap';
  bubbleWrap.innerHTML = `
    <span class="bubble-other-avatar">${getSvgAvatar(avatar || name, 32)}</span>
    <div class="bubble-other-main">
      <div class="bubble other">
        <div class="bubble-other-name">${name}</div>
        <span class="bubble-content">${msg.replace(/\n/g, '<br>')}</span>
        <span class="bubble-meta">${(new Date()).getHours().toString().padStart(2, '0')}:${(new Date()).getMinutes().toString().padStart(2, '0')}</span>
      </div>
    </div>
  `;
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
    div.innerHTML = `
      <div class="info">
        <div class="title">#${escapeHTML(rd.room)}</div>
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
    if (!username || !room) {
      alert('请输入用户名和房间名');
      return;
    }
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
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (avatarEl) avatarEl.innerHTML = getSvgAvatar(username, 44);
    // 隐藏登录界面
    if (modal) modal.remove();
    else document.getElementById('login-container').style.display = 'none';
    document.getElementById('chat-container').style.display = '';
    setStatus('正在连接...');
    // 初始化 ChatCrypt
    const callbacks = {
      onServerClosed: () => setStatus('服务器连接关闭'),
      onServerSecured: () => setStatus('与服务器安全连接已建立'),
      onClientSecured: (user) => handleClientSecured(idx, user),
      onClientList: (list, selfId) => handleClientList(idx, list, selfId),
      onClientLeft: (clientId) => handleClientLeft(idx, clientId),
      onClientMessage: (msg) => {
        if (msg.username === newRd.myName) return;
        roomsData[idx].messages.push({ type: 'other', text: msg.data, name: msg.username, avatar: msg.username });
        if (activeRoomIndex === idx) renderChatArea();
      }
    };
    chat = new window.ChatCrypt(config, callbacks);
    chat.setCredentials(username, room, password);
    chat.connect();
    roomsData[idx].chat = chat;
  };
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
      <h1>Sign in to Chatroom</h1>
      <p class="subtips">请输入用户名、房间名，房间密码可选</p>
      <form id="login-form-modal">
        <div class="input-group">
          <label for="username-modal">Username</label>
          <input id="username-modal" type="text" autocomplete="username" required="">
        </div>
        <div class="input-group">
          <label for="room-modal">Room Name</label>
          <input id="room-modal" type="text" required="">
        </div>
        <div class="input-group">
          <label for="password-modal">Room Password <span class="optional">(optional)</span></label>
          <input id="password-modal" type="password" autocomplete="off">
        </div>
        <button type="submit" class="login-btn">NEXT</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  // 关闭按钮
  modal.querySelector('.login-modal-close').onclick = () => modal.remove();
  // 表单提交逻辑，复用loginFormHandler但传入modal
  const form = modal.querySelector('#login-form-modal');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    // 获取输入
    const username = document.getElementById('username-modal').value.trim();
    const room = document.getElementById('room-modal').value.trim();
    const password = document.getElementById('password-modal').value.trim();
    if (!username || !room) {
      alert('请输入用户名和房间名');
      return;
    }
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
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (avatarEl) avatarEl.innerHTML = getSvgAvatar(username, 44);
    // 关闭modal
    modal.remove();
    document.getElementById('chat-container').style.display = '';
    setStatus('正在连接...');
    // 初始化 ChatCrypt
    const callbacks = {
      onServerClosed: () => setStatus('服务器连接关闭'),
      onServerSecured: () => setStatus('与服务器安全连接已建立'),
      onClientSecured: (user) => handleClientSecured(idx, user),
      onClientList: (list, selfId) => handleClientList(idx, list, selfId),
      onClientLeft: (clientId) => handleClientLeft(idx, clientId),
      onClientMessage: (msg) => {
        if (msg.username === newRd.myName) return;
        roomsData[idx].messages.push({ type: 'other', text: msg.data, name: msg.username, avatar: msg.username });
        if (activeRoomIndex === idx) renderChatArea();
      }
    };
    chat = new window.ChatCrypt(config, callbacks);
    chat.setCredentials(username, room, password);
    chat.connect();
    roomsData[idx].chat = chat;
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
  document.getElementById("main-header").innerHTML = `
    <div style="display: flex; align-items: center;">
      <div class="group-title" style="font-size: 1.22em; font-weight: bold;">#${escapeHTML(roomName)}</div>
      <span style="margin-left:10px;font-size:13px;color:#888;">${onlineCount} members</span>
    </div>
    <div class="main-header-actions">
      <button class="more-btn" id="more-btn" aria-label="更多选项">
        <span class="more-btn-dot"></span>
        <span class="more-btn-dot"></span>
        <span class="more-btn-dot"></span>
      </button>
      <div class="more-menu" id="more-menu">
        <div class="more-menu-item" data-action="share">分享</div>
        <div class="more-menu-item" data-action="exit">退出</div>
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
  let closeTimer = null;
  let animating = false;

  function openMenu() {
    menu.classList.remove('close');
    menu.classList.add('open');
    menu.style.display = 'block';
    menuRect = menu.getBoundingClientRect();
  }
  function closeMenu() {
    if (animating) return;
    animating = true;
    menu.classList.remove('open');
    menu.classList.add('close');
    setTimeout(() => {
      if (menu.classList.contains('close')) menu.style.display = 'none';
      animating = false;
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
        // 退出当前房间
        if (activeRoomIndex >= 0 && roomsData[activeRoomIndex]) {
          // 优先彻底销毁连接
          const chatInst = roomsData[activeRoomIndex].chat;
          if (chatInst && typeof chatInst.destruct === 'function') {
            chatInst.destruct();
          } else if (chatInst && typeof chatInst.disconnect === 'function') {
            chatInst.disconnect();
          }
          roomsData[activeRoomIndex].chat = null;
          // 移除房间
          roomsData.splice(activeRoomIndex, 1);
          if (roomsData.length > 0) {
            // 切换到第一个房间
            switchRoom(0);
          } else {
            // 没有房间了，回到登录
            activeRoomIndex = -1;
            document.getElementById('chat-container').style.display = 'none';
            document.getElementById('login-container').style.display = '';
          }
        }
      }
      closeMenu();
    }
  };

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
      window.removeEventListener('mousemove', onMouseMove);
    }
  }

  menu.addEventListener('mouseenter', function() {
    window.addEventListener('mousemove', onMouseMove);
  });
  menu.addEventListener('mouseleave', function() {
    window.addEventListener('mousemove', onMouseMove);
  });
  btn.addEventListener('mouseleave', function() {
    window.addEventListener('mousemove', onMouseMove);
  });
  btn.addEventListener('click', function() {
    if (menu.classList.contains('open')) {
      window.addEventListener('mousemove', onMouseMove);
    }
  });

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

  setupInputPlaceholder();
  setupMoreBtnMenu();

  // 自动聚焦到输入框
  const input = document.querySelector('.input-message-input');
  if (input) {
    input.focus();
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.innerText.trim();
        if (text && chat) {
          chat.sendChannelMessage('text', text);
          addMsg(text);
          input.innerText = '';
          input.dispatchEvent(new Event('input'));
        }
      }
    });
  }
});

// 初始化
renderRooms(activeRoomIndex);
renderMainHeader();
renderUserList();
setupTabs();
renderChatArea();