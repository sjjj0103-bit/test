/**
 * 영어 단어 받아쓰기 (Google Apps Script)
 *
 * 구글 시트에 붙여 넣고 "웹 앱"으로 배포하면,
 * 학생은 크롬북에서 링크를 열어 받아쓰기를 하고
 * 결과는 이 시트의 "결과" 탭에 자동으로 쌓여요.
 */

// ===== 선생님이 바꿀 수 있는 설정 =====
var CLASS_COUNT = 8;          // 담당 반 수
var SHUFFLE_WORDS = true;     // 단어 순서를 학생마다 섞을지
var SHOW_ANSWERS_AFTER = true; // 제출 후 학생에게 정답을 보여 줄지

var SHEET_WORDS = '단어목록';
var SHEET_UNITS = '단원설정';
var SHEET_RESULTS = '결과';

// ===== 웹 앱 =====
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('영어 단어 받아쓰기')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 학생 화면이 처음 열릴 때 필요한 정보 */
function getAppInfo() {
  return {
    classCount: CLASS_COUNT,
    units: getOpenUnits_(),
    email: getStudentEmail_()
  };
}

/** 단원의 단어 목록 (소리로 읽어 주려면 단어가 필요해서 함께 보냄. 화면에는 표시하지 않음) */
function getWords(unit) {
  var words = getUnitWords_(unit);
  var list = words.map(function (w, i) {
    return { id: i, meaning: w.meaning, speak: w.word };
  });
  if (SHUFFLE_WORDS) shuffle_(list);
  return list;
}

/** 학생 답안 제출 → 채점 → 결과 시트에 저장 */
function submitAnswers(payload) {
  var unit = String(payload.unit);
  var words = getUnitWords_(unit);
  var answers = payload.answers || {};

  var details = [];
  var wrong = [];
  var correct = 0;
  words.forEach(function (w, i) {
    var typed = String(answers[i] || '');
    var ok = normalize_(typed) === normalize_(w.word);
    if (ok) correct++; else wrong.push(w.word + '(' + (typed || '빈칸') + ')');
    details.push({ word: w.word, meaning: w.meaning, typed: typed, ok: ok });
  });

  var total = words.length;
  var score = total ? Math.round(correct / total * 100) : 0;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getOrCreateSheet_(SHEET_RESULTS, RESULT_HEADERS_);
    sheet.appendRow([
      new Date(),
      Number(payload.classNo),
      Number(payload.studentNo),
      String(payload.name).trim(),
      unit,
      score,
      correct + '/' + total,
      wrong.join(', '),
      getStudentEmail_()
    ]);
  } finally {
    lock.releaseLock();
  }

  return {
    score: score,
    correct: correct,
    total: total,
    details: SHOW_ANSWERS_AFTER ? details : null
  };
}

// ===== 시트 메뉴 (선생님용) =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📝 받아쓰기')
    .addItem('처음 설정하기 (시트 만들기)', 'setupSheets')
    .addItem('반별 성적표 만들기', 'buildClassReports')
    .addToUi();
}

/** 필요한 탭을 만들고 예시 단어를 넣어 줌 */
function setupSheets() {
  var ss = SpreadsheetApp.getActive();

  var words = ss.getSheetByName(SHEET_WORDS);
  if (!words) {
    words = ss.insertSheet(SHEET_WORDS);
    words.appendRow(['단원', '단어(정답)', '뜻(학생에게 보임)']);
    [
      ['Unit 1', 'apple', '사과'],
      ['Unit 1', 'banana', '바나나'],
      ['Unit 1', 'orange', '오렌지'],
      ['Unit 1', 'I like apples.', '나는 사과를 좋아해.'],
      ['Unit 2', 'school', '학교'],
      ['Unit 2', 'teacher', '선생님'],
      ['Unit 2', 'friend', '친구']
    ].forEach(function (r) { words.appendRow(r); });
    styleHeader_(words, 3);
  }

  var units = ss.getSheetByName(SHEET_UNITS);
  if (!units) {
    units = ss.insertSheet(SHEET_UNITS);
    units.appendRow(['단원', '학생에게 열기']);
    units.appendRow(['Unit 1']);
    units.appendRow(['Unit 2']);
    units.getRange('B2:B50').insertCheckboxes();
    units.getRange('B2').check();
    styleHeader_(units, 2);
  }

  getOrCreateSheet_(SHEET_RESULTS, RESULT_HEADERS_);

  SpreadsheetApp.getUi().alert(
    '준비 완료!\n\n1) "단어목록"에 단원별 단어를 넣으세요.\n' +
    '2) "단원설정"에서 학생에게 열 단원에 체크하세요.\n' +
    '3) 배포 → 새 배포 → 웹 앱으로 링크를 만드세요.'
  );
}

