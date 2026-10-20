// 우리 둘 달력 — 경제 탭용 Supabase Edge Function (이름: market)
// 하는 일: 관심 종목 시세(국내: 네이버, 해외·환율: 야후, 코인: 업비트)와 경제 뉴스 헤드라인(구글 뉴스)을 모아서 앱에 돌려줘요.
// 앱이 이 사이트들에 직접 물어보면 브라우저가 막기 때문에, 이 함수가 대신 물어봐요.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA = { "User-Agent": "Mozilla/5.0 (compatible; couple-app/1.0)" };

type Item = { kind: "kr" | "us" | "fx" | "coin"; sym: string };
type Quote = { price: number; prev: number; change: number; pct: number; currency: string; name?: string; time?: number; error?: boolean };

const num = (v: unknown) => typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));

// 업비트 코인 이름(한글) 목록은 한 번 받아 두고 다시 써요
let upbitMarkets: Record<string, string> | null = null;
async function upbitNames() {
  if (upbitMarkets) return upbitMarkets;
  const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false");
  const list = await r.json() as { market: string; korean_name: string }[];
  upbitMarkets = Object.fromEntries(list.map(m => [m.market, m.korean_name]));
  return upbitMarkets;
}

async function yahoo(sym: string): Promise<Quote> {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, { headers: UA });
  const j = await r.json();
  const m = j?.chart?.result?.[0]?.meta;
  if (!m || typeof m.regularMarketPrice !== "number") throw new Error("no quote");
  const price = m.regularMarketPrice, prev = m.chartPreviousClose ?? m.previousClose ?? price;
  return { price, prev, change: price - prev, pct: prev ? (price - prev) / prev * 100 : 0, currency: m.currency || "", name: m.shortName || m.longName || "", time: (m.regularMarketTime || 0) * 1000 };
}

async function naverKr(sym: string): Promise<Quote> {
  const isIndex = /^(KOSPI|KOSDAQ|KPI200)$/i.test(sym);
  const url = isIndex ? `https://m.stock.naver.com/api/index/${sym.toUpperCase()}/basic` : `https://m.stock.naver.com/api/stock/${sym}/basic`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error("naver " + r.status);
  const j = await r.json();
  const price = num(j.closePrice);
  if (!isFinite(price) || !price) throw new Error("no price");
  let change = num(j.compareToPreviousClosePrice);
  const code = String(j.compareToPreviousPrice?.code ?? "");
  if (code === "4" || code === "5") change = -Math.abs(change);       // 4·5 = 하락
  const pctRaw = num(j.fluctuationsRatio);
  const pct = code === "4" || code === "5" ? -Math.abs(pctRaw) : pctRaw;
  return { price, prev: price - change, change, pct, currency: "KRW", name: j.stockName || j.indexName || "", time: Date.parse(j.localTradedAt || "") || Date.now() };
}

async function krQuote(sym: string): Promise<Quote> {
  try { return await naverKr(sym); }
  catch {
    // 네이버가 안 되면 야후로 (코스피 .KS → 코스닥 .KQ 순서)
    const map: Record<string, string> = { KOSPI: "^KS11", KOSDAQ: "^KQ11", KPI200: "^KS200" };
    if (map[sym.toUpperCase()]) return yahoo(map[sym.toUpperCase()]);
    try { return await yahoo(sym + ".KS"); } catch { return yahoo(sym + ".KQ"); }
  }
}

async function news(): Promise<{ title: string; link: string; source: string; time: number }[]> {
  const r = await fetch("https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko", { headers: UA });
  const xml = await r.text();
  const pick = (s: string, tag: string) => {
    const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
  };
  const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map(([, it]) => {
    const source = decode(pick(it, "source"));
    let title = decode(pick(it, "title"));
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    return { title, link: decode(pick(it, "link")), source, time: Date.parse(pick(it, "pubDate")) || 0 };
  }).filter(n => n.title && n.link.startsWith("https://"));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const items: Item[] = (Array.isArray(body.items) ? body.items : []).slice(0, 30)
    .filter((i: Item) => i && typeof i.sym === "string" && /^[A-Za-z0-9.^=\-]{1,20}$/.test(i.sym));
  const out: { quotes: Record<string, Quote>; news: unknown[]; at: number } = { quotes: {}, news: [], at: Date.now() };
  const key = (i: Item) => `${i.kind}:${i.sym}`;

  const coins = items.filter(i => i.kind === "coin");
  const tasks: Promise<unknown>[] = items.filter(i => i.kind !== "coin").map(async i => {
    try { out.quotes[key(i)] = i.kind === "kr" ? await krQuote(i.sym) : await yahoo(i.sym); }
    catch { out.quotes[key(i)] = { error: true } as Quote; }
  });
  if (coins.length) tasks.push((async () => {
    try {
      const names = await upbitNames();
      const ok = coins.filter(c => names[c.sym]);
      coins.filter(c => !names[c.sym]).forEach(c => { out.quotes[key(c)] = { error: true } as Quote; });
      if (!ok.length) return;
      const r = await fetch(`https://api.upbit.com/v1/ticker?markets=${ok.map(c => c.sym).join(",")}`);
      // deno-lint-ignore no-explicit-any
      const list = await r.json() as any[];
      for (const t of list) {
        out.quotes[`coin:${t.market}`] = { price: t.trade_price, prev: t.prev_closing_price, change: t.signed_change_price, pct: t.signed_change_rate * 100, currency: "KRW", name: names[t.market], time: t.trade_timestamp };
      }
    } catch { coins.forEach(c => { out.quotes[key(c)] ??= { error: true } as Quote; }); }
  })());
  if (body.news) tasks.push(news().then(n => { out.news = n; }).catch(() => {}));
  await Promise.all(tasks);
  return new Response(JSON.stringify(out), { headers: { ...CORS, "Content-Type": "application/json" } });
});
