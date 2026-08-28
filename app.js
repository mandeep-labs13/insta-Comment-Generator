/* ===========================================================
   Comment Bay — Instagram comment sticker renderer
   Fixed-size transparent "stage" canvas; the comment card is a
   positionable, scalable object drawn onto it. A second,
   identically-sized canvas (#handles) sits on top purely for
   the drag/resize UI — it is never part of the exported PNG.
=========================================================== */

const CANVAS_W = 1080;
const CANVAS_H = 1350;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const handles = document.getElementById('handles');
const hctx = handles.getContext('2d');
const commentInput = document.getElementById('commentInput');
const miniCanvas = document.getElementById('miniCanvas');
const miniCtx = miniCanvas.getContext('2d');
const miniPreview = document.getElementById('miniPreview');

const state = {
  avatarImg: null,
  avatarColor: '#7a2ff0',
  username: 'builtbyherself.co',
  verified: false,
  commentRuns: [],
  likes: 500,
  timestamp: '2h',
  showReply: true,
  authorHeart: false,

  // position & size
  posX: 90,
  posY: 120,
  scale: 1,
  cardWidth: 900,
  padding: 40,
  avatarSize: 68,   // diameter
  textWidth: 640,
  vSpacing: 22,
  cornerRadius: 28,

  // border
  border: { enabled: false, color: '#ffffff', width: 4 },
  // shadow
  shadow: { enabled: false, color: '#000000', blur: 30, offsetX: 0, offsetY: 12 },

  // fill
  cardColor: '#000000',
  cardOpacity: 100,
  cardGradient: false,
  cardColor2: '#7a2ff0',
  cardGradientAngle: 45,

  // typography
  textColor: '#ffffff',
  metaColor: '#9a9a9a',
  usernameColor: '#ffffff',
  accentColor: '#3897f0',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  fontSize: 30,
  textStyle: { bold: false, italic: false },
  stroke: { enabled: false, color: '#000000', width: 4 }
};

/* cached bounds of the last-drawn card, in stage coordinates — used for hit testing */
let lastCardBounds = { x: 0, y: 0, w: 0, h: 0 };

/* ---------- Theme switcher ---------- */
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.documentElement.dataset.theme = btn.dataset.themeBtn;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
  });
});

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

/* ---------- Rich-text toolbar ---------- */
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
  } catch (e) { /* ignore before focus exists */ }
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

/* ---------- Field bindings ---------- */
function bindRange(id, key, opts) {
  const el = document.getElementById(id);
  el.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (opts && opts.path) { state[opts.path][key] = v; } else { state[key] = v; }
    if (opts && opts.display) document.getElementById(opts.display).textContent = opts.format ? opts.format(v) : v;
    scheduleRender();
  });
}
function bindText(id, key, transform) {
  document.getElementById(id).addEventListener('input', e => {
    state[key] = transform ? transform(e.target.value) : e.target.value;
    scheduleRender();
  });
}
function bindColor(id, key, path) {
  document.getElementById(id).addEventListener('input', e => {
    if (path) state[path][key] = e.target.value; else state[key] = e.target.value;
    scheduleRender();
  });
}
function bindCheckbox(id, key, path) {
  document.getElementById(id).addEventListener('change', e => {
    if (path) state[path][key] = e.target.checked; else state[key] = e.target.checked;
    scheduleRender();
  });
}

bindText('username', 'username');
document.getElementById('username').addEventListener('input', e => {
  document.getElementById('usernameCount').textContent = e.target.value.length;
});
bindText('likes', 'likes', v => parseInt(v || '0', 10));
bindText('timestamp', 'timestamp');
bindCheckbox('verifiedToggle', 'verified');
bindCheckbox('replyToggle', 'showReply');
bindCheckbox('authorHeartToggle', 'authorHeart');

bindRange('posX', 'posX');
bindRange('posY', 'posY');
bindRange('scale', 'scale', { display: 'scaleVal', format: v => v.toFixed(2) });
bindRange('cardWidth', 'cardWidth');
bindRange('padding', 'padding');
bindRange('avatarSize', 'avatarSize');
bindRange('textWidth', 'textWidth');
bindRange('vSpacing', 'vSpacing');
bindRange('cornerRadius', 'cornerRadius');

bindCheckbox('borderToggle', 'enabled', 'border');
bindColor('borderColor', 'color', 'border');
bindRange('borderWidth', 'width', { path: 'border' });

bindCheckbox('shadowToggle', 'enabled', 'shadow');
bindColor('shadowColor', 'color', 'shadow');
bindRange('shadowBlur', 'blur', { path: 'shadow' });
bindRange('shadowOffsetX', 'offsetX', { path: 'shadow' });
bindRange('shadowOffsetY', 'offsetY', { path: 'shadow' });

bindColor('cardColor', 'cardColor');
bindColor('cardColor2', 'cardColor2');
bindRange('cardOpacity', 'cardOpacity');
bindRange('cardGradientAngle', 'cardGradientAngle');
document.getElementById('cardGradientToggle').addEventListener('change', e => {
  state.cardGradient = e.target.checked;
  document.getElementById('cardGradientRow').style.display = state.cardGradient ? 'grid' : 'none';
  scheduleRender();
});