/**
 * 반마다 탭을 하나씩 만들어
 * 학생(행) × 단원(열) 표로 "첫 번째 시도 점수"를 보여 줌.
 * (같은 단원을 여러 번 했으면 괄호 안에 횟수 표시)
 */
function buildClassReports() {
  var ss = SpreadsheetApp.getActive();
  var res = ss.getSheetByName(SHEET_RESULTS);
  if (!res || res.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('아직 제출된 결과가 없어요.');
    return;
  }
  var rows = res.getRange(2, 1, res.getLastRow() - 1, RESULT_HEADERS_.length).getValues();
  rows.sort(function (a, b) { return new Date(a[0]) - new Date(b[0]); });

  var unitOrder = getAllUnits_();
  var byClass = {};
  rows.forEach(function (r) {
    var cls = r[1], no = r[2], name = r[3], unit = String(r[4]), score = r[5];
    if (unitOrder.indexOf(unit) < 0) unitOrder.push(unit);
    byClass[cls] = byClass[cls] || {};
    var key = no;
    var st = byClass[cls][key] = byClass[cls][key] || { no: no, name: name, units: {} };
    st.name = name;
    var u = st.units[unit];
    if (!u) st.units[unit] = { first: score, count: 1 };
    else u.count++;
  });

  for (var c = 1; c <= CLASS_COUNT; c++) {
    var title = c + '반 성적';
    var sh = ss.getSheetByName(title) || ss.insertSheet(title);
    sh.clear();
    var header = ['번호', '이름'].concat(unitOrder).concat(['평균']);
    var out = [header];
    var students = byClass[c] ? Object.keys(byClass[c]).map(function (k) { return byClass[c][k]; }) : [];
    students.sort(function (a, b) { return a.no - b.no; });
    students.forEach(function (st) {
      var sum = 0, n = 0;
      var cells = unitOrder.map(function (u) {
        var v = st.units[u];
        if (!v) return '';
        sum += v.first; n++;
        return v.count > 1 ? v.first + ' (' + v.count + '회)' : v.first;
      });
      out.push([st.no, st.name].concat(cells).concat([n ? Math.round(sum / n) : '']));
    });
    sh.getRange(1, 1, out.length, header.length).setValues(out);
    styleHeader_(sh, header.length);
    sh.setFrozenRows(1);
  }
  SpreadsheetApp.getUi().alert('1반~' + CLASS_COUNT + '반 성적 탭을 새로 만들었어요.');
}

// ===== 내부 함수 =====
var RESULT_HEADERS_ = ['제출 시각', '반', '번호', '이름', '단원', '점수', '맞은 개수', '틀린 단어(학생 답)', '계정'];

function getUnitWords_(unit) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_WORDS);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
    .filter(function (r) { return String(r[0]).trim() === unit && String(r[1]).trim() !== ''; })
    .map(function (r) { return { word: String(r[1]).trim(), meaning: String(r[2]).trim() }; });
}

function getAllUnits_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_WORDS);
  if (!sh || sh.getLastRow() < 2) return [];
  var seen = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var u = String(r[0]).trim();
    if (u && seen.indexOf(u) < 0) seen.push(u);
  });
  return seen;
}

function getOpenUnits_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_UNITS);
  if (!sh || sh.getLastRow() < 2) return getAllUnits_();
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(function (r) { return String(r[0]).trim() && r[1] === true; })
    .map(function (r) { return String(r[0]).trim(); });
}

/** 대소문자·앞뒤 공백·여러 칸 띄어쓰기·끝의 마침표/물음표/느낌표 차이는 맞은 걸로 봄 */
function normalize_(s) {
  return String(s)
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim();
}

function getStudentEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    styleHeader_(sh, headers.length);
    sh.setFrozenRows(1);
  }
  return sh;
}

function styleHeader_(sh, cols) {
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#fde68a');
}

function shuffle_(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
}
