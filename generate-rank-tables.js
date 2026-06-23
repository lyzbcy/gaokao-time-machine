/* ===========================================================
 * generate-rank-tables.js — 生成各省一分一段表（模型版，MVP用）
 *
 * 生成 js/data/rank-tables.json，含：
 *   - 每省每年的「一分一段曲线」points（[[score, rank], ...]，rank 单调递减）
 *   - 省控线锚点（本科线/特控线/一本线）
 *   - track 口径标记（science/arts/physics/history/general）
 *
 * 生成逻辑（代表性估算，非真实数据）：
 *   - 用各省考生总数 + 历年省控线（已校准的代表性值）
 *   - 生成单调递减的累计位次曲线（高分段稀疏、低分段密集，符合高考实际）
 *   - 2026 表：用 2025 表 + 省控线平移外推（标记 source: 'predicted'）
 *
 * ⚠️ 这是 MVP 模型数据。真实数据由 scripts/fetch-rank-data.js
 *    从阳光高考/各省考试院抓取关键点位后覆盖 points 锚点。
 * =========================================================== */

const fs = require('fs');
const path = require('path');

// ---------- 各省配置 ----------
// 注：省控线为代表性校准值（参考历年公开数据范围），非精确真实值。
//     fetch-rank-data.js 抓到真实值后会覆盖。
const PROVINCES = {
  sc: { name: '四川',   examinees: 800000, mode2026: 'new', batch2026: { phys本科: 433, phys特控: 511, hist本科: 457, hist特控: 504 } },
  ha: { name: '河南',   examinees: 1360000, mode2026: 'new', batch2026: { phys本科: 427, phys特控: 509, hist本科: 443, hist特控: 504 } },
  sd: { name: '山东',   examinees: 980000, mode2026: 'new', batch2026: { general本科: 443, general特控: 513 } }, // 3+3 总分
  gd: { name: '广东',   examinees: 760000, mode2026: 'new', batch2026: { phys本科: 464, phys特控: 525, hist本科: 465, hist特控: 540 } },
  js: { name: '江苏',   examinees: 440000, mode2026: 'new', batch2026: { phys本科: 462, phys特控: 512, hist本科: 474, hist特控: 530 } },
  hb: { name: '湖北',   examinees: 520000, mode2026: 'new', batch2026: { phys本科: 432, phys特控: 525, hist本科: 432, hist特控: 533 } },
  hn: { name: '湖南',   examinees: 680000, mode2026: 'new', batch2026: { phys本科: 422, phys特控: 505, hist本科: 428, hist特控: 532 } },
  zj: { name: '浙江',   examinees: 360000, mode2026: 'new', batch2026: { general一段: 492, general特控: 521 } }, // 3+3 总分
  he: { name: '河北',   examinees: 860000, mode2026: 'new', batch2026: { phys本科: 433, phys特控: 506, hist本科: 430, hist特控: 532 } },
  ah: { name: '安徽',   examinees: 650000, mode2026: 'new', batch2026: { phys本科: 427, phys特控: 514, hist本科: 442, hist特控: 513 } },
};

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// 各省新高考衔接年（衔接年前用 science/arts，后用 physics/history）
// 浙江2017、山东2020、冀苏鄂湘粤2021、安徽2024、川豫2025
const TRANSITION_YEAR = {
  sc: 2025, ha: 2025, sd: 2020, gd: 2021, js: 2021,
  hb: 2021, hn: 2021, zj: 2017, he: 2021, ah: 2024,
};

// 确定性随机
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * 生成一条一分一段曲线
 * @param {number} maxScore 满分(750)
 * @param {number} totalExaminees 该科类考生总数（约为省考生数的 60%）
 * @param {number} batchScore 该科类本科线（锚点：本科线处累计位次≈总考生*某比例）
 * @param {object} rng
 * @returns {Array<[number,number]>} [[score, cumulativeRank], ...] 从高分到低分
 *
 * 模型：累计位次 = total * (1 - ((score - batch) / (max - batch))^k)
 *   高分段 score→max 时 rank→0（指数衰减，k≈2.2 让曲线尾部稀疏）
 */
