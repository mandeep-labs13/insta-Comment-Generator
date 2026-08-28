/* ===========================================================
   Comment Bay — Instagram comment sticker renderer
   Pure canvas rendering, no dependencies.
=========================================================== */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const ICONS = {
  none: '',
  megaphone: '🗣️',
  fire: '🔥',
  heart: '❤️',
  star: '⭐',
  eyes: '👀'
};

const state = {
  avatarImg: null,
  avatarColor: '#7a2ff0',
  username: 'builtbyherself.co',
  verified: false,
  commentRuns: [],           // [{text, bold, italic, color}]
  icon: 'megaphone',
  likes: 500,
  timestamp: '2h',
  showReply: true,
  authorHeart: false,
  bg: '#0d0d0d',
  gradient: false,
  bg2: '#7a2ff0',
  gradientAngle: 45,
  cardColor: '#000000',
  cardOpacity: 100,
  textColor: '#ffffff',
  metaColor: '#9a9a9a',
  usernameColor: '#ffffff',
  accentColor: '#3897f0',
  cornerRadius: 28,
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
  const el = document.getElementById('commentInput');
  state.commentRuns = extractRuns(el, { bold: false, italic: false, color: null });
}

/* ---------- Rich-text toolbar (execCommand keeps this simple & robust) ---------- */
document.querySelectorAll('.rte-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('commentInput').focus();
    document.execCommand(btn.dataset.cmd, false, null);
    scheduleRender();
  });
});
document.getElementById('rteColor').addEventListener('input', e => {
  document.getElementById('commentInput').focus();
  document.execCommand('foreColor', false, e.target.value);
  scheduleRender();
});
document.getElementById('rteClear').addEventListener('click', () => {
  document.execCommand('removeFormat', false, null);
  scheduleRender();
});
document.getElementById('commentInput').addEventListener('input', () => {
  const text = document.getElementById('commentInput').innerText;
  document.getElementById('commentCount').textContent = Math.min(text.length, 150);
  scheduleRender();
});

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
bindText('bgColor', 'bg');
bindText('bgColor2', 'bg2');
bindText('cardColor', 'cardColor');
bindText('textColor', 'textColor');
bindText('metaColor', 'metaColor');
bindText('usernameColor', 'usernameColor');
bindText('accentColor', 'accentColor');
bindText('cornerRadius', 'cornerRadius', v => parseInt(v, 10));
bindText('cardOpacity', 'cardOpacity', v => parseInt(v, 10));
bindText('gradientAngle', 'gradientAngle', v => parseInt(v, 10));
bindText('fontFamily', 'fontFamily');
bindText('fontSize', 'fontSize', v => {
  const n = parseInt(v, 10);
  document.getElementById('fontSizeVal').textContent = n;
  return n;
});
document.getElementById('iconSelect').addEventListener('change', e => { state.icon = e.target.value; scheduleRender(); });
document.getElementById('verifiedToggle').addEventListener('change', e => { state.verified = e.target.checked; scheduleRender(); });
document.getElementById('replyToggle').addEventListener('change', e => { state.showReply = e.target.checked; scheduleRender(); });
document.getElementById('authorHeartToggle').addEventListener('change', e => { state.authorHeart = e.target.checked; scheduleRender(); });
document.getElementById('gradientToggle').addEventListener('change', e => {
  state.gradient = e.target.checked;
  document.getElementById('gradientRow').style.display = state.gradient ? 'grid' : 'none';
  scheduleRender();
});

