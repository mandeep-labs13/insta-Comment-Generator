/* ===========================================================
   Comment Bay — Instagram comment sticker renderer
   Pure canvas rendering, no dependencies.
   Canvas background is always transparent; the "card" behind
   the comment is a separate, styleable fill layer.
=========================================================== */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const commentInput = document.getElementById('commentInput');

const state = {
  avatarImg: null,
  avatarColor: '#7a2ff0',
  username: 'builtbyherself.co',
  verified: false,
  commentRuns: [],           // [{text, bold, italic, color}]
  likes: 500,
  timestamp: '2h',
  showReply: true,
  authorHeart: false,

  cardColor: '#000000',
  cardOpacity: 100,
  cardGradient: false,
  cardColor2: '#7a2ff0',
  cardGradientAngle: 45,
  cornerRadius: 28,

  textColor: '#ffffff',
  metaColor: '#9a9a9a',
  usernameColor: '#ffffff',
  accentColor: '#3897f0',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  fontSize: 30
};

/* ---------- Rich text: read contenteditable into styled runs ---------- */
function extractRuns(node, inherited) {
  let runs = [];
  inherited = inherited || { bold: false, italic: false, color: null };

  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent.length) {
        runs.push({
          text: child.textContent,
          bold: inherited.bold,
          italic: inherited.italic,
          color: inherited.color
        });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(child);
      const next = {
        bold: inherited.bold || style.fontWeight >= 600 || child.tagName === 'B' || child.tagName === 'STRONG',
        italic: inherited.italic || style.fontStyle === 'italic' || child.tagName === 'I' || child.tagName === 'EM',
        color: (child.style && child.style.color) ? child.style.color : inherited.color
      };
      if (child.tagName === 'BR') {
        runs.push({ text: '\n', bold: false, italic: false, color: null });
      } else {
        runs = runs.concat(extractRuns(child, next));
      }
    }
  });
  return runs;
}

function readComment() {
  state.commentRuns = extractRuns(commentInput, { bold: false, italic: false, color: null });
}

/* ---------- Rich-text toolbar ----------
   Selection inside a contenteditable is lost the instant focus moves to a
   button, which is why "bold" used to only work if text was pre-selected
   (the caret position needed for "start bolding from here" was thrown away).
   We track the last known selection inside the editor and restore it right
   before running any command, so it works for both an actual selection and
   a plain collapsed caret (i.e. "type in bold from here on"). */
let savedRange = null;

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel.rangeCount && commentInput.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
    updateToolbarActiveState();
  }
});

function restoreSelection() {
  commentInput.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  if (savedRange) {
    sel.addRange(savedRange);
  } else {
    // no prior caret at all — place one at the end of the content
    const r = document.createRange();
    r.selectNodeContents(commentInput);
    r.collapse(false);
    sel.addRange(r);
  }
}

function runCommand(cmd, value) {
  restoreSelection();
  document.execCommand(cmd, false, value || null);
  const sel = window.getSelection();
  if (sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
  updateToolbarActiveState();
  scheduleRender();
}

function updateToolbarActiveState() {
  try {
    document.querySelector('.rte-btn[data-cmd="bold"]').classList.toggle('active', document.queryCommandState('bold'));
    document.querySelector('.rte-btn[data-cmd="italic"]').classList.toggle('active', document.queryCommandState('italic'));
  } catch (e) { /* queryCommandState can throw before focus exists — ignore */ }
}

document.querySelectorAll('.rte-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => runCommand(btn.dataset.cmd));
});
document.getElementById('rteColor').addEventListener('input', e => runCommand('foreColor', e.target.value));
document.getElementById('rteClear').addEventListener('click', () => runCommand('removeFormat'));

commentInput.addEventListener('input', () => {
  const text = commentInput.innerText;
  document.getElementById('commentCount').textContent = Math.min(text.length, 150);
  scheduleRender();
});
commentInput.addEventListener('keyup', updateToolbarActiveState);
commentInput.addEventListener('click', updateToolbarActiveState);

