// util.emoji.js
// 极简表情选择器模块
const EMOJIS = [
  '😀','😁','😅','🤣','🙂','😞','😮','🥺','😨','😱','😢','😭','😓','😫','🥱','💤','😤','😡','🤬',
  '🙈','🙉','🙊','💩','🤡','👻','💗','💋','👅','😍','😘','🤗','🫣','🤫','🤔','🤐','😏','🤮','😵‍💫','🤯',
  '👋','👌','✌','👍','👏','🙌','🤝','🖕','🙏','🍆'
];

export function setupEmojiPicker({ btnSelector = '.chat-emoji-btn', inputSelector = '.input-message-input' } = {}) {
  const btn = document.querySelector(btnSelector);
  const input = document.querySelector(inputSelector);
  if (!btn || !input) return;
  let panel = document.createElement('div');
  panel.className = 'emoji-panel';
  // 样式已交由 style.css 控制，这里不再内联 style
  EMOJIS.forEach(e => {
    let span = document.createElement('span');
    span.textContent = e;
    // 仅设置必要的交互属性，视觉交由 CSS
    span.onmouseenter = () => span.style.background = '';
    span.onmouseleave = () => span.style.background = '';
    span.onclick = () => {
      insertEmoji(input, e);
      panel.style.display = 'none';
    };
    panel.appendChild(span);
  });
  btn.parentNode.style.position = 'relative';
  btn.parentNode.appendChild(panel);
  btn.onclick = (ev) => {
    ev.stopPropagation();
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  };
  document.addEventListener('click', (ev) => {
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
