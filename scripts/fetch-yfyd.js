/* ===========================================================
 * scripts/fetch-yfyd.js — 逐省抓取真实一分一段表（教育在线 eol.cn）
 *
 * 用 Playwright 抓取 HTML 表格，解析成 points 数组，
 * 写入 js/data/rank-tables.json 对应的省/年/track。
 *
 * 合规：教育在线转载各省考试院公开数据，仅用于娱乐网页。
 * 频率克制：每个请求间隔 3 秒。
 *
 * 用法：
 *   node scripts/fetch-yfyd.js              # 抓配置里全部
 *   node scripts/fetch-yfyd.js --province sc # 只抓四川
 *   node scripts/fetch-yfyd.js --dry-run    # 只打印不写
 * =========================================================== */

const fs = require('fs');
const path = require('path');

const RANK_FILE = path.join(__dirname, '..', 'js', 'data', 'rank-tables.json');
const DELAY_MS = 3000;

// ---------- 抓取配置：省份/年份/科类 → URL ----------
// track 映射：eol 页面科类 → rank-tables 的 track key
//   理科/物理类 → science(老)/physics(新)
//   文科/历史类 → arts(老)/history(新)
const CONFIG = {
  sc: { name: '四川', pages: [
    { year: 2023, track: 'science', trackLabel: '理科',     url: 'https://gaokao.eol.cn/si_chuan/dongtai/202306/t20230625_2447135.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/si_chuan/dongtai/202507/t20250702_2678480.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/si_chuan/dongtai/202507/t20250702_2678481.shtml' },
  ]},
  ha: { name: '河南', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/he_nan/dongtai/202506/t20250625_2676860.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/he_nan/dongtai/202506/t20250625_2676858.shtml' },
  ]},
  sd: { name: '山东', pages: [
    { year: 2024, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/shan_dong/dongtai/202406/t20240625_2619329.shtml' },
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/shan_dong/dongtai/202506/t20250625_2677092.shtml' },
  ]},
  gd: { name: '广东', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/guang_dong/dongtai/202406/t20240626_2619547.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/guang_dong/dongtai/202506/t20240626_2677410.shtml' },
  ]},
  js: { name: '江苏', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240625_2619080.shtml' },
  ]},
  hb: { name: '湖北', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/hu_bei/dongtai/202406/t20240625_2619340.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/hu_bei/dongtai/202506/t20250625_2677137.shtml' },
  ]},
  hn: { name: '湖南', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/hu_nan/dongtai/202406/t20240625_2619096.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/hu_nan/dongtai/202506/t20250625_2676956.shtml' },
  ]},
  zj: { name: '浙江', pages: [
    { year: 2024, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/zhe_jiang/dongtai/202406/t20240626_2619511.shtml' },
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/zhe_jiang/dongtai/202506/t20250625_2677143.shtml' },
  ]},
  he: { name: '河北', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/he_bei/dongtai/202506/t20250624_2676842.shtml' },
  ]},
  ah: { name: '安徽', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/an_hui/dongtai/202406/t20240625_2619348.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/an_hui/dongtai/202506/t20250625_2676962.shtml' },
  ]},
  cq: { name: '重庆', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/chong_qing/dongtai/202406/t20240624_2619002.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/chong_qing/dongtai/202506/t20250624_2676752.shtml' },
  ]},
  fj: { name: '福建', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/fu_jian/dongtai/202406/t20240625_2619344.shtml' },
  ]},
  ln: { name: '辽宁', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/liao_ning/dongtai/202406/t20240624_2619037.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/liao_ning/dongtai/202506/t20250624_2676779.shtml' },
  ]},
  jx: { name: '江西', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/jiang_xi/dongtai/202406/t20240626_2619478.shtml' },
    { year: 2024, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/jiang_xi/dongtai/202406/t20240626_2619467.shtml' },
  ]},
  sx: { name: '山西', pages: [
    { year: 2024, track: 'science', trackLabel: '理科',     url: 'https://gaokao.eol.cn/shan_xi/dongtai/202406/t20240624_2619042.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/shan_xi/dongtai/202506/t20250626_2677335.shtml' },
  ]},
  sn: { name: '陕西', pages: [
    { year: 2024, track: 'science', trackLabel: '理科',     url: 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202406/t20240624_2618954.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202506/t20250625_2677115.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202506/t20250625_2677119.shtml' },
  ]},
  hl: { name: '黑龙江', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/hei_long_jiang/dongtai/202406/t20240625_2619391.shtml' },
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/hei_long_jiang/dongtai/202506/t20250624_2676681.shtml' },
  ]},
  jl: { name: '吉林', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/ji_lin/dongtai/202406/t20240625_2619214.shtml' },
  ]},
  bj: { name: '北京', pages: [
    { year: 2024, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/bei_jing/dongtai/202406/t20240625_2619140.shtml' },
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/bei_jing/dongtai/202506/t20250625_2676934.shtml' },
  ]},
  sh: { name: '上海', pages: [
    { year: 2024, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/shang_hai/dongtai/202406/t20240623_2618511.shtml' },
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/shang_hai/dongtai/202506/t20250623_2676341.shtml' },
  ]},
  // ===== 第二批补全：2025 年真实表（2025-06/07 公布）=====
  nm: { name: '内蒙古', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/nei_meng/dongtai/202506/t20250625_2676869.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/nei_meng/dongtai/202506/t20250625_2676868.shtml' },
  ]},
  gx: { name: '广西', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/guang_xi/dongtai/202506/t20250625_2677014.shtml' },
  ]},
  hi: { name: '海南', pages: [
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/hai_nan/dongtai/202507/t20250702_2678468.shtml' },
  ]},
  yn: { name: '云南', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/yun_nan/dongtai/202507/t20250701_2678266.shtml' },
  ]},
  gs: { name: '甘肃', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/gan_su/dongtai/202507/t20250702_2678474.shtml' },
  ]},
  qh: { name: '青海', pages: [
    { year: 2025, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/qing_hai/dongtai/202506/t20250625_2677001.shtml' },
    { year: 2025, track: 'history', trackLabel: '历史类',   url: 'https://gaokao.eol.cn/qing_hai/dongtai/202506/t20250625_2677002.shtml' },
  ]},
  tj: { name: '天津', pages: [
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/tian_jin/dongtai/202506/t20250623_2676457.shtml' },
  ]},
};