/* ---------- Avatar ---------- */
function drawAvatarPreviewCss() {
  const prev = document.getElementById('avatarPreview');
  if (state.avatarImg) {
    prev.style.backgroundImage = `url(${state.avatarImg.src})`;
    prev.style.backgroundColor = 'transparent';
  } else {
    prev.style.backgroundImage = 'none';
    prev.style.backgroundColor = state.avatarColor;
  }
}
document.getElementById('avatarUploadBtn').addEventListener('click', () => {
  document.getElementById('avatarUpload').click();
});
document.getElementById('avatarUpload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => { state.avatarImg = img; drawAvatarPreviewCss(); scheduleRender(); };
  img.src = URL.createObjectURL(file);
});
document.getElementById('avatarRandomBtn').addEventListener('click', () => {
  state.avatarImg = null;
  state.avatarColor = `hsl(${Math.floor(Math.random()*360)}, 65%, 45%)`;
  drawAvatarPreviewCss();
  scheduleRender();
});
document.getElementById('avatarRemoveBtn').addEventListener('click', () => {
  state.avatarImg = null;
  state.avatarColor = '#3a3a3a';
  drawAvatarPreviewCss();
  scheduleRender();
});

/* ---------- Simple field bindings ---------- */
function bindText(id, key, transform) {
  document.getElementById(id).addEventListener('input', e => {
    state[key] = transform ? transform(e.target.value) : e.target.value;
    scheduleRender();
  });
}
bindText('username', 'username');
document.getElementById('username').addEventListener('input', e => {
  document.getElementById('usernameCount').textContent = e.target.value.length;
});
bindText('likes', 'likes', v => parseInt(v || '0', 10));
bindText('timestamp', 'timestamp');
bindText('cardColor', 'cardColor');
bindText('cardColor2', 'cardColor2');
bindText('cardOpacity', 'cardOpacity', v => parseInt(v, 10));
bindText('cardGradientAngle', 'cardGradientAngle', v => parseInt(v, 10));
bindText('cornerRadius', 'cornerRadius', v => parseInt(v, 10));
bindText('textColor', 'textColor');
bindText('metaColor', 'metaColor');
bindText('usernameColor', 'usernameColor');
bindText('accentColor', 'accentColor');
bindText('fontFamily', 'fontFamily');
bindText('fontSize', 'fontSize', v => {
  const n = parseInt(v, 10);
  document.getElementById('fontSizeVal').textContent = n;
  return n;
});
document.getElementById('verifiedToggle').addEventListener('change', e => { state.verified = e.target.checked; scheduleRender(); });
document.getElementById('replyToggle').addEventListener('change', e => { state.showReply = e.target.checked; scheduleRender(); });
document.getElementById('authorHeartToggle').addEventListener('change', e => { state.authorHeart = e.target.checked; scheduleRender(); });
document.getElementById('cardGradientToggle').addEventListener('change', e => {
  state.cardGradient = e.target.checked;
  document.getElementById('cardGradientRow').style.display = state.cardGradient ? 'grid' : 'none';
  scheduleRender();
});

/* Card fill swatches: transparent / chroma green / chroma blue / studio black / white */
document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    if (sw.dataset.fill === 'transparent') {
      state.cardOpacity = 0;
      document.getElementById('cardOpacity').value = 0;
    } else {
      state.cardColor = sw.dataset.fill;
      state.cardOpacity = 100;
      state.cardGradient = false;
      document.getElementById('cardColor').value = sw.dataset.fill;
      document.getElementById('cardOpacity').value = 100;
      document.getElementById('cardGradientToggle').checked = false;
      document.getElementById('cardGradientRow').style.display = 'none';
    }
    scheduleRender();
  });
});

/* ---------- Reset ---------- */
document.getElementById('resetBtn').addEventListener('click', () => location.reload());

/* ---------- Canvas helpers ---------- */
function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* Wrap styled runs into lines of {text, bold, italic, color, width} tokens */
function wrapRuns(runs, maxWidth, baseSize, fontFamily) {
  const lines = [[]];
  let curWidth = 0;

  const fontFor = (bold, italic) =>
    `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${baseSize}px ${fontFamily}`;

  runs.forEach(run => {
    const segments = run.text.split('\n');
    segments.forEach((seg, segIdx) => {
      if (segIdx > 0) { lines.push([]); curWidth = 0; }
      const words = seg.split(/(\s+)/).filter(w => w.length);
      words.forEach(word => {
        ctx.font = fontFor(run.bold, run.italic);
        const w = ctx.measureText(word).width;
        if (curWidth + w > maxWidth && word.trim().length) {
          lines.push([]);
          curWidth = 0;
        }
        lines[lines.length - 1].push({ text: word, bold: run.bold, italic: run.italic, color: run.color, width: w });
        curWidth += w;
      });
    });
  });
  return lines.filter(l => l.length);
}

