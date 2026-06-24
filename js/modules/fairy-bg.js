/* ===========================================================
 * fairy-bg.js — 童话背景装饰 + 鼠标推开交互
 *
 * 生成云朵、星星、彩虹装饰，漂浮动画；指针划过时装饰被推开。
 * requestAnimationFrame 节流，尊重 prefers-reduced-motion。
 * =========================================================== */

const FairyBg = (function () {

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let decorations = [];

  function init() {
    const bg = document.getElementById('fairy-bg');
    if (!bg) return;
    bg.innerHTML = '';
    decorations = [];

    // 彩虹
    const rainbow = document.createElement('div');
    rainbow.className = 'rainbow';
    bg.appendChild(rainbow);

    // 云朵（5-7 朵）
    const cloudCount = window.innerWidth < 480 ? 4 : 6;
    for (let i = 0; i < cloudCount; i++) {
      decorations.push(makeCloud(bg, i));
    }

    // 星星（10-14 颗，emoji）
    const starCount = window.innerWidth < 480 ? 8 : 12;
    const starChars = ['✨', '⭐', '🌟', '💫'];
    for (let i = 0; i < starCount; i++) {
      decorations.push(makeStar(bg, i, starChars[i % starChars.length]));
    }

    if (!REDUCE) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }
  }

  function makeCloud(bg, i) {
    const el = document.createElement('div');
    el.className = 'cloud';
    const w = 80 + Math.random() * 90;
    const h = w * 0.45;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    const x = Math.random() * 100;          // vw
    const y = 5 + Math.random() * 70;       // vh
    el.style.left = x + 'vw';
    el.style.top = y + 'vh';
    el.style.setProperty('--ox', '0px');
    el.style.setProperty('--oy', '0px');
    const dur = 16 + Math.random() * 12;
    const animName = i % 2 === 0 ? 'float' : 'floatSlow';
    if (!REDUCE) el.style.animation = `${animName} ${dur}s ease-in-out infinite`;
    bg.appendChild(el);
    return { el, baseX: x, baseY: y, vx: 0, vy: 0, type: 'cloud', pushRadius: 180, pushForce: 60 };
  }

  function makeStar(bg, i, ch) {
    const el = document.createElement('div');
    el.className = 'star';
    el.textContent = ch;
    el.style.fontSize = (14 + Math.random() * 16) + 'px';
    const x = Math.random() * 100;
    const y = Math.random() * 90;
    el.style.left = x + 'vw';
    el.style.top = y + 'vh';
    el.style.setProperty('--ox', '0px');
    el.style.setProperty('--oy', '0px');
    el.style.animationDelay = (Math.random() * 2.4) + 's';
    bg.appendChild(el);
    return { el, baseX: x, baseY: y, vx: 0, vy: 0, type: 'star', pushRadius: 120, pushForce: 45 };
  }

  // 把装饰 baseX/Y(vw/vh) 转成 px，用于距离计算
  function getCenterPx(d) {
    const rect = d.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  let pointer = { x: -9999, y: -9999 };
  let ticking = false;

  function onPointerMove(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function update() {
    ticking = false;
    for (const d of decorations) {
      if (d.type === 'cloud' && REDUCE) continue;
      const c = getCenterPx(d);
      const dx = c.x - pointer.x;
      const dy = c.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < d.pushRadius && dist > 0.1) {
        // 推开：力度随距离衰减
        const force = (1 - dist / d.pushRadius) * d.pushForce;
        const ox = (dx / dist) * force;
        const oy = (dy / dist) * force;
        d.vx = ox; d.vy = oy;
      } else {
        // 回弹到原位
        d.vx *= 0.85; d.vy *= 0.85;
        if (Math.abs(d.vx) < 0.5) d.vx = 0;
        if (Math.abs(d.vy) < 0.5) d.vy = 0;
      }
      d.el.style.setProperty('--ox', d.vx.toFixed(1) + 'px');
      d.el.style.setProperty('--oy', d.vy.toFixed(1) + 'px');
    }
  }

  return { init };
})();

window.FairyBg = FairyBg;
