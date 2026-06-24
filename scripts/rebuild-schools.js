/* rebuild-schools.js — 基于 university_info.csv + labolado 真实分数线重建学校数据
 *
 * 输入：
 *   - siu91/university_info.csv (2784 校完整名单，含层次/类别/省份)
 *   - labolado-scores.json (48795 条校×省×科类真实录取线 2016-2020)
 *
 * 输出（覆盖现有）：
 *   - js/data/schools-dict.json (学校字典，2784校)
 *   - js/data/scores/{code}.json (每省各校分数线，含真实数据)
 *
 * 层次标注：985/211 用硬编码名单，其余普通本科/专科/独立学院用 CSV 层次
 * 分数线：labolado 有真实值就用（优先 science 物理类），无则按层次+省份难度估算 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNI_CSV = 'E:/_gk_research2/easy_university_selection/resource/university_info.csv';
const LABOLADO = 'E:/_gk_research2/labolado-scores.json';
const DICT_OUT = path.join(ROOT, 'js', 'data', 'schools-dict.json');
const SCORES_DIR = path.join(ROOT, 'js', 'data', 'scores');

// ---------- 985/211 硬编码名单（精确标注）----------
const LIST_985 = ['清华大学','北京大学','中国人民大学','北京航空航天大学','北京理工大学','中国农业大学','北京师范大学','中央民族大学','南开大学','天津大学','大连理工大学','吉林大学','哈尔滨工业大学','复旦大学','同济大学','上海交通大学','华东师范大学','南京大学','东南大学','浙江大学','中国科学技术大学','厦门大学','山东大学','中国海洋大学','武汉大学','华中科技大学','中南大学','湖南大学','国防科技大学','中山大学','华南理工大学','四川大学','重庆大学','电子科技大学','西安交通大学','西北工业大学','西北农林科技大学','兰州大学','东北大学'];
const LIST_211 = ['北京交通大学','北京工业大学','北京科技大学','北京化工大学','北京邮电大学','北京林业大学','北京中医药大学','北京外国语大学','中国传媒大学','中央财经大学','对外经济贸易大学','北京体育大学','中央音乐学院','中国政法大学','华北电力大学','华北电力大学保定校区','中国矿业大学（北京）','中国石油大学（北京）','中国地质大学（北京）','上海财经大学','上海大学','上海外国语大学','华东理工大学','东华大学','第二军医大学','海军军医大学','第四军医大学','空军军医大学','天津医科大学','河北工业大学','太原理工大学','内蒙古大学','辽宁大学','大连海事大学','延边大学','东北师范大学','哈尔滨工程大学','东北农业大学','东北林业大学','南京航空航天大学','南京理工大学','中国矿业大学','河海大学','江南大学','南京农业大学','中国药科大学','南京师范大学','苏州大学','安徽大学','合肥工业大学','合肥工业大学宣城校区','福州大学','南昌大学','中国石油大学（华东）','郑州大学','武汉理工大学','中国地质大学（武汉）','华中师范大学','华中农业大学','中南财经政法大学','湖南师范大学','暨南大学','华南师范大学','海南大学','广西大学','西南大学','西南交通大学','西南财经大学','四川农业大学','贵州大学','云南大学','西藏大学','西北大学','西安电子科技大学','长安大学','陕西师范大学','青海大学','宁夏大学','新疆大学','石河子大学'];
const SET_985 = new Set(LIST_985);
const SET_211 = new Set(LIST_211);

// CSV 层次 → tier 映射
const LAYER_TO_TIER = {
  '普通本科': '1',      // 一本（启发式，985/211 会覆盖）
  '独立学院': '2',      // 二本
  '中外合作办学': '2',
  'HND项目': '2',
  '高职高专': '3',      // 专科
  '成人教育': '3',
  '远程教育学院': '3',
  '其它': '2',
};

// 省名→省码（CSV 用省名）
const NAME_CODE = {'北京':'bj','天津':'tj','上海':'sh','重庆':'cq','河北':'he','山西':'sx','辽宁':'ln','吉林':'jl','黑龙江':'hl','江苏':'js','浙江':'zj','安徽':'ah','福建':'fj','江西':'jx','山东':'sd','河南':'ha','湖北':'hb','湖南':'hn','广东':'gd','海南':'hi','四川':'sc','贵州':'gz','云南':'yn','陕西':'sn','甘肃':'gs','青海':'qh','内蒙古':'nm','广西':'gx','宁夏':'nx','新疆':'xj','西藏':'xz'};
const CODE_NAME = Object.fromEntries(Object.entries(NAME_CODE).map(([n,c])=>[c,n]));

// 各省难度系数（用于估算分数线，参考现有 generate-scores 逻辑）
const DIFFICULTY = {sc:1.0,ha:1.05,sd:1.0,gd:0.95,js:1.0,hb:1.0,hn:1.0,zj:1.05,he:1.0,ah:1.0,cq:0.95,fj:0.95,ln:0.9,jx:0.95,sx:0.95,sn:0.95,hl:0.9,jl:0.9,bj:1.1,sh:1.1,nm:0.85,gx:0.9,hi:0.85,gz:0.9,yn:0.9,gs:0.85,qh:0.8,nx:0.85,xj:0.85,tj:1.0,xz:0.8};

// ---------- 1. 读 CSV 学校名单 ----------
function loadUniversities() {
  const lines = fs.readFileSync(UNI_CSV, 'utf-8').split('\n').filter(l => l.trim());
  const out = {};  // code → [{name, tier, cat}]
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const name = c[2], provName = c[3], layer = c[4], cat = c[6];
    const code = NAME_CODE[provName];
    if (!code) continue;  // 跳过港澳台等
    let tier;
    if (SET_985.has(name)) tier = '985';
    else if (SET_211.has(name)) tier = '211';
    else tier = LAYER_TO_TIER[layer] || '2';
    if (!out[code]) out[code] = [];
    out[code].push({ name, tier, cat: cat || '综合类' });
  }
  return out;
}

// ---------- 2. 读 labolado 真实分数线 ----------
function loadLabolado() {
  return JSON.parse(fs.readFileSync(LABOLADO, 'utf-8'));
}

// ---------- 3. 层次→基础分（用于估算）----------
function baseScoreByTier(tier, difficulty) {
  const base = { '985': 620, '211': 560, '1': 510, '2': 440, '3': 350 };
  return Math.round((base[tier] || 450) * difficulty);
}

// 生成 2019-2025 的估算分数线（基于基础分小幅波动）
function estimateScores(base, rng) {
  const years = [2019,2020,2021,2022,2023,2024,2025];
  const out = {};
  for (const y of years) {
    const wobble = Math.round((rng() - 0.5) * 12);  // ±6 波动
    out[y] = base + wobble;
  }
  return out;
}

// 简单 seeded RNG
function seed(s) { let h = 2166136261; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }

// ---------- 主流程 ----------
function main() {
  const unis = loadUniversities();
  const labolado = loadLabolado();

  const dict = { _meta: {
    generatedAt: new Date().toISOString(),
    note: '学校字典：基于 university_info.csv(2784校) 重建，985/211精确标注，其余按层次推断',
    years: [2019,2020,2021,2022,2023,2024,2025],
    tierLegend: { '985':'985','211':'211','1':'一本','2':'二本','3':'专科' },
    provinces: Object.keys(NAME_CODE).map(n => ({ code: NAME_CODE[n], name: n })),
  }, provinces: {} };

  let totalSchools = 0;
  let realScoreCount = 0;

  for (const code of Object.keys(NAME_CODE).map(n => NAME_CODE[n])) {
    const list = unis[code] || [];
    const diff = DIFFICULTY[code] || 0.95;
    const schools = [];

    for (const u of list) {
      // 查 labolado 真实分数线：优先 science(理科/物理)，回退 arts
      const keyS = u.name + '|' + code + '|science';
      const keyA = u.name + '|' + code + '|arts';
      const rec = labolado[keyS] || labolado[keyA];
      const base = baseScoreByTier(u.tier, diff);
      const rng = seed(u.name + code);

      let scores;
      let scoreSource = 'estimated';
      if (rec && Object.keys(rec.scores).length >= 2) {
        // 有真实数据：用真实的，缺的年份用最近真实值外推
        scores = fillFromReal(rec.scores, base);
        scoreSource = 'real';
        realScoreCount++;
      } else {
        scores = estimateScores(base, rng);
      }
      schools.push({ name: u.name, tier: u.tier, baseScore: base, scores, source: scoreSource });
    }

    dict.provinces[code] = { name: CODE_NAME[code], schools };
    totalSchools += schools.length;

    // 写 scores 分片
    const scoreFile = path.join(SCORES_DIR, code + '.json');
    fs.writeFileSync(scoreFile, JSON.stringify({ name: CODE_NAME[code], difficulty: diff, schools }, null, 2), 'utf-8');
  }

  dict._meta.schoolCount = totalSchools;
  dict._meta.realScoreCount = realScoreCount;
  fs.writeFileSync(DICT_OUT, JSON.stringify(dict, null, 2), 'utf-8');

  console.log('=== 重建完成 ===');
  console.log('总学校数:', totalSchools);
  console.log('有真实分数线的学校:', realScoreCount);
  console.log('估算分数线的学校:', totalSchools - realScoreCount);
  console.log('真实占比:', (realScoreCount/totalSchools*100).toFixed(1) + '%');
  console.log('写入:', DICT_OUT);
  console.log('scores 分片:', SCORES_DIR);
}

// 用真实分数线填充 2019-2025（labolado 只到 2020，2021-2025 用 2020 外推）
function fillFromReal(realScores, baseFallback) {
  const years = [2019,2020,2021,2022,2023,2024,2025];
  const out = {};
  // 找最近的真实年作为基准
  const realYears = Object.keys(realScores).map(Number).sort((a,b)=>b-a);
  const latestYear = realYears[0];
  const latest = realScores[latestYear];
  for (const y of years) {
    if (realScores[y] != null) {
      out[y] = realScores[y];
    } else {
      // y > latestYear：用 latest 加小幅趋势
      const delta = (y - latestYear) * 1.5;
      out[y] = Math.round(latest + delta);
    }
  }
  return out;
}

main();
