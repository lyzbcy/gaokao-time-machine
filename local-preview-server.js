/* ===========================================================
 * local-preview-server.js — zeen-tools 本地预览服务
 *
 * 为「高考分数时光机」单页 SPA 提供静态预览。
 * 特性：
 *   - 全部响应头带 charset=utf-8（中文路径/中文输出不乱码）
 *   - 目录请求回退到 index.html
 *   - SPA 路由别名（/ → index.html）
 *   - Cache-Control: no-cache（开发期即时生效）
 *   - 端口冲突自动回退
 * =========================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;
const DEFAULT_PORT = 8091;
const PORT_FALLBACKS = [8091, 8092, 8093, 8094, 8095];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.md':   'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

// 路由别名（SPA 单页 + 导航页）
const routeAliases = {
  '/':    '/index.html',
  '/nav': '/zeen-tools/nav.html',
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  // 别名
  if (routeAliases[p]) p = routeAliases[p];
  // 防穿越
  const fp = path.normalize(path.join(PROJECT_ROOT, p));
  if (!fp.startsWith(PROJECT_ROOT)) return null;

  // 目录 → index.html
  let stat;
  try { stat = fs.statSync(fp); } catch { return null; }
  if (stat.isDirectory()) {
    const idx = path.join(fp, 'index.html');
    if (fs.existsSync(idx)) return idx;
    return null;
  }
  return fp;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + path.basename(filePath));
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const fp = resolveFile(req.url);
  if (!fp) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + req.url);
    return;
  }
  sendFile(res, fp);
});

// 端口冲突回退
function tryListen(portIdx) {
  const port = PORT_FALLBACKS[portIdx] || (DEFAULT_PORT + portIdx);
  server.listen(port, '127.0.0.1', () => {
    console.log('==============================================');
    console.log('  高考分数时光机 · 本地预览已启动');
    console.log('  首页:   http://127.0.0.1:' + port + '/');
    console.log('  导航页: http://127.0.0.1:' + port + '/nav');
    console.log('  项目根: ' + PROJECT_ROOT);
    console.log('  按 Ctrl+C 停止，或双击「一键关闭前端.bat」');
    console.log('==============================================');
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && portIdx < PORT_FALLBACKS.length - 1) {
      console.log('[提示] 端口 ' + port + ' 被占用，尝试 ' + PORT_FALLBACKS[portIdx + 1] + ' ...');
      server.removeAllListeners('error');
      tryListen(portIdx + 1);
    } else {
      console.error('[错误] 无法监听端口: ' + e.message);
      process.exit(1);
    }
  });
}

// 支持环境变量覆盖
const envPort = parseInt(process.env.LOCAL_PREVIEW_PORT, 10);
if (envPort && envPort > 0) {
  server.listen(envPort, '127.0.0.1', () => {
    console.log('本地预览已启动: http://127.0.0.1:' + envPort + '/  (端口由环境变量指定)');
  });
  server.on('error', e => { console.error('[错误] ' + e.message); process.exit(1); });
} else {
  tryListen(0);
}
