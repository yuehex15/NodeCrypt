// util.emoji.js
// 使用emoji-picker-element库的表情选择器模块
import { $, $$, createElement, on } from './util.dom.js';

// 加载emoji-picker-element库
const loadEmojiPickerScript = () => {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="emoji-picker-element"]')) {
      resolve(); // 如果脚本已加载，直接解析
      return;
    }
    
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// 添加emoji-picker元素的默认样式
const addEmojiPickerStyles = () => {
  if (document.querySelector('#emoji-picker-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'emoji-picker-styles';
  style.textContent = `
    emoji-picker {
      --background: #fff;
      --border-color: rgba(0, 0, 0, 0.1);
      --border-radius: 10px;
      --emoji-padding: 0.4rem;
      --category-emoji-size: 1.2rem;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      position: absolute;
      bottom: 60px;
      left: 22px;
      z-index: 5;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
      animation: emoji-panel-fade-in 0.18s;
      width: 320px;
      display: none;
    }
    @keyframes emoji-panel-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
};

export async function setupEmojiPicker({ btnSelector = '.chat-emoji-btn', inputSelector = '.input-message-input' } = {}) {
  const btn = $(btnSelector);
  const input = $(inputSelector);
  if (!btn || !input) return;
  
  try {
    await loadEmojiPickerScript();
    addEmojiPickerStyles();
    
    // 移除可能存在的旧表情选择器
    const oldPicker = $('emoji-picker', btn.parentNode);
    if (oldPicker) oldPicker.remove();
    
    // 创建新的emoji-picker元素
    const picker = document.createElement('emoji-picker');
    picker.style.display = 'none';
    
    // 确保按钮父元素有相对定位
    btn.parentNode.style.position = 'relative';
    btn.parentNode.appendChild(picker);
    
    // 监听emoji选择事件
    picker.addEventListener('emoji-click', event => {
      insertEmoji(input, event.detail.unicode);
      picker.style.display = 'none';
    });
    
    // 切换表情面板显示/隐藏
    on(btn, 'click', (ev) => {
      ev.stopPropagation();
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    });
    
    // 点击其他地方关闭表情面板
    on(document, 'click', (ev) => {
      if (!picker.contains(ev.target) && ev.target !== btn) {
        picker.style.display = 'none';
      }
    });
    
    console.log('Emoji picker initialized successfully');
  } catch (error) {
    console.error('Failed to initialize emoji picker:', error);
  }
}

function insertEmoji(input, emoji) {
  input.focus();
  if (document.getSelection && window.getSelection) {
    let sel = window.getSelection();
    if (!sel.rangeCount) return;
    let range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(emoji));
    // 移动光标到表情后
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    input.innerText += emoji;
  }
  input.dispatchEvent(new Event('input'));
}
