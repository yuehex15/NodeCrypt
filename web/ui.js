// 通用界面交互管理模块
import { createAvatarSVG } from './util.avatar.js';
import { roomsData, activeRoomIndex, togglePrivateChat, exitRoom } from './room.js';

/**
 * HTML转义，防止XSS攻击
 * @param {string} str 需要转义的字符串
 * @returns {string} 转义后的安全字符串
 */
// 导入工具库
import { escapeHTML } from './util.string.js';
import { $, $$, $id, createElement, on, off, addClass, removeClass, toggleClass } from './util.dom.js';

/**
 * 渲染主面板房间头部
 */
export function renderMainHeader() {
  const rd = roomsData[activeRoomIndex];
  let roomName = rd ? rd.roomName : 'Room';
  let onlineCount = rd && rd.userList ? rd.userList.length : 0;
  
  if (rd && !rd.userList.some(u => u.clientId === rd.myId)) {
    onlineCount += 1;
  }
  
  const safeRoomName = escapeHTML(roomName);
  
  // 头部结构：更多按钮和右侧栏按钮互换位置，右侧栏按钮在最右侧
  $id("main-header").innerHTML = `
    <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="打开侧栏">
      <svg width="35px" height="35px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M21.4498 10.275L11.9998 3.1875L2.5498 10.275L2.9998 11.625H3.7498V20.25H20.2498V11.625H20.9998L21.4498 10.275ZM5.2498 18.75V10.125L11.9998 5.0625L18.7498 10.125V18.75H14.9999V14.3333L14.2499 13.5833H9.74988L8.99988 14.3333V18.75H5.2498ZM10.4999 18.75H13.4999V15.0833H10.4999V18.75Z" fill="#808080"></path> </g></svg>
      </button>
    <div class="main-header-center" id="main-header-center">
      <div class="main-header-flex">
        <div class="group-title group-title-bold">#${safeRoomName}</div>
        <span class="main-header-members">${onlineCount} members</span>
      </div>
    </div>
    <div class="main-header-actions">
      <button class="more-btn" id="more-btn" aria-label="更多选项">
         <svg width="35px" height="35px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <circle cx="12" cy="6" r="1.5" fill="#808080"></circle> <circle cx="12" cy="12" r="1.5" fill="#808080"></circle> <circle cx="12" cy="18" r="1.5" fill="#808080"></circle> </g></svg>
      </button>
      <button class="mobile-info-btn" id="mobile-info-btn" aria-label="打开成员栏" >
        <svg width="35px" height="35px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M16.0603 18.307C14.89 19.0619 13.4962 19.5 12 19.5C10.5038 19.5 9.10996 19.0619 7.93972 18.307C8.66519 16.7938 10.2115 15.75 12 15.75C13.7886 15.75 15.3349 16.794 16.0603 18.307ZM17.2545 17.3516C16.2326 15.5027 14.2632 14.25 12 14.25C9.73663 14.25 7.76733 15.5029 6.74545 17.3516C5.3596 15.9907 4.5 14.0958 4.5 12C4.5 7.85786 7.85786 4.5 12 4.5C16.1421 4.5 19.5 7.85786 19.5 12C19.5 14.0958 18.6404 15.9908 17.2545 17.3516ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM12 12C13.2426 12 14.25 10.9926 14.25 9.75C14.25 8.50736 13.2426 7.5 12 7.5C10.7574 7.5 9.75 8.50736 9.75 9.75C9.75 10.9926 10.7574 12 12 12ZM12 13.5C14.0711 13.5 15.75 11.8211 15.75 9.75C15.75 7.67893 14.0711 6 12 6C9.92893 6 8.25 7.67893 8.25 9.75C8.25 11.8211 9.92893 13.5 12 13.5Z" fill="#808080"></path> </g></svg></button>
      <div class="more-menu" id="more-menu">
        <div class="more-menu-item" data-action="share">Share</div>
        <div class="more-menu-item" data-action="exit">Quit</div>
      </div>
    </div>
  `;
  
  setupMoreBtnMenu();
  setupMobileUIHandlers();
}

