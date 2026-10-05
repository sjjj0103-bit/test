'use strict';

/* =========================================================
   오늘 뭐 입지? — 내 옷장 + 날씨 기반 코디 추천
   옷 사진과 기록은 모두 이 브라우저(IndexedDB / localStorage)에만 저장됩니다.
   날씨: Open-Meteo (무료, API 키 필요 없음)
   ========================================================= */

/* ---------- 기본 데이터 ---------- */

const CATS = {
  top:    '상의',
  bottom: '하의',
  dress:  '원피스',
  outer:  '아우터',
  shoes:  '신발',
};

// neutral: 어떤 색과도 잘 어울리는 기본색 / family: 같은 계열(톤온톤) 판단용
const COLORS = [
  { id: 'black',    name: '블랙',   hex: '#222222', neutral: true },
  { id: 'white',    name: '화이트', hex: '#f8f8f5', neutral: true },
  { id: 'gray',     name: '그레이', hex: '#9b9b9b', neutral: true },
  { id: 'beige',    name: '베이지', hex: '#dccbb0', neutral: true },
  { id: 'camel',    name: '카멜',   hex: '#b5834f', neutral: true },
  { id: 'brown',    name: '브라운', hex: '#6b4a35', neutral: true },
  { id: 'navy',     name: '네이비', hex: '#23314f', neutral: true },
  { id: 'denim',    name: '데님',   hex: '#5476a0', neutral: true },
  { id: 'khaki',    name: '카키',   hex: '#76764a', neutral: true },
  { id: 'red',      name: '레드',   hex: '#c23b32', family: 'red' },
  { id: 'pink',     name: '핑크',   hex: '#f2aabb', family: 'red' },
  { id: 'orange',   name: '오렌지', hex: '#e5803a', family: 'orange' },
  { id: 'yellow',   name: '옐로우', hex: '#f0cc4a', family: 'yellow' },
  { id: 'green',    name: '그린',   hex: '#3f8a5c', family: 'green' },
  { id: 'mint',     name: '민트',   hex: '#a6dcc8', family: 'green' },
  { id: 'blue',     name: '블루',   hex: '#3a74d0', family: 'blue' },
  { id: 'skyblue',  name: '하늘',   hex: '#a4cbee', family: 'blue' },
  { id: 'purple',   name: '퍼플',   hex: '#7e5aa8', family: 'purple' },
  { id: 'lavender', name: '라벤더', hex: '#cbbde9', family: 'purple' },
];
const COLOR = Object.fromEntries(COLORS.map(c => [c.id, c]));
const col = id => COLOR[id] || COLOR.gray;

