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
  cq: { name: '重庆',   examinees: 350000, mode2026: 'new', batch2026: { phys本科: 427, phys特控: 505, hist本科: 428, hist特控: 524 } }, // 第三批2021
  fj: { name: '福建',   examinees: 320000, mode2026: 'new', batch2026: { phys本科: 465, phys特控: 525, hist本科: 465, hist特控: 532 } }, // 第三批2021
  ln: { name: '辽宁',   examinees: 280000, mode2026: 'new', batch2026: { phys本科: 368, phys特控: 501, hist本科: 400, hist特控: 510 } }, // 第三批2021（本科线偏低）
  jx: { name: '江西',   examinees: 600000, mode2026: 'new', batch2026: { phys本科: 448, phys特控: 520, hist本科: 463, hist特控: 532 } }, // 第四批2024
  sx: { name: '山西',   examinees: 380000, mode2026: 'old', batch2026: { science本科一批: 480, science本科二批: 410, arts本科一批: 490, arts本科二批: 420 } }, // 第五批2025(老高考口径)
  sn: { name: '陕西',   examinees: 360000, mode2026: 'old', batch2026: { science本科一批: 475, science本科二批: 405, arts本科一批: 485, arts本科二批: 415 } }, // 老高考
  hl: { name: '黑龙江', examinees: 250000, mode2026: 'new', batch2026: { phys本科: 360, phys特控: 480, hist本科: 400, hist特控: 500 } }, // 第四批2024
  jl: { name: '吉林',   examinees: 180000, mode2026: 'new', batch2026: { phys本科: 345, phys特控: 470, hist本科: 385, hist特控: 490 } }, // 第四批2024（本科线偏低）
  bj: { name: '北京',   examinees: 120000, mode2026: 'new', batch2026: { general本科: 425, general特控: 510 } }, // 3+3
  sh: { name: '上海',   examinees: 110000, mode2026: 'new', batch2026: { general本科: 403, general特控: 503 } }, // 3+3（满分660，这里按比例调）
};

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// 各省新高考衔接年（衔接年前用 science/arts，后用 physics/history）
// 浙江2017、山东2020、冀苏鄂湘粤2021、安徽2024、川豫2025
const TRANSITION_YEAR = {
  sc: 2025, ha: 2025, sd: 2020, gd: 2021, js: 2021,
  hb: 2021, hn: 2021, zj: 2017, he: 2021, ah: 2024,
  cq: 2021, fj: 2021, ln: 2021,             // 第三批
  jx: 2024, hl: 2024, jl: 2024,             // 第四批
  sx: 2025, sn: 2025,                       // 第五批（老高考口径，2025起物理历史）
  bj: 2017, sh: 2017,                       // 第二批 3+3
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
 * 生成一条一分一段曲线（V2 锚点驱动 sigmoid 模型）
 *
 * 真实高考一分一段曲线是 S 型（sigmoid）累计分布：
 *   高分段（680+）极稀疏（每分几十~几百人）
 *   中高分段（600-680）陡增（每分上千人）
 *   中段（一本线附近）最密集
 *   低分段（本科线下）继续增长但放缓
 *
 * 用 sigmoid 拟合真实锚点（以四川2023理科为校准基准）：
 *   700分→~50名, 660分→~3000名, 626分→~15000名, 600分→~25000名,
 *   520(一本)→~80000名, 433(二本)→~190000名, 150→~300000名
 *
 * @param {number} maxScore 满分(750)
 * @param {number} totalExaminees 该科类考生总数
 * @param {number} batchScore 该科类本科线
 * @param {object} rng
 * @returns {Array<[number,number]>} [[score, cumulativeRank], ...] 从高分到低分
 */
function generateCurve(maxScore, totalExaminees, batchScore, rng) {
  // 真实锚点（四川2023理科，作为通用 sigmoid 的基准比例）
  // rankRatio = rank / totalExaminees，在 total=300000 时的真实值
  const TOTAL_REF = 300000; // 四川理科参考总考生
  const anchors = [
    [720, 10], [700, 50], [680, 600], [660, 3000], [640, 9000],
    [626, 15000], [610, 24000], [600, 30000], [580, 46000],
    [560, 64000], [540, 86000], [520, 108000],   // 520≈一本线
    [500, 135000], [480, 162000], [460, 188000], [433, 218000], // 433≈二本线
    [400, 248000], [350, 280000], [300, 294000], [200, 299000], [150, 300000],
  ];
  // 把锚点的 rank 按 totalExaminees/300000 比例缩放到当前省
  const scale = totalExaminees / TOTAL_REF;
  const scaledAnchors = anchors.map(([s, r]) => [s, Math.max(1, Math.round(r * scale))]);

  // 平移曲线使本科线锚点对齐（refBatch 取 433 本科批口径）
  const refBatch = 433;
  const shift = batchScore - refBatch;
  const shifted = scaledAnchors.map(([s, r]) => [s + shift, r]);

  // 插值生成每分的点（线性插值，保证单调）
  const points = [];
  // 高于最高锚点的（接近满分）：rank 趋近 1
  points.push([maxScore, 1]);
  for (let i = 0; i < shifted.length - 1; i++) {
    const [s1, r1] = shifted[i];
    const [s2, r2] = shifted[i + 1];
    if (s1 <= s2) continue; // 平移后可能乱序，跳过
    // 在 [s2, s1] 间每分插值
    for (let s = s1; s > s2; s--) {
      const frac = (s1 - s) / (s1 - s2);
      const r = Math.round(r1 + (r2 - r1) * frac);
      points.push([s, Math.max(1, r)]);
    }
  }
  // 最低锚点以下：线性延伸到 150 分
  const last = shifted[shifted.length - 1];
  for (let s = last[0] - 1; s >= 150; s--) {
    points.push([s, last[1] + Math.round((last[0] - s) * 5)]);
  }

  // 加噪声（±2%，保持单调）
  for (let i = 0; i < points.length; i++) {
    const noise = 1 + (rng() - 0.5) * 0.02;
    points[i][1] = Math.max(1, Math.round(points[i][1] * noise));
  }
  // 单调化（score 降 → rank 升）
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] <= points[i - 1][1]) points[i][1] = points[i - 1][1] + 1;
  }

  // 抽稀：每 3 分一个点 + 本科线±10 密集
  const dense = [];
  for (let i = 0; i < points.length; i++) {
    const [s] = points[i];
    const nearBatch = Math.abs(s - batchScore) <= 10;
    if (i === 0 || i === points.length - 1 || s % 3 === 0 || nearBatch) {
      dense.push(points[i]);
    }
  }
  return dense;
}