/**
 * 设置移动端UI事件处理
 */
export function setupMobileUIHandlers() {
  const sidebar = document.getElementById('sidebar');
  const rightbar = document.getElementById('rightbar');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileInfoBtn = document.getElementById('mobile-info-btn');
  const sidebarMask = document.getElementById('mobile-sidebar-mask');
  const rightbarMask = document.getElementById('mobile-rightbar-mask');
  
  function isMobile() {
    return window.innerWidth <= 768;
  }
  
  function updateMobileBtnDisplay() {
    if (isMobile()) {
      if (mobileMenuBtn) mobileMenuBtn.style.display = 'flex';
      if (mobileInfoBtn) mobileInfoBtn.style.display = 'flex';
    } else {
      if (mobileMenuBtn) mobileMenuBtn.style.display = 'none';
      if (mobileInfoBtn) mobileInfoBtn.style.display = 'none';
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (rightbar) rightbar.classList.remove('mobile-open');
      if (sidebarMask) sidebarMask.classList.remove('active');
      if (rightbarMask) rightbarMask.classList.remove('active');
    }
  }
  
  updateMobileBtnDisplay();
  window.addEventListener('resize', updateMobileBtnDisplay);
  
  if (mobileMenuBtn && sidebar && sidebarMask) {
    mobileMenuBtn.onclick = function(e) {
      e.stopPropagation();
      sidebar.classList.add('mobile-open');
      sidebarMask.classList.add('active');
    };
    
    sidebarMask.onclick = function() {
      sidebar.classList.remove('mobile-open');
      sidebarMask.classList.remove('active');
    };
  }
  
  if (mobileInfoBtn && rightbar && rightbarMask) {
    mobileInfoBtn.onclick = function(e) {
      e.stopPropagation();
      rightbar.classList.add('mobile-open');
      rightbarMask.classList.add('active');
    };
    
    rightbarMask.onclick = function() {
      rightbar.classList.remove('mobile-open');
      rightbarMask.classList.remove('active');
    };
  }
  
  // 点击其它区域关闭侧栏/右栏
  document.addEventListener('click', function(ev) {
    if (!isMobile()) return;
    
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      if (!sidebar.contains(ev.target) && ev.target !== mobileMenuBtn) {
        sidebar.classList.remove('mobile-open');
        if (sidebarMask) sidebarMask.classList.remove('active');
      }
    }
    
    if (rightbar && rightbar.classList.contains('mobile-open')) {
      if (!rightbar.contains(ev.target) && ev.target !== mobileInfoBtn) {
        rightbar.classList.remove('mobile-open');
        if (rightbarMask) rightbarMask.classList.remove('active');
      }
    }
  });
}

/**
 * 渲染在线用户列表
 */
export function renderUserList() {
  const userListEl = $id('member-list');
  userListEl.innerHTML = '';
  
  const rd = roomsData[activeRoomIndex];
  if (!rd) return;
  
  let me = rd.userList.find(u => u.clientId === rd.myId);
  let others = rd.userList.filter(u => u.clientId !== rd.myId);
  
  if (me) userListEl.appendChild(createUserItem(me, true));
  others.forEach(u => userListEl.appendChild(createUserItem(u, false)));
  
  renderMainHeader(); // 在线用户变化时刷新
}

/**
 * 创建用户列表项
 * @param {Object} user 用户数据
 * @param {boolean} isMe 是否为当前用户
 * @returns {HTMLElement} 创建的DOM元素
 */
export function createUserItem(user, isMe) {
  let div = document.createElement('div');
  const rd = roomsData[activeRoomIndex];
  const isPrivateTarget = rd && user.clientId === rd.privateChatTargetId;
  
  div.className = 'member' + (isMe ? ' me' : '') + (isPrivateTarget ? ' private-chat-active' : '');
  
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
  
  if (!isMe) {
    div.onclick = () => togglePrivateChat(user.clientId, safeUserName);
  }
  
  return div;
}

