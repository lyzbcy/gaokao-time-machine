/* copy-anim.js — 复制动态 GIF 到 img/anim/（童话风+吉祥物用）
 * 用 Node 跑规避 PowerShell 中文路径编码问题
 */
const fs = require('fs');
const path = require('path');

const SRC = 'E:\\星星布丁\\微信表情包';
const DST = path.join(__dirname, 'img', 'anim');
fs.mkdirSync(DST, { recursive: true });

// [源相对路径, 目标文件名]
const map = [
  ['星星布丁第一弹\\sparkle.gif',      'sparkle.gif'],      // 装饰闪光
  ['星星布丁第一弹\\02_星星眼.gif',    'star-eyes.gif'],    // 庆祝-星星眼
  ['星星布丁第五弹\\冒泡.gif',         'idle-bubble.gif'],  // 待机
  ['星星布丁第五弹\\呆萌.gif',         'idle-cute.gif'],    // 呆萌
  ['星星布丁第五弹\\打哈欠.gif',       'idle-yawn.gif'],    // 打哈欠
  ['星星布丁第五弹\\斜眼看.gif',       'peek.gif'],         // 探头看
  ['星星布丁第五弹\\转圈.gif',         'spin.gif'],         // 开盒欢呼
  ['星星布丁第五弹\\嘻嘻.gif',         'happy.gif'],        // 庆祝偷笑
  ['星星布丁第五弹\\哭诉.gif',         'cry.gif'],          // 安慰哭
  ['星星布丁第五弹\\可怜.gif',         'pity.gif'],         // 安慰委屈
  ['星星布丁第五弹\\怒.gif',           'angry.gif'],        // 生气
  ['星星布丁第五弹\\生气.gif',         'mad.gif'],          // 跺脚
  ['星星布丁第五弹\\打你.gif',         'hit.gif'],          // 点击反击
  ['星星布丁第五弹\\呵呵.gif',         'hehe.gif'],         // 欠揍得意
];

let ok = 0, miss = 0;
for (const [rel, dstRel] of map) {
  const s = path.join(SRC, rel);
  const d = path.join(DST, dstRel);
  try {
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, d);
      const kb = (fs.statSync(d).size / 1024).toFixed(0);
      console.log(`OK   ${dstRel} (${kb}KB)`);
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
