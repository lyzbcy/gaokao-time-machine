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
  ]},
  ha: { name: '河南', pages: [
    { year: 2024, track: 'science', trackLabel: '理科',     url: 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619064.shtml' },
  ]},
  sd: { name: '山东', pages: [
    { year: 2025, track: 'general', trackLabel: '总分',     url: 'https://gaokao.eol.cn/shan_dong/dongtai/202506/t20250625_2677092.shtml' },
  ]},
  gd: { name: '广东', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/guang_dong/dongtai/202406/t20240626_2619547.shtml' },
  ]},
  js: { name: '江苏', pages: [
    // 注意：t20240624_2619055 是图片版抓不到，用 t20240625_2619080（含HTML表格版）
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240625_2619080.shtml' },
  ]},
  hb: { name: '湖北', pages: [
    { year: 2024, track: 'physics', trackLabel: '物理类',   url: 'https://gaokao.eol.cn/hu_bei/dongtai/202406/t20240625_2619340.shtml' },
  ]},
  // 更多省逐个补充 URL（找到一个加一个）
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
async function fetchTable(url) {
  // 动态加载 playwright（全局安装位置）
  const { createRequire } = require('module');
  const gReq = createRequire('C:\\Users\\24676\\AppData\\Roaming\\npm\\node_modules\\');
  const { chromium } = gReq('playwright');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (!res || !res.ok) { await browser.close(); return { error: 'HTTP ' + (res ? res.status() : 'no response') }; }

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
    await browser.close();
    if (!rows || rows.length === 0) return { error: '未找到表格' };
    return { rows };
  } catch (e) {
    await browser.close();
    return { error: e.message };
  }
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
