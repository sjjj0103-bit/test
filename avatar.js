'use strict';

/* =========================================================
   아바타 옷 입히기
   옷 종류(kind)마다 모양을 SVG로 그리고, 등록한 옷 색으로 칠합니다.
   왼쪽 절반만 정의한 모양은 mirror()로 오른쪽을 만들어요. (좌표계: 200 x 400)
   ========================================================= */

const SKIN = '#f6dccb';
const HAIR = '#16110f';
const HAIR_SHINE = '#3b322e';
const LASH = '#1a1210';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// "x y" 좌표 쌍의 x를 좌우 반전 (H/V/A 명령은 쓰지 않음)
const mirror = d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)} ${y}`);

const path = (d, fill, stroke, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round" ${extra}/>`;
const both = (d, fill, stroke, extra) => path(d, fill, stroke, extra) + path(mirror(d), fill, stroke, extra);
const line = (x1, y1, x2, y2, color, extra = '') =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="1.2" fill="none" ${extra}/>`;

function paints(hex) {
  return {
    f: hex,
    s: luminance(hex) > 0.8 ? '#b9b2ab' : shade(hex, -0.3),
    d: luminance(hex) < 0.3 ? shade(hex, 0.3) : shade(hex, -0.22),
    soft: shade(hex, -0.08),
  };
}

/* ---------- 공통 조각 ---------- */

const TORSO = 'M72 90 Q86 84 92 84 Q100 93 108 84 Q114 84 128 90 L127 180 L73 180 Z';
const SLEEVE_SHORT = 'M73 91 L60 127 L72 131 L80 106 Z';
const SLEEVE_LONG = 'M73 91 L50 192 L63 196 L81 108 Z';
const CUFF = 'M51 186 L64 190 L63 196 L50 192 Z';
const PANTS = 'M75 168 L125 168 L128 206 L124 358 L104 358 L100 216 L96 358 L76 358 L72 206 Z';

const ribs = (x1, x2, y1, y2, c) => {
  let s = '';
  for (let x = x1; x <= x2; x += 6) s += line(x, y1, x, y2, c, 'opacity=".35"');
  return s;
};

/* ---------- 옷 종류별 모양 ---------- */

const SHAPES = {
  // 상의
  sleeveless: p => path('M79 90 Q89 86 92 86 Q100 96 108 86 Q111 86 121 90 L126 180 L74 180 Z', p.f, p.s),
  tshirt: p => both(SLEEVE_SHORT, p.f, p.s) + path(TORSO, p.f, p.s),
  longtee: p => both(SLEEVE_LONG, p.f, p.s) + path(TORSO, p.f, p.s),
  shirt: p => (p.short ? both(SLEEVE_SHORT, p.f, p.s) : both(SLEEVE_LONG, p.f, p.s) + both(CUFF, p.soft, p.s)) + path(TORSO, p.f, p.s)
    + line(100, 94, 100, 180, p.d) + [108, 126, 144, 162].map(y => `<circle cx="102.5" cy="${y}" r="1.4" fill="${p.d}"/>`).join('')
    + both('M92 83 L100 95 L87 99 Z', p.f, p.s),
  blouse: p => (p.short ? both('M73 91 Q56 104 58 128 L72 132 L80 106 Z', p.f, p.s)
    : both('M73 91 Q50 112 52 150 L50 192 L63 196 Q66 140 81 108 Z', p.f, p.s)) + path(TORSO, p.f, p.s)
    + both('M91 84 Q90 98 100 96 Q96 90 98 88 Z', p.soft, p.s) + line(100, 96, 100, 128, p.d, 'opacity=".5"'),
  sweatshirt: p => both(SLEEVE_LONG, p.f, p.s) + both(CUFF, p.soft, p.s) + path(TORSO, p.f, p.s)
    + path('M73 171 L127 171 L127 180 L73 180 Z', p.soft, p.s),
  hoodie: p => path('M80 96 Q78 78 100 77 Q122 78 120 96 Z', p.soft, p.s) + SHAPES.sweatshirt(p)
    + line(96, 92, 95, 122, p.d) + line(104, 92, 105, 122, p.d)
    + path('M84 136 L116 136 L118 160 L82 160 Z', p.f, p.d, 'opacity=".8"'),
  knit: p => SHAPES.sweatshirt(p) + ribs(80, 120, 98, 168, p.d)
    + path('M90 84 Q100 92 110 84 L110 80 Q100 87 90 80 Z', p.soft, p.s),

  // 하의
  jeans: p => path(PANTS, p.f, p.s) + path('M75 168 L125 168 L125 175 L75 175 Z', p.soft, p.s)
    + line(100, 175, 100, 214, p.d) + path('M78 180 Q86 192 92 180', 'none', p.d)
    + path('M122 180 Q114 192 108 180', 'none', p.d)
    + line(80, 340, 96, 340, p.d, 'opacity=".5"') + line(104, 340, 120, 340, p.d, 'opacity=".5"'),
  slacks: p => path('M75 168 L125 168 L128 206 L127 358 L104 358 L100 216 L96 358 L73 358 L72 206 Z', p.f, p.s)
    + path('M75 168 L125 168 L125 175 L75 175 Z', p.soft, p.s)
    + line(86, 214, 85, 356, p.d, 'opacity=".4"') + line(114, 214, 115, 356, p.d, 'opacity=".4"'),
  cottonpants: p => path('M75 168 L125 168 L128 206 L123 344 L104 344 L100 216 L96 344 L77 344 L72 206 Z', p.f, p.s)
    + path('M75 168 L125 168 L125 175 L75 175 Z', p.soft, p.s) + line(100, 175, 100, 206, p.d),
  shorts: p => path('M75 168 L125 168 L129 236 L104 238 L100 214 L96 238 L71 236 Z', p.f, p.s)
    + path('M75 168 L125 168 L125 175 L75 175 Z', p.soft, p.s),
  miniskirt: p => path('M76 168 L124 168 L135 240 L65 240 Z', p.f, p.s)
    + path('M76 168 L124 168 L124 175 L76 175 Z', p.soft, p.s),
  longskirt: p => path('M76 168 L124 168 L142 332 L58 332 Z', p.f, p.s)
    + path('M76 168 L124 168 L124 175 L76 175 Z', p.soft, p.s)
    + line(91, 180, 82, 330, p.d, 'opacity=".3"') + line(109, 180, 118, 330, p.d, 'opacity=".3"'),

  // 원피스
  'dress-short': p => both(SLEEVE_SHORT, p.f, p.s)
    + path('M72 90 Q86 84 92 84 Q100 93 108 84 Q114 84 128 90 L125 166 L137 248 L63 248 L75 166 Z', p.f, p.s)
    + line(75, 166, 125, 166, p.d),
  'dress-long': p => both(SLEEVE_SHORT, p.f, p.s)
    + path('M72 90 Q86 84 92 84 Q100 93 108 84 Q114 84 128 90 L125 166 L145 334 L55 334 L75 166 Z', p.f, p.s)
    + line(75, 166, 125, 166, p.d) + line(90, 172, 80, 332, p.d, 'opacity=".25"') + line(110, 172, 120, 332, p.d, 'opacity=".25"'),
  'dress-knit': p => both(SLEEVE_LONG, p.f, p.s) + both(CUFF, p.soft, p.s)
    + path('M72 90 Q86 84 92 84 Q100 93 108 84 Q114 84 128 90 L126 300 L74 300 L73 180 Z', p.f, p.s)
    + ribs(80, 120, 98, 296, p.d),

  // 아우터 (앞이 열린 모양 → 안에 입은 옷이 보여요)
  cardigan: p => both('M72 89 L48 194 L63 199 L82 110 Z', p.f, p.s)
    + both('M72 89 L91 85 L97 132 L97 188 L72 188 Z', p.f, p.s)
    + [140, 156, 172].map(y => `<circle cx="94" cy="${y}" r="1.6" fill="${p.d}"/>`).join(''),
  jacket: p => both('M71 88 L47 194 L63 199 L83 110 Z', p.f, p.s)
    + both('M70 88 L91 85 L97 140 L97 198 L71 198 Z', p.f, p.s)
    + both('M91 85 L97 140 L85 116 L84 92 Z', p.soft, p.s)
    + `<circle cx="94" cy="160" r="1.8" fill="${p.d}"/>`,
  trench: p => both('M71 88 L46 196 L63 201 L83 110 Z', p.f, p.s)
    + both('M70 88 L91 85 L97 140 L97 294 L61 294 Z', p.f, p.s)
    + both('M91 85 L97 140 L84 118 L83 92 Z', p.soft, p.s)
    + both('M67 164 L97 164 L97 172 L66 172 Z', p.soft, p.s)
    + [134, 150].map(y => `<circle cx="89" cy="${y}" r="1.6" fill="${p.d}"/><circle cx="111" cy="${y}" r="1.6" fill="${p.d}"/>`).join(''),
  coat: p => both('M71 88 L46 196 L64 201 L83 110 Z', p.f, p.s)
    + both('M69 88 L91 85 L97 140 L97 284 L63 284 Z', p.f, p.s)
    + both('M91 85 L97 140 L83 120 L82 92 Z', p.soft, p.s),
  padding: p => both('M70 90 L42 194 L64 203 L85 112 Z', p.f, p.s)
    + path('M68 88 Q100 80 132 88 L135 216 L65 216 Z', p.f, p.s)
    + [118, 148, 182].map(y => line(67, y, 133, y, p.d, 'opacity=".5"')).join('')
    + line(100, 88, 100, 216, p.d)
    + path('M84 86 Q100 92 116 86 L117 74 Q100 82 83 74 Z', p.soft, p.s),
  jumper: p => both('M71 89 L47 194 L63 199 L83 110 Z', p.f, p.s)
    + path('M69 88 Q100 82 131 88 L130 198 L70 198 Z', p.f, p.s)
    + path('M70 190 L130 190 L130 198 L70 198 Z', p.soft, p.s)
    + line(100, 86, 100, 198, p.d)
    + path('M86 86 Q100 92 114 86 L114 79 Q100 85 86 79 Z', p.soft, p.s),

  // 신발 (왼발 기준으로 그리고 오른발은 좌우 반전)
  sneakers: p => both('M75 368 Q74 356 86 357 Q98 357 98 366 L98 371 L75 371 Z', p.f, p.s)
    + both('M74 369 L99 369 L99 373 L74 373 Z', '#ffffff', '#b9b2ab'),
  loafers: p => both('M76 368 Q76 358 87 358 Q98 359 97 368 L97 371 L76 371 Z', p.f, p.s)
    + both('M80 362 L94 362', 'none', p.d),
  heels: p => both('M76 369 Q80 358 90 360 L97 364 L97 370 L80 370 Z', p.f, p.s)
    + both('M95 368 L97 368 L97 378 L95 378 Z', p.f, p.s),
  sandals: p => both('M77 366 Q77 360 87 360 Q97 360 96 368 Q90 372 78 370 Z', SKIN, '#d9ab8f')
    + both('M78 362 L95 366', 'none', p.f, 'stroke-width="3"') + both('M82 368 L93 360', 'none', p.f, 'stroke-width="3"'),
  boots: p => both('M78 314 L97 314 L97 362 Q100 372 90 372 L74 372 Q72 364 78 360 Z', p.f, p.s)
    + both('M78 314 L97 314 L97 320 L78 320 Z', p.soft, p.s),
};

/* ---------- 몸 ---------- */

// 사막여우상 얼굴: 크고 눈꼬리가 살짝 올라간 눈, 갸름한 V라인, 긴 흑발 생머리
function eye(side) {
  const X = x => (side === 'R' ? 200 - x : x);
  const p = d => (side === 'R' ? mirror(d) : d);
  return path(p('M96.6 51.4 Q92 43.6 84.6 48.2 Q89.5 55.8 96.6 51.4 Z'), '#ffffff', 'none')
    + `<circle cx="${X(90.6)}" cy="50" r="3.4" fill="#3a251b"/>`
    + `<circle cx="${X(90.6)}" cy="50" r="1.7" fill="#0e0907"/>`
    + `<circle cx="${X(90.6) + 1.3}" cy="48.6" r="1.05" fill="#ffffff"/>`
    + `<circle cx="${X(90.6) - 1.2}" cy="51.6" r=".5" fill="#ffffff" opacity=".8"/>`
    + `<path d="${p('M97.2 51.6 Q92 43.2 84.4 48 L81.4 45.6')}" stroke="${LASH}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${p('M86.4 52 Q90.5 55.2 95.6 52.8')}" stroke="#c99a86" stroke-width=".55" fill="none"/>`;
}

function bodyBack() {
  const face = 'M78 43 Q78 24 100 23 Q122 24 122 43 Q122 58 113 69 Q106 77.5 100 77.5 Q94 77.5 87 69 Q78 58 78 43 Z';
  const brow = `<path d="M83.6 42 Q89 39.6 95.4 41.2" stroke="${LASH}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  return `
    <ellipse cx="100" cy="378" rx="46" ry="6" fill="#000" opacity=".06"/>
    <path d="M74 44 Q73 14 100 13 Q127 14 126 44 L131 140 Q118 146 100 144 Q82 146 69 140 Z" fill="${HAIR}"/>
    <rect x="93" y="68" width="14" height="24" rx="5" fill="${SKIN}"/>
    <path d="M71 92 L56 196 M129 92 L144 196" stroke="${SKIN}" stroke-width="13" stroke-linecap="round"/>
    <path d="M89 200 L87 362 M111 200 L113 362" stroke="${SKIN}" stroke-width="18" stroke-linecap="round"/>
    <path d="M74 90 Q100 84 126 90 L126 206 L74 206 Z" fill="${SKIN}"/>
    <path d="${face}" fill="${SKIN}"/>
    ${brow}${mirror(brow)}
    ${eye('L')}${eye('R')}
    <ellipse cx="86" cy="59.5" rx="4.2" ry="2.3" fill="#f4a39b" opacity=".42"/>
    <ellipse cx="114" cy="59.5" rx="4.2" ry="2.3" fill="#f4a39b" opacity=".42"/>
    <path d="M100.4 55.5 Q102 59 99.6 60.2" stroke="#d6a28c" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M96.2 64.8 Q98 63.6 100 64.4 Q102 63.6 103.8 64.8 Q100 68.6 96.2 64.8 Z" fill="#e2837d"/>
    <path d="M96.4 64.9 Q100 66 103.6 64.9" stroke="#c4605c" stroke-width=".7" fill="none"/>
    <path d="M76 42 Q77 14 100 13.5 Q123 14 124 42 Q119 30 108 25 Q101 30 92 27 Q82 30 76 42 Z" fill="${HAIR}"/>
    <path d="M100 17 Q83 19 78.5 40 Q76 58 80.5 78 Q78 58 85 38 Q91 26 100 24 Z" fill="${HAIR}"/>
    <path d="M100 17 Q117 19 121.5 40 Q124 58 119.5 78 Q122 58 115 38 Q109 26 100 24 Z" fill="${HAIR}"/>
    <path d="M86 21 Q97 15.5 110 19" stroke="${HAIR_SHINE}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`;
}

