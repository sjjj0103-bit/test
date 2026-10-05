'use strict';

/* =========================================================
   아바타 옷 입히기
   옷 종류(kind)마다 모양을 SVG로 그리고, 등록한 옷 색으로 칠합니다.
   왼쪽 절반만 정의한 모양은 mirror()로 오른쪽을 만들어요. (좌표계: 200 x 400)
   ========================================================= */

const SKIN = '#f3d3bd';
const HAIR = '#3b2a22';

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

function bodyBack() {
  return `
    <ellipse cx="100" cy="378" rx="46" ry="6" fill="#000" opacity=".06"/>
    <path d="M73 46 Q100 12 127 46 L133 126 Q100 136 67 126 Z" fill="${HAIR}"/>
    <rect x="92" y="68" width="16" height="22" rx="5" fill="${SKIN}"/>
    <path d="M71 92 L56 196 M129 92 L144 196" stroke="${SKIN}" stroke-width="13" stroke-linecap="round"/>
    <path d="M89 200 L87 362 M111 200 L113 362" stroke="${SKIN}" stroke-width="18" stroke-linecap="round"/>
    <path d="M74 90 Q100 84 126 90 L126 206 L74 206 Z" fill="${SKIN}"/>
    <ellipse cx="100" cy="50" rx="22" ry="25" fill="${SKIN}"/>
    <circle cx="92" cy="53" r="2.3" fill="${HAIR}"/>
    <circle cx="108" cy="53" r="2.3" fill="${HAIR}"/>
    <circle cx="87" cy="60" r="3.6" fill="#f2a29c" opacity=".55"/>
    <circle cx="113" cy="60" r="3.6" fill="#f2a29c" opacity=".55"/>
    <path d="M95 63 Q100 67 105 63" stroke="#c0605a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M77 47 Q83 23 100 24 Q118 23 124 47 Q112 35 100 37 Q87 37 77 47 Z" fill="${HAIR}"/>`;
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