bindColor('textColor', 'textColor');
bindColor('metaColor', 'metaColor');
bindColor('usernameColor', 'usernameColor');
bindColor('accentColor', 'accentColor');
bindText('fontFamily', 'fontFamily');
bindText('fontSize', 'fontSize', v => {
  const n = parseInt(v, 10);
  document.getElementById('fontSizeVal').textContent = n;
  return n;
});

bindCheckbox('globalBold', 'bold', 'textStyle');
bindCheckbox('globalItalic', 'italic', 'textStyle');
bindCheckbox('strokeToggle', 'enabled', 'stroke');
bindColor('strokeColor', 'color', 'stroke');
bindRange('strokeWidth', 'width', { path: 'stroke' });

/* Card fill swatches */
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
function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function wrapRuns(runs, maxWidth, baseSize, fontFamily) {
  const lines = [[]];
  let curWidth = 0;
  const fontFor = (bold, italic) =>
    `${(italic || state.textStyle.italic) ? 'italic ' : ''}${(bold || state.textStyle.bold) ? '700' : '400'} ${baseSize}px ${fontFamily}`;

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

function drawWrappedLines(lines, x, y, lineHeight, fontSize, fontFamily, defaultColor) {
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    let cx = x;
    const ly = y + i * lineHeight;
    line.forEach(tok => {
      const bold = tok.bold || state.textStyle.bold;
      const italic = tok.italic || state.textStyle.italic;
      ctx.font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = tok.color || defaultColor;
      paintText(tok.text, cx, ly);
      cx += tok.width;
    });
  });
}

function formatLikes(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/* Draws stroke (if enabled) then fill, for one piece of text at the current font/baseline/align. */
function paintText(text, x, y) {
  if (state.stroke.enabled) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = state.stroke.color;
    ctx.lineWidth = state.stroke.width * state.scale;
    ctx.strokeText(text, x, y);
  }
  ctx.fillText(text, x, y);
}

