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
  // 新增11省
  nm: { name: '内蒙古', examinees: 220000, mode2026: 'new', batch2026: { phys本科: 370, phys特控: 470, hist本科: 410, hist特控: 490 } }, // 第四批2024
  gx: { name: '广西',   examinees: 460000, mode2026: 'new', batch2026: { phys本科: 371, phys特控: 500, hist本科: 400, hist特控: 510 } }, // 第四批2024
  hi: { name: '海南',   examinees: 130000, mode2026: 'new', batch2026: { general本科: 480, general特控: 540 } }, // 第二批3+3
  gz: { name: '贵州',   examinees: 490000, mode2026: 'new', batch2026: { phys本科: 380, phys特控: 480, hist本科: 440, hist特控: 510 } }, // 第四批2024
  yn: { name: '云南',   examinees: 380000, mode2026: 'old', batch2026: { science本科一批: 520, science本科二批: 440, arts本科一批: 540, arts本科二批: 465 } }, // 第五批2025(老高考)
  gs: { name: '甘肃',   examinees: 260000, mode2026: 'new', batch2026: { phys本科: 370, phys特控: 470, hist本科: 400, hist特控: 500 } }, // 第四批2024
  qh: { name: '青海',   examinees: 120000, mode2026: 'old', batch2026: { science本科一批: 400, science本科二批: 360, arts本科一批: 420, arts本科二批: 380 } }, // 第五批2025(老高考)
  nx: { name: '宁夏',   examinees: 150000, mode2026: 'old', batch2026: { science本科一批: 430, science本科二批: 380, arts本科一批: 490, arts本科二批: 430 } }, // 第五批2025(老高考)
  xj: { name: '新疆',   examinees: 230000, mode2026: 'old', batch2026: { science本科一批: 400, science本科二批: 350, arts本科一批: 420, arts本科二批: 370 } }, // 老高考
  tj: { name: '天津',   examinees: 130000, mode2026: 'new', batch2026: { general本科: 475, general特控: 540 } }, // 第二批3+3
  xz: { name: '西藏',   examinees: 100000, mode2026: 'old', batch2026: { science本科一批: 400, science本科二批: 315, arts本科一批: 420, arts本科二批: 330 } }, // 老高考
};

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// 各省新高考衔接年（衔接年前用 science/arts，后用 physics/history）
// 浙江2017、山东2020、冀苏鄂湘粤2021、安徽2024、川豫2025
const TRANSITION_YEAR = {
  sc: 2025, ha: 2025, sd: 2020, gd: 2021, js: 2021,
  hb: 2021, hn: 2021, zj: 2017, he: 2021, ah: 2024,
  cq: 2021, fj: 2021, ln: 2021,             // 第三批
  jx: 2024, hl: 2024, jl: 2024,             // 第四批
  nm: 2024, gx: 2024, gz: 2024, gs: 2024,   // 第四批（新增）
  sx: 2025, sn: 2025, yn: 2025, qh: 2025, nx: 2025, // 第五批（老→新，2025起物理历史）
  xj: 2100, xz: 2100,                       // 仍为老高考（暂未改革）
  bj: 2017, sh: 2017, hi: 2020, tj: 2020,   // 3+3（海南天津第二批2020）
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
function generateCurve(maxScore, totalExaminees, batchScore, rng, realAnchors) {
  // 如果有该省的真实锚点（从已抓取的真实一分一段表提取），优先用真实锚点
  // 否则回退到四川2023理科基准锚点
  const TOTAL_REF = 300000;
  const defaultAnchors = [
    [720, 10], [700, 50], [680, 600], [660, 3000], [640, 9000],
    [626, 15000], [610, 24000], [600, 30000], [580, 46000],
    [560, 64000], [540, 86000], [520, 108000],
    [500, 135000], [480, 162000], [460, 188000], [433, 218000],
    [400, 248000], [350, 280000], [300, 294000], [200, 299000], [150, 300000],
  ];
  const anchors = realAnchors && realAnchors.length >= 10 ? realAnchors : defaultAnchors;
  const refTotal = realAnchors ? realAnchors[realAnchors.length - 1][1] : TOTAL_REF;
  // 把锚点的 rank 按 totalExaminees/refTotal 比例缩放到当前省的考生数
  const scale = totalExaminees / refTotal;
  const scaledAnchors = anchors.map(([s, r]) => [s, Math.max(1, Math.round(r * scale))]);

  // 平移曲线使本科线锚点对齐（仅对默认四川锚点；真实锚点本身就是该省分数，不平移）
  let shifted;
  if (realAnchors) {
    shifted = scaledAnchors;
  } else {
    const refBatch = 433;
    const shift = batchScore - refBatch;
    shifted = scaledAnchors.map(([s, r]) => [s + shift, r]);
  }

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
  // 3+3 模式省份（全程 general 总分）：浙江、山东、北京、上海、海南、天津
  if (code === 'zj' || code === 'sd' || code === 'bj' || code === 'sh' || code === 'hi' || code === 'tj') return ['general'];
  const trans = TRANSITION_YEAR[code];
  const isNew = year >= trans;
  return isNew ? ['physics', 'history'] : ['science', 'arts'];
}

function trackLabel(track) {
  return { science: '理科', arts: '文科', physics: '物理类', history: '历史类', general: '总分' }[track];
}

// 查该省该年该 track 是否已有真实数据（返回完整对象或 null）
function getExistingOfficial(code, year, track) {
  if (!REAL_TABLES[code]) return null;
  const alias = { science: 'physics', physics: 'science', arts: 'history', history: 'arts', general: 'general' };
  const candidates = [track, alias[track]].filter(t => REAL_TABLES[code][t]);
  for (const t of candidates) {
    for (const item of REAL_TABLES[code][t]) {
      if (item.year === year) {
        return {
          label: trackLabel(track),
          batchLine: 0, specialLine: 0,
          examinees: item.points[item.points.length - 1][1],
          source: 'official',
          points: item.points,
        };
      }
    }
  }
  return null;
}

// 找该省该 track 最近的完整真实表（返回 {year, points} 或 null）
function findRealTable(code, track) {
  if (!REAL_TABLES[code]) return null;
  // 精确 track 或别名
  const alias = { science: 'physics', physics: 'science', arts: 'history', history: 'arts', general: 'general' };
  const candidates = [track, alias[track]].filter(t => REAL_TABLES[code][t]);
  if (candidates.length === 0) {
    // 该省任意 track（同省考生结构接近）
    const keys = Object.keys(REAL_TABLES[code]);
    if (keys.length === 0) return null;
    candidates.push(keys[0]);
  }
  // 取所有候选中最近年份的
  let best = null;
  for (const t of candidates) {
    for (const item of REAL_TABLES[code][t]) {
      if (!best || item.year > best.year) best = { year: item.year, points: item.points, track: t };
    }
  }
  return best;
}

// ---------- 从已抓取的真实表提取锚点（锚点动态校准） ----------
// 读现有 rank-tables.json，找 source=official 的表，提取关键分数点位次
const ANCHOR_CACHE = {};  // { province: { track: [[score,rank],...] } }
const REAL_TABLES = {};  // { province: { track: [{year, points}] } }
function loadRealAnchors() {
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(__dirname, 'js', 'data', 'rank-tables.json'), 'utf-8'));
    for (const code in existing.provinces) {
      ANCHOR_CACHE[code] = {};
      REAL_TABLES[code] = {};
      for (const year in existing.provinces[code].years) {
        for (const track in existing.provinces[code].years[year]) {
          const t = existing.provinces[code].years[year][track];
          if (t.source === 'official' && t.points && t.points.length > 50) {
            // 存完整真实表（供 findRealTable 直接复用）
            if (!REAL_TABLES[code][track]) REAL_TABLES[code][track] = [];
            REAL_TABLES[code][track].push({ year: parseInt(year), points: t.points });
            // 提取锚点（供无真实表的年份用）
            const pts = t.points;
            const step = Math.max(1, Math.floor(pts.length / 20));
            const anchors = [];
            for (let i = 0; i < pts.length; i += step) anchors.push([pts[i][0], pts[i][1]]);
            if (anchors[anchors.length-1][0] !== pts[pts.length-1][0]) anchors.push(pts[pts.length-1]);
            ANCHOR_CACHE[code][track] = anchors;
          }
        }
      }
    }
    const provCount = Object.keys(REAL_TABLES).filter(c => Object.keys(REAL_TABLES[c]).length > 0).length;
    const tableCount = Object.values(REAL_TABLES).reduce((s, p) => Object.values(p).reduce((ss, t) => ss + t.length, 0), 0);
    console.log(`[锚点校准] 从现有真实数据提取了 ${provCount} 省的 ${tableCount} 张真实表`);
  } catch (e) {
    console.log('[锚点校准] 无现有真实数据，使用默认锚点');
  }
}