// ---------- CLI ----------
function parseArgs() {
  const a = { province: null, dryRun: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--province') a.province = argv[++i];
    else if (argv[i] === '--dry-run') a.dryRun = true;
  }
  return a;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- Playwright 抓取 + 解析 ----------
// eol.cn 国内访问慢且不稳（ERR_NETWORK_CHANGED / 超时常见），
// 所以用全局复用的 browser + 每个 URL 最多 3 次重试 + 指数退避。
let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  const { createRequire } = require('module');
  const gReq = createRequire('C:\\Users\\24676\\AppData\\Roaming\\npm\\node_modules\\');
  const { chromium } = gReq('playwright');
  _browser = await chromium.launch();
  return _browser;
}

// 单次抓取（不含重试）。出错时关闭出错的 page，但保留 browser 给下次复用。
async function fetchTableOnce(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    if (!res || !res.ok) return { error: 'HTTP ' + (res ? res.status() : 'no response') };
    // 等表格渲染（部分页面表格异步注入）
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});

    // 解析表格：分数 | 人数 | 累计人数
    const rows = await page.evaluate(() => {
      const tbl = document.querySelector('table');
      if (!tbl) return null;
      const trs = tbl.querySelectorAll('tr');
      const out = [];
      for (const tr of trs) {
        const cells = Array.from(tr.querySelectorAll('td,th')).map(c => c.textContent.trim());
        if (cells.length >= 3) out.push(cells);
      }
      return out;
    });
    if (!rows || rows.length === 0) return { error: '未找到表格' };
    return { rows };
  } finally {
    await page.close().catch(() => {});
  }
}

// 带重试的抓取：最多 MAX 次指数退避
async function fetchTable(url, retries = 3) {
  let lastErr = '';
  for (let i = 0; i < retries; i++) {
    if (i > 0) {
      const wait = 3000 * Math.pow(2, i - 1); // 3s, 6s, 12s
      console.log(`  ⏳ 第${i + 1}次重试（等待 ${wait / 1000}s）...`);
      await sleep(wait);
    }
    const r = await fetchTableOnce(url);
    if (!r.error) return r;
    lastErr = r.error;
    // 网络抖动类错误才重试；HTTP 4xx 不重试
    if (/HTTP 4\d\d/.test(lastErr)) break;
  }
  return { error: lastErr };
}