// 실패 없는 기본색 조합
const CLASSIC_PAIRS = [
  ['navy', 'beige'], ['black', 'white'], ['white', 'denim'], ['beige', 'brown'],
  ['camel', 'white'], ['gray', 'navy'], ['khaki', 'white'], ['beige', 'denim'],
  ['camel', 'denim'], ['black', 'beige'], ['camel', 'black'], ['gray', 'white'],
];
// 서로 다른 계열이지만 잘 어울리는 색
const SOFT_PAIRS = [
  ['pink', 'skyblue'], ['mint', 'lavender'], ['yellow', 'skyblue'],
  ['lavender', 'skyblue'], ['pink', 'lavender'], ['mint', 'skyblue'],
];
const hasPair = (pairs, a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const WARMTH = [
  null,
  { name: '아주 얇음',   ex: '민소매·반팔·반바지·샌들' },
  { name: '얇음',        ex: '긴팔티·셔츠·블라우스·면바지' },
  { name: '보통',        ex: '맨투맨·얇은 니트·가디건·청바지' },
  { name: '따뜻함',      ex: '두꺼운 니트·자켓·트렌치코트·기모바지' },
  { name: '아주 따뜻함', ex: '울코트·패딩·부츠' },
];

const OCCASIONS = {
  work:   { name: '출근',   word: '출근룩' },
  date:   { name: '데이트', word: '데이트룩' },
  casual: { name: '외출',   word: '데일리룩' },
};

const CITIES = [
  { id: 'gps',      name: '📍 현재 위치' },
  { id: 'seoul',    name: '서울', lat: 37.5665, lon: 126.9780 },
  { id: 'incheon',  name: '인천', lat: 37.4563, lon: 126.7052 },
  { id: 'suwon',    name: '수원', lat: 37.2636, lon: 127.0286 },
  { id: 'chuncheon',name: '춘천', lat: 37.8813, lon: 127.7298 },
  { id: 'gangneung',name: '강릉', lat: 37.7519, lon: 128.8761 },
  { id: 'cheongju', name: '청주', lat: 36.6424, lon: 127.4890 },
  { id: 'sejong',   name: '세종', lat: 36.4800, lon: 127.2890 },
  { id: 'daejeon',  name: '대전', lat: 36.3504, lon: 127.3845 },
  { id: 'jeonju',   name: '전주', lat: 35.8242, lon: 127.1480 },
  { id: 'daegu',    name: '대구', lat: 35.8714, lon: 128.6014 },
  { id: 'gwangju',  name: '광주', lat: 35.1595, lon: 126.8526 },
  { id: 'ulsan',    name: '울산', lat: 35.5384, lon: 129.3114 },
  { id: 'busan',    name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'jeju',     name: '제주', lat: 33.4996, lon: 126.5312 },
];

const SAMPLES = [
  ['화이트 셔츠',      'top',    'white',    2, ['work']],
  ['베이지 니트',      'top',    'beige',    3, []],
  ['네이비 맨투맨',    'top',    'navy',     3, ['casual']],
  ['핑크 블라우스',    'top',    'pink',     2, ['work', 'date']],
  ['블랙 반팔티',      'top',    'black',    1, []],
  ['연청 청바지',      'bottom', 'denim',    3, []],
  ['블랙 슬랙스',      'bottom', 'black',    3, ['work']],
  ['베이지 롱스커트',  'bottom', 'beige',    2, ['date', 'work']],
  ['화이트 반바지',    'bottom', 'white',    1, ['casual']],
  ['라벤더 원피스',    'dress',  'lavender', 2, ['date']],
  ['베이지 트렌치코트','outer',  'beige',    4, []],
  ['네이비 가디건',    'outer',  'navy',     3, []],
  ['블랙 울코트',      'outer',  'black',    5, []],
  ['화이트 스니커즈',  'shoes',  'white',    2, ['casual', 'date']],
  ['블랙 로퍼',        'shoes',  'black',    3, ['work']],
  ['브라운 앵클부츠',  'shoes',  'brown',    4, []],
].map(([name, cat, color, warmth, occasions], i) =>
  ({ id: `sample-${i}`, sample: true, name, cat, color, warmth, occasions, photo: null, createdAt: i }));

/* ---------- 작은 도구들 ---------- */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayNum = s => Math.round(parseYmd(s).getTime() / 864e5);
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const defaultName = item => `${col(item.color).name} ${CATS[item.cat] || ''}`.trim();
const itemName = item => item.name || defaultName(item);

const ls = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 불가(사생활 보호 모드 등) */ }
  },
};

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// 같은 날에는 같은 추천이 나오도록 하는 작은 난수
function rand(seed, pieces) {
  let h = 2166136261 ^ seed;
  for (const ch of pieces.map(p => p.id).join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/* ---------- 옷장 저장소 (IndexedDB) ---------- */

const store = {
  db: null,
  async open() {
    if (!('indexedDB' in window)) return;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('wardrobe', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('items', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('items', mode);
      const req = fn(t.objectStore('items'));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  },
  all()      { return this.db ? this.tx('readonly',  s => s.getAll())     : Promise.resolve([]); },
  put(item)  { return this.db ? this.tx('readwrite', s => s.put(item))    : Promise.resolve(); },
  del(id)    { return this.db ? this.tx('readwrite', s => s.delete(id))   : Promise.resolve(); },
};

/* ---------- 입은 옷 기록 ---------- */

const wornLog = () => ls.get('wornLog', {});
function recentWorn(dateStr, days = 3) {
  const log = wornLog();
  const base = parseYmd(dateStr);
  const ids = new Set();
  for (let i = 1; i <= days; i++) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    (log[ymd(d)] || []).forEach(id => ids.add(id));
  }
  return ids;
}

/* ---------- 날씨 ---------- */

function weatherInfo(code) {
  if (code === 0) return ['☀️', '맑음'];
  if (code <= 2) return ['🌤️', '구름 조금'];
  if (code === 3) return ['☁️', '흐림'];
  if (code <= 48) return ['🌫️', '안개'];
  if (code <= 57) return ['🌦️', '이슬비'];
  if (code <= 67) return ['🌧️', '비'];
  if (code <= 77) return ['🌨️', '눈'];
  if (code <= 82) return ['🌧️', '소나기'];
  if (code <= 86) return ['🌨️', '눈'];
  return ['⛈️', '뇌우'];
}

function getLocation() {
  const cityId = ls.get('city', 'seoul');
  const city = CITIES.find(c => c.id === cityId) || CITIES[1];
  if (city.id !== 'gps') return Promise.resolve(city);
  return new Promise(resolve => {
    const fallback = () => { toast('위치를 못 가져와서 서울 날씨로 보여드려요'); resolve(CITIES[1]); };
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ name: '현재 위치', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      fallback,
      { timeout: 8000, maximumAge: 30 * 60e3 },
    );
  });
}

async function loadWeather(force) {
  const loc = await getLocation();
  const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
  const cached = ls.get('wxCache', null);
  const today = ymd(new Date());
  if (!force && cached && cached.key === key && Date.now() - cached.at < 3600e3
      && cached.data.days[0].date === today) {
    return cached.data;
  }
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max'
    + '&hourly=temperature_2m&timezone=auto&forecast_days=7';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = await res.json();
  const d = j.daily;
  const days = d.time.map((date, i) => {
    const h = j.hourly.time.indexOf(`${date}T08:00`);
    return {
      date,
      code: d.weather_code[i],
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      // 체감온도(바람·습도 반영)의 하루 평균
      feel: Math.round((d.apparent_temperature_max[i] + d.apparent_temperature_min[i]) / 2),
      rain: d.precipitation_probability_max[i] ?? 0,
      morning: h >= 0 ? Math.round(j.hourly.temperature_2m[h]) : null,
    };
  });
  const data = { place: loc.name, days };
  ls.set('wxCache', { key, at: Date.now(), data });
  return data;
}

/* ---------- 코디 추천 ---------- */

// 한국에서 흔히 쓰는 "기온별 옷차림표"를 두께 단계(1~5)로 옮긴 것
function guideFor(t) {
  if (t >= 28) return { label: '민소매·반팔·반바지·원피스',    top: [1, 1], bottom: [1, 2], outer: 'none',     outerR: [1, 2], shoes: [1, 2] };
  if (t >= 23) return { label: '반팔·얇은 셔츠·반바지·면바지', top: [1, 2], bottom: [1, 2], outer: 'none',     outerR: [1, 2], shoes: [1, 3] };
  if (t >= 20) return { label: '블라우스·긴팔티·면바지·슬랙스', top: [2, 2], bottom: [2, 3], outer: 'optional', outerR: [2, 3], shoes: [2, 3] };
  if (t >= 17) return { label: '얇은 니트·가디건·맨투맨·청바지', top: [2, 3], bottom: [2, 3], outer: 'optional', outerR: [3, 3], shoes: [2, 4] };
  if (t >= 12) return { label: '자켓·가디건·셔츠·청바지',      top: [2, 3], bottom: [3, 3], outer: 'required', outerR: [3, 4], shoes: [3, 4] };
  if (t >= 9)  return { label: '트렌치코트·야상·점퍼·니트',    top: [3, 3], bottom: [3, 4], outer: 'required', outerR: [4, 4], shoes: [3, 4] };
  if (t >= 5)  return { label: '울코트·가죽자켓·히트텍·니트',  top: [3, 4], bottom: [3, 4], outer: 'required', outerR: [4, 5], shoes: [3, 5] };
  return             { label: '패딩·두꺼운 코트·목도리·기모',  top: [3, 4], bottom: [4, 5], outer: 'required', outerR: [5, 5], shoes: [4, 5] };
}

function fit(warmth, [lo, hi]) {
  if (warmth >= lo && warmth <= hi) return 3;
  const d = warmth < lo ? lo - warmth : warmth - hi;
  return d === 1 ? 0 : -4 * d;
}

function rangeFor(item, g) {
  if (item.cat === 'outer') return g.outerR;
  if (item.cat === 'bottom') return g.bottom;
  if (item.cat === 'shoes') return g.shoes;
  return g.top;
}

function colorScore(pieces) {
  const ids = [...new Set(pieces.map(p => col(p.color).id))];
  const bold = ids.filter(id => !COLOR[id].neutral);
  let score = 0;
  const reasons = [];
  if (bold.length === 0) {
    score += 2;
    reasons.push(ids.length === 1 && pieces.length > 1
      ? `${COLOR[ids[0]].name} 원톤이라 세련돼 보여요`
      : '기본색끼리라 실패 없는 조합이에요');
  } else if (bold.length === 1) {
    score += 3;
    reasons.push(`${COLOR[bold[0]].name} 하나만 포인트로 써서 깔끔해요`);
  } else if (bold.length === 2) {
    const [a, b] = bold.map(id => COLOR[id]);
    if (a.family === b.family) {
      score += 2;
      reasons.push(`${a.name}·${b.name}, 비슷한 색끼리 맞춘 톤온톤이에요`);
    } else if (hasPair(SOFT_PAIRS, a.id, b.id)) {
      score += 2;
      reasons.push(`${a.name}+${b.name}는 부드러운 색끼리 잘 어울려요`);
    } else {
      score -= 3;
    }
  } else {
    score -= 5;
  }
  const classic = CLASSIC_PAIRS.find(([a, b]) => ids.includes(a) && ids.includes(b));
  if (classic) {
    score += 1;
    reasons.push(`${COLOR[classic[0]].name}+${COLOR[classic[1]].name}는 공식 같은 조합이에요`);
  }
  return { score, reasons };
}

function scoreOutfit(pieces, ctx) {
  const { g, occasion } = ctx;
  let score = 0;
  let allFit = true;
  const reasons = [];
  const notes = [];
  const outer = pieces.find(p => p.cat === 'outer');

  for (const p of pieces) {
    const f = fit(p.warmth, rangeFor(p, g));
    score += f;
    if (f < 3) allFit = false;
    if (p.occasions?.length) score += p.occasions.includes(occasion) ? 2 : -3;
    if (ctx.recent.has(p.id)) score -= 2;
    if (p.cat !== 'outer') score -= 5 * (ctx.used.get(p.id) || 0);
  }

  if (g.outer === 'required' && !outer) {
    score -= 6;
    allFit = false;
    notes.push('이 날씨엔 겉옷을 하나 걸치는 게 좋아요');
  }
  if (g.outer === 'none' && outer) score -= 8;
  if (outer && ctx.swing >= 10) {
    score += 2;
    reasons.push(`일교차가 ${ctx.swing}°라 벗고 입기 편한 겉옷을 넣었어요`);
  }
  if (allFit) reasons.unshift(`체감 ${ctx.t}°에 딱 맞는 두께예요`);

  const c = colorScore(pieces);
  score += c.score;
  reasons.push(...c.reasons);

  if (pieces.filter(p => p.occasions?.includes(occasion)).length >= 2) {
    reasons.push(`${OCCASIONS[occasion].name}할 때 입는 옷으로 골랐어요`);
  }
  if (pieces.some(p => ctx.recent.has(p.id))) notes.push('최근 3일 안에 입은 옷이 들어 있어요');

  score += rand(ctx.seed, pieces) * 1.5;
  return { pieces, score, reasons, notes };
}

function pickShoes(outfit, shoes, ctx) {
  if (!shoes.length || outfit.shoes !== undefined) return;
  let best = null;
  let bestScore = -Infinity;
  for (const s of shoes) {
    let sc = fit(s.warmth, ctx.g.shoes) + colorScore([...outfit.pieces, s]).score;
    if (s.occasions?.length) sc += s.occasions.includes(ctx.occasion) ? 2 : -3;
    if (ctx.rain >= 50 && ['white', 'beige'].includes(s.color)) sc -= 1;
    sc += rand(ctx.seed + 7, [...outfit.pieces, s]);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  outfit.shoes = best;
}

function makeCtx(day, occasion, used = new Map()) {
  return {
    t: day.feel,
    g: guideFor(day.feel),
    swing: day.max - day.min,
    rain: day.rain,
    occasion,
    recent: recentWorn(day.date),
    used,
    seed: dayNum(day.date),
  };
}

// 점수 높은 순으로 정렬된 코디 목록 (같은 상·하의 조합은 한 번만)
function recommend(ctx) {
  const by = cat => state.items.filter(i => i.cat === cat);
  const tops = by('top'), bottoms = by('bottom'), dresses = by('dress'), outers = by('outer');
  const bases = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of dresses) bases.push([d]);
  const outerOpts = ctx.g.outer === 'none' ? [null] : [null, ...outers];

  const all = [];
  for (const base of bases) {
    for (const o of outerOpts) all.push(scoreOutfit(o ? [...base, o] : base, ctx));
  }
  all.sort((a, b) => b.score - a.score);

  const seen = new Set();
  return all.filter(o => {
    const key = o.pieces.filter(p => p.cat !== 'outer').map(p => p.id).join('+');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pinterestUrl(outfit, occasion) {
  const words = outfit.pieces.map(itemName);
  const q = `${words.join(' ')} ${OCCASIONS[occasion].word}`;
  return 'https://www.pinterest.co.kr/search/pins/?q=' + encodeURIComponent(q);
}

/* ---------- 화면 상태 ---------- */

const state = {
  items: [],
  weather: null,
  wxError: false,
  view: 'today',
  occasion: ls.get('occasion', 'work'),
  page: 0,
  filter: 'all',
  draft: null,
};

/* ---------- 화면 그리기 ---------- */

function thumb(item) {
  const inner = item.photo
    ? `<img src="${item.photo}" alt="">`
    : `<span class="swatch" style="background:${col(item.color).hex}"></span>`;
  return `<figure class="thumb">${inner}<figcaption>${esc(itemName(item))}</figcaption></figure>`;
}

function dayLabel(dateStr, i) {
  const d = parseYmd(dateStr);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  if (i === 0) return `오늘 <small>${md} ${DOW[d.getDay()]}</small>`;
  if (i === 1) return `내일 <small>${md} ${DOW[d.getDay()]}</small>`;
  return `${DOW[d.getDay()]}요일 <small>${md}</small>`;
}

function weatherTips(day) {
  const tips = [];
  if (day.max - day.min >= 10) tips.push(`🌡️ 일교차 ${day.max - day.min}°! 아침저녁엔 쌀쌀하니 겉옷을 챙기세요`);
  if (day.rain >= 50) tips.push(`☔ 비 올 확률 ${day.rain}% — 우산 챙기고, 밝은 색·스웨이드 신발은 피하세요`);
  return tips;
}

function emptyCloset() {
  return `
    <div class="card empty">
      <p class="big">👗</p>
      <p><b>옷장이 아직 비어 있어요.</b></p>
      <p class="muted">아래 ＋ 버튼으로 옷 사진을 올려 주세요.<br>먼저 체험해 보고 싶다면 예시 옷을 넣어 볼 수 있어요.</p>
      <button type="button" class="primary" data-act="sample-add">예시 옷으로 체험하기</button>
    </div>`;
}

function outfitCard(o, idx, occasion) {
  const pieces = [...o.pieces, o.shoes].filter(Boolean);
  const ids = pieces.map(p => p.id).join(',');
  return `
    <article class="card outfit">
      <div class="outfit-head"><b>추천 ${idx + 1}</b></div>
      <div class="pieces">${pieces.map(thumb).join('')}</div>
      <ul class="reasons">${o.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      ${o.notes.map(n => `<p class="note">${esc(n)}</p>`).join('')}
      <div class="actions">
        <button type="button" class="primary" data-act="wear" data-ids="${ids}">이거 입을래요</button>
        <a class="btn" href="${pinterestUrl(o, occasion)}" target="_blank" rel="noopener">핀터레스트에서 비슷한 코디 보기 ↗</a>
      </div>
    </article>`;
}

function occChips(selected, act, extra = '') {
  return Object.entries(OCCASIONS).map(([id, o]) =>
    `<button type="button" class="chip" data-act="${act}" data-occ="${id}" ${extra} aria-pressed="${id === selected}">${o.name}</button>`,
  ).join('');
}

function weatherError() {
  return `
    <div class="card">
      <p><b>날씨를 불러오지 못했어요.</b></p>
      <p class="muted">인터넷 연결을 확인하고 다시 시도해 주세요.</p>
      <button type="button" data-act="retry">다시 시도</button>
    </div>`;
}

function renderToday() {
  const el = $('#view-today');
  if (!state.weather) {
    el.innerHTML = state.wxError ? weatherError() : '<div class="card muted">날씨를 불러오는 중…</div>';
    return;
  }
  const day = state.weather.days[0];
  const [icon, desc] = weatherInfo(day.code);
  const ctx = makeCtx(day, state.occasion);
  const worn = wornLog()[day.date];

  let html = `
    <div class="card weather">
      <div class="wx-main">
        <span class="wx-icon">${icon}</span>
        <div>
          <div class="wx-temp">${day.min}° / ${day.max}°</div>
          <div class="muted">${esc(state.weather.place)} · ${desc} · 체감 평균 ${day.feel}°</div>
        </div>
      </div>
      <div class="wx-row">
        ${day.morning != null ? `<span>🚶 출근길(8시) ${day.morning}°</span>` : ''}
        <span>☔ 강수확률 ${day.rain}%</span>
      </div>
      ${weatherTips(day).map(t => `<p class="tip">${t}</p>`).join('')}
      <p class="guide">오늘 같은 날씨엔 <b>${ctx.g.label}</b></p>
    </div>`;

  if (worn) {
    const items = worn.map(id => state.items.find(i => i.id === id)).filter(Boolean);
    html += `
      <div class="card chosen">
        <p><b>✅ 오늘 입은 옷</b></p>
        <div class="pieces">${items.map(thumb).join('')}</div>
        <button type="button" class="link" data-act="unwear">선택 취소</button>
      </div>`;
  }

  html += `<div class="occ-row"><span>오늘 일정</span>${occChips(state.occasion, 'occ')}</div>`;

  if (!state.items.length) {
    el.innerHTML = html + emptyCloset();
    return;
  }

  const list = recommend(ctx);
  if (!list.length) {
    el.innerHTML = html + `
      <div class="card empty">
        <p><b>조합을 만들 옷이 부족해요.</b></p>
        <p class="muted">상의 1벌 + 하의 1벌, 또는 원피스 1벌이 있으면 추천을 시작할 수 있어요.</p>
      </div>`;
    return;
  }

  const per = 3;
  const pages = Math.ceil(list.length / per);
  const page = state.page % pages;
  const shown = list.slice(page * per, page * per + per);
  const shoes = state.items.filter(i => i.cat === 'shoes');
  shown.forEach(o => pickShoes(o, shoes, ctx));

  html += shown.map((o, i) => outfitCard(o, page * per + i, state.occasion)).join('');
  if (pages > 1) {
    html += `<button type="button" class="wide" data-act="more">🔄 다른 조합 보기 (${page + 1}/${pages})</button>`;
  }
  if (!state.items.some(i => i.cat === 'outer') && ctx.g.outer !== 'none') {
    html += '<p class="hint">💡 아우터를 등록하면 쌀쌀한 날 겉옷까지 같이 추천해 드려요.</p>';
  }
  el.innerHTML = html;
}

function weekOccasion(dateStr) {
  const saved = ls.get('weekOcc', {})[dateStr];
  if (saved) return saved;
  const dow = parseYmd(dateStr).getDay();
  return dow === 0 || dow === 6 ? 'casual' : 'work';
}

function renderWeek() {
  const el = $('#view-week');
  if (!state.weather) {
    el.innerHTML = state.wxError ? weatherError() : '<div class="card muted">날씨를 불러오는 중…</div>';
    return;
  }
  const used = new Map();
  const shoes = state.items.filter(i => i.cat === 'shoes');
  let html = `<p class="intro">이번 주 날씨에 맞춰 <b>같은 옷이 겹치지 않게</b> 미리 짜 봤어요. 요일마다 일정을 바꿀 수 있어요.</p>`;

  state.weather.days.forEach((day, i) => {
    const [icon, desc] = weatherInfo(day.code);
    const occ = weekOccasion(day.date);
    const ctx = makeCtx(day, occ, used);
    let body;
    if (!state.items.length) {
      body = '<p class="muted">옷장에 옷을 넣으면 여기에 코디가 나와요.</p>';
    } else {
      const best = recommend(ctx)[0];
      if (!best) {
        body = '<p class="muted">상의+하의 또는 원피스가 필요해요.</p>';
      } else {
        pickShoes(best, shoes, ctx);
        best.pieces.forEach(p => { if (p.cat !== 'outer') used.set(p.id, (used.get(p.id) || 0) + 1); });
        body = `
          <div class="pieces small">${[...best.pieces, best.shoes].filter(Boolean).map(thumb).join('')}</div>
          ${best.reasons[0] ? `<p class="reason-line">✓ ${esc(best.reasons[0])}</p>` : ''}
          <a class="link" href="${pinterestUrl(best, occ)}" target="_blank" rel="noopener">핀터레스트에서 보기 ↗</a>`;
      }
    }
    html += `
      <article class="card day">
        <div class="day-head">
          <div class="day-name">${dayLabel(day.date, i)}</div>
          <div class="day-wx" title="${desc}">${icon} ${day.min}°/${day.max}°${day.rain >= 50 ? ` ☔${day.rain}%` : ''}</div>
        </div>
        <div class="occ-row small">${occChips(occ, 'week-occ', `data-date="${day.date}"`)}</div>
        ${body}
      </article>`;
  });
  el.innerHTML = html;
}

function renderCloset() {
  const el = $('#view-closet');
  const counts = { all: state.items.length };
  for (const i of state.items) counts[i.cat] = (counts[i.cat] || 0) + 1;
  const filters = [['all', '전체'], ...Object.entries(CATS)];
  const hasSamples = state.items.some(i => i.sample);

  let html = `<div class="filter-row">${filters.map(([id, name]) =>
    `<button type="button" class="chip" data-act="filter" data-cat="${id}" aria-pressed="${state.filter === id}">${name} ${counts[id] || 0}</button>`,
  ).join('')}</div>`;

  if (!state.items.length) {
    html += emptyCloset();
  } else {
    const list = state.items
      .filter(i => state.filter === 'all' || i.cat === state.filter)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    html += list.length
      ? `<div class="grid">${list.map(i => `
          <button type="button" class="item" data-act="edit" data-id="${esc(i.id)}">
            ${thumb(i)}
            <span class="meta">${CATS[i.cat]} · ${WARMTH[i.warmth]?.name || ''}</span>
          </button>`).join('')}</div>`
      : '<p class="muted center">이 종류의 옷이 아직 없어요.</p>';
  }

  html += `
    <div class="card tools">
      <p class="muted">📌 사진은 <b>이 휴대폰 브라우저에만</b> 저장돼요. 폰을 바꾸거나 인터넷 기록을 지우기 전에 백업 파일을 저장해 두세요.</p>
      <div class="actions">
        <button type="button" data-act="export">백업 파일 저장</button>
        <button type="button" data-act="import">백업 불러오기</button>
        ${hasSamples ? '<button type="button" class="danger" data-act="sample-del">예시 옷 모두 지우기</button>' : ''}
      </div>
    </div>`;
  el.innerHTML = html;
}

function render() {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${state.view}`));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  if (state.view === 'today') renderToday();
  else if (state.view === 'week') renderWeek();
  else renderCloset();
}

/* ---------- 옷 추가·수정 창 ---------- */

const editor = $('#editor');

function openEditor(item) {
  state.draft = item
    ? { ...item, occasions: [...(item.occasions || [])] }
    : { id: null, photo: null, cat: 'top', color: 'gray', warmth: 3, occasions: [], name: '' };
  $('#editor-title').textContent = item ? '옷 정보 수정' : '옷 추가';
  $('#btn-delete').hidden = !item;
  $('#f-name').value = state.draft.name || '';
  $('#color-hint').textContent = '';
  $('#photo-input').value = '';
  renderEditor();
  editor.showModal();
}

function renderEditor() {
  const d = state.draft;
  $('#photo-preview').innerHTML = d.photo
    ? `<img src="${d.photo}" alt="옷 사진">`
    : '<span>📷<br>사진 찍기 / 앨범에서 고르기</span>';
  $('#f-cat').innerHTML = Object.entries(CATS).map(([id, name]) =>
    `<button type="button" class="chip" data-field="cat" data-val="${id}" aria-pressed="${d.cat === id}">${name}</button>`).join('');
  $('#f-color').innerHTML = COLORS.map(c =>
    `<button type="button" class="color" data-field="color" data-val="${c.id}" aria-pressed="${d.color === c.id}" title="${c.name}">
       <span style="background:${c.hex}"></span>${c.name}</button>`).join('');
  $('#f-warmth').innerHTML = WARMTH.slice(1).map((w, i) =>
    `<button type="button" data-field="warmth" data-val="${i + 1}" aria-pressed="${d.warmth === i + 1}">
       <b>${'●'.repeat(i + 1)}${'○'.repeat(4 - i)} ${w.name}</b><small>${w.ex}</small></button>`).join('');
  $('#f-occ').innerHTML = Object.entries(OCCASIONS).map(([id, o]) =>
    `<button type="button" class="chip" data-field="occ" data-val="${id}" aria-pressed="${d.occasions.includes(id)}">${o.name}</button>`).join('');
  $('#f-name').placeholder = `예: ${defaultName(d)}`;
}

editor.addEventListener('click', e => {
  const b = e.target.closest('[data-field]');
  if (!b) return;
  const d = state.draft;
  const v = b.dataset.val;
  if (b.dataset.field === 'cat') d.cat = v;
  if (b.dataset.field === 'color') { d.color = v; $('#color-hint').textContent = ''; }
  if (b.dataset.field === 'warmth') d.warmth = Number(v);
  if (b.dataset.field === 'occ') {
    d.occasions = d.occasions.includes(v) ? d.occasions.filter(x => x !== v) : [...d.occasions, v];
  }
  renderEditor();
});

$('#photo-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const { photo, color } = await processPhoto(file);
    state.draft.photo = photo;
    state.draft.color = color;
    renderEditor();
    $('#color-hint').textContent = `사진에서 ${col(color).name}(으)로 골랐어요. 다르면 눌러서 바꿔 주세요`;
  } catch {
    toast('사진을 읽지 못했어요. 다른 사진으로 해 볼까요?');
  }
});

$('#editor-form').addEventListener('submit', async e => {
  e.preventDefault();
  const d = state.draft;
  const item = {
    ...d,
    id: d.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: $('#f-name').value.trim(),
    createdAt: d.createdAt || Date.now(),
  };
  try {
    await store.put(item);
  } catch {
    toast('저장 공간이 부족해요. 안 입는 옷을 지우고 다시 시도해 주세요');
    return;
  }
  const idx = state.items.findIndex(i => i.id === item.id);
  if (idx >= 0) state.items[idx] = item; else state.items.push(item);
  editor.close();
  toast(d.id ? '수정했어요' : `${itemName(item)}을(를) 옷장에 넣었어요`);
  render();
});

$('#btn-cancel').addEventListener('click', () => editor.close());

$('#btn-delete').addEventListener('click', async () => {
  const d = state.draft;
  if (!confirm(`'${itemName(d)}'을(를) 옷장에서 지울까요?`)) return;
  await store.del(d.id);
  state.items = state.items.filter(i => i.id !== d.id);
  editor.close();
  toast('지웠어요');
  render();
});

/* ---------- 사진 처리 ---------- */

const PALETTE_RGB = COLORS.map(c => ({
  id: c.id,
  r: parseInt(c.hex.slice(1, 3), 16),
  g: parseInt(c.hex.slice(3, 5), 16),
  b: parseInt(c.hex.slice(5, 7), 16),
}));

function nearestColor(r, g, b) {
  let best = 'gray';
  let bestD = Infinity;
  for (const p of PALETTE_RGB) {
    const d = 2 * (r - p.r) ** 2 + 4 * (g - p.g) ** 2 + 3 * (b - p.b) ** 2;
    if (d < bestD) { bestD = d; best = p.id; }
  }
  return best;
}

// 사진 가운데 부분에서 가장 많이 보이는 색을 고름 (가장자리 배경은 제외)
function detectColor(img) {
  const n = 48;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, 0, 0, n, n);
  const data = c.getImageData(0, 0, n, n).data;
  const count = {};
  for (let i = 0; i < data.length; i += 4) {
    const id = nearestColor(data[i], data[i + 1], data[i + 2]);
    count[id] = (count[id] || 0) + 1;
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

async function processPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 640;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return { photo: cv.toDataURL('image/jpeg', 0.8), color: detectColor(img) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- 백업 ---------- */

function exportBackup() {
  const data = { app: 'what-to-wear', version: 1, exportedAt: new Date().toISOString(), items: state.items, wornLog: wornLog() };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `내옷장-백업-${ymd(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('백업 파일을 저장했어요');
}

$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items)) throw new Error('bad file');
    const items = data.items.filter(i => i && i.id && CATS[i.cat]);
    for (const item of items) await store.put(item);
    if (data.wornLog) ls.set('wornLog', { ...data.wornLog, ...wornLog() });
    state.items = await store.all();
    toast(`옷 ${items.length}벌을 불러왔어요`);
    render();
  } catch {
    toast('백업 파일이 아닌 것 같아요');
  }
});

/* ---------- 버튼 동작 ---------- */

document.addEventListener('click', async e => {
  const nav = e.target.closest('.tabs button');
  if (nav) {
    state.view = nav.dataset.view;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const today = state.weather?.days[0].date || ymd(new Date());

  switch (b.dataset.act) {
    case 'occ':
      state.occasion = b.dataset.occ;
      state.page = 0;
      ls.set('occasion', state.occasion);
      render();
      break;
    case 'more':
      state.page++;
      render();
      break;
    case 'wear': {
      const log = wornLog();
      log[today] = b.dataset.ids.split(',');
      // 60일 지난 기록은 정리
      const cutoff = ymd(new Date(Date.now() - 60 * 864e5));
      for (const k of Object.keys(log)) if (k < cutoff) delete log[k];
      ls.set('wornLog', log);
      toast('기록했어요! 며칠 동안은 겹치지 않게 추천할게요');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    }
    case 'unwear': {
      const log = wornLog();
      delete log[today];
      ls.set('wornLog', log);
      render();
      break;
    }
    case 'week-occ': {
      const map = ls.get('weekOcc', {});
      map[b.dataset.date] = b.dataset.occ;
      ls.set('weekOcc', map);
      render();
      break;
    }
    case 'filter':
      state.filter = b.dataset.cat;
      render();
      break;
    case 'edit':
      openEditor(state.items.find(i => i.id === b.dataset.id));
      break;
    case 'sample-add':
      for (const s of SAMPLES) await store.put(s);
      state.items = await store.all();
      toast('예시 옷 16벌을 넣었어요. 오늘 탭에서 추천을 확인해 보세요!');
      render();
      break;
    case 'sample-del':
      if (!confirm('예시 옷을 모두 지울까요? 직접 올린 옷은 그대로 남아요.')) return;
      for (const s of state.items.filter(i => i.sample)) await store.del(s.id);
      state.items = state.items.filter(i => !i.sample);
      render();
      break;
    case 'export':
      exportBackup();
      break;
    case 'import':
      $('#import-file').click();
      break;
    case 'retry':
      refreshWeather(true);
      break;
  }
});

$('#fab').addEventListener('click', () => openEditor(null));

$('#city').addEventListener('change', e => {
  ls.set('city', e.target.value);
  refreshWeather(true);
});

/* ---------- 시작 ---------- */

async function refreshWeather(force) {
  state.wxError = false;
  if (force) { state.weather = null; render(); }
  try {
    state.weather = await loadWeather(force);
  } catch {
    state.wxError = true;
  }
  render();
}

async function init() {
  $('#city').innerHTML = CITIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  $('#city').value = ls.get('city', 'seoul');
  try {
    await store.open();
  } catch {
    toast('이 브라우저에서는 옷장을 저장할 수 없어요. 사생활 보호 모드를 꺼 주세요');
  }
  state.items = await store.all().catch(() => []);
  render();
  refreshWeather(false);
}

init();