// 取某省某 track 的真实锚点（兼容 track 别名）
function extractRealAnchors(code, track) {
  if (!ANCHOR_CACHE[code]) return null;
  if (ANCHOR_CACHE[code][track]) return ANCHOR_CACHE[code][track];
  // 别名兼容
  const alias = { science: 'physics', physics: 'science', arts: 'history', history: 'arts', general: 'general' };
  if (alias[track] && ANCHOR_CACHE[code][alias[track]]) return ANCHOR_CACHE[code][alias[track]];
  // 该省任意 track 的锚点（同省考生结构接近，比四川锚点准）
  const keys = Object.keys(ANCHOR_CACHE[code]);
  if (keys.length > 0) return ANCHOR_CACHE[code][keys[0]];
  return null;
}

// ---------- 生成 ----------
function generate() {
  loadRealAnchors();  // 先加载真实锚点

  const result = { _meta: {
    generatedAt: new Date().toISOString(),
    note: '一分一段曲线：有真实数据的省/年用真实值，其余用锚点校准模型（优先用同省真实锚点）。仅供娱乐。',
    years: YEARS,
    model: 'anchor-calibrated sigmoid',
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

        // 0. 如果该省该年该 track 已有真实数据，直接保留（不覆盖）
        const existing = getExistingOfficial(code, year, track);
        if (existing) {
          result.provinces[code].years[year][track] = existing;
          continue;
        }

        // 1. 如果该省该 track 有其他年份的真实表，直接复用（目标年做微小通胀调整）
        const realTable = findRealTable(code, track);
        let curve, srcLabel, trackExaminees;
        if (realTable && year >= 2024) {
          const yearDelta = year - realTable.year;
          curve = realTable.points.map(([s, r]) => [Math.min(750, s + yearDelta * 2), r]);
          trackExaminees = realTable.points[realTable.points.length - 1][1];
          srcLabel = 'official-extrapolated';
        } else {
          // 2. 无真实数据：用锚点校准模型（优先同省真实锚点）
          const realAnchors = extractRealAnchors(code, track);
          trackExaminees = realAnchors
            ? realAnchors[realAnchors.length - 1][1]
            : Math.round(p.examinees * (0.55 + rng() * 0.1));
          curve = generateCurve(750, trackExaminees, lines.batch, rng, realAnchors);
          srcLabel = 'predicted';
        }

        result.provinces[code].years[year][track] = {
          label: trackLabel(track),
          batchLine: lines.batch,
          specialLine: lines.special,
          examinees: trackExaminees,
          source: srcLabel,
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
