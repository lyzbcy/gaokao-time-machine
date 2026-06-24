/* ===========================================================
 * generate-scores.js — 生成 data/scores.json 的数据生成器
 *
 * 一次性运行脚本（node generate-scores.js），生成 10 省 × 30 校 × 2019-2025 的代表性录取分数线。
 *
 * ⚠️ 数据为基于公开规律的【代表性估算】，非真实爬取，仅供娱乐网页使用。
 *    真实数据请后续用各省考试院公开数据校准 data/scores.json。
 *
 * 生成逻辑：
 *   - 按学校梯队（985/211/一本/二本）+ 省份难度系数 给出基准分
 *   - 每年叠加一个趋势项 + 小幅随机扰动（种子固定，可复现）
 *   - 不同省份难度系数不同（河南/山东/河北卷 → 高分段密集）
 * =========================================================== */

const fs = require('fs');
const path = require('path');

// ---------- 配置 ----------
const PROVINCES = [
  { code: 'sc', name: '四川',   difficulty: 1.00 },
  { code: 'ha', name: '河南',   difficulty: 1.05 }, // 考生多，分数线偏高
  { code: 'sd', name: '山东',   difficulty: 1.04 },
  { code: 'gd', name: '广东',   difficulty: 0.96 },
  { code: 'js', name: '江苏',   difficulty: 0.98 }, // 历史分值体系特殊，这里统一处理
  { code: 'hb', name: '湖北',   difficulty: 1.00 },
  { code: 'hn', name: '湖南',   difficulty: 1.01 },
  { code: 'zj', name: '浙江',   difficulty: 0.99 },
  { code: 'he', name: '河北',   difficulty: 1.05 },
  { code: 'ah', name: '安徽',   difficulty: 1.00 },
  { code: 'cq', name: '重庆',   difficulty: 0.99 },
  { code: 'fj', name: '福建',   difficulty: 0.97 },
  { code: 'ln', name: '辽宁',   difficulty: 0.98 },
  { code: 'jx', name: '江西',   difficulty: 1.00 },
  { code: 'sx', name: '山西',   difficulty: 1.02 },
  { code: 'sn', name: '陕西',   difficulty: 1.00 },
  { code: 'hl', name: '黑龙江', difficulty: 0.95 },
  { code: 'jl', name: '吉林',   difficulty: 0.95 },
  { code: 'bj', name: '北京',   difficulty: 0.97 },
  { code: 'sh', name: '上海',   difficulty: 0.96 },
];

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

