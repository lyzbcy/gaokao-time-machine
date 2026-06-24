/* ===========================================================
 * mascot.js — 星星布丁吉祥物（右下角悬浮，全流程互动）
 *
 * 状态机驱动表情切换：
 *   idle(冒泡) → idle2(呆萌/打哈欠，闲置>5s) → peek(填表探头)
 *   spin(开盒) → happy(升档庆祝)/cry(掉档安慰) → angry(校验失败)
 * 点击吉祥物 → 随机反击（打你/生气/呵呵）
 * =========================================================== */

const Mascot = (function () {

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PREFIX = 'img/anim/';

  // 状态 → GIF + 台词
  const STATES = {
    idle:    { gif: 'idle-bubble.gif', lines: ['陪我一起开盒吧～', '点点我呀 ✨'] },
    idle2:   { gif: 'idle-yawn.gif',   lines: ['哈～等你好久了', '发呆中…', '你怎么还不填？'] },
    peek:    { gif: 'peek.gif',        lines: ['让我看看你填啥 👀', '选啥呢？', '嗯嗯听着呢'] },
    spin:    { gif: 'spin.gif',        lines: ['开盒啦！', '见证奇迹 ✨', '冲冲冲！'] },
    happy:   { gif: 'happy.gif',       lines: ['哇哦好运！', '恭喜恭喜 🎉', '赚翻了！'] },
    cry:     { gif: 'cry.gif',         lines: ['摸摸你…', '别难过啦', '时代变了嘛'] },
    angry:   { gif: 'angry.gif',       lines: ['填错啦！', '认真点嘛 😤', '这个不对哦'] },
  };

  // 点击随机反击
  const TAP_REACTIONS = [
    { gif: 'hit.gif',   line: '别戳我！👊' },
    { gif: 'mad.gif',   line: '生气了！💢' },
    { gif: 'hehe.gif',  line: '呵呵～' },
    { gif: 'happy.gif', line: '嘿嘿被你发现啦' },
  ];

  let currentState = 'idle';
  let idleTimer = null;
  let tapIndex = 0;
  let bubbleTimer = null;

  function init() {
    const mascot = document.getElementById('mascot');
    if (!mascot) return;
    mascot.addEventListener('click', onTap);
    setState('idle');
    resetIdleTimer();
  }

  function setState(state, opts = {}) {
    if (!STATES[state] && state !== 'tap') return;
    currentState = state;
    const img = document.getElementById('mascotImg');
    if (!img) return;

    if (state === 'tap') {
      const r = opts.reaction || TAP_REACTIONS[tapIndex % TAP_REACTIONS.length];
      tapIndex++;
      img.src = PREFIX + r.gif;
      showBubble(r.line, 1800);
      // 反击后回到上一个状态
      setTimeout(() => setState(currentState === 'tap' ? 'idle' : currentState), 1900);
      return;
    }

    const s = STATES[state];
    img.src = PREFIX + s.gif;

    // 显示台词（除非 silent）
    if (!opts.silent) {
      const line = s.lines[Math.floor(Math.random() * s.lines.length)];
      showBubble(line, 2500);
    }
    resetIdleTimer();
  }

  function onTap() {
    setState('tap');
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (REDUCE) return;
    idleTimer = setTimeout(() => {
      // 闲置 6s 后切到 idle2（除非正在 spin/happy/cry/angry）
      if (['idle', 'peek'].includes(currentState)) {
        setState('idle2');
      }
    }, 6000);
  }

  function showBubble(text, duration) {
    const b = document.getElementById('mascotBubble');
    if (!b) return;
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove('show'), duration);
  }

  // 临时状态（自动回到 idle）
  function flash(state, duration = 2500) {
    setState(state);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setState('idle'), duration);
  }

  return { init, setState, flash };
})();

window.Mascot = Mascot;
