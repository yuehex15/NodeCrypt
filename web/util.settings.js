// util.settings.js
// 设置面板逻辑（仅UI和本地存储，功能待实现）
import { $, $$, $id, createElement, on, off, addClass, removeClass } from './util.dom.js';

const DEFAULT_SETTINGS = {
  notify: false,  // 桌面通知
  sound: false    // 声音通知
};

function loadSettings() {
  let s = localStorage.getItem('settings');
  try {
    s = s ? JSON.parse(s) : {};
  } catch { s = {}; }
  return { ...DEFAULT_SETTINGS, ...s };
}

function saveSettings(settings) {
  const { notify, sound } = settings;
  localStorage.setItem('settings', JSON.stringify({ notify, sound }));
}

function applySettings(settings) {
  // 主题切换逻辑已移除
  // 强制英文
  document.documentElement.lang = 'en';
}

// 兼容各浏览器的 requestPermission 调用
function askNotificationPermission(callback) {
  if (Notification.requestPermission.length === 0) {
    // 返回 promise
    Notification.requestPermission().then(callback);
  } else {
    // 接受 callback
    Notification.requestPermission(callback);
  }
}

function setupSettingsPanel() {
  let panel = $id('settings-panel');
  if (!panel) {
    panel = createElement('div', {
      id: 'settings-panel',
      class: 'settings-panel'
    }, `
      <div class="settings-panel-card">
        <div class="settings-title">Settings</div>
        <div class="settings-item">
          <span>Desktop Notification</span>
          <label class="switch">
            <input type="checkbox" id="settings-notify">
            <span class="slider"></span>
          </label>
        </div>
        <div class="settings-item">
          <span>Sound Notification</span>
          <label class="switch">
            <input type="checkbox" id="settings-sound">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `);
    document.body.appendChild(panel);
  }
  const settings = loadSettings();
  // 初始化UI
  const notifyCheckbox = $('#settings-notify', panel);
  const soundCheckbox = $('#settings-sound', panel);
  
  if (notifyCheckbox) notifyCheckbox.checked = !!settings.notify;
  if (soundCheckbox) soundCheckbox.checked = !!settings.sound;
  // 事件
  on(notifyCheckbox, 'change', e => {
    const checked = e.target.checked;
    if (checked) {
      // 浏览器不支持时回退
      if (!('Notification' in window)) {
        alert('Notifications are not supported by your browser.');
        e.target.checked = false;
        return;
      }
      // 申请权限
      askNotificationPermission(permission => {
        if (permission === 'granted') {
          settings.notify = true;
          // 互斥：关闭声音
          settings.sound = false;
          if (soundCheckbox) soundCheckbox.checked = false;
          saveSettings(settings); applySettings(settings);
          // 测试推送
          new Notification('Notifications enabled', { body: 'You will receive alerts here.' });
        } else {
          // 用户拒绝或未做选择时回退并提示
          settings.notify = false;
          e.target.checked = false;
          saveSettings(settings); applySettings(settings);
          alert('Please allow notifications in your browser settings.');
        }
      });
    } else {
      settings.notify = false;
      saveSettings(settings); applySettings(settings);
    }
  });

  on(soundCheckbox, 'change', e => {
    settings.sound = e.target.checked;
    // 互斥：启用声音时关闭通知
    if (settings.sound) {
      settings.notify = false;
      if (notifyCheckbox) notifyCheckbox.checked = false;
    }
    saveSettings(settings); applySettings(settings);
  });
}

function openSettingsPanel() {
  setupSettingsPanel();
  const panel = $id('settings-panel');
  const btn = $id('settings-btn');
  if (!btn || !panel) return;
  if (panel.style.display === 'block') return;
  
  // 定位到按钮下方，始终与按钮对齐
  const btnRect = btn.getBoundingClientRect();
  panel.style.display = 'block';
  const card = $('.settings-panel-card', panel);
  
  if (!card) return;
  
  card.style.position = 'fixed';
  card.style.left = btnRect.left + 'px';
  card.style.top = (btnRect.bottom + 8) + 'px';
  card.style.transform = 'translateX(0)';
  removeClass(card, 'close-anim');
  addClass(card, 'open-anim');
  
  // 监听鼠标移出自动关闭（只绑定一次）
  function onMouseMove(ev) {
    const cardRect = card.getBoundingClientRect();
    const safe = 60;
    const mx = ev.clientX, my = ev.clientY;
    const inCard = mx >= cardRect.left - safe && mx <= cardRect.right + safe && 
                   my >= cardRect.top - safe && my <= cardRect.bottom + safe;
    const inBtn = mx >= btnRect.left - safe && mx <= btnRect.right + safe && 
                  my >= btnRect.top - safe && my <= btnRect.bottom + safe;
    
    if (!inCard && !inBtn) {
      closeSettingsPanel();
    }
  }
  
  function bindMouseMove() {
    if (!panel._mousemoveBound) {
      on(window, 'mousemove', onMouseMove);
      panel._mousemoveBound = true;
    }
  }
  
  function unbindMouseMove() {
    if (panel._mousemoveBound) {
      off(window, 'mousemove', onMouseMove);
      panel._mousemoveBound = false;
    }
  }
  
  bindMouseMove();
  panel._unbind = unbindMouseMove;
}

function closeSettingsPanel() {
  const panel = $id('settings-panel');
  if (!panel) return;
  const card = $('.settings-panel-card', panel);
  if (!card) return;
  
  removeClass(card, 'open-anim');
  addClass(card, 'close-anim');
  
  if (panel._unbind) panel._unbind();
  
  setTimeout(() => {
    panel.style.display = 'none';
    removeClass(card, 'close-anim');
  }, 180);
}

function initSettings() {
  const settings = loadSettings();
  applySettings(settings);
}

// 新增通知逻辑
const MAX_NOTIFY_TEXT_LEN = 100;
function truncateText(text) {
  return text.length > MAX_NOTIFY_TEXT_LEN ? text.slice(0, MAX_NOTIFY_TEXT_LEN) + '...' : text;
}
function playSoundNotification() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1000;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    setTimeout(() => { osc.stop(); ctx.close(); }, 600);
  } catch (e) {
    console.error('Sound notification failed', e);
  }
}
function showDesktopNotification(roomName, text, msgType, sender) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  let body;
  const senderPrefix = sender ? `${sender}: ` : '';

  if (msgType === 'image' || msgType === 'private image') {
    body = `${senderPrefix}[image]`;
    if (msgType === 'private image') {
      body = `(Private) ${body}`;
    }
  } else if (msgType === 'text' || msgType === 'private text') {
    body = `${senderPrefix}${truncateText(text)}`;
    if (msgType === 'private text') {
      body = `(Private) ${body}`;
    }
  } else { // Fallback for other types, e.g., 'system'
    body = truncateText(text);
  }
  new Notification(`#${roomName}`, { body });
}
/**
 * 通知入口：根据设置决定桌面通知或声音通知
 * @param {string} roomName 房间名
 * @param {string} msgType 消息类型 'text' | 'image'
 * @param {string} text 消息文本
 * @param {string} sender 发消息人
 */
export function notifyMessage(roomName, msgType, text, sender) {
  const settings = loadSettings();
  if (settings.notify) {
    showDesktopNotification(roomName, text, msgType, sender);
  } else if (settings.sound) {
    playSoundNotification();
  }
}

export { openSettingsPanel, closeSettingsPanel, initSettings };