// 学校池（全国性代表校，按梯队分组）
// tier: 985 / 211 / 1(一本) / 2(二本)
// baseScore: 在 difficulty=1.00 省份的大致录取最低分（理科口径，估算）
const SCHOOL_POOL = [
  // ===== 985 顶流（顶尖综合+特色）=====
  { name: '清华大学',         tier: '985', base: 692, national: true },
  { name: '北京大学',         tier: '985', base: 690, national: true },
  { name: '复旦大学',         tier: '985', base: 680, national: true },
  { name: '上海交通大学',     tier: '985', base: 680, national: true },
  { name: '浙江大学',         tier: '985', base: 674, national: true },
  { name: '中国科学技术大学', tier: '985', base: 672, national: true },
  { name: '南京大学',         tier: '985', base: 670, national: true },
  { name: '中国人民大学',     tier: '985', base: 667, national: true },
  { name: '北京航空航天大学', tier: '985', base: 662, national: true },
  { name: '北京理工大学',     tier: '985', base: 660, national: true },
  { name: '同济大学',         tier: '985', base: 657, national: true },
  { name: '哈尔滨工业大学',   tier: '985', base: 655, national: true },
  { name: '西安交通大学',     tier: '985', base: 653, national: true },
  { name: '厦门大学',         tier: '985', base: 650, national: true },
  { name: '东南大学',         tier: '985', base: 648, national: true },
  { name: '天津大学',         tier: '985', base: 647, national: true },
  { name: '南开大学',         tier: '985', base: 645, national: true },
  { name: '武汉大学',         tier: '985', base: 643, national: true },
  { name: '华中科技大学',     tier: '985', base: 641, national: true },
  { name: '北京师范大学',     tier: '985', base: 640, national: true },
  { name: '中山大学',         tier: '985', base: 639, national: true },
  { name: '华东师范大学',     tier: '985', base: 638, national: true },
  { name: '电子科技大学',     tier: '985', base: 636, national: true },
  { name: '四川大学',         tier: '985', base: 634, national: true },
  { name: '吉林大学',         tier: '985', base: 630, national: true },
  { name: '重庆大学',         tier: '985', base: 628, national: true },
  { name: '山东大学',         tier: '985', base: 627, national: true },
  { name: '湖南大学',         tier: '985', base: 625, national: true },
  { name: '中南大学',         tier: '985', base: 624, national: true },
  { name: '大连理工大学',     tier: '985', base: 623, national: true },
  { name: '华南理工大学',     tier: '985', base: 622, national: true },
  { name: '兰州大学',         tier: '985', base: 618, national: true },
  { name: '中国海洋大学',     tier: '985', base: 615, national: true },
  { name: '中国农业大学',     tier: '985', base: 614, national: true },
  { name: '国防科技大学',     tier: '985', base: 658, national: true },
  { name: '西北农林科技大学', tier: '985', base: 610, national: true },

  // ===== 211（行业特色强校）=====
  { name: '北京邮电大学',     tier: '211', base: 637, national: true },
  { name: '上海财经大学',     tier: '211', base: 635, national: true },
  { name: '对外经济贸易大学', tier: '211', base: 630, national: true },
  { name: '中央财经大学',     tier: '211', base: 628, national: true },
  { name: '中国政法大学',     tier: '211', base: 622, national: true },
  { name: '北京外国语大学',   tier: '211', base: 621, national: true },
  { name: '上海外国语大学',   tier: '211', base: 620, national: true },
  { name: '中国传媒大学',     tier: '211', base: 619, national: true },
  { name: '西安电子科技大学', tier: '211', base: 616, national: true },
  { name: '北京交通大学',     tier: '211', base: 612, national: true },
  { name: '北京科技大学',     tier: '211', base: 610, national: true },
  { name: '华东理工大学',     tier: '211', base: 608, national: true },
  { name: '南京理工大学',     tier: '211', base: 606, national: true },
  { name: '南京航空航天大学', tier: '211', base: 605, national: true },
  { name: '中国药科大学',     tier: '211', base: 604, national: true },
  { name: '中国地质大学(武汉)', tier: '211', base: 603, national: true },
  { name: '暨南大学',         tier: '211', base: 603, national: true },
  { name: '上海大学',         tier: '211', base: 602, national: true },
  { name: '苏州大学',         tier: '211', base: 600, national: true },
  { name: '南京农业大学',     tier: '211', base: 598, national: true },
  { name: '武汉理工大学',     tier: '211', base: 606, national: true },
  { name: '西南交通大学',     tier: '211', base: 598, national: true },
  { name: '中南财经政法大学', tier: '211', base: 597, national: true },
  { name: '华中师范大学',     tier: '211', base: 596, national: true },
  { name: '南京师范大学',     tier: '211', base: 595, national: true },
  { name: '华南师范大学',     tier: '211', base: 594, national: true },
  { name: '西南财经大学',     tier: '211', base: 593, national: true },
  { name: '合肥工业大学',     tier: '211', base: 592, national: true },
  { name: '陕西师范大学',     tier: '211', base: 591, national: true },
  { name: '西南大学',         tier: '211', base: 590, national: true },
  { name: '河北工业大学',     tier: '211', base: 588, national: true },
  { name: '四川农业大学',     tier: '211', base: 580, national: true },
  { name: '华中农业大学',     tier: '211', base: 585, national: true },
  { name: '西北大学',         tier: '211', base: 582, national: true },
  { name: '郑州大学',         tier: '211', base: 580, national: true },
  { name: '云南大学',         tier: '211', base: 575, national: true },
  { name: '新疆大学',         tier: '211', base: 555, national: true },
  { name: '江南大学',         tier: '211', base: 592, national: true },   // 作者母校，必须有！
  { name: '福州大学',         tier: '211', base: 585, national: true },
  { name: '南昌大学',         tier: '211', base: 580, national: true },
  { name: '太原理工大学',     tier: '211', base: 575, national: true },
  { name: '长安大学',         tier: '211', base: 578, national: true },
  { name: '陕西师范大学',     tier: '211', base: 580, national: true },
  { name: '东北师范大学',     tier: '211', base: 585, national: true },
  { name: '哈尔滨工程大学',   tier: '211', base: 585, national: true },
  { name: '大连海事大学',     tier: '211', base: 572, national: true },
  { name: '延边大学',         tier: '211', base: 545, national: true },
  { name: '华北电力大学',     tier: '211', base: 595, national: true },
  { name: '东华大学',         tier: '211', base: 590, national: true },
  { name: '上海财经大学',     tier: '211', base: 635, national: true },
  { name: '北京交通大学',     tier: '211', base: 612, national: true },
  { name: '北京科技大学',     tier: '211', base: 610, national: true },
  { name: '北京林业大学',     tier: '211', base: 585, national: true },
  { name: '北京中医药大学',   tier: '211', base: 580, national: true },

  // ===== 一本（热门双非/省重点）=====
  { name: '深圳大学',         tier: '1', base: 602, national: true },
  { name: '首都医科大学',     tier: '1', base: 600, national: true },
  { name: '中国社会科学院大学', tier: '1', base: 598, national: true },
  { name: '华东政法大学',     tier: '1', base: 595, national: true },
  { name: '杭州电子科技大学', tier: '1', base: 590, national: true },
  { name: '南方科技大学',     tier: '1', base: 588, national: true },
  { name: '北京语言大学',     tier: '1', base: 585, national: true },
  { name: '浙江工业大学',     tier: '1', base: 578, national: true },
  { name: '燕山大学',         tier: '1', base: 575, national: true },
  { name: '南京邮电大学',     tier: '1', base: 572, national: true },
  { name: '上海理工大学',     tier: '1', base: 570, national: true },
  { name: '中国医科大学',     tier: '1', base: 568, national: true },
  { name: '成都理工大学',     tier: '1', base: 562, national: true },
  { name: '扬州大学',         tier: '1', base: 560, national: true },
  { name: '西南石油大学',     tier: '1', base: 552, national: true },
  { name: '湖南科技大学',     tier: '1', base: 548, national: true },
  { name: '重庆邮电大学',     tier: '1', base: 546, national: true },
  { name: '长江大学',         tier: '1', base: 540, national: true },
  { name: '河南大学',         tier: '1', base: 538, national: true },
  { name: '湖北大学',         tier: '1', base: 535, national: true },
  { name: '福建师范大学',     tier: '1', base: 545, national: true },
  { name: '江西财经大学',     tier: '1', base: 548, national: true },
  { name: '山西大学',         tier: '1', base: 540, national: true },
  { name: '西安建筑科技大学', tier: '1', base: 542, national: true },
  { name: '黑龙江大学',       tier: '1', base: 525, national: true },
  { name: '华东理工大学',     tier: '211', base: 608, national: true },
  { name: '上海大学',         tier: '211', base: 602, national: true },
  { name: '北京工业大学',     tier: '211', base: 600, national: true },
  { name: '天津医科大学',     tier: '211', base: 595, national: true },
  { name: '辽宁大学',         tier: '211', base: 568, national: true },
  { name: '东北农业大学',     tier: '211', base: 560, national: true },
  { name: '东北林业大学',     tier: '211', base: 565, national: true },
  { name: '上海师范大学',     tier: '1', base: 565, national: true },
  { name: '上海海事大学',     tier: '1', base: 555, national: true },
  { name: '北京工商大学',     tier: '1', base: 555, national: true },
  { name: '首都师范大学',     tier: '1', base: 568, national: true },
  { name: '南京信息工程大学', tier: '1', base: 568, national: true },
  { name: '中国计量大学',     tier: '1', base: 558, national: true },
  { name: '重庆医科大学',     tier: '1', base: 575, national: true },
  { name: '西南政法大学',     tier: '1', base: 572, national: true },
  { name: '西安邮电大学',     tier: '1', base: 548, national: true },
  { name: '西安理工大学',     tier: '1', base: 545, national: true },
  { name: '中北大学',         tier: '1', base: 535, national: true },

  // ===== 二本（地方应用型）=====
  { name: '成都大学',         tier: '2', base: 535, national: true },
  { name: '西南民族大学',     tier: '2', base: 528, national: true },
  { name: '四川轻化工大学',   tier: '2', base: 515, national: true },
  { name: '绵阳师范学院',     tier: '2', base: 505, national: true },
  { name: '内江师范学院',     tier: '2', base: 498, national: true },
  { name: '湖北文理学院',     tier: '2', base: 500, national: true },
  { name: '湖南文理学院',     tier: '2', base: 495, national: true },
  { name: '肇庆学院',         tier: '2', base: 502, national: true },
  { name: '嘉兴大学',         tier: '2', base: 508, national: true },
  { name: '洛阳师范学院',     tier: '2', base: 492, national: true },
  { name: '宜宾学院',         tier: '2', base: 488, national: true },
  { name: '南阳师范学院',     tier: '2', base: 485, national: true },
];