// 把 HTML 表格行转成 points [[score, rank], ...]
// 行格式：["分数","人数","累计人数"] 或 ["699-750","55","55"]
function rowsToPoints(rows) {
  const points = [];
  for (let i = 1; i < rows.length; i++) { // 跳过表头
    const [scoreStr, countStr, rankStr] = rows[i];
    const rank = parseInt(rankStr, 10);
    if (isNaN(rank)) continue;
    if (scoreStr.includes('-')) {
      // 区间如 "699-750"：取下限分数
      const lo = parseInt(scoreStr.split('-')[0], 10);
      if (!isNaN(lo)) points.push([lo, rank]);
    } else {
      const s = parseInt(scoreStr, 10);
      if (!isNaN(s)) points.push([s, rank]);
    }
  }
  // 按分数降序排列（rank 升序）
  points.sort((a, b) => b[0] - a[0]);
  return points;
}

// ---------- 主流程 ----------
async function main() {
  const args = parseArgs();
  console.log('=== 一分一段表抓取（教育在线）===\n');
  const rankData = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'));
  const provinces = args.province ? [args.province] : Object.keys(CONFIG);
  const stats = { ok: 0, fail: 0 };

  for (const code of provinces) {
    const cfg = CONFIG[code];
    if (!cfg) { console.log(`[跳过] 未配置省份 ${code}`); continue; }
    for (const pg of cfg.pages) {
      console.log(`【${cfg.name} ${pg.year}${pg.trackLabel}】`);
      console.log(`  URL: ${pg.url}`);
      const r = await fetchTable(pg.url);
      if (r.error) {
        console.log(`  ❌ 失败: ${r.error}`);
        stats.fail++;
      } else {
        const points = rowsToPoints(r.rows);
        console.log(`  ✅ 解析 ${points.length} 个点位`);
        // 抽样验证
        [680, 650, 626, 600, 520].forEach(s => {
          const hit = points.find(p => p[0] <= s) || points[points.length - 1];
          if (hit) console.log(`     ${s}分附近 → ${hit[1]} 名`);
        });
        // 写入 rankData
        if (!args.dryRun && points.length > 50) {
          applyToRankData(rankData, code, pg.year, pg.track, points, pg.trackLabel);
          stats.ok++;
        }
      }
      await sleep(DELAY_MS);
    }
  }

  if (!args.dryRun && stats.ok > 0) {
    rankData._meta.lastFetchedAt = new Date().toISOString();
    rankData._meta.fetchedProvinces = (rankData._meta.fetchedProvinces || []);
    for (const code of provinces) if (CONFIG[code]) rankData._meta.fetchedProvinces.push(code);
    rankData._meta.fetchedProvinces = [...new Set(rankData._meta.fetchedProvinces)];
    fs.writeFileSync(RANK_FILE, JSON.stringify(rankData, null, 2), 'utf-8');
    console.log(`\n✅ 已写回 ${RANK_FILE}（${stats.ok} 个表更新）`);
  } else {
    console.log(`\n[dry-run 或无成功] 本次 ${stats.ok} 个，未写文件`);
  }
  console.log(`成功 ${stats.ok} / 失败 ${stats.fail}`);
  if (_browser) await _browser.close().catch(() => {});
}

function applyToRankData(rankData, code, year, track, points, trackLabel) {
  const prov = rankData.provinces[code];
  if (!prov || !prov.years[year]) {
    console.log(`  [跳过写入] rank-tables 无 ${code} ${year}`);
    return;
  }
  // 兼容 track 别名（science↔physics, arts↔history）
  let t = track;
  if (!prov.years[year][t]) {
    const alias = { science: 'physics', physics: 'science', arts: 'history', history: 'arts' };
    if (alias[t] && prov.years[year][alias[t]]) t = alias[t];
  }
  if (!prov.years[year][t]) {
    console.log(`  [跳过写入] 无 ${code} ${year} ${track} track`);
    return;
  }
  prov.years[year][t].points = points;
  prov.years[year][t].source = 'official';
  prov.years[year][t].label = trackLabel;
  // 从 points 推算本科线（最低分附近）
  console.log(`  → 写入 ${code} ${year} ${t}（${points.length}点，source=official）`);
}

main().catch(e => { console.error('致命错误:', e); process.exit(1); });
