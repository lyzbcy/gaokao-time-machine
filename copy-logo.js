const fs = require('fs');
const path = require('path');
const SRC = 'E:\\星星布丁\\微信表情包\\周三涵做表情17\\最终版\\专注.png';
const DST_LOGO = path.join(__dirname, 'img', 'ui', 'logo.png');
const DST_FAV = path.join(__dirname, 'img', 'ui', 'favicon.png');
if (fs.existsSync(SRC)) {
  fs.copyFileSync(SRC, DST_LOGO);
  fs.copyFileSync(SRC, DST_FAV);
  console.log('OK 专注.png → logo.png + favicon.png');
} else {
  console.log('MISS', SRC);
}
