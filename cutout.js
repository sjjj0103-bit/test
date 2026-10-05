'use strict';

/* =========================================================
   옷 사진 배경 지우기
   1) AI 자동 지우기: IS-Net 모델을 이 기기 브라우저 안에서 돌림 (사진이 밖으로 나가지 않음)
   2) 손으로 다듬기: 지우개 / 되살리기 붓
   결과는 배경이 투명한 PNG로 저장해서, 아바타에 실제 옷 사진을 입힐 때 씁니다.
   ========================================================= */

const AI = {
  session: null,
  loading: null,
  MODEL_URL: 'vendor/models/isnet_small.onnx',
  SIZE: 1024,

  load(onStatus) {
    if (this.session) return Promise.resolve(this.session);
    if (!this.loading) {
      this.loading = this._load(onStatus).catch(err => { this.loading = null; throw err; });
    }
    return this.loading;
  },

  async _load(onStatus) {
    if (!window.ort) await loadScript('vendor/ort/ort.wasm.min.js');
    ort.env.wasm.wasmPaths = new URL('vendor/ort/', location.href).href;
    ort.env.wasm.numThreads = 1;
    const model = await fetchWithCache(this.MODEL_URL, (got, total) =>
      onStatus?.(`AI 준비 중… ${Math.round(got / 1e6)}MB / ${Math.round(total / 1e6)}MB (처음 한 번만 받아요)`));
    onStatus?.('AI 준비 중…');
    this.session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    return this.session;
  },

  // 원본 캔버스와 같은 크기의 마스크 캔버스(흰색 + 투명도)를 돌려줌
  async mask(source, onStatus) {
    const session = await this.load(onStatus);
    onStatus?.('배경 지우는 중… (10초쯤 걸려요)');
    await new Promise(r => setTimeout(r, 30));
    const S = this.SIZE;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(source, 0, 0, S, S);
    const px = cx.getImageData(0, 0, S, S).data;
    const input = new Float32Array(3 * S * S);
    for (let i = 0, n = S * S; i < n; i++) {
      input[i] = (px[i * 4] - 128) / 256;
      input[i + n] = (px[i * 4 + 1] - 128) / 256;
      input[i + 2 * n] = (px[i * 4 + 2] - 128) / 256;
    }
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, S, S]) });
    const m = out[session.outputNames[0]].data;
    const img = cx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(m[i] * 255)));
    }
    cx.putImageData(img, 0, 0);
    const mask = document.createElement('canvas');
    mask.width = source.width;
    mask.height = source.height;
    mask.getContext('2d').drawImage(c, 0, 0, mask.width, mask.height);
    return mask;
  },
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`load ${src}`));
    document.head.appendChild(s);
  });
}