/* ---------- Main render ---------- */
function render() {
  readComment();

  const s = state.scale;
  const pad = state.padding * s;
  const avatarR = (state.avatarSize * s) / 2;
  const maxTextWidth = state.textWidth * s;
  const vGap = state.vSpacing * s;
  const radius = state.cornerRadius * s;
  const gapH = 22 * s;
  const usernameSize = 26 * s;
  const metaSize = 21 * s;
  const commentSize = state.fontSize * s;
  const commentLineHeight = Math.round(commentSize * 1.34);

  const lines = wrapRuns(state.commentRuns, maxTextWidth, commentSize, state.fontFamily);
  const textBlockHeight = Math.max(commentLineHeight, lines.length * commentLineHeight);
  const metaRowHeight = metaSize + 10;

  const cardW = state.cardWidth * s;
  const cardH = pad + avatarR * 2 + vGap + textBlockHeight + vGap + metaRowHeight + pad;
  const cardX = state.posX;
  const cardY = state.posY;

  lastCardBounds = { x: cardX, y: cardY, w: cardW, h: cardH };

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ----- Shadow + fill -----
  if (state.cardOpacity > 0) {
    ctx.save();
    if (state.shadow.enabled) {
      ctx.shadowColor = state.shadow.color;
      ctx.shadowBlur = state.shadow.blur * s;
      ctx.shadowOffsetX = state.shadow.offsetX * s;
      ctx.shadowOffsetY = state.shadow.offsetY * s;
    }
    ctx.globalAlpha = state.cardOpacity / 100;
    roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
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

  // ----- Border -----
  if (state.border.enabled) {
    ctx.save();
    roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.lineWidth = state.border.width * s;
    ctx.strokeStyle = state.border.color;
    ctx.stroke();
    ctx.restore();
  }

  // ----- Avatar -----
  const avX = cardX + pad + avatarR;
  const avY = cardY + pad + avatarR;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (state.avatarImg) {
    ctx.drawImage(state.avatarImg, avX - avatarR, avY - avatarR, avatarR * 2, avatarR * 2);
  } else {
    ctx.fillStyle = state.avatarColor;
    ctx.fillRect(avX - avatarR, avY - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `700 ${avatarR}px ${state.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((state.username[0] || '?').toUpperCase(), avX, avY + 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // ----- Username row -----
  const textX = cardX + pad + avatarR * 2 + gapH;
  ctx.font = `${state.textStyle.italic ? 'italic ' : ''}700 ${usernameSize}px ${state.fontFamily}`;
  ctx.fillStyle = state.usernameColor;
  ctx.textBaseline = 'middle';
  paintText(state.username, textX, avY);
  const usernameW = ctx.measureText(state.username).width;

  if (state.verified) {
    const bx = textX + usernameW + 10 * s;
    const by = avY;
    const br = 11 * s;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = state.accentColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(bx - br * 0.45, by);
    ctx.lineTo(bx - br * 0.1, by + br * 0.35);
    ctx.lineTo(bx + br * 0.55, by - br * 0.45);
    ctx.stroke();
  }

  // ----- Comment body -----
  const commentY = avY + avatarR + vGap;
  drawWrappedLines(lines, textX, commentY, commentLineHeight, commentSize, state.fontFamily, state.textColor);

  const metaY = commentY + textBlockHeight + vGap;

  // ----- Meta row -----
  ctx.textBaseline = 'top';
  ctx.font = `${state.textStyle.italic ? 'italic ' : ''}${state.textStyle.bold ? '700' : '500'} ${metaSize}px ${state.fontFamily}`;
  ctx.fillStyle = state.metaColor;
  let metaX = textX;
  const metaParts = [state.timestamp, `${formatLikes(state.likes)} likes`];
  if (state.showReply) metaParts.push('Reply');
  metaParts.forEach(part => {
    paintText(part, metaX, metaY);
    metaX += ctx.measureText(part).width + 28 * s;
  });

  if (state.authorHeart) {
    ctx.font = `${20 * s}px sans-serif`;
    ctx.fillStyle = state.accentColor;
    ctx.fillText('❤', cardX + cardW - pad - 24 * s, metaY - 2);
  }

  drawHandles();
  updateMiniPreview();
}

/* ---------- Mini preview (content only, no drag handles) ---------- */
function updateMiniPreview() {
  miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
  miniCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, miniCanvas.width, miniCanvas.height);
}

miniPreview.addEventListener('click', () => {
  document.getElementById('monitorFrame').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

if ('IntersectionObserver' in window) {
  const previewObserver = new IntersectionObserver(
    entries => entries.forEach(entry => miniPreview.classList.toggle('visible', !entry.isIntersecting)),
    { threshold: 0 }
  );
  previewObserver.observe(document.getElementById('monitorFrame'));
}

/* ---------- Selection / drag / resize overlay ---------- */
const HANDLE_R = 16;

function drawHandles() {
  hctx.clearRect(0, 0, handles.width, handles.height);
  const { x, y, w, h } = lastCardBounds;
  hctx.save();
  hctx.strokeStyle = '#00d4ff';
  hctx.lineWidth = 3;
  hctx.setLineDash([12, 8]);
  hctx.strokeRect(x, y, w, h);
  hctx.setLineDash([]);
  // resize handle, bottom-right
  hctx.beginPath();
  hctx.arc(x + w, y + h, HANDLE_R, 0, Math.PI * 2);
  hctx.fillStyle = '#00d4ff';
  hctx.fill();
  hctx.lineWidth = 3;
  hctx.strokeStyle = '#ffffff';
  hctx.stroke();
  hctx.restore();
}

function stagePoint(evt) {
  const rect = handles.getBoundingClientRect();
  const factor = handles.width / rect.width;
  return {
    x: (evt.clientX - rect.left) * factor,
    y: (evt.clientY - rect.top) * factor
  };
}

let dragMode = null;      // 'move' | 'resize' | null
let dragOffset = { x: 0, y: 0 };
let resizeStart = { dist: 1, scale: 1 };

handles.addEventListener('pointerdown', e => {
  const p = stagePoint(e);
  const { x, y, w, h } = lastCardBounds;
  const dx = p.x - (x + w);
  const dy = p.y - (y + h);
  if (Math.sqrt(dx * dx + dy * dy) < HANDLE_R * 1.8) {
    dragMode = 'resize';
    resizeStart.dist = Math.max(1, Math.hypot(p.x - x, p.y - y));
    resizeStart.scale = state.scale;
  } else if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) {
    dragMode = 'move';
    dragOffset = { x: p.x - x, y: p.y - y };
  } else {
    dragMode = null;
    return;
  }
  handles.setPointerCapture(e.pointerId);
  handles.classList.add('dragging');
});

handles.addEventListener('pointermove', e => {
  if (!dragMode) return;
  const p = stagePoint(e);
  if (dragMode === 'move') {
    state.posX = Math.round(p.x - dragOffset.x);
    state.posY = Math.round(p.y - dragOffset.y);
    document.getElementById('posX').value = state.posX;
    document.getElementById('posY').value = state.posY;
  } else if (dragMode === 'resize') {
    const { x, y } = lastCardBounds;
    const dist = Math.max(1, Math.hypot(p.x - x, p.y - y));
    const newScale = Math.min(3, Math.max(0.3, resizeStart.scale * (dist / resizeStart.dist)));
    state.scale = newScale;
    document.getElementById('scale').value = newScale.toFixed(2);
    document.getElementById('scaleVal').textContent = newScale.toFixed(2);
  }
  scheduleRender();
});

function endDrag(e) {
  if (dragMode && handles.hasPointerCapture && handles.hasPointerCapture(e.pointerId)) {
    handles.releasePointerCapture(e.pointerId);
  }
  dragMode = null;
  handles.classList.remove('dragging');
}
handles.addEventListener('pointerup', endDrag);
handles.addEventListener('pointercancel', endDrag);

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
