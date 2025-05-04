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
function renderMainHeader(roomId = 0) {
  document.getElementById("main-header").innerHTML = `
    <div style="display: flex; align-items: center;">
      <span class="avatar">${getSvgAvatar("R"+(roomId+1), 40)}</span>
      <div class="group-title">Room ${roomId+1}</div>
      <span style="margin-left:10px;font-size:13px;color:#888;">${MEMBER_COUNT} members</span>
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
  setupMoreBtnMenu(); // 每次渲染都重新绑定事件
}

// 清空消息区（UI占位）
function clearChat() {
  document.getElementById("chat-area").innerHTML = "";
}

// 渲染成员列表（UI占位）
function renderMembers() {
  const list = document.getElementById("member-list");
  list.innerHTML = "";
  for (let i = 0; i < MEMBER_COUNT; i++) {
    const div = document.createElement("div");
    div.className = "member";
    div.innerHTML = `
      <span class="avatar">${getSvgAvatar("U"+(i+1), 38)}</span>
      <div class="member-info">
        <div class="member-name">User${i+1}</div>
        <div class="member-status"></div>
      </div>
    `;
    list.appendChild(div);
  }
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
  // 登录表单逻辑
  const loginContainer = document.getElementById('login-container');
  const chatContainer = document.getElementById('chat-container');
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      // 简单校验
      const username = document.getElementById('username').value.trim();
      const room = document.getElementById('room').value.trim();
      // 密码可选
      if (!username || !room) {
        alert('请输入用户名和房间名');
        return;
      }
      // 隐藏登录页，显示聊天主界面
      loginContainer.style.display = 'none';
      chatContainer.style.display = '';
      // 设置用户名到侧边栏
      const sidebarUsername = document.getElementById('sidebar-username');
      if (sidebarUsername) sidebarUsername.textContent = username;
      // 设置头像
      const avatar = document.getElementById('sidebar-user-avatar');
      if (avatar) avatar.innerHTML = getSvgAvatar(username, 44);
      // 可根据room名做房间切换，这里简单模拟
    });
  }

  setupInputPlaceholder();
  setupMoreBtnMenu();

  // 自动聚焦到输入框
  const input = document.querySelector('.input-message-input');
  if (input) {
    input.focus();
  }

  // 回车发送消息
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.innerText.trim();
      if (text) {
        const chatArea = document.getElementById('chat-area');
        const bubble = document.createElement('div');
        bubble.className = 'bubble me';
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        bubble.innerHTML = `
          <span class="bubble-content">${text.replace(/\n/g, '<br>')}</span>
          <span class="bubble-meta">${time}</span>
        `;
        chatArea.appendChild(bubble);
        chatArea.scrollTop = chatArea.scrollHeight;
        input.innerText = '';
        input.dispatchEvent(new Event('input'));
      }
    }
  });

  // 添加一个别人发的消息示例（带头像和名字）
  window.addOtherMessage = function(msg, name = 'Alice', avatar = 'A') {
    const chatArea = document.getElementById('chat-area');
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'bubble-other-wrap';
    bubbleWrap.innerHTML = `
      <span class="bubble-other-avatar">${avatar}</span>
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
  };
});

// 初始化
renderRooms();
renderMainHeader();
renderMembers();
setupTabs();
clearChat();