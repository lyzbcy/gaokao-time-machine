/* ===========================================================
 * share-card.js — 分享卡片生成（canvas）
 *
 * 生成一张适合发小红书/朋友圈的卡片图：
 *   标签 + 稀有度 + 对比数据 + IP形象水印 + "@星星布丁 友情出演"
 * =========================================================== */

const ShareCard = (function () {

  const TIER_CN = { '985': '985', '211': '211', '1': '一本', '2': '二本' };

  async function generate(result, input, mountEl) {
    const W = 750, H = 1000;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const def = result.label;
    const tier = Labels.tier(def.tier);

    // ---------- 背景：渐变 ----------
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#FFF6E5');
    bgGrad.addColorStop(0.5, '#FFE9F3');
    bgGrad.addColorStop(1, '#F3E8FF');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 装饰圆点
    ctx.fillStyle = 'rgba(255,138,61,0.12)';
    ctx.beginPath(); ctx.arc(80, 120, 60, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(155,107,255,0.12)';
    ctx.beginPath(); ctx.arc(680, 880, 80, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,111,161,0.10)';
    ctx.beginPath(); ctx.arc(650, 180, 40, 0, Math.PI*2); ctx.fill();

    // ---------- 标题 ----------
    ctx.fillStyle = '#2D2438';
    ctx.font = 'bold 34px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的高考分数时光机', W/2, 90);

    ctx.fillStyle = '#6B6478';
    ctx.font = '20px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(`${input.provinceName} · ${input.year}年 · ${input.score}分 · 全省第${(input.rank||0).toLocaleString()}名`, W/2, 124);

    // ---------- 中央卡片区 ----------
    const cardX = 80, cardY = 160, cardW = W - 160, cardH = 560;
    // 卡片底
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();
    // 卡片阴影边
    ctx.strokeStyle = tier.color;
    ctx.lineWidth = 4;
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.stroke();

    // ---------- 标签 emoji（大） ----------
    ctx.font = '140px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, W/2, cardY + 170);

    // ---------- 稀有度条 ----------
    ctx.font = 'bold 16px sans-serif';
    const rarityText = `${tier.stars} ${tier.name}`;
    const rarityW = ctx.measureText(rarityText).width + 32;
    ctx.fillStyle = tier.color;
    roundRect(ctx, W/2 - rarityW/2, cardY + 270, rarityW, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(rarityText, W/2, cardY + 286);

    // ---------- 标签名 ----------
    ctx.fillStyle = '#2D2438';
    ctx.font = 'bold 56px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(def.name, W/2, cardY + 350);

    // ---------- 副标题 ----------
    ctx.fillStyle = '#9C95A8';
    ctx.font = '18px sans-serif';
    wrapText(ctx, def.subtitle, W/2, cardY + 400, cardW - 80, 26);

    // ---------- 对比数据 ----------
    const dataY = cardY + 470;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#6B6478';
    ctx.fillText(`当年档次 → 2026等位分档次`, W/2, dataY);

    ctx.font = 'bold 28px sans-serif';
    const oldText = TIER_CN[result.oldTier] || result.oldTier || '—';
    const newText = TIER_CN[result.newTier] || result.newTier || '—';
    const arrow = result.tierDelta > 0 ? '↑' : result.tierDelta < 0 ? '↓' : '→';
    const deltaColor = result.tierDelta > 0 ? '#15803D' : result.tierDelta < 0 ? '#BE123C' : '#6B6478';
    ctx.fillStyle = deltaColor;
    ctx.fillText(`${oldText}  ${arrow}  ${newText}`, W/2, dataY + 40);

    // ---------- 等位分小字 ----------
    ctx.fillStyle = '#9C95A8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${input.score}分（第${(input.rank||0).toLocaleString()}名）→ 同位次2026约${result.equivalentScore2026||input.score}分`, W/2, dataY + 66);

    // ---------- 出现概率 ----------
    const isHidden = def.tier === 'hidden';
    const probPct = (result.appearanceProb * 100).toFixed(isHidden ? 2 : 1);
    ctx.fillStyle = '#9C95A8';
    ctx.font = '14px sans-serif';
    ctx.fillText(`出现概率 ${probPct}%`, W/2, dataY + 80);

    // ---------- 骚话（截断） ----------
    ctx.fillStyle = '#2D2438';
    ctx.font = 'bold 16px sans-serif';
    const talk = (result.trashTalk || '').slice(0, 40);
    wrapText(ctx, talk, W/2, dataY + 120, cardW - 100, 22);

    ctx.textBaseline = 'alphabetic';

    // ---------- 底部水印 ----------
    ctx.fillStyle = '#9C95A8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎨 表情包友情出演：星星布丁 · 捞鱼 · 周三涵', W/2, H - 60);
    ctx.fillStyle = '#C4A3FF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('@星星布丁 · 高考分数时光机', W/2, H - 32);

    // ---------- 挂载 ----------
    mountEl.innerHTML = '';
    canvas.style.maxWidth = '100%';
    canvas.style.borderRadius = '16px';
    canvas.style.boxShadow = '0 8px 24px rgba(155,107,255,0.2)';
    mountEl.appendChild(canvas);

    // 下载链接
    const dl = document.createElement('a');
    dl.textContent = '⬇️ 点这里下载图片';
    dl.href = canvas.toDataURL('image/png');
    dl.download = `高考时光机-${def.name}.png`;
    dl.style.cssText = 'display:inline-block;margin-top:12px;color:#9B6BFF;font-weight:700;text-decoration:underline';
    mountEl.appendChild(dl);
  }

  // ---------- 工具：圆角矩形 ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 工具：自动换行 ----------
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  return { generate };
})();

window.ShareCard = ShareCard;
