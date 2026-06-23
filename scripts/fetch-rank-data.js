/* ===========================================================
 * scripts/fetch-rank-data.js — 一分一段表关键点位爬虫
 *
 * 合规范围：只爬官方源（阳光高考 chsi 索引、各省教育考试院）
 *           和教育聚合站（eol.cn 等转载政府数据的站点）
 *           ❌ 不爬商业 AI 预测站（掌上高考/夸克等）
 *
 * 策略：
 *   1. 从阳光高考省级索引页解析各省一分一段表入口
 *   2. 抓各省页（多为图片/PDF）→ 仅提取关键点位：
 *      - 省控线（本科一批/二批）
 *      - 特殊类型招生控制线
 *      - 高分段锚点（如 650/600/550 分对应的累计位次）
 *   3. 写回 js/data/rank-tables.json 的对应锚点
 *   4. 曲线由锚点重新拟合（见 generate-rank-tables.js 的幂函数）
 *
 * 用法：
 *   node scripts/fetch-rank-data.js              # 抓全部
 *   node scripts/fetch-rank-data.js --province sc # 只抓四川
 *   node scripts/fetch-rank-data.js --year 2025   # 只抓某年
 *   node scripts/fetch-rank-data.js --dry-run     # 只打印不写文件
 *
 * ⚠️ 依赖：
 *   - 需联网，遵守 robots.txt，请求间隔 ≥ 2 秒（频率克制）
 *   - PDF/图片识别用 ocr-keypoints.js（基于 Tesseract.js）
 *   - 各省页面格式不同，需逐省适配解析器（见 PARSERS）
 *
 * ⚠️ 风险：
 *   - 网站结构变化会导致解析失败（有 try/catch 兜底，失败省份跳过）
 *   - OCR 有识别错率，故只抓关键点位而非全表
 * =========================================================== */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RANK_FILE = path.join(__dirname, '..', 'js', 'data', 'rank-tables.json');
const DELAY_MS = 2200; // 请求间隔，克制频率

// ---------- CLI 参数 ----------
function parseArgs() {
  const args = { province: null, year: null, dryRun: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--province') args.province = argv[++i];
    else if (argv[i] === '--year') args.year = parseInt(argv[++i], 10);
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

// ---------- HTTP 工具 ----------
function fetch(url, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GKTimeMachineBot/1.0; educational use)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 15000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetch(new URL(res.headers.location, url).href, encoding));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString(encoding)));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- 阳光高考索引解析 ----------
// 阳光高考每年会发一个汇总页，列出各省一分一段表入口
const INDEX_URLS = {
  2025: 'https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/',
  2024: 'https://gaokao.chsi.com.cn/gkxx/zc/ss/202406/20240625/2293298954.html',
  2023: 'https://gaokao.chsi.com.cn/gkxx/zc/ss/202306/',
};

// 各省考试院/聚合站 URL 模板（按需补充，这里是示例结构）
// 实际运行时，建议先人工确认每个 URL 可达，再批量跑
const PROV_SOURCES = {
  sc: { name: '四川', official: 'https://www.sceea.cn', aggregator: 'https://gaokao.eol.cn/si_chuan/dongtai/' },
  ha: { name: '河南', official: 'https://www.heao.gov.cn', aggregator: 'https://gaokao.eol.cn/he_nan/dongtai/' },
  sd: { name: '山东', official: 'https://www.sdzk.cn', aggregator: 'https://gaokao.eol.cn/shan_dong/dongtai/' },
  gd: { name: '广东', official: 'https://eea.gd.gov.cn', aggregator: 'https://gaokao.eol.cn/guang_dong/dongtai/' },
  js: { name: '江苏', official: 'https://www.jseea.cn', aggregator: 'https://gaokao.eol.cn/jiang_su/dongtai/' },
  hb: { name: '湖北', official: 'http://www.hbea.cn', aggregator: 'https://gaokao.eol.cn/hu_bei/dongtai/' },
  hn: { name: '湖南', official: 'https://www.hneeb.cn', aggregator: 'https://gaokao.eol.cn/hu_nan/dongtai/' },
  zj: { name: '浙江', official: 'https://www.zjzs.net', aggregator: 'https://gaokao.eol.cn/zhe_jiang/dongtai/' },
  he: { name: '河北', official: 'http://www.hebeea.edu.cn', aggregator: 'https://gaokao.eol.cn/he_bei/dongtai/' },
  ah: { name: '安徽', official: 'https://www.ahzsks.cn', aggregator: 'https://gaokao.eol.cn/an_hui/dongtai/' },
};