const BARE_FEET = `<ellipse cx="86" cy="367" rx="9" ry="5" fill="${SKIN}"/><ellipse cx="114" cy="367" rx="9" ry="5" fill="${SKIN}"/>`;
const HANDS = `<circle cx="56" cy="199" r="6.5" fill="${SKIN}"/><circle cx="144" cy="199" r="6.5" fill="${SKIN}"/>`;
const BASIC_TOP = path('M79 90 Q89 86 92 86 Q100 96 108 86 Q111 86 121 90 L124 176 L76 176 Z', '#ece6df', '#cfc6bd');
const BASIC_BOTTOM = path('M75 168 L125 168 L127 220 L101 222 L100 210 L99 222 L73 220 Z', '#ece6df', '#cfc6bd');

// 무늬 채우기. 화면에 같은 그림이 여러 개 있어도 섞이지 않게 매번 새 id를 씀
let patternSeq = 0;
function patternDef(kind, base, sub) {
  const id = `pt${++patternSeq}`;
  const bg = `<rect width="40" height="40" fill="${base}"/>`;
  const body = {
    stripe: `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">${bg}<rect y="0" width="8" height="3" fill="${sub}"/></pattern>`,
    check:  `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse">${bg}<rect width="12" height="5" fill="${sub}" opacity=".55"/><rect width="5" height="12" fill="${sub}" opacity=".55"/></pattern>`,
    dot:    `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse">${bg}<circle cx="4.5" cy="4.5" r="1.7" fill="${sub}"/></pattern>`,
    floral: `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse">${bg}`
      + [[8, 5], [11, 8], [8, 11], [5, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${sub}"/>`).join('')
      + `<circle cx="8" cy="8" r="1.6" fill="#f0cc4a"/></pattern>`,
  }[kind];
  return body ? { id, def: `<defs>${body}</defs>` } : null;
}

// 프린팅 티: 가슴에 작은 그림
function printMark(item, sub) {
  if (!['top', 'dress'].includes(item.cat)) return '';
  return `<rect x="88" y="112" width="24" height="16" rx="3" fill="${sub}"/>`
    + `<path d="M92 124 L97 117 L101 122 L104 119 L108 124 Z" fill="${col(item.color).hex}" opacity=".8"/>`;
}

function garment(item) {
  const draw = SHAPES[kindOf(item).id];
  if (!draw) return '';
  const hex = col(item.color).hex;
  const sub = col(item.color2 || 'white').hex;
  const pt = item.pattern || 'none';
  // 이름에 "반팔"이 있으면 셔츠·블라우스도 반팔로 그림
  const short = /반팔|반소매/.test(item.name || '');
  const p = { ...paints(hex), short };
  const fill = pt !== 'none' && pt !== 'print' && item.cat !== 'shoes' ? patternDef(pt, hex, sub) : null;
  if (fill) p.f = `url(#${fill.id})`;
  return (fill ? fill.def : '') + draw(p) + (pt === 'print' ? printMark(item, sub) : '');
}

// look: { top, bottom, dress, outer, shoes } — 각 값은 옷 아이템(없으면 비어 있음)
function drawAvatar(look, label = '아바타') {
  let s = bodyBack();
  if (look.dress) {
    s += garment(look.dress);
  } else {
    s += look.bottom ? garment(look.bottom) : BASIC_BOTTOM;
    s += look.top ? garment(look.top) : BASIC_TOP;
  }
  if (look.outer) s += garment(look.outer);
  s += look.shoes ? garment(look.shoes) : BARE_FEET;
  s += HANDS;
  return `<svg class="avatar-svg" viewBox="0 0 200 390" role="img" aria-label="${label}">${s}</svg>`;
}

/* =========================================================
   실제 옷 사진으로 입히기 (배경을 지운 사진이 있는 옷만, 없으면 그림으로)
   ========================================================= */

// 옷 종류별로 사진을 놓을 자리 [x, y, 너비, 높이] (아바타 좌표)
const PHOTO_BOX = {
  top:    () => [42, 82, 116, 112],
  outer:  k => (['trench', 'coat'].includes(k) ? [34, 80, 132, 226] : ['padding'].includes(k) ? [34, 78, 132, 146] : [36, 80, 128, 132]),
  bottom: k => ({ shorts: [62, 164, 76, 80], miniskirt: [60, 164, 80, 84], longskirt: [54, 164, 92, 172] }[k] || [62, 164, 76, 200]),
  dress:  k => ({ 'dress-short': [48, 82, 104, 172], 'dress-knit': [46, 82, 108, 224] }[k] || [44, 82, 112, 258]),
  shoes:  () => [66, 344, 68, 36],
};

let clipSeq = 0;
function photoPiece(item, url) {
  const [bx, by, bw, bh] = PHOTO_BOX[item.cat](kindOf(item).id);
  const f = { s: 1, x: 0, y: 0, ...(item.fit || {}) };
  const w = bw * f.s, h = bh * f.s;
  const x = bx + (bw - w) / 2 + f.x, y = by + f.y;
  const align = item.cat === 'shoes' ? 'xMidYMax' : 'xMidYMin';
  const img = `<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${align} meet"/>`;
  if (item.cat !== 'outer' || item.closed) return img;
  // 아우터는 앞을 살짝 열어서 안에 입은 옷이 보이게: 왼쪽·오른쪽 반을 바깥으로 벌림
  const mid = x + w / 2, gap = 6 * f.s;
  const id = `cl${++clipSeq}`;
  return `<defs><clipPath id="${id}L"><rect x="${x - 20}" y="${y - 20}" width="${mid - x + 20}" height="${h + 40}"/></clipPath>`
    + `<clipPath id="${id}R"><rect x="${mid}" y="${y - 20}" width="${w / 2 + 20}" height="${h + 40}"/></clipPath></defs>`
    + `<g clip-path="url(#${id}L)" transform="translate(${-gap} 0)">${img}</g>`
    + `<g clip-path="url(#${id}R)" transform="translate(${gap} 0)">${img}</g>`;
}

function photoOrDrawing(item) {
  const url = cutoutUrl(item);
  return url ? photoPiece(item, url) : garment(item);
}

// 아바타에 실제 사진 입히기
function drawPhotoAvatar(look, label = '아바타') {
  let s = bodyBack();
  if (look.dress) {
    s += photoOrDrawing(look.dress);
  } else {
    s += look.bottom ? photoOrDrawing(look.bottom) : BASIC_BOTTOM;
    s += look.top ? photoOrDrawing(look.top) : BASIC_TOP;
  }
  if (look.outer) s += photoOrDrawing(look.outer);
  s += look.shoes ? photoOrDrawing(look.shoes) : BARE_FEET;
  // 사진 옷은 소매가 손을 덮지 않게 손을 그리지 않음
  if (!lookPieces(look).some(p => cutoutUrl(p) && ['top', 'outer', 'dress'].includes(p.cat))) s += HANDS;
  return `<svg class="avatar-svg" viewBox="0 0 200 390" role="img" aria-label="${label}">${s}</svg>`;
}

// 코디 보드: 핀터레스트 코디 사진처럼 옷을 나란히 펼쳐 놓기
const BOARD = {
  withOuter: { outer: [8, 16, 132, 210], top: [148, 8, 144, 116], bottom: [154, 132, 132, 150], dress: [148, 8, 144, 226], shoes: [20, 232, 108, 60] },
  noOuter:   { top: [16, 10, 150, 136], bottom: [168, 30, 120, 210], dress: [40, 8, 150, 270], shoes: [24, 200, 120, 84] },
};
const DRAW_BOX = { top: '40 76 120 130', bottom: '40 160 120 210', dress: '35 76 130 270', outer: '30 76 140 230', shoes: '66 350 68 30' };

function drawBoard(look, label = '코디 보드') {
  const L = look.outer ? BOARD.withOuter : BOARD.noOuter;
  let s = '<rect width="300" height="300" rx="14" fill="var(--board, #fbf8f4)"/>';
  for (const cat of ['outer', 'bottom', 'top', 'dress', 'shoes']) {
    const item = look[cat];
    if (!item) continue;
    let [x, y, w, h] = L[cat];
    if (cat === 'shoes' && look.dress && !look.outer) [x, y, w, h] = [190, 210, 100, 80];
    const url = cutoutUrl(item);
    s += url
      ? `<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
      : `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${DRAW_BOX[cat]}">${garment(item)}</svg>`;
  }
  return `<svg class="board-svg" viewBox="0 0 300 300" role="img" aria-label="${label}">${s}</svg>`;
}

// mode: 'draw' 그림 / 'photo' 사진 입히기 / 'board' 코디 보드
function drawLook(look, mode, label) {
  if (mode === 'board') return drawBoard(look, label);
  if (mode === 'photo') return drawPhotoAvatar(look, label);
  return drawAvatar(look, label);
}