// ---------- 各省内"本地院校"标记 ----------
// 本省院校在本地招生名额多，分数线相对略低（本地生友好），生成时给 0.97 系数
const LOCAL_SCHOOLS = {
  sc: ['四川大学', '电子科技大学', '西南交通大学', '西南财经大学', '成都理工大学', '西南石油大学', '四川农业大学', '四川轻化工大学', '成都大学', '西南民族大学', '绵阳师范学院', '内江师范学院', '宜宾学院'],
  ha: ['郑州大学', '河南大学', '河南科技大学', '洛阳师范学院', '南阳师范学院'],
  sd: ['山东大学', '中国海洋大学', '中国石油大学(华东)', '山东师范大学', '青岛大学', '济南大学', '山东科技大学'],
  gd: ['中山大学', '华南理工大学', '暨南大学', '深圳大学', '华南师范大学', '南方科技大学', '广州大学', '肇庆学院'],
  js: ['南京大学', '东南大学', '南京理工大学', '南京航空航天大学', '南京师范大学', '苏州大学', '南京邮电大学', '扬州大学', '中国药科大学', '南京农业大学', '江南大学', '中国矿业大学', '河海大学'],
  hb: ['武汉大学', '华中科技大学', '武汉理工大学', '华中师范大学', '华中农业大学', '中国地质大学(武汉)', '中南财经政法大学', '湖北大学', '长江大学', '湖北文理学院'],
  hn: ['中南大学', '湖南大学', '湖南师范大学', '湘潭大学', '长沙理工大学', '湖南科技大学', '湖南文理学院'],
  zj: ['浙江大学', '浙江工业大学', '杭州电子科技大学', '宁波大学', '嘉兴大学', '温州医科大学', '浙江师范大学', '中国美术学院'],
  he: ['河北工业大学', '燕山大学', '河北大学', '石家庄铁道大学', '河北师范大学'],
  ah: ['中国科学技术大学', '合肥工业大学', '安徽大学', '安徽师范大学', '安徽工业大学'],
  cq: ['重庆大学', '西南大学', '西南政法大学', '重庆邮电大学', '重庆医科大学', '四川外国语大学'],
  fj: ['厦门大学', '福州大学', '华侨大学', '福建师范大学', '福建医科大学'],
  ln: ['大连理工大学', '东北大学', '大连海事大学', '辽宁大学', '中国医科大学', '东北财经大学'],
  jx: ['南昌大学', '江西财经大学', '江西师范大学', '华东交通大学'],
  sx: ['太原理工大学', '山西大学', '中北大学', '山西医科大学'],
  sn: ['西安交通大学', '西北工业大学', '西安电子科技大学', '西北大学', '长安大学', '陕西师范大学', '西安建筑科技大学', '西安理工大学', '西安邮电大学'],
  hl: ['哈尔滨工业大学', '哈尔滨工程大学', '东北农业大学', '东北林业大学', '黑龙江大学'],
  jl: ['吉林大学', '东北师范大学', '延边大学', '长春理工大学'],
  bj: ['清华大学', '北京大学', '中国人民大学', '北京航空航天大学', '北京理工大学', '北京师范大学', '北京邮电大学', '北京交通大学', '北京科技大学', '中国政法大学', '中央财经大学', '对外经济贸易大学', '北京外国语大学', '首都医科大学', '首都师范大学', '北京工商大学', '北京工业大学'],
  sh: ['复旦大学', '上海交通大学', '同济大学', '华东师范大学', '上海财经大学', '上海大学', '华东理工大学', '东华大学', '上海理工大学', '上海师范大学', '上海海事大学'],
};

