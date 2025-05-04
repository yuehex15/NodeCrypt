import config from './config.js';

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
  // 不再提前 return，让 main-header 始终刷新
  let me = userList.find(u => u.clientId === myId);
  let others = userList.filter(u => u.clientId !== myId);
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
function handleClientList(list, selfId) {
  userList = list;
  userMap = {};
  userList.forEach(u => { userMap[u.clientId] = u; });
  myId = selfId;
  renderUserList();
}
// 新用户上线或资料变更
function handleClientSecured(user) {
  let idx = userList.findIndex(u => u.clientId === user.clientId);
  if (idx === -1) {
    userList.push(user);
  } else {
    userList[idx] = user;
  }
  userMap[user.clientId] = user;
  renderUserList();
}
// 用户下线
function handleClientLeft(clientId) {
  userList = userList.filter(u => u.clientId !== clientId);
  delete userMap[clientId];
  renderUserList();
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

function addMsg(text) {
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

function addOtherMsg(msg, name = '匿名', avatar = '') {
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

// 占位房间和成员数量，实际项目请用你的数据替换
const ROOM_COUNT = 4;
const MEMBER_COUNT = 8;

// 渲染房间列表（UI占位）
function renderRooms(activeId = 0) {
  const roomList = document.getElementById("room-list");
  roomList.innerHTML = "";
  for (let i = 0; i < ROOM_COUNT; i++) {
    const div = document.createElement("div");
    div.className = "room" + (i === activeId ? " active" : "");
    div.innerHTML = `
      <span class="avatar">${getSvgAvatar("R"+(i+1), 42)}</span>
      <div class="info">
        <div class="title">Room ${i+1}</div>
        <div class="lastmsg"></div>
      </div>
      <div class="time"></div>
    `;
    div.onclick = () => {
      renderRooms(i);
      renderMainHeader(i);
      clearChat();
    };
    roomList.appendChild(div);
  }
}

// 渲染主面板房间头部（UI占位）
function renderMainHeader() {
  // 取当前房间名和在线人数
  let roomName = currentRoom || 'Room';
  // 如果用户列表不包含自己，则显示人数+1
  let onlineCount = userList && userList.length ? userList.length : 0;
  if (!userList.some(u => u.clientId === myId)) {
    onlineCount += 1;
  }
  document.getElementById("main-header").innerHTML = `
    <div style="display: flex; align-items: center;">
      <span class="avatar">${getSvgAvatar(roomName[0] || 'R', 40)}</span>
      <div class="group-title">${escapeHTML(roomName)}</div>
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
    if (animating) return;
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
        alert('退出功能待实现');
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
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const room = document.getElementById('room').value.trim();
      const password = document.getElementById('password').value.trim();
      if (!username || !room) {
        alert('请输入用户名和房间名');
        return;
      }
      myName = username;
      currentRoom = room;
      loginContainer.style.display = 'none';
      chatContainer.style.display = '';
      const sidebarUsername = document.getElementById('sidebar-username');
      if (sidebarUsername) sidebarUsername.textContent = username;
      const avatar = document.getElementById('sidebar-user-avatar');
      if (avatar) avatar.innerHTML = getSvgAvatar(username, 44);
      setStatus('正在连接...');
      renderMainHeader(); // 登录后立即渲染一次
      // 初始化 ChatCrypt
      const callbacks = {
        onServerClosed: () => setStatus('服务器连接关闭'),
        onServerSecured: () => setStatus('与服务器安全连接已建立'),
        onClientSecured: (user) => handleClientSecured(user),
        onClientList: (list, selfId) => handleClientList(list, selfId),
        onClientLeft: (clientId) => handleClientLeft(clientId),
        onClientMessage: (msg) => {
          if (msg.username === myName) return;
          addOtherMsg(msg.data, msg.username, msg.username);
        }
      };
      chat = new window.ChatCrypt(config, callbacks);
      chat.setCredentials(username, room, password);
      chat.connect();
    });
  }

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
renderRooms();
renderMainHeader();
renderUserList();
setupTabs();
clearChat();