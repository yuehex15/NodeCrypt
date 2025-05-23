// 房间逻辑管理模块
import { createAvatarSVG } from './util.avatar.js';
import { renderChatArea, addSystemMsg, updateChatInputStyle } from './chat.js';
import { renderMainHeader, renderUserList } from './ui.js';
import { escapeHTML } from './util.string.js';
import { $id, createElement } from './util.dom.js';

// 多房间状态管理
let roomsData = [];
let activeRoomIndex = -1;

/**
 * 创建新房间数据结构
 * @returns {Object} 新的房间数据对象
 */
export function getNewRoomData() {
  return { 
    roomName: '', 
    userList: [], 
    userMap: {}, 
    myId: null, 
    myUserName: '', 
    chat: null, 
    messages: [], 
    prevUserList: [], 
    knownUserIds: new Set(), 
    unreadCount: 0, 
    privateChatTargetId: null, 
    privateChatTargetName: null 
  };
}

/**
 * 切换房间并恢复上下文，更新 UI
 * @param {number} index 房间索引
 */
export function switchRoom(index) {
  if (index < 0 || index >= roomsData.length) return;
  activeRoomIndex = index;
  const rd = roomsData[index];
  
  // 清零未读数
  if (typeof rd.unreadCount === 'number') rd.unreadCount = 0;
  
  // 恢复 sidebar-username、sidebar-user-avatar id
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = rd.myUserName;
  setSidebarAvatar(rd.myUserName);
  
  renderRooms(index);
  // 先渲染头部信息
  renderMainHeader();
  // 再渲染用户列表，不再重复更新头部
  renderUserList(false);
  renderChatArea();
  updateChatInputStyle(); // 根据新房间更新输入框样式
}

/**
 * 设置侧边栏头像
 * @param {string} userName 用户名
 */
export function setSidebarAvatar(userName) {
  if (!userName) return;
  const svg = createAvatarSVG(userName);
  const el = $id('sidebar-user-avatar');
  if (el) {
    // 清理SVG，移除任何可能的脚本内容
    const cleanSvg = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    el.innerHTML = cleanSvg;
  }
}

/**
 * 渲染房间列表
 * @param {number} activeId 当前激活的房间索引
 */
export function renderRooms(activeId = 0) {
  const roomList = $id('room-list');
  roomList.innerHTML = '';
  roomsData.forEach((rd, i) => {
    const div = createElement('div', { 
      class: 'room' + (i === activeId ? ' active' : ''),
      onclick: () => switchRoom(i)
    });
    
    const safeRoomName = escapeHTML(rd.roomName);
    let unreadHtml = '';
    if (rd.unreadCount && i !== activeId) {
      unreadHtml = `<span class="room-unread-badge">${rd.unreadCount > 99 ? '99+' : rd.unreadCount}</span>`;
    }
    
    div.innerHTML = `
      <div class="info">
        <div class="title">#${safeRoomName}</div>
      </div>
      ${unreadHtml}
    `;
    
    roomList.appendChild(div);
  });
}

/**
 * 加入房间
 * @param {string} userName 用户名
 * @param {string} roomName 房间名
 * @param {string} password 密码
 * @param {HTMLElement|null} modal 模态框元素
 * @param {Function} onResult 结果回调
 */
export function joinRoom(userName, roomName, password, modal = null, onResult) {
  // 生成房间数据并切换
  const newRd = getNewRoomData();
  newRd.roomName = roomName;
  newRd.myUserName = userName;
  newRd.password = password; // 保存密码
  roomsData.push(newRd);
  const idx = roomsData.length - 1;
  switchRoom(idx);
  
  // 更新侧边栏
  const sidebarUsername = $id('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = userName;
  setSidebarAvatar(userName);
  
  // 初始化 ChatCrypt
  let closed = false;
  const callbacks = {
    onServerClosed: () => {
      setStatus('Node connection closed');
      if (onResult && !closed) { closed = true; onResult(false); }
    },    onServerSecured: () => {
      setStatus('Secure connection to node');
      // 连接成功，隐藏登录界面或关闭modal
      if (modal) modal.remove();
      else {
        const loginContainer = $id('login-container');
        if (loginContainer) loginContainer.style.display = 'none';
        
        const chatContainer = $id('chat-container');
        if (chatContainer) chatContainer.style.display = '';
      }
      if (onResult && !closed) { closed = true; onResult(true); }
      
      // 添加服务器连接安全的系统消息
      addSystemMsg("Server connection secured");
    },
    onClientSecured: (user) => handleClientSecured(idx, user),
    onClientList: (list, selfId) => handleClientList(idx, list, selfId),
    onClientLeft: (clientId) => handleClientLeft(idx, clientId), 
    onClientMessage: (msg) => handleClientMessage(idx, msg)
  };
  
  const chatInst = new window.ChatCrypt(window.config, callbacks);
  chatInst.setCredentials(userName, roomName, password);
  chatInst.connect();
  roomsData[idx].chat = chatInst;
}

/**
 * 处理服务器推送的在线用户列表
 * @param {number} idx 房间索引
 * @param {Array} list 用户列表
 * @param {string} selfId 自己的ID
 */
export function handleClientList(idx, list, selfId) {
  const rd = roomsData[idx];
  if (!rd) return;
  
  // 记录旧用户ID集合
  const oldUserIds = new Set((rd.userList || []).map(u => u.clientId));
  
  // 新用户ID集合
  const newUserIds = new Set(list.map(u => u.clientId));
  
  // 检查退出用户（旧有，新没有），并调用 handleClientLeft
  for (const oldId of oldUserIds) {
    if (!newUserIds.has(oldId)) {
      handleClientLeft(idx, oldId);
    }
  }
  
  // 更新在线用户列表和映射
  rd.userList = list;
  rd.userMap = {};
  list.forEach(u => { rd.userMap[u.clientId] = u; });
  rd.myId = selfId;
  
  // 确保当前活动房间的界面刷新
  if (activeRoomIndex === idx) {
    // 先渲染用户列表，不同时更新头部信息
    renderUserList(false);
    // 然后单独渲染头部信息
    renderMainHeader();
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

/**
 * 处理用户成功连接（加密链接建立）
 * @param {number} idx 房间索引
 * @param {Object} user 用户数据
 */
export function handleClientSecured(idx, user) {
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
    // 先渲染用户列表，不同时更新头部信息
    renderUserList(false);
    // 然后单独渲染头部信息
    renderMainHeader();
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
    const msg = `${name} joined`;
    rd.messages.push({ type: 'system', text: msg });
    if (activeRoomIndex === idx) addSystemMsg(msg, true);
    
    // 系统通知
    if (window.notifyMessage) {
      window.notifyMessage(rd.roomName, 'system', msg);
    }
  }
}

/**
 * 处理用户下线
 * @param {number} idx 房间索引
 * @param {string} clientId 用户ID
 */
export function handleClientLeft(idx, clientId) {
  const rd = roomsData[idx];
  if (!rd) return;

  // 如果离开的用户是私聊目标，退出私聊模式
  if (rd.privateChatTargetId === clientId) {
    rd.privateChatTargetId = null;
    rd.privateChatTargetName = null;
    if (activeRoomIndex === idx) {
      updateChatInputStyle();
    }
  }

  const user = rd.userMap[clientId];
  // 退出提示逻辑：不再依赖 isInitialized，任何时候都提示
  const name = user ? (user.userName || user.username || user.name || 'Anonymous') : 'Anonymous';
  const msg = `${name} left`;
  rd.messages.push({ type: 'system', text: msg });
  if (activeRoomIndex === idx) addSystemMsg(msg, true);
  
  rd.userList = rd.userList.filter(u => u.clientId !== clientId);
  delete rd.userMap[clientId];
  
  if (activeRoomIndex === idx) {
    // 先渲染用户列表，不同时更新头部信息
    renderUserList(false);
    // 然后单独渲染头部信息
    renderMainHeader();
  }
}

/**
 * 处理接收到的客户端消息
 * @param {number} idx 房间索引
 * @param {Object} msg 消息对象
 */
export function handleClientMessage(idx, msg) {
  const newRd = roomsData[idx];
  if (!newRd) return;

  if (msg.userName === newRd.myUserName && !msg.type.includes('_private')) { 
    // 允许接收自己的私信（如果服务器回传）
    const currentRd = roomsData[idx];
    if (currentRd && msg.clientId === currentRd.myId && msg.type.includes('_private')) {
      // 这是我自己私信的回传，不做处理
    } else if (msg.clientId === newRd.myId) { // 标准自发消息，忽略
      return;
    }
  }
  
  // 判断消息类型
  let msgType = msg.type || 'text'; 
  if (!msgType.includes('_private') && msg.data && msg.data.startsWith('data:image/')) {
    msgType = 'image';
  }

  // 如果msg.userName缺失，尝试从userMap查找
  let realUserName = msg.userName;
  if (!realUserName && msg.clientId && newRd.userMap[msg.clientId]) {
    realUserName = newRd.userMap[msg.clientId].userName || newRd.userMap[msg.clientId].username || newRd.userMap[msg.clientId].name;
  }
  
  roomsData[idx].messages.push({
    type: 'other',
    text: msg.data,
    userName: realUserName,
    avatar: realUserName,
    msgType,
    timestamp: Date.now()
  });
  
  // 通知消息，无论当前房间是否激活
  const notificationMsgType = msgType.includes('_private') ? `private ${msgType.split('_')[0]}` : msgType;
  if (window.notifyMessage) {
    window.notifyMessage(newRd.roomName, notificationMsgType, msg.data, realUserName);
  }
  
  // 未读数逻辑
  if (activeRoomIndex !== idx) {
    roomsData[idx].unreadCount = (roomsData[idx].unreadCount || 0) + 1;
    renderRooms(activeRoomIndex);
  } else {
    renderChatArea();
  }
}

/**
 * 切换私聊模式
 * @param {string} targetId 目标用户ID
 * @param {string} targetName 目标用户名
 */
export function togglePrivateChat(targetId, targetName) {
  const rd = roomsData[activeRoomIndex];
  if (!rd) return;

  if (rd.privateChatTargetId === targetId) {
    // 点击同一个用户，退出私聊模式
    rd.privateChatTargetId = null;
    rd.privateChatTargetName = null;
  } else {
    // 切换到新用户或进入私聊模式
    rd.privateChatTargetId = targetId;
    rd.privateChatTargetName = targetName;
  }
  
  renderUserList(); // 重新渲染以更新活动卡片样式
  updateChatInputStyle(); // 更新输入提示和样式
}

/**
 * 设置状态消息
 * @param {string} text 状态文本
 */
export function setStatus(text) {
  let statusBar = $id('status-bar');
  if (!statusBar) {
    statusBar = createElement('div', {
      id: 'status-bar',
      style: 'color:green;padding:4px 10px;font-size:13px;'
    });
    document.body.appendChild(statusBar);
  }
  statusBar.innerText = text;
}

/**
 * 退出房间
 * @returns {boolean} 是否成功退出
 */
export function exitRoom() {
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
      return true;
    } else {
      // 没有房间了，返回false表示需要重载页面
      return false;
    }
  }
  return false;
}

// 导出房间状态管理
export { roomsData, activeRoomIndex };
