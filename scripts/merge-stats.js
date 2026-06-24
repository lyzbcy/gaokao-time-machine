/* merge-stats.js — 把 rank-tables.json 的统计注入 schools-dict.json._meta.stats
 *
 * 解决问题：DataStats 依赖 RANK_DATA（9.7MB大文件），该文件加载慢或被 CDN
 * 缓存时会显示"0省0张"。把统计冗余进 schools-dict（110KB小文件，必加载必先就绪），
 * 作为兜底真相源，彻底摆脱大文件的加载竞态。
 *
 * 用法：node scripts/merge-stats.js
 * 配套：build-schools-dict.js 也已加上同样的合并逻辑，重生成时自动带上 stats。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DICT_FILE = path.join(ROOT, 'js', 'data', 'schools-dict.json');
const RANK_FILE = path.join(ROOT, 'js', 'data', 'rank-tables.json');

// 从 rank-tables 现算统计（不依赖 _meta.stats 是否存在，更稳健）
function computeStats(rankData) {
  let officialCount = 0, extrapolatedCount = 0, predictedCount = 0;
  const realSet = new Set();
  for (const code in rankData.provinces) {
    for (const year in rankData.provinces[code].years) {
      for (const track in rankData.provinces[code].years[year]) {
        const src = rankData.provinces[code].years[year][track].source;
        if (src === 'official') { officialCount++; realSet.add(code); }
        else if (src === 'official-extrapolated') extrapolatedCount++;
        else predictedCount++;
      }
    }
  }
  return {
    provinceCount: Object.keys(rankData.provinces).length,
    officialCount,
    extrapolatedCount,
    predictedCount,
    realProvinceCount: realSet.size,
    realProvinceList: [...realSet].sort(),
    totalTables: officialCount + extrapolatedCount + predictedCount,
  };
}

const dict = JSON.parse(fs.readFileSync(DICT_FILE, 'utf-8'));
const rank = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'));
const stats = (rank._meta && rank._meta.stats) || computeStats(rank);

dict._meta.stats = stats;
dict._meta.statsMergedFrom = 'rank-tables.json';
fs.writeFileSync(DICT_FILE, JSON.stringify(dict, null, 2), 'utf-8');

console.log('已把统计注入 schools-dict.json._meta.stats:');
console.log(JSON.stringify(stats, null, 2));
