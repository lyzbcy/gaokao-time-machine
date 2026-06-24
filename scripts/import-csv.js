/* import-csv.js — 从 Gaokao-score-distribution 的 CSV 导入真实一分一段表
 *
 * 数据源：1996-2024年全国高考分段表.csv (459899行)
 * 来源仓库：sdgedfegw/Gaokao-score-distribution (GitHub, 1101张表)
 *
 * 策略：
 *   - 覆盖全部 31 省（CSV 有数据的都导入，不只缺的6省）
 *   - 科类中文 → track 映射：理科→science, 文科→arts, 物理类→physics,
 *     历史类→history, 综合/3+3综合/3+1+1综合→general
 *   - 只写入 rank-tables 中"已存在该 track 且当前非 official"的槽位（不覆盖已抓真实表）
 *   - 跳过海南(900分制)/上海(660分制)等特殊总分省份的 general 表，避免口径冲突
 *   - CSV 只到 2024，2025/2026 保持模型
 */
const fs = require('fs');
const path = require('path');

const CSV_FILE = 'E:/_gk_research/Gaokao-score-distribution/1996-2024年全国高考分段表.csv';
const RANK_FILE = path.join(__dirname, '..', 'js', 'data', 'rank-tables.json');

// 省名 → 省码（CSV 用省名，rank-tables 用省码）
const NAME_TO_CODE = {
  '北京':'bj','天津':'tj','上海':'sh','重庆':'cq','河北':'he','山西':'sx',
  '辽宁':'ln','吉林':'jl','黑龙江':'hl','江苏':'js','浙江':'zj','安徽':'ah',
  '福建':'fj','江西':'jx','山东':'sd','河南':'ha','湖北':'hb','湖南':'hn',
  '广东':'gd','海南':'hi','四川':'sc','贵州':'gz','云南':'yn','陕西':'sn',
  '甘肃':'gs','青海':'qh','内蒙古':'nm','广西':'gx','宁夏':'nx','新疆':'xj','西藏':'xz',
};

// 科类中文 → track
const CATE_TO_TRACK = {
  '理科':'science','文科':'arts',
  '物理类':'physics','历史类':'history',
  '综合':'general','3+3综合':'general','3+1+1综合':'general',
};

// 解析 CSV → { "code|year|track": [[score, rank], ...] }
function parseCsv() {
  const raw = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const groups = {};
  let skipCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const [, loStr, , accStr, provName, cate, yearStr] = cols;
    const code = NAME_TO_CODE[provName];
    const track = CATE_TO_TRACK[cate];
    if (!code || !track) { skipCount++; continue; }
    const year = parseInt(yearStr, 10);
    const score = parseInt(loStr, 10);
    const rank = parseInt(accStr, 10);
    if (isNaN(score) || isNaN(rank)) continue;
    const key = code + '|' + year + '|' + track;
    if (!groups[key]) groups[key] = [];
    groups[key].push([score, rank]);
  }
  // 每组按分数降序、同名次取累计去重（同一分数只留最大累计=该分位次）
  for (const k in groups) {
    const m = {};
    for (const [s, r] of groups[k]) m[s] = Math.max(m[s] || 0, r);
    groups[k] = Object.entries(m).map(([s, r]) => [parseInt(s), r])
      .sort((a, b) => b[0] - a[0]);
  }
  console.log('[CSV] 解析 ' + lines.length + ' 行，得到 ' + Object.keys(groups).length + ' 组表');
  return groups;
}

function main() {
  const groups = parseCsv();
  const rankData = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'));
  let imported = 0, skippedOfficial = 0, skippedNoTrack = 0, skippedSpecial = 0;

  // 特殊总分省份的 general 表跳过（海南900/上海660，口径不同）
  const SPECIAL_GENERAL = new Set(['hi', 'sh']);

  for (const key in groups) {
    const [code, yearStr, track] = key.split('|');
    const year = parseInt(yearStr, 10);
    const prov = rankData.provinces[code];
    if (!prov || !prov.years[year]) continue;
    const yearData = prov.years[year];

    // 特殊总分省份的 general 跳过
    if (SPECIAL_GENERAL.has(code) && track === 'general') { skippedSpecial++; continue; }

    // 该年没有这个 track → 尝试别名（science↔physics, arts↔history）
    let t = track;
    if (!yearData[t]) {
      const alias = { science:'physics', physics:'science', arts:'history', history:'arts' };
      if (alias[t] && yearData[alias[t]]) t = alias[t];
      else { skippedNoTrack++; continue; }
    }

    // 已有 official → 不覆盖
    if (yearData[t].source === 'official') { skippedOfficial++; continue; }

    const points = groups[key];
    if (points.length < 50) continue;  // 太少不导入

    yearData[t].points = points;
    yearData[t].source = 'official';
    yearData[t].label = yearData[t].label || track;
    imported++;
  }

  rankData._meta.lastCsvImportAt = new Date().toISOString();
  rankData._meta.csvSource = 'sdgedfegw/Gaokao-score-distribution (1996-2024)';
  fs.writeFileSync(RANK_FILE, JSON.stringify(rankData, null, 2), 'utf-8');

  console.log('\n=== 导入完成 ===');
  console.log('  导入(official):', imported);
  console.log('  跳过(已有official):', skippedOfficial);
  console.log('  跳过(无对应track):', skippedNoTrack);
  console.log('  跳过(特殊总分):', skippedSpecial);
  console.log('  写入:', RANK_FILE);
}

main();