/**
 * 设置更多按钮菜单交互
 */
export function setupMoreBtnMenu() {
  const btn = $id('more-btn');
  const menu = $id('more-menu');
  
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
    if (isMouseMoveBound) {
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
          const pwd = encodeURIComponent(rd.password || '');
          const url = `${location.origin}${location.pathname}?node=${room}&pwd=${pwd}`;
          
          // 复制到剪贴板
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
              window.addSystemMsg('Share link copied!');
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
        const result = exitRoom();
        if (!result) {
          // 没有房间了，刷新页面
          location.reload();
        }
        closeMenu();
      }
    }
  };

  // 点击空白处关闭菜单
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

/**
 * 禁止输入框输入空格的工具函数
 * @param {HTMLElement} input 输入框元素
 */
export function preventSpaceInput(input) {
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

/**
 * 登录表单提交处理
 * @param {HTMLElement|null} modal 模态框元素
 * @returns {Function} 表单提交处理函数
 */
export function loginFormHandler(modal) {
  return function(e) {
    e.preventDefault();
    let userName, roomName, password, btn, roomInput, warnTip;
    
    if (modal) {
      userName = document.getElementById('userName-modal').value.trim();
      roomName = document.getElementById('roomName-modal').value.trim();
      password = document.getElementById('password-modal').value.trim();
      btn = modal.querySelector('.login-btn');
      roomInput = document.getElementById('roomName-modal');
    } else {
      userName = document.getElementById('userName').value.trim();
      roomName = document.getElementById('roomName').value.trim();
      password = document.getElementById('password').value.trim();
      btn = document.querySelector('#login-form .login-btn');
      roomInput = document.getElementById('roomName');
    }
    
    // 检查房间是否已存在（忽略大小写）
    const exists = roomsData.some(rd => rd.roomName && rd.roomName.toLowerCase() === roomName.toLowerCase());
    
    // 先移除旧的警告样式和提示
    if (roomInput) {
      roomInput.style.border = '';
      roomInput.style.background = '';
      if (roomInput._warnTip) {
        roomInput.parentNode.removeChild(roomInput._warnTip);
        roomInput._warnTip = null;
      }
    }
    
    if (exists) {
      // 添加红色警告样式和提示
      if (roomInput) {
        roomInput.style.border = '1.5px solid #e74c3c';
        roomInput.style.background = '#fff6f6';
        warnTip = document.createElement('div');
        warnTip.style.color = '#e74c3c';
        warnTip.style.fontSize = '13px';
        warnTip.style.marginTop = '4px';
        warnTip.textContent = 'Node already exists';
        roomInput.parentNode.appendChild(warnTip);
        roomInput._warnTip = warnTip;
        roomInput.focus();
      }
      
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'ENTER';
      }
      
      return;
    }
    
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Connecting...';
    }
    
    window.joinRoom(userName, roomName, password, modal, function(success) {
      if (!success && btn) {
        btn.disabled = false;
        btn.innerText = 'ENTER';
      }
    });
  };
}

/**
 * 打开新房间登录模态
 */
export function openLoginModal() {
  // 创建一个新的modal，内容copy初始登录页面
  const modal = document.createElement('div');
  modal.className = 'login-modal';
  
  // 复制登录表单内容
  modal.innerHTML = `
    <div class="login-modal-bg"></div>
    <div class="login-modal-card">
      <button class="login-modal-close login-modal-close-abs">&times;</button>
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
  
  // 自动填充URL参数
  autofillRoomPwd('userName-modal');
}

/**
 * 设置Tab切换
 */
export function setupTabs() {
  const tabs = document.getElementById("member-tabs").children;
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].onclick = function() {
      for (let j = 0; j < tabs.length; j++) tabs[j].classList.remove("active");
      this.classList.add("active");
    }
  }
}

/**
 * 自动填充房间号和密码（支持分享链接）
 * @param {string} formPrefix 表单前缀
 */
export function autofillRoomPwd(formPrefix = '') {
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