// ---------- 确定性随机（种子可复现） ----------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 字符串 → 种子
function strSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- 生成 ----------
function generate() {
  const result = {};
  let total = 0;

  for (const prov of PROVINCES) {
    result[prov.code] = {
      name: prov.name,
      difficulty: prov.difficulty,
      schools: []
    };

    // 每省按梯队分层抽样，全池覆盖（985/211/一本/二本全取），保证各档次都覆盖
    // 池子里每省会自然出现"外省院校线 + 本省院校线"混合的真实感
    const byTier = { '985': [], '211': [], '1': [], '2': [] };
    for (const sch of SCHOOL_POOL) byTier[sch.tier].push(sch);
    const picks = [
      ...byTier['985'],
      ...byTier['211'],
      ...byTier['1'],
      ...byTier['2'],
    ];

    for (const sch of picks) {
      const rng = mulberry32(strSeed(prov.code + sch.name));
      // 该校在该省的基准分 = 全国基准 × 省份难度 × 学校在该省的招生竞争力微调
      // 本省院校在本地招生多、分数线相对略低（本地生友好），外省略高
      const isLocal = LOCAL_SCHOOLS[prov.code] && LOCAL_SCHOOLS[prov.code].includes(sch.name);
      const localFactor = isLocal ? 0.97 : 1.0;
      const provFactor = prov.difficulty * localFactor * (0.96 + rng() * 0.08); // ±4%
      let base = Math.round(sch.base * provFactor);

      // 年度趋势：整体微涨（通胀），叠加学校自身趋势
      const schoolTrend = (rng() - 0.45) * 1.6; // -0.72 ~ +0.88 / 年
      const scores = {};
      for (const y of YEARS) {
        const dy = y - 2019;
        const inflation = dy * 0.6; // 整体每年微涨 0.6
        const noise = (rng() - 0.5) * 6; // ±3 扰动
        let v = Math.round(base + schoolTrend * dy + inflation + noise);
        // 分数最低不能太离谱
        v = Math.max(420, v);
        scores[y] = v;
      }
      result[prov.code].schools.push({
        name: sch.name,
        tier: sch.tier,
        baseScore: base,
        scores
      });
      total++;
    }
  }

  return { _meta: {
    generatedAt: new Date().toISOString(),
    note: '代表性估算数据，非真实爬取。基于学校梯队与省份难度系数生成，仅供娱乐。',
    years: YEARS,
    provinces: PROVINCES.map(p => ({ code: p.code, name: p.name })),
    schoolCount: total,
    generatorVersion: '1.0',
  }, provinces: result };
}

// ---------- 写入 ----------
const data = generate();
const outDir = path.join(__dirname, 'js', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'scores.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`✅ 已生成 ${data._meta.schoolCount} 所学校 × ${YEARS.length} 年 的数据`);
console.log(`   覆盖省份：${PROVINCES.map(p => p.name).join('、')}`);
console.log(`   写入：${outPath}`);
