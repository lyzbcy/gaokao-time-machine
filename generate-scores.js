/* ===========================================================
 * generate-scores.js — 按省生成分数线文件（V5 懒加载架构）
 *
 * 读取：js/data/schools-dict.json（学校字典）
 * 输出：js/data/scores/{code}.json（每省一个文件，含该省所有校的历年分数线）
 *
 * 分数生成：基于 tier 基准分 × 省份难度 × 本地系数，历年加趋势+噪声
 *   tier 基准（difficulty=1.00）：985=690 211=600 一本=550 二本=500 专科=380
 *   专科 200-400 分段
 *
 * 每省文件结构：{ name, difficulty, schools: [{name, tier, baseScore, scores:{year:..}}] }
 * 与旧 scores.json 的单省结构一致（box-engine 零改动）
 * =========================================================== */

const fs = require('fs');
const path = require('path');

const DICT_PATH = path.join(__dirname, 'js', 'data', 'schools-dict.json');
const OUT_DIR = path.join(__dirname, 'js', 'data', 'scores');

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

// 各省难度系数（与 schools-dict 对齐）
const PROV_DIFFICULTY = {
  sc: 1.00, ha: 1.05, sd: 1.04, gd: 0.96, js: 0.98,
  hb: 1.00, hn: 1.01, zj: 0.99, he: 1.05, ah: 1.00,
  cq: 0.99, fj: 0.97, ln: 0.98, jx: 1.00, sx: 1.02,
  sn: 1.00, hl: 0.95, jl: 0.95, bj: 0.97, sh: 0.96,
  // 新增11省
  nm: 0.96, gx: 0.96, hi: 0.94, gz: 0.96, yn: 0.97,
  gs: 0.98, qh: 0.90, nx: 0.94, xj: 0.92, tj: 0.97, xz: 0.88,
};

// tier 基准分（在 difficulty=1.00 省份的大致录取最低分）
const TIER_BASE = { '985': 685, '211': 595, '1': 550, '2': 500, '3': 360 };

// 确定性随机
function mulberry32(seed) { return function(){let t=(seed+=0x6D2B79F5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}; }
function strSeed(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

// 从字典的 dept 字段判断是否本地校（粗略：非"教育部/省"或本地校名含省份特征）
// 这里简化：用 rng 随机给 30% 的校本地系数（因为字典没明确标注本地）
function isLocalGuess(name, rng) {
  // 校名含本省特征或"省字头"通常是本地校
  return rng() < 0.3;
}

// ---------- 生成 ----------
function generate() {
  const dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 构建"全国学校总池"（去重），记录每校的所在地省份 homeProv
  const ALL_SCHOOLS = [];
  const seenNames = new Set();
  for (const code in dict.provinces) {
    for (const sch of dict.provinces[code].schools) {
      if (!seenNames.has(sch.name)) {
        seenNames.add(sch.name);
        ALL_SCHOOLS.push({ name: sch.name, tier: sch.tier, homeProv: code });
      }
    }
  }

  let totalSchools = 0;
  const summary = [];

  for (const code in dict.provinces) {
    const provDict = dict.provinces[code];
    const difficulty = PROV_DIFFICULTY[code] || 1.0;
    const schools = [];

    // 遍历"全国学校总池"（去重），让每所学校在该省都生成一条录取线
    // 真实招生：全国本科都跨省招生，每省分数线不同
    for (const sch of ALL_SCHOOLS) {
      const rng = mulberry32(strSeed(code + sch.name));
      const base = TIER_BASE[sch.tier] || 500;
      // 本地校（所在地=该省）分数线略低（本地生名额多），外省略高
      const isLocal = (sch.homeProv === code);
      const localFactor = isLocal ? 0.97 : 1.0;
      const provFactor = difficulty * localFactor * (0.94 + rng() * 0.10);
      let schBase = Math.round(base * provFactor);

      // tier 微调：同 tier 内按 rng 拉开差距
      const tierSpread = sch.tier === '985' ? 60 : sch.tier === '211' ? 50 : sch.tier === '1' ? 45 : sch.tier === '2' ? 40 : 50;
      schBase = Math.round(schBase + (rng() - 0.5) * tierSpread);
      schBase = Math.max(sch.tier === '3' ? 200 : 420, schBase);

      // 历年分数
      const trend = (rng() - 0.45) * 1.5;
      const scores = {};
      for (const y of YEARS) {
        const dy = y - 2019;
        const inflation = dy * 0.5;
        const noise = (rng() - 0.5) * 5;
        let v = Math.round(schBase + trend * dy + inflation + noise);
        v = Math.max(sch.tier === '3' ? 150 : 400, v);
        scores[y] = v;
      }

      schools.push({ name: sch.name, tier: sch.tier, baseScore: schBase, scores });
      totalSchools++;
    }

    const provData = { name: provDict.name, difficulty, schools };
    const outPath = path.join(OUT_DIR, `${code}.json`);
    fs.writeFileSync(outPath, JSON.stringify(provData, null, 2), 'utf-8');
    summary.push(`${provDict.name}(${code}): ${schools.length}所`);
  }

  console.log(`✅ 按省生成分数线完成，共 ${totalSchools} 所学校 × ${YEARS.length}年`);
  console.log(`   ${summary.join('，')}`);
  console.log(`   写入目录：${OUT_DIR}`);
}

generate();
