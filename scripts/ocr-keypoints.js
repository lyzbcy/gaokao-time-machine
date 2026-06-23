/* ===========================================================
 * scripts/ocr-keypoints.js — 一分一段表关键点位 OCR 工具
 *
 * 用途：当 fetch-rank-data.js 遇到图片/PDF 格式的一分一段表时，
 *       用本工具下载图片 → OCR → 提取关键点位。
 *
 * 策略：只 OCR 关键行（省控线/特控线/几个高分段），不做全表 OCR，
 *       控制识别错率和耗时。
 *
 * 依赖（按需安装）：
 *   npm install tesseract.js     # OCR 引擎（纯 JS，无需系统依赖）
 *   # PDF 支持（可选）：
 *   npm install pdf-parse        # 提取 PDF 文本（若考试院发的是文本型 PDF）
 *
 * 用法：
 *   node scripts/ocr-keypoints.js <图片URL或本地路径> [--year 2025] [--track science]
 *
 * ⚠️ OCR 识别错率非零，提取的关键点位建议人工核对后再写回 rank-tables.json
 * =========================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ---------- 下载图片 ----------
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    lib.get(url, { timeout: 30000 }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', reject);
  });
}

// ---------- OCR ----------
async function ocrImage(filePath) {
  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch (e) {
    console.error('❌ 未安装 tesseract.js，请先运行: npm install tesseract.js');
    console.error('   或检查 package.json 是否有该依赖');
    process.exit(2);
  }
  console.log('正在 OCR（首次会下载语言包，约 10-30MB）...');
  const { data: { text } } = await Tesseract.recognize(filePath, 'chi_sim+eng', {
    logger: m => { if (m.status === 'recognizing text') process.stdout.write(`\r  识别进度: ${(m.progress*100).toFixed(0)}%`); },
  });
  console.log('');
  return text;
}

// ---------- 提取关键点位 ----------
// 一分一段表图片 OCR 后，文本里会有大量「分数 人数 累计」三列
// 我们只关心关键行：本科线/特控线附近的累计位次
function extractKeypointsFromOcrText(text) {
  const points = [];
  const lines = text.split(/\n+/);
  // 匹配「分数  本段人数  累计人数」格式（数字间可能有空格/制表符）
  const numRow = /^(\d{2,3})\s+(\d{1,6})\s+(\d{1,7})/;
  for (const line of lines) {
    const m = line.match(numRow);
    if (m) {
      points.push({
        score: parseInt(m[1], 10),
        count: parseInt(m[2], 10),
        cumulativeRank: parseInt(m[3], 10),
      });
    }
  }
  // 去重（同分取最后一个）、排序（分数降序）
  const seen = {};
  for (const p of points) seen[p.score] = p;
  const unique = Object.values(seen).sort((a, b) => b.score - a.score);

  // 抽取关键锚点：省控线附近、特控线附近、几个高分段
  const keyScores = [700, 680, 650, 600, 580, 550, 520, 500, 480, 460, 440, 430, 420];
  const keypoints = [];
  for (const ks of keyScores) {
    // 找最接近的（±2 分）
    const hit = unique.find(p => Math.abs(p.score - ks) <= 2);
    if (hit) keypoints.push(hit);
  }
  return { allRows: unique.length, keypoints };
}

// ---------- 主流程 ----------
async function main() {
  const input = process.argv[2];
  if (!input) {
    console.log('用法: node scripts/ocr-keypoints.js <图片URL或路径>');
    console.log('示例: node scripts/ocr-keypoints.js https://www.sceea.cn/xxx/2024yfyd.jpg');
    console.log('      node scripts/ocr-keypoints.js ./downloads/sc-2024.jpg');
    process.exit(1);
  }

  let localPath = input;
  // 如果是 URL，先下载
  if (input.startsWith('http://') || input.startsWith('https://')) {
    const tmpDir = path.join(__dirname, '..', 'downloads');
    fs.mkdirSync(tmpDir, { recursive: true });
    const fname = input.split('/').pop().split('?')[0] || 'temp.jpg';
    localPath = path.join(tmpDir, fname);
    console.log(`下载图片 → ${localPath}`);
    await downloadFile(input, localPath);
  }

  if (!fs.existsSync(localPath)) {
    console.error(`❌ 文件不存在: ${localPath}`);
    process.exit(1);
  }

  const text = await ocrImage(localPath);
  console.log(`\nOCR 完成，原文长度 ${text.length} 字符`);

  const { allRows, keypoints } = extractKeypointsFromOcrText(text);
  console.log(`\n=== 提取结果 ===`);
  console.log(`识别到 ${allRows} 行数据，关键锚点 ${keypoints.length} 个：`);
  console.table(keypoints);

  console.log('\n⚠️ 请人工核对后，把 keypoints 写入 js/data/rank-tables.json 的对应 points 数组');
  console.log('   格式：[[score, cumulativeRank], ...]（与现有 points 合并/覆盖）');

  // 可选：输出可直接粘贴的 JSON 片段
  const jsonSnippet = JSON.stringify(keypoints.map(k => [k.score, k.cumulativeRank]));
  console.log('\n可粘贴的 JSON 片段：');
  console.log(jsonSnippet);
}

main().catch(e => { console.error('错误:', e); process.exit(1); });