document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    state.bg = sw.dataset.bg;
    if (state.bg !== 'transparent') document.getElementById('bgColor').value = state.bg;
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

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Wrap styled runs into lines of {text, bold, italic, color, width} tokens */
function wrapRuns(runs, maxWidth, baseFont, baseSize, fontFamily) {
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
  lines.forEach((line, i) => {
    let cx = x;
    const ly = y + i * lineHeight;
    line.forEach(tok => {
      ctx.font = `${tok.italic ? 'italic ' : ''}${tok.bold ? '700' : '400'} ${state.fontSize}px ${state.fontFamily}`;
      ctx.fillStyle = tok.color || defaultColor;
      ctx.textBaseline = 'top';
      ctx.fillText(tok.text, cx, ly);
      cx += tok.width;
    });
  });
  return lines.length * lineHeight;
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

  // measure username line width (icon + username + verified)
  ctx.font = `700 26px ${state.fontFamily}`;
  const iconStr = ICONS[state.icon] ? ICONS[state.icon] + ' ' : '';
  const commentLineHeight = Math.round(state.fontSize * 1.34);

  const lines = wrapRuns(state.commentRuns, maxTextWidth, null, state.fontSize, state.fontFamily);
  const textBlockHeight = Math.max(commentLineHeight, lines.length * commentLineHeight);

  const cardHeight = CARD_PAD /*top*/ + AVATAR_R * 2 + 22 /*gap*/ + textBlockHeight + 22 /*gap*/ + 30 /*meta row*/ + CARD_PAD /*bottom*/;
  const H = cardHeight + PAD * 2;
  canvas.height = Math.max(H, 320);
  canvas.width = W;

  // ----- Background -----
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.bg !== 'transparent') {
    if (state.gradient) {
      const rad = state.gradientAngle * Math.PI / 180;
      const x1 = canvas.width/2 - Math.cos(rad)*canvas.width/2;
      const y1 = canvas.height/2 - Math.sin(rad)*canvas.height/2;
      const x2 = canvas.width/2 + Math.cos(rad)*canvas.width/2;
      const y2 = canvas.height/2 + Math.sin(rad)*canvas.height/2;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, state.bg);
      g.addColorStop(1, state.bg2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = state.bg;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ----- Card -----
  const cardX = PAD, cardY = PAD, cardW = canvas.width - PAD * 2, cardH = canvas.height - PAD * 2;
  if (state.cardOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = state.cardOpacity / 100;
    roundRectPath(cardX, cardY, cardW, cardH, state.cornerRadius);
    ctx.fillStyle = state.cardColor;
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
  let usernameW = ctx.measureText(state.username).width;

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
  ctx.textBaseline = 'top';
  let curY = avY + AVATAR_R + 22;
  let bodyX = textX;
  if (iconStr) {
    ctx.font = `${state.fontSize}px ${state.fontFamily}`;
    ctx.fillText(iconStr, bodyX, curY);
    bodyX += ctx.measureText(iconStr).width;
  }
  // icon only offsets the first line; every other line starts at textX
  drawCommentWithIconOffset(lines, textX, bodyX - textX, curY, commentLineHeight);

  curY += textBlockHeight + 22;

  // ----- Meta row: timestamp · likes · reply -----
  ctx.font = `500 21px ${state.fontFamily}`;
  ctx.fillStyle = state.metaColor;
  let metaX = textX;
  const metaParts = [state.timestamp, `${formatLikes(state.likes)} likes`];
  if (state.showReply) metaParts.push('Reply');
  metaParts.forEach((part, i) => {
    ctx.fillText(part, metaX, curY);
    metaX += ctx.measureText(part).width + 28;
  });

  if (state.authorHeart) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = state.accentColor;
    ctx.fillText('❤', cardX + cardW - CARD_PAD - 24, curY - 2);
  }
}

function drawCommentWithIconOffset(lines, x, iconOffset, y, lineHeight) {
  lines.forEach((line, i) => {
    let cx = x + (i === 0 ? iconOffset : 0);
    const ly = y + i * lineHeight;
    line.forEach(tok => {
      ctx.font = `${tok.italic ? 'italic ' : ''}${tok.bold ? '700' : '400'} ${state.fontSize}px ${state.fontFamily}`;
      ctx.fillStyle = tok.color || state.textColor;
      ctx.textBaseline = 'top';
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
document.getElementById('commentInput').dispatchEvent(new Event('input'));
scheduleRender();