// 큰 모델 파일은 브라우저 저장소(Cache)에 넣어 두고 다음부터는 바로 씀
async function fetchWithCache(url, onProgress) {
  let cache = null;
  try { cache = await caches.open('wardrobe-ai-v1'); } catch { /* 지원 안 하는 환경 */ }
  const hit = cache && await cache.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());

  const res = await fetch(url);
  if (!res.ok) throw new Error(`model ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 44e6;
  let buf;
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      onProgress?.(got, total);
    }
    buf = new Uint8Array(got);
    let off = 0;
    for (const p of parts) { buf.set(p, off); off += p.length; }
  } else {
    buf = new Uint8Array(await res.arrayBuffer());
  }
  try { await cache?.put(url, new Response(buf)); } catch { /* 저장 공간 부족 등 */ }
  return buf;
}

/* ---------- 다듬기 창 ---------- */

const Cutter = {
  dlg: null,
  canvas: null,
  orig: null,   // 원본 사진 캔버스
  mask: null,   // 흰색 + 투명도 (투명한 곳이 지워진 곳)
  undo: [],
  mode: 'erase',
  resolve: null,
  drawing: false,
  last: null,

  init() {
    this.dlg = document.getElementById('cutter');
    this.canvas = document.getElementById('cut-canvas');
    this.dlg.addEventListener('click', e => {
      const b = e.target.closest('[data-cut]');
      if (b) this.action(b.dataset.cut);
    });
    this.dlg.addEventListener('cancel', e => { e.preventDefault(); this.finish(null); });
    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.start(e));
    c.addEventListener('pointermove', e => this.move(e));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => c.addEventListener(t, () => { this.drawing = false; }));
  },

  // photoUrl: 원본 사진, cutoutUrl: 이전에 지운 결과(있으면 이어서 다듬기)
  async open(photoUrl, cutoutUrl, autoAI) {
    const img = await loadImage(photoUrl);
    const max = 900;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    this.orig = document.createElement('canvas');
    this.orig.width = w; this.orig.height = h;
    this.orig.getContext('2d').drawImage(img, 0, 0, w, h);
    this.mask = document.createElement('canvas');
    this.mask.width = w; this.mask.height = h;
    const mx = this.mask.getContext('2d');
    if (cutoutUrl && cutoutUrl.box) {
      // 이전 결과의 투명도를 원래 위치에 다시 깔기
      const prev = await loadImage(cutoutUrl.src);
      const [bx, by, bw, bh] = cutoutUrl.box;
      mx.drawImage(prev, bx * w, by * h, bw * w, bh * h);
      mx.globalCompositeOperation = 'source-in';
      mx.fillStyle = '#fff';
      mx.fillRect(0, 0, w, h);
      mx.globalCompositeOperation = 'source-over';
    } else {
      mx.fillStyle = '#fff';
      mx.fillRect(0, 0, w, h);
    }
    this.canvas.width = w; this.canvas.height = h;
    this.openId = (this.openId || 0) + 1;
    this.undo = [];
    this.setMode('erase');
    this.status(cutoutUrl ? '지우개·되살리기로 다듬어 주세요' : '');
    this.paint();
    this.dlg.showModal();
    if (autoAI) this.action('ai');
    return new Promise(resolve => { this.resolve = resolve; });
  },

  status(msg) { document.getElementById('cut-status').textContent = msg; },

  setMode(mode) {
    this.mode = mode;
    this.dlg.querySelectorAll('[data-cut=erase],[data-cut=restore]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.cut === mode)));
    this.paint();
  },

  paint() {
    const x = this.canvas.getContext('2d');
    x.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.mode === 'restore') {
      // 되살리기 모드에서는 지워진 부분을 흐리게 보여 줌
      x.globalAlpha = 0.25;
      x.drawImage(this.orig, 0, 0);
      x.globalAlpha = 1;
    }
    const tmp = document.createElement('canvas');
    tmp.width = this.orig.width; tmp.height = this.orig.height;
    const t = tmp.getContext('2d');
    t.drawImage(this.orig, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(this.mask, 0, 0);
    x.drawImage(tmp, 0, 0);
  },

  pushUndo() {
    this.undo.push(this.mask.getContext('2d').getImageData(0, 0, this.mask.width, this.mask.height));
    if (this.undo.length > 15) this.undo.shift();
  },

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * this.canvas.width / r.width, (e.clientY - r.top) * this.canvas.height / r.height];
  },

  brush() {
    const r = this.canvas.getBoundingClientRect();
    return Number(document.getElementById('cut-size').value) * this.canvas.width / r.width;
  },

  stroke(from, to) {
    const m = this.mask.getContext('2d');
    m.save();
    m.globalCompositeOperation = this.mode === 'erase' ? 'destination-out' : 'source-over';
    m.strokeStyle = m.fillStyle = '#fff';
    m.lineWidth = this.brush();
    m.lineCap = m.lineJoin = 'round';
    m.beginPath();
    m.moveTo(...from);
    m.lineTo(...to);
    m.stroke();
    m.restore();
    this.paint();
  },

  start(e) {
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pushUndo();
    this.drawing = true;
    this.last = this.point(e);
    this.stroke(this.last, this.last);
  },

  move(e) {
    if (!this.drawing) return;
    const p = this.point(e);
    this.stroke(this.last, p);
    this.last = p;
  },

  async action(act) {
    if (act === 'erase' || act === 'restore') return this.setMode(act);
    if (act === 'undo') {
      const prev = this.undo.pop();
      if (prev) { this.mask.getContext('2d').putImageData(prev, 0, 0); this.paint(); }
      return;
    }
    if (act === 'reset') {
      this.pushUndo();
      const m = this.mask.getContext('2d');
      m.globalCompositeOperation = 'source-over';
      m.fillStyle = '#fff';
      m.fillRect(0, 0, this.mask.width, this.mask.height);
      this.paint();
      this.status('처음 사진으로 돌렸어요');
      return;
    }
    if (act === 'ai') {
      const btn = this.dlg.querySelector('[data-cut=ai]');
      btn.disabled = true;
      const openId = this.openId;
      try {
        const m = await AI.mask(this.orig, msg => { if (openId === this.openId) this.status(msg); });
        if (openId !== this.openId || !this.dlg.open) return; // 그사이 창을 닫았으면 무시
        this.pushUndo();
        const mx = this.mask.getContext('2d');
        mx.clearRect(0, 0, this.mask.width, this.mask.height);
        mx.drawImage(m, 0, 0);
        this.paint();
        this.status('다 됐어요! 덜 지워진 곳은 지우개로, 옷이 지워졌으면 되살리기로 다듬어 주세요');
      } catch (err) {
        console.error(err);
        this.status('AI를 불러오지 못했어요. 인터넷 연결을 확인하거나, 지우개로 직접 지워 주세요');
      } finally {
        btn.disabled = false;
      }
      return;
    }
    if (act === 'cancel') return this.finish(null);
    if (act === 'done') return this.finish(this.result());
  },

  // 옷 부분만 잘라서 PNG로. box = 원본 사진 안에서의 위치(비율) — 나중에 이어서 다듬을 때 씀
  result() {
    const w = this.mask.width, h = this.mask.height;
    const a = this.mask.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { empty: true };
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const scale = Math.min(1, 600 / Math.max(bw, bh));
    const out = document.createElement('canvas');
    out.width = Math.round(bw * scale);
    out.height = Math.round(bh * scale);
    const o = out.getContext('2d');
    o.drawImage(this.orig, x0, y0, bw, bh, 0, 0, out.width, out.height);
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(this.mask, x0, y0, bw, bh, 0, 0, out.width, out.height);
    return {
      src: out.toDataURL('image/png'),
      box: [x0 / w, y0 / h, bw / w, bh / h],
      color: colorOfCutout(out),
    };
  },

  finish(value) {
    this.openId++;
    this.dlg.close();
    const r = this.resolve;
    this.resolve = null;
    r?.(value);
  },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

// 배경을 지운 옷에서 가장 많이 보이는 색 (투명한 곳은 빼고 셈)
function colorOfCutout(canvas) {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data;
  const count = {};
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const id = nearestColor(d[i], d[i + 1], d[i + 2]);
    count[id] = (count[id] || 0) + 1;
  }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}