function generateCurve(maxScore, totalExaminees, batchScore, rng) {
  const points = [];
  const k = 2.2;
  // 从满分往下，每分一个点；本科线以下密集，以上稀疏
  for (let score = maxScore; score >= Math.max(150, batchScore - 80); score -= 1) {
    let rank;
    if (score >= batchScore) {
      // 本科线以上：用幂函数
      const ratio = Math.pow((maxScore - score) / (maxScore - batchScore), k);
      rank = Math.round(totalExaminees * ratio);
    } else {
      // 本科线以下：线性快速上升（人多）
      const aboveAtBatch = totalExaminees; // 本科线处约等于总考生（粗略）
      const belowRange = totalExaminees * 2.5; // 以下还有更多考生
      const frac = (batchScore - score) / 80; // 0..1
      rank = Math.round(aboveAtBatch + belowRange * frac);
    }
    // 加点噪声（±3%），保持单调递减（score降→rank升）
    const noise = 1 + (rng() - 0.5) * 0.03;
    rank = Math.max(1, Math.round(rank * noise));
    points.push([score, rank]);
  }
  // 保证单调（rank 随 score 下降而上升）——做一次单调化
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] <= points[i - 1][1]) points[i][1] = points[i - 1][1] + 1;
  }
  return points;
}

// 各年省控线（代表性校准，逐年微调）
function batchLinesFor(code, year, track) {
  const p = PROVINCES[code];
  const b = p.batch2026;
  // 历年相对2026做小幅回退（分数线逐年微涨）
  const yearFactor = 1 - (2026 - year) * 0.004; // 每往前1年-0.4%
  const adjust = v => Math.round(v * yearFactor);

  if (track === 'physics' || track === 'science') {
    return { batch: adjust(b.phys本科 || b.general本科 || 440), special: adjust(b.phys特控 || b.general特控 || 510) };
  }
  if (track === 'history' || track === 'arts') {
    return { batch: adjust(b.hist本科 || b.general本科 || 445), special: adjust(b.hist特控 || b.general特控 || 525) };
  }
  // general（浙江山东）
  return { batch: adjust(b.general一段 || b.general本科 || 490), special: adjust(b.general特控 || 520) };
}

function trackFor(code, year) {
  const trans = TRANSITION_YEAR[code];
  const isNew = year >= trans;
  if (code === 'zj' || code === 'sd') return ['general']; // 3+3 总分
  return isNew ? ['physics', 'history'] : ['science', 'arts'];
}

function trackLabel(track) {
  return { science: '理科', arts: '文科', physics: '物理类', history: '历史类', general: '总分' }[track];
}

// ---------- 生成 ----------
function generate() {
  const result = { _meta: {
    generatedAt: new Date().toISOString(),
    note: '一分一段曲线为代表性模型估算（基于省控线锚点+指数分布生成）。真实关键点位由 scripts/fetch-rank-data.js 抓取后覆盖。仅供娱乐。',
    years: YEARS,
    model: 'power-law: rank = total * ((max-score)/(max-batch))^2.2',
    sources: { predicted: '模型预测', official: '官方/考试院', ocr: 'OCR抓取' },
  }, provinces: {} };

  for (const code in PROVINCES) {
    const p = PROVINCES[code];
    result.provinces[code] = { name: p.name, examinees: p.examinees, years: {} };

    for (const year of YEARS) {
      const tracks = trackFor(code, year);
      result.provinces[code].years[year] = {};

      for (const track of tracks) {
        const rng = mulberry32(strSeed(code + year + track));
        const lines = batchLinesFor(code, year, track);
        // 该科类考生数（约为省考生数的 55-65%）
        const trackExaminees = Math.round(p.examinees * (0.55 + rng() * 0.1));
        const curve = generateCurve(750, trackExaminees, lines.batch, rng);

        result.provinces[code].years[year][track] = {
          label: trackLabel(track),
          batchLine: lines.batch,
          specialLine: lines.special,
          examinees: trackExaminees,
          source: year === 2026 ? 'predicted' : 'predicted',
          points: curve,
        };
      }
    }
  }
  return result;
}

const data = generate();
const outDir = path.join(__dirname, 'js', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'rank-tables.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');

// 统计
let curveCount = 0, pointCount = 0;
for (const code in data.provinces) {
  for (const year in data.provinces[code].years) {
    for (const track in data.provinces[code].years[year]) {
      curveCount++;
      pointCount += data.provinces[code].years[year][track].points.length;
    }
  }
}
console.log(`✅ 已生成 ${curveCount} 条一分一段曲线，共 ${pointCount} 个点位`);
console.log(`   覆盖：${Object.keys(data.provinces).length} 省 × ${YEARS.length} 年`);
console.log(`   写入：${outPath}`);