function drawWrappedLines(lines, x, y, lineHeight, defaultColor) {
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    let cx = x;
    const ly = y + i * lineHeight;
    line.forEach(tok => {
      ctx.font = `${tok.italic ? 'italic ' : ''}${tok.bold ? '700' : '400'} ${state.fontSize}px ${state.fontFamily}`;
      ctx.fillStyle = tok.color || defaultColor;
      ctx.fillText(tok.text, cx, ly);
      cx += tok.width;
    });
  });
}

function formatLikes(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/* ---------- Main render ---------- */
function render() {
  readComment();

  const W = 1080;
  const PAD = 56;
  const AVATAR_R = 34;
  const CARD_PAD = 40;
  const GAP = 22;

  const contentX = CARD_PAD + AVATAR_R * 2 + GAP;
  const maxTextWidth = W - CARD_PAD * 2 - PAD * 2 - AVATAR_R * 2 - GAP;

  const commentLineHeight = Math.round(state.fontSize * 1.34);
  const lines = wrapRuns(state.commentRuns, maxTextWidth, state.fontSize, state.fontFamily);
  const textBlockHeight = Math.max(commentLineHeight, lines.length * commentLineHeight);

  const cardHeight = CARD_PAD + AVATAR_R * 2 + 22 + textBlockHeight + 22 + 30 + CARD_PAD;
  const H = cardHeight + PAD * 2;
  canvas.height = Math.max(H, 320);
  canvas.width = W;

  // Canvas background is always fully transparent — only clear it.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ----- Card fill -----
  const cardX = PAD, cardY = PAD, cardW = canvas.width - PAD * 2, cardH = canvas.height - PAD * 2;
  if (state.cardOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = state.cardOpacity / 100;
    roundRectPath(cardX, cardY, cardW, cardH, state.cornerRadius);
    if (state.cardGradient) {
      const rad = state.cardGradientAngle * Math.PI / 180;
      const cx = cardX + cardW / 2, cy = cardY + cardH / 2;
      const x1 = cx - Math.cos(rad) * cardW / 2, y1 = cy - Math.sin(rad) * cardH / 2;
      const x2 = cx + Math.cos(rad) * cardW / 2, y2 = cy + Math.sin(rad) * cardH / 2;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, state.cardColor);
      g.addColorStop(1, state.cardColor2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = state.cardColor;
    }
    ctx.fill();
    ctx.restore();
  }

  // ----- Avatar -----
  const avX = cardX + CARD_PAD + AVATAR_R;
  const avY = cardY + CARD_PAD + AVATAR_R;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, AVATAR_R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (state.avatarImg) {
    ctx.drawImage(state.avatarImg, avX - AVATAR_R, avY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
  } else {
    ctx.fillStyle = state.avatarColor;
    ctx.fillRect(avX - AVATAR_R, avY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `700 ${AVATAR_R}px ${state.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((state.username[0] || '?').toUpperCase(), avX, avY + 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // ----- Username row (vertically centered on the avatar) -----
  const textX = cardX + contentX;
  ctx.font = `700 26px ${state.fontFamily}`;
  ctx.fillStyle = state.usernameColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(state.username, textX, avY);
  const usernameW = ctx.measureText(state.username).width;

  if (state.verified) {
    const bx = textX + usernameW + 10;
    const by = avY;
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = state.accentColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by);
    ctx.lineTo(bx - 1, by + 4);
    ctx.lineTo(bx + 6, by - 5);
    ctx.stroke();
  }

  // ----- Comment body -----
  const commentY = avY + AVATAR_R + 22;
  drawWrappedLines(lines, textX, commentY, commentLineHeight, state.textColor);

  const metaY = commentY + textBlockHeight + 22;

  // ----- Meta row: timestamp · likes · reply -----
  ctx.textBaseline = 'top';
  ctx.font = `500 21px ${state.fontFamily}`;
  ctx.fillStyle = state.metaColor;
  let metaX = textX;
  const metaParts = [state.timestamp, `${formatLikes(state.likes)} likes`];
  if (state.showReply) metaParts.push('Reply');
  metaParts.forEach(part => {
    ctx.fillText(part, metaX, metaY);
    metaX += ctx.measureText(part).width + 28;
  });

  if (state.authorHeart) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = state.accentColor;
    ctx.fillText('❤', cardX + cardW - CARD_PAD - 24, metaY - 2);
  }
}

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { render(); renderScheduled = false; });
}

/* ---------- Download ---------- */
document.getElementById('downloadBtn').addEventListener('click', () => {
  render();
  const link = document.createElement('a');
  link.download = 'ig-comment.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

/* ---------- Init ---------- */
drawAvatarPreviewCss();
commentInput.dispatchEvent(new Event('input'));
scheduleRender();
