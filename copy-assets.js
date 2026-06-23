/* ===========================================================
 * copy-assets.js — 复制美术资源到 img 目录
 *
 * 用 Node 跑（node copy-assets.js），规避 PowerShell 中文编码问题。
 * Node 默认 UTF-8，中文路径处理稳定。
 * =========================================================== */

const fs = require('fs');
const path = require('path');

const SRC = 'E:\\星星布丁\\微信表情包';
const DST = path.join(__dirname, 'img');

const map = [
  ['周三涵做表情1\\最终版\\惊讶震惊.png', 'labels\\tianxuan.png'],
  ['星星布丁第四弹\\呜呜.png',            'labels\\xuekui.png'],
  ['星星布丁第四弹\\得意.png',            'labels\\shidai.png'],
  ['参考图库\\皱眉.png',                  'labels\\xingkao.png'],
  ['星星布丁第四弹\\嘻嘻.png',            'labels\\jianlou.png'],
  ['周三涵做表情4\\最终版\\淡定.png',      'labels\\pingping.png'],
  ['星星布丁第四弹\\天呐.png',            'labels\\yidai.png'],
  ['周三涵做表情1\\最终版\\惊讶震惊.png',  'labels\\xuefei.png'],
  ['周三涵做表情7\\最终版\\闪耀.png',      'labels\\pingxing.png'],
  ['周三涵做表情7\\最终版\\飞天.png',      'labels\\shikong.png'],
  ['星星布丁base5.png',                  'ui\\box.png'],
  ['星星布丁base5.png',                  'ui\\logo.png'],
];

let ok = 0, miss = 0;
for (const [rel, dstRel] of map) {
  const s = path.join(SRC, rel);
  const d = path.join(DST, dstRel);
  try {
    fs.mkdirSync(path.dirname(d), { recursive: true });
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, d);
      console.log(`OK   ${dstRel}`);
      ok++;
    } else {
      console.log(`MISS ${rel}`);
      miss++;
    }
  } catch (e) {
    console.log(`ERR  ${rel}: ${e.message}`);
    miss++;
  }
}
console.log(`\n完成: 成功 ${ok}, 缺失 ${miss}`);