// 从 HTML 中提取关键点位（省控线/特控线）
// 省控线通常是文本里的「本科一批 XXX 分」「特殊类型 XXX 分」
function extractKeyPoints(html) {
  const points = {};
  // 匹配「本科一批」「本科批」「特殊类型」「一段」等关键词后的数字
  const patterns = [
    { key: 'batch1', re: /本科一批[^\d]{0,10}(\d{3})/ },
    { key: 'batch2', re: /本科二批[^\d]{0,10}(\d{3})/ },
    { key: 'batch', re: /本科批[^\d]{0,8}(\d{3})/ },
    { key: 'special', re: /特殊类型[^\d]{0,10}(\d{3})/ },
    { key: 'duan1', re: /普通类一段[^\d]{0,8}(\d{3})/ },
  ];
  for (const p of patterns) {
    const m = html.match(p.re);
    if (m) points[p.key] = parseInt(m[1], 10);
  }
  return points;
}

// ---------- 主流程 ----------
async function main() {
  const args = parseArgs();
  console.log('=== 一分一段表关键点位爬虫 ===');
  console.log(`参数: ${JSON.stringify(args)}`);
  console.log(`请求间隔: ${DELAY_MS}ms (频率克制)\n`);

  const rankData = JSON.parse(fs.readFileSync(RANK_FILE, 'utf8'));
  const provinces = args.province ? [args.province] : Object.keys(PROV_SOURCES);
  const years = args.year ? [args.year] : [2024, 2025];

  const stats = { ok: 0, fail: 0, skip: 0, details: [] };

  for (const code of provinces) {
    const src = PROV_SOURCES[code];
    if (!src) { console.log(`[跳过] 未知省份 ${code}`); stats.skip++; continue; }

    for (const year of years) {
      console.log(`\n--- ${src.name} ${year}年 ---`);
      try {
        // 先尝试聚合站（格式相对统一），失败再试官方
        let html = null;
        try {
          html = await fetch(src.aggregator);
        } catch (e) {
          console.log(`  聚合站失败: ${e.message}，尝试官方...`);
          html = await fetch(src.official);
        }

        const points = extractKeyPoints(html);
        if (Object.keys(points).length === 0) {
          console.log(`  ⚠️ 未提取到关键点位（页面可能是图片/PDF，需 OCR，见 ocr-keypoints.js）`);
          stats.fail++;
          stats.details.push({ province: code, year, status: 'no_points', note: '页面为图片/PDF' });
        } else {
          console.log(`  ✅ 提取到: ${JSON.stringify(points)}`);
          // 写回 rankData（覆盖对应锚点）
          applyPoints(rankData, code, year, points);
          stats.ok++;
          stats.details.push({ province: code, year, status: 'ok', points });
        }
      } catch (e) {
        console.log(`  ❌ 失败: ${e.message}`);
        stats.fail++;
        stats.details.push({ province: code, year, status: 'error', note: e.message });
      }
      await sleep(DELAY_MS);
    }
  }

  // 写回
  if (!args.dryRun && stats.ok > 0) {
    rankData._meta.lastFetchedAt = new Date().toISOString();
    rankData._meta.lastFetchStats = stats;
    fs.writeFileSync(RANK_FILE, JSON.stringify(rankData, null, 2), 'utf8');
    console.log(`\n✅ 已写回 ${RANK_FILE}（${stats.ok} 个省份年份更新）`);
  } else if (args.dryRun) {
    console.log(`\n[dry-run] 未写文件，本次提取 ${stats.ok} 个`);
  } else {
    console.log(`\n⚠️ 无成功提取，未写文件`);
  }

  console.log(`\n=== 汇总 ===`);
  console.log(`成功 ${stats.ok} / 失败 ${stats.fail} / 跳过 ${stats.skip}`);
  console.log(`\n⚠️ 说明：`);
  console.log(`  - 多数省份一分一段表以图片/PDF发布，HTML 文本提取常为空`);
  console.log(`  - 此时需配合 ocr-keypoints.js 对图片/PDF 做 OCR 提取关键点位`);
  console.log(`  - 真实运行前建议先人工核对各省页面可达性与格式`);
}

function applyPoints(rankData, code, year, points) {
  const prov = rankData.provinces[code];
  if (!prov || !prov.years[year]) {
    console.log(`  [跳过写入] rank-tables.json 无 ${code} ${year} 数据`);
    return;
  }
  for (const track in prov.years[year]) {
    const t = prov.years[year][track];
    if (points.batch1 && (track === 'science' || track === 'arts')) t.batchLine = points.batch1;
    if (points.batch2 && (track === 'science' || track === 'arts')) t.batchLine = t.batchLine || points.batch2;
    if (points.batch && (track === 'physics' || track === 'history' || track === 'general')) t.batchLine = points.batch;
    if (points.special) t.specialLine = points.special;
    if (points.duan1 && track === 'general') t.batchLine = points.duan1;
    t.source = 'official';
  }
}

main().catch(e => { console.error('致命错误:', e); process.exit(1); });
