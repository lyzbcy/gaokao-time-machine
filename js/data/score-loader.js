/* ===========================================================
 * score-loader.js — 按省懒加载分数线 + 内存缓存
 *
 * 接口：async loadProvScores(code) → 返回该省完整数据
 *   { name, difficulty, schools:[{name,tier,baseScore,scores:{year}}] }
 * 与 box-engine 期望的 provinceData 结构一致（零改动适配）
 *
 * 内部：{ [code]: Promise<provData> } 缓存，防止重复 fetch
 * 文件位置：js/data/scores/{code}.json
 * =========================================================== */

const ScoreLoader = (function () {

  const cache = {};   // { code: Promise<provData> }

  function loadProvScores(code) {
    if (!code) return Promise.reject(new Error('无省份代码'));
    // 命中缓存直接返回（同一个 Promise，避免并发重复请求）
    if (cache[code]) return cache[code];

    cache[code] = fetch(`js/data/scores/${code}.json`)
      .then(res => {
        if (!res.ok) throw new Error(`scores/${code}.json HTTP ` + res.status);
        return res.json();
      })
      .catch(e => {
        // 失败则清除缓存，允许重试
        delete cache[code];
        console.warn('[ScoreLoader] 加载失败 ' + code + ':', e.message);
        throw e;
      });

    return cache[code];
  }

  // 预取（可选）：提前加载某省，不阻塞
  function prefetch(code) {
    if (code && !cache[code]) loadProvScores(code).catch(() => {});
  }

  function isCached(code) {
    return !!cache[code];
  }

  return { loadProvScores, prefetch, isCached };
})();

window.ScoreLoader = ScoreLoader;
