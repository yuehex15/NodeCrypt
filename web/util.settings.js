// util.settings.js
// 设置面板逻辑（仅UI和本地存储，功能待实现）

const DEFAULT_SETTINGS = {
  lang: 'zh',     // 'zh' | 'en'
  notify: true,   // 桌面通知
  sound: true     // 声音通知
};

function loadSettings() {
  let s = localStorage.getItem('settings');
  try {
    s = s ? JSON.parse(s) : {};
  } catch { s = {}; }
  return { ...DEFAULT_SETTINGS, ...s };
}

function saveSettings(settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
}

function applySettings(settings) {
  // 主题切换逻辑已移除
  // 语言切换（仅UI，功能待实现）
  document.documentElement.lang = settings.lang;
  // 通知/声音逻辑待实现
}

function setupSettingsPanel() {
  let panel = document.getElementById('settings-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-panel-card">
        <div class="settings-title">设置</div>
        <div class="settings-item">
          <span>语言</span>
          <select id="settings-lang">
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="settings-item">
          <span>桌面通知</span>
          <label class="switch">
            <input type="checkbox" id="settings-notify">
            <span class="slider"></span>
          </label>
        </div>
        <div class="settings-item">
          <span>声音通知</span>
          <label class="switch">
            <input type="checkbox" id="settings-sound">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }
  const settings = loadSettings();
  // 初始化UI
  panel.querySelector('#settings-lang').value = settings.lang;
  panel.querySelector('#settings-notify').checked = !!settings.notify;
  panel.querySelector('#settings-sound').checked = !!settings.sound;
  // 事件
  panel.querySelector('#settings-lang').onchange = e => {
    settings.lang = e.target.value;
    saveSettings(settings); applySettings(settings);
  };
  panel.querySelector('#settings-notify').onchange = e => {
    settings.notify = e.target.checked;
    saveSettings(settings); applySettings(settings);
  };
  panel.querySelector('#settings-sound').onchange = e => {
    settings.sound = e.target.checked;
    saveSettings(settings); applySettings(settings);
  };
}

function openSettingsPanel() {
  setupSettingsPanel();
  const panel = document.getElementById('settings-panel');
  const btn = document.getElementById('settings-btn');
  if (!btn || !panel) return;
  if (panel.style.display === 'block') return;
  // 定位到按钮下方，始终与按钮对齐
  const btnRect = btn.getBoundingClientRect();
  panel.style.display = 'block';
  const card = panel.querySelector('.settings-panel-card');
  card.style.position = 'fixed';
  card.style.left = btnRect.left + 'px';
  card.style.top = (btnRect.bottom + 8) + 'px';
  card.style.transform = 'translateX(0)';
  card.classList.remove('close-anim');
  card.classList.add('open-anim');
  // 监听鼠标移出自动关闭（只绑定一次）
  function onMouseMove(ev) {
    const cardRect = card.getBoundingClientRect();
    const safe = 60;
    const mx = ev.clientX, my = ev.clientY;
    const inCard = mx >= cardRect.left - safe && mx <= cardRect.right + safe && my >= cardRect.top - safe && my <= cardRect.bottom + safe;
    const inBtn = mx >= btnRect.left - safe && mx <= btnRect.right + safe && my >= btnRect.top - safe && my <= btnRect.bottom + safe;
    if (!inCard && !inBtn) {
      closeSettingsPanel();
    }
  }
  function bindMouseMove() {
    if (!panel._mousemoveBound) {
      window.addEventListener('mousemove', onMouseMove);
      panel._mousemoveBound = true;
    }
  }
  function unbindMouseMove() {
    if (panel._mousemoveBound) {
      window.removeEventListener('mousemove', onMouseMove);
      panel._mousemoveBound = false;
    }
  }
  bindMouseMove();
  panel._unbind = unbindMouseMove;
}

function closeSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  const card = panel.querySelector('.settings-panel-card');
  if (!card) return;
  card.classList.remove('open-anim');
  card.classList.add('close-anim');
  if (panel._unbind) panel._unbind();
  setTimeout(() => {
    panel.style.display = 'none';
    card.classList.remove('close-anim');
  }, 180);
}

function initSettings() {
  const settings = loadSettings();
  applySettings(settings);
}

export { openSettingsPanel, closeSettingsPanel, initSettings };
