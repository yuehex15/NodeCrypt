// util.emoji.js
// 极简表情选择器模块
import { $, $$, createElement, on } from './util.dom.js';

const EMOJIS = [
  '😀','😁','😅','🤣','🙂','😞','😮','🥺','😨','😱','😢','😭','😓','😫','🥱','💤','😤','😡','🤬','🥵',
  '🙈','🙉','🙊','💩','🤡','👻','💗','💋','👅','😍','😘','🤗','🤫','🤔','🤐','😏','🤮','🤯',
  '👋','👌','✌','👍','😑','👏','🙌','🤝','🙏','🖕','🍆'
];


export function setupEmojiPicker({ btnSelector = '.chat-emoji-btn', inputSelector = '.input-message-input' } = {}) {
  const btn = $(btnSelector);
  const input = $(inputSelector);
  if (!btn || !input) return;
  
  const panel = createElement('div', { class: 'emoji-panel' });
  panel.style.display = 'none'; // 确保面板默认隐藏
  
  // 样式已交由 style.css 控制，这里不再内联 style
  EMOJIS.forEach(e => {
    const span = createElement('span', { 
      textContent: e,
      onclick: () => {
        insertEmoji(input, e);
        panel.style.display = 'none';
      }
    });
    
    // 仅设置必要的交互属性，视觉交由 CSS
    on(span, 'mouseenter', () => span.style.background = '');
    on(span, 'mouseleave', () => span.style.background = '');
    
    panel.appendChild(span);
  });
  
  btn.parentNode.style.position = 'relative';
  btn.parentNode.appendChild(panel);
  
  on(btn, 'click', (ev) => {
    ev.stopPropagation();
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
  
  on(document, 'click', (ev) => {
    if (!panel.contains(ev.target) && ev.target !== btn) panel.style.display = 'none';
  });
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