// 各年省控线（代表性校准，逐年微调）
function batchLinesFor(code, year, track) {
  const p = PROVINCES[code];
  const b = p.batch2026;
  // 历年相对2026做小幅回退（分数线逐年微涨）
  const yearFactor = 1 - (2026 - year) * 0.004; // 每往前1年-0.4%
  const adjust = v => Math.round(v * yearFactor);

  if (track === 'physics' || track === 'science') {
    // 兼容老高考字段 science本科一批
    const batch = b.phys本科 || b.science本科一批 || b.general本科 || 440;
    const special = b.phys特控 || b.science本科二批 || b.general特控 || 510;
    return { batch: adjust(batch), special: adjust(special) };
  }
  if (track === 'history' || track === 'arts') {
    const batch = b.hist本科 || b.arts本科一批 || b.general本科 || 445;
    const special = b.hist特控 || b.arts本科二批 || b.general特控 || 525;
    return { batch: adjust(batch), special: adjust(special) };
  }
  // general（浙江山东北京上海）
  return { batch: adjust(b.general一段 || b.general本科 || 490), special: adjust(b.general特控 || 520) };
}

function trackFor(code, year) {
  // 3+3 模式省份（全程 general 总分）：浙江、山东、北京、上海
  if (code === 'zj' || code === 'sd' || code === 'bj' || code === 'sh') return ['general'];
  const trans = TRANSITION_YEAR[code];
  const isNew = year >= trans;
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
