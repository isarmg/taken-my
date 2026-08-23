const startedAt = performance.now();
const arrivedAt = new Date();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const requestedLanguage = new URLSearchParams(location.search).get('lang');
const language = requestedLanguage === 'zh' || requestedLanguage === 'en'
  ? requestedLanguage
  : (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
const isChinese = language === 'zh';

const staticCopy = {
  en: {
    title: 'taken. — browser portrait',
    description: 'A browser privacy story, revealed from the data your browser shares.',
    series: 'A browser portrait · Vol. I',
    intro: 'You opened this page. It already knows the following.',
    reading: 'reading',
    fingerprintLabel: 'Reading browser information',
    observationsLabel: 'What your browser disclosed',
    readSources: 'Read the sources',
    tellSomeone: 'Tell someone',
    edition: 'A browser portrait · August 2026',
    credit: 'An independent study inspired by <a href="https://sinceyouarrived.world/taken" target="_blank" rel="noreferrer">Since You Arrived · Vol. IV</a>.',
    shareKicker: '— Tell Someone —',
    shareHeading: 'A page just described my device without asking a question.',
    copyLink: 'Copy link',
    copied: 'Copied',
    close: 'Close',
    sourcesKicker: '— A Note On What You Gave —',
    sourcesHeading: 'Sources & confessions',
    sourcesLede: 'Every observation was assembled in your browser from standard web APIs. Nothing is stored by this replica.',
    sourceBrowserTitle: 'Browser APIs',
    sourceBrowserCite: 'MDN Web Docs · Mozilla',
    sourceBrowserBody: 'Screen, language, preferences, storage estimates and graphics data are exposed through standard JavaScript APIs.',
    sourceFontTitle: 'Font fingerprinting',
    sourceFontCite: 'Electronic Frontier Foundation · Cover Your Tracks',
    sourceFontBody: 'Small differences in installed fonts can help distinguish one browser from another without a cookie.',
    sourceWebglTitle: 'WebGL fingerprinting',
    sourceWebglCite: 'MDN · WebGL API',
    sourceWebglBody: 'A graphics renderer string may reveal the GPU family or may show that the browser deliberately masked it.',
    sourceStorageTitle: 'What this page stores',
    sourceStorageCite: 'Nothing',
    sourceStorageBody: 'No cookies, localStorage, sessionStorage or analytics are used. Reloading starts the story again.',
    sourceOriginalTitle: 'The original work',
    sourceOriginalBody: 'This is a from-scratch educational recreation of its interaction language, with new structure and condensed copy.'
  },
  zh: {
    title: 'taken. — 浏览器画像',
    description: '一段由浏览器主动透露的信息所组成的隐私叙事。',
    series: '浏览器画像 · 第一卷',
    intro: '你打开了这个页面。它已经知道了这些。',
    reading: '正在读取',
    fingerprintLabel: '正在读取浏览器信息',
    observationsLabel: '你的浏览器所透露的信息',
    readSources: '阅读来源说明',
    tellSomeone: '告诉别人',
    edition: '浏览器画像 · 2026 年 8 月',
    credit: '这是一项独立研究，灵感来自 <a href="https://sinceyouarrived.world/taken" target="_blank" rel="noreferrer">Since You Arrived · 第四卷</a>。',
    shareKicker: '— 告诉别人 —',
    shareHeading: '一个页面没有问我任何问题，却描述出了我的设备。',
    copyLink: '复制链接',
    copied: '已复制',
    close: '关闭',
    sourcesKicker: '— 关于你所交出的信息 —',
    sourcesHeading: '来源与坦白',
    sourcesLede: '每一条观察都由你的浏览器通过标准 Web API 在本地生成。这个复刻版不会储存任何结果。',
    sourceBrowserTitle: '浏览器 API',
    sourceBrowserCite: 'MDN Web 文档 · Mozilla',
    sourceBrowserBody: '屏幕、语言、界面偏好、存储配额和图形信息，都可以通过标准 JavaScript API 获取。',
    sourceFontTitle: '字体指纹',
    sourceFontCite: '电子前哨基金会 · Cover Your Tracks',
    sourceFontBody: '设备中已安装字体的细微差异，可以在没有 Cookie 的情况下帮助区分不同浏览器。',
    sourceWebglTitle: 'WebGL 指纹',
    sourceWebglCite: 'MDN · WebGL API',
    sourceWebglBody: '图形渲染器字符串可能暴露 GPU 系列，也可能显示浏览器正在刻意隐藏它。',
    sourceStorageTitle: '这个页面储存了什么',
    sourceStorageCite: '什么都没有',
    sourceStorageBody: '不使用 Cookie、localStorage、sessionStorage 或分析服务。刷新页面后，故事会重新开始。',
    sourceOriginalTitle: '原始作品',
    sourceOriginalBody: '这是一次从零实现的教育性复刻，沿用了原作的交互语言，并采用新的代码结构与精简后的文案。'
  }
};

function applyLanguage() {
  const copy = staticCopy[language];
  document.documentElement.lang = isChinese ? 'zh-CN' : 'en';
  document.title = copy.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', copy.description);
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const translated = copy[element.dataset.i18n];
    if (translated) element.textContent = translated;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(element => {
    const translated = copy[element.dataset.i18nHtml];
    if (translated) element.innerHTML = translated;
  });
  const switcher = document.querySelector('#languageSwitch');
  switcher.textContent = isChinese ? 'EN' : '中文';
  switcher.setAttribute('aria-label', isChinese ? 'Switch to English' : '切换到中文');
  document.querySelector('.fingerprint')?.setAttribute('aria-label', copy.fingerprintLabel);
  document.querySelector('#observations')?.setAttribute('aria-label', copy.observationsLabel);
}

applyLanguage();

const state = {
  points: 0,
  scrollMax: 0,
  mouseMoves: 0,
  clicks: 0,
  tabSwitches: 0,
  tabLeftAt: null,
  rendered: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

$('#languageSwitch').addEventListener('click', () => {
  const next = isChinese ? 'en' : 'zh';
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  location.assign(url);
});

document.addEventListener('mousemove', () => state.mouseMoves++, { passive: true });
document.addEventListener('touchmove', () => state.mouseMoves++, { passive: true });
document.addEventListener('click', () => state.clicks++);
window.addEventListener('scroll', () => {
  const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  state.scrollMax = Math.max(state.scrollMax, Math.min(100, Math.round(scrollY / total * 100)));
}, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    state.tabSwitches++;
    state.tabLeftAt = performance.now();
    return;
  }
  if (!state.tabLeftAt) return;
  const seconds = ((performance.now() - state.tabLeftAt) / 1000).toFixed(1);
  const notice = $('#tabNotice');
  notice.textContent = isChinese
    ? `你离开了 ${seconds} 秒。你的浏览器告诉了我们。`
    : `You left for ${seconds} seconds. Your browser told us.`;
  notice.classList.add('visible');
  setTimeout(() => notice.classList.remove('visible'), 4000);
  state.tabLeftAt = null;
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function browserName(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'an unnamed browser';
}

function operatingSystem(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS|Macintosh/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'an unnamed operating system';
}

function graphicsRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return null;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    if (!extension) return 'masked by your browser';
    return gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
  } catch {
    return null;
  }
}

function installedFonts() {
  const candidates = ['Arial', 'Georgia', 'Courier New', 'Verdana', 'Trebuchet MS', 'Garamond', 'Palatino', 'Consolas', 'Menlo', 'Monaco'];
  const probe = document.createElement('span');
  probe.textContent = 'mmmmmmmmmwwwww';
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;visibility:hidden';
  document.body.appendChild(probe);
  probe.style.fontFamily = 'monospace';
  const baseline = probe.offsetWidth;
  const found = candidates.filter(font => {
    probe.style.fontFamily = `"${font}", monospace`;
    return probe.offsetWidth !== baseline;
  });
  probe.remove();
  return found;
}

async function batteryStatus() {
  try {
    if (!navigator.getBattery) return null;
    const battery = await navigator.getBattery();
    return { level: Math.round(battery.level * 100), charging: battery.charging };
  } catch {
    return null;
  }
}

async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { quota = 0 } = await navigator.storage.estimate();
    if (!quota) return null;
    const gigabytes = quota / 1024 / 1024 / 1024;
    return gigabytes >= 10 ? `${Math.round(gigabytes)} GB` : `${gigabytes.toFixed(1)} GB`;
  } catch {
    return null;
  }
}

async function collect() {
  const ua = navigator.userAgent;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown timezone';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const battery = await batteryStatus();
  const storage = await storageEstimate();
  const fonts = installedFonts();
  return {
    browser: browserName(ua),
    os: operatingSystem(ua),
    timezone,
    time: arrivedAt.toLocaleTimeString(isChinese ? 'zh-CN' : undefined, { hour: '2-digit', minute: '2-digit' }),
    screen: `${screen.width}×${screen.height}`,
    viewport: `${innerWidth}×${innerHeight}`,
    pixelRatio: devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    touchPoints: navigator.maxTouchPoints || 0,
    languages,
    darkMode: matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion,
    cookies: navigator.cookieEnabled,
    dnt: navigator.doNotTrack === '1',
    gpu: graphicsRenderer(),
    fonts,
    battery,
    storage,
    referrer: document.referrer ? new URL(document.referrer).hostname : null
  };
}

function makeObservations(data) {
  const observations = [];
  state.points = 0;
  const add = (label, datum, prose, points) => {
    observations.push({ label, datum, prose });
    state.points += points;
  };

  if (isChinese) {
    add(
      '你抵达的时间',
      `${data.time} · ${data.timezone.replaceAll('_', ' ')}`,
      '页面还没有完全显现，你的设备就已经报出了当地时间与时区。这些信息可以暗示你何时醒来、何时工作，以及何时在深夜仍然没有入睡。',
      2
    );

    add(
      '你带来的东西',
      `${data.browser} · ${data.os} · ${data.screen} @ ${data.pixelRatio}x · ${data.colorDepth} 位色深`,
      `你正在 ${data.os} 上使用 ${data.browser} 阅读。屏幕报告了 ${data.screen} 像素，而当前窗口占据 ${data.viewport}。${data.touchPoints ? `它还支持 ${data.touchPoints} 个同时触控点。` : '它没有报告触控输入。'}这些事实都不需要弹窗询问。`,
      7
    );

    if (data.gpu) {
      add(
        '渲染你眼前世界的东西',
        escapeHtml(data.gpu),
        'WebGL 暴露了图形渲染器字符串。它和屏幕尺寸、软件信息组合起来，可以帮助网站从许多设备中区分出这一台。',
        1
      );
    }

    add(
      '你所使用的语言',
      data.languages.map(escapeHtml).join(' · '),
      `你的浏览器携带了${data.languages.length === 1 ? '一种首选语言' : `${data.languages.length} 种按顺序排列的首选语言`}。语言的排列顺序可能透露你的地区、旅行经历、工作环境，以及这台设备是否与他人共用。`,
      data.languages.length
    );

    if (data.fonts.length) {
      add(
        '你随身携带的字体',
        data.fonts.map(escapeHtml).join(' · '),
        `在我们测试的一小组字体中，有 ${data.fonts.length} 种作出了回应。桌面设备中的字体会随着应用和创作工具不断累积，最终形成浏览器指纹的一部分。`,
        data.fonts.length
      );
    }

    if (data.battery) {
      add(
        '还剩下多少',
        `电量：${data.battery.level}% · ${data.battery.charging ? '正在充电' : '未充电'}`,
        '一些浏览器仍会暴露电池状态。不断变化的电量只在短时间内有效，但和其他数值组合后，仍可能帮助关联前后几次访问。',
        2
      );
    } else {
      add(
        '还剩下多少',
        '电量：浏览器没有透露',
        '你的浏览器没有暴露电池状态。隐藏信号能够改善隐私，但“选择隐藏”这件事本身，也可能缩小你所使用浏览器的范围。',
        1
      );
    }

    const preferenceParts = [
      data.cookies ? 'Cookie：已启用' : 'Cookie：已禁用',
      data.darkMode ? '深色模式' : '浅色模式',
      data.reducedMotion ? '减少动态效果' : '完整动态效果',
      data.dnt ? '已发送禁止追踪信号' : '未发送禁止追踪信号'
    ];
    if (data.storage) preferenceParts.push(`可用存储：${data.storage}`);
    add(
      '你所允许的事情',
      preferenceParts.join(' · '),
      '操作系统分享了你的界面偏好，浏览器则说明了这个站点可以储存多少内容。本页面只使用这些信息生成你正在看到的叙事，不会把任何内容写入持久化浏览器存储。',
      preferenceParts.length
    );

    if (data.referrer && !/localhost|127\.0\.0\.1/.test(data.referrer)) {
      add(
        '你之前所在的地方',
        escapeHtml(data.referrer),
        '来源地址告诉了我们是哪个网站把你带到这里。现代浏览器通常会隐去具体路径，但上一个站点的域名仍常常和你一起跨过门槛。',
        1
      );
    }

    return observations;
  }

  add(
    'When you arrived',
    `${data.time} · ${data.timezone.replaceAll('_', ' ')}`,
    'Your device named its local time and timezone before the page finished appearing. That can suggest when you wake, when you work and when you are awake later than usual.',
    2
  );

  add(
    'What you brought with you',
    `${data.browser} · ${data.os} · ${data.screen} @ ${data.pixelRatio}x · ${data.colorDepth}-bit color`,
    `You are reading in ${data.browser} on ${data.os}. Your screen reported ${data.screen} pixels while this window occupies ${data.viewport}. ${data.touchPoints ? `It also accepts ${data.touchPoints} simultaneous touch points.` : 'It reports no touch input.'} None of these facts required a prompt.`,
    7
  );

  if (data.gpu) {
    add(
      'What renders your world',
      escapeHtml(data.gpu),
      'WebGL exposed a graphics renderer string. Combined with screen size and software details, it can help separate this device from a crowd of others.',
      1
    );
  }

  add(
    'What you speak',
    data.languages.map(escapeHtml).join(' · '),
    `Your browser carries ${data.languages.length === 1 ? 'one preferred language' : `${data.languages.length} preferred languages`}. Language order can reveal region, travel, work and the people with whom a device is shared.`,
    data.languages.length
  );

  if (data.fonts.length) {
    add(
      'What you carry',
      data.fonts.map(escapeHtml).join(' · '),
      `Of a small list we tested, ${data.fonts.length} typefaces answered. A font list changes as apps and creative tools accumulate; on desktop, that combination can become part of a fingerprint.`,
      data.fonts.length
    );
  }

  if (data.battery) {
    add(
      'How much is left',
      `Battery: ${data.battery.level}% · ${data.battery.charging ? 'charging' : 'not charging'}`,
      'Some browsers still expose battery status. A changing percentage is short-lived, but paired with other values it can help correlate visits for a while.',
      2
    );
  } else {
    add(
      'How much is left',
      'Battery: kept back',
      'Your browser did not expose battery status. Hiding a signal improves privacy, though the choice to hide it can itself narrow down which browser you use.',
      1
    );
  }

  const preferenceParts = [
    data.cookies ? 'Cookies: enabled' : 'Cookies: disabled',
    data.darkMode ? 'Dark mode' : 'Light mode',
    data.reducedMotion ? 'Reduced motion' : 'Full motion',
    data.dnt ? 'Do Not Track' : 'No Do Not Track signal'
  ];
  if (data.storage) preferenceParts.push(`Storage offered: ${data.storage}`);
  add(
    'What you allow',
    preferenceParts.join(' · '),
    `The operating system shared interface preferences and the browser described what this origin could store. This page uses that information only to render what you see. It writes nothing to persistent browser storage.`,
    preferenceParts.length
  );

  if (data.referrer && !/localhost|127\.0\.0\.1/.test(data.referrer)) {
    add(
      'Where you were before',
      escapeHtml(data.referrer),
      'The referrer header identified the site that led you here. Modern browsers usually trim the exact path, but the previous origin often still crosses the doorway with you.',
      1
    );
  }

  return observations;
}

function renderObservations(observations) {
  $('#observations').innerHTML = observations.map((item, index) => `
    ${index ? `<div class="divider" data-index="${index}"></div>` : ''}
    <article class="observation" data-index="${index}">
      <h2>${item.label}</h2>
      <p class="datum">${item.datum}</p>
      <p class="prose">${item.prose}</p>
    </article>
  `).join('');
}

function createTick(element) {
  const tick = document.createElement('i');
  tick.className = 'dossier-tick';
  tick.style.top = `${element.getBoundingClientRect().top + scrollY + 14}px`;
  document.body.appendChild(tick);
  requestAnimationFrame(() => tick.classList.add('visible'));
}

function hashBars(seed) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: 16 }, (_, index) => {
    hash ^= index + 1;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return 7 + (Math.abs(hash) % 26);
  });
}

function animateNumber(element, target) {
  if (reducedMotion) {
    element.textContent = target;
    return;
  }
  const began = performance.now();
  const frame = now => {
    const amount = Math.min(1, (now - began) / 1300);
    element.textContent = Math.round(target * (1 - Math.pow(1 - amount, 3)));
    if (amount < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function renderClosing(data) {
  const seed = [data.browser, data.os, data.screen, data.timezone, data.languages.join(','), data.gpu].join('|');
  const closingCopy = isChinese ? {
    barcodeLabel: '由这台浏览器生成的条形码',
    dataPoints: '数据点',
    tallyMeta: '0 个问题 &nbsp;·&nbsp; 本页面储存 0 字节',
    thesis: '你访问的每个页面，都能知道某种版本的这些信息。<br />多数页面只是保持沉默。<br />这个页面选择把过程展示给你。',
    oneMore: '还有一件事',
    stillHere: '你还在这里。',
    final: '你没有留下姓名，也没有填写表单。<br />你的浏览器仍然画出了一幅画像。<br /><br />',
    finalTag: '看看是什么与你一同抵达。'
  } : {
    barcodeLabel: 'A barcode derived from this browser',
    dataPoints: 'data points',
    tallyMeta: '0 questions asked &nbsp;·&nbsp; 0 bytes stored by this page',
    thesis: 'Every page you visit can learn some version of this.<br />Most learn quietly.<br />This one chose to show its work.',
    oneMore: 'And one more thing',
    stillHere: 'You are still here.',
    final: 'You gave no name. You filled in no form.<br />Your browser still drew a portrait.<br /><br />',
    finalTag: 'Look at what arrives with you.'
  };
  $('#closing').innerHTML = `
    <div class="closing-block tally">
      <div class="tally-number" id="tallyNumber">0</div>
      <div class="barcode" role="img" aria-label="${closingCopy.barcodeLabel}">${hashBars(seed).map(height => `<i style="height:${height}px"></i>`).join('')}</div>
      <div class="tally-label">${closingCopy.dataPoints}</div>
      <div class="tally-meta">${closingCopy.tallyMeta}</div>
    </div>
    <div class="closing-block thesis">
      ${closingCopy.thesis}
    </div>
    <div class="closing-block behavior" id="behaviorBlock">
      <span class="closing-label">${closingCopy.oneMore}</span>
      <span class="datum">${closingCopy.stillHere}</span>
      <span id="behaviorText"></span>
    </div>
    <div class="closing-block final-statement" id="finalBlock">
      ${closingCopy.final}
      <span class="final-tag">${closingCopy.finalTag}</span>
    </div>
  `;
}

function populateBehavior() {
  const seconds = Math.round((performance.now() - startedAt) / 1000);
  $('#behaviorText').textContent = isChinese
    ? `在 ${seconds} 秒里，你滚动了页面的 ${state.scrollMax}%，移动指针 ${state.mouseMoves.toLocaleString('zh-CN')} 次，点击 ${state.clicks} 次，并离开标签页 ${state.tabSwitches} 次。这些信号只停留在当前页面中，关闭后便会消失。`
    : `In ${seconds} seconds you scrolled ${state.scrollMax}% of the page, moved a pointer ${state.mouseMoves.toLocaleString()} times, clicked ${state.clicks} times and left the tab ${state.tabSwitches} times. These signals stayed in this page and disappear when you close it.`;
}

function runChoreography(observations, data) {
  const base = reducedMotion ? 50 : 4300;
  const gap = reducedMotion ? 20 : 1550;
  setTimeout(() => $('#scanning').classList.add('done'), Math.max(0, base - 300));
  const elements = $$('.observation');
  elements.forEach((element, index) => {
    setTimeout(() => {
      element.classList.add('visible');
      $(`.divider[data-index="${index}"]`)?.classList.add('visible');
      $('#dossierRule').style.height = `${Math.round((index + 1) / elements.length * 100)}vh`;
      createTick(element);
    }, base + index * gap);
  });

  setTimeout(() => {
    $('#liveCounter').classList.add('visible');
  }, base + Math.min(2, elements.length - 1) * gap);

  const climax = base + observations.length * gap + (reducedMotion ? 20 : 800);
  renderClosing(data);
  $$('.closing-block').forEach((block, index) => {
    setTimeout(() => {
      block.classList.add('visible');
      if (index === 0) animateNumber($('#tallyNumber'), state.points);
      if (block.id === 'behaviorBlock') populateBehavior();
    }, climax + index * (reducedMotion ? 20 : 1450));
  });
  setTimeout(() => {
    $('#footer').classList.add('visible');
    $('#liveCounter').classList.remove('visible');
    state.rendered = true;
  }, climax + 4 * (reducedMotion ? 20 : 1450));
}

setInterval(() => {
  const elapsed = Math.round((performance.now() - startedAt) / 1000);
  $('#liveCounter').innerHTML = isChinese
    ? `<span>${state.points}</span> 个数据点 &nbsp;·&nbsp; 已停留 <span>${elapsed} 秒</span> &nbsp;·&nbsp; 已读 <span>${state.scrollMax}%</span>`
    : `<span>${state.points}</span> data points &nbsp;·&nbsp; <span>${elapsed}s</span> here &nbsp;·&nbsp; <span>${state.scrollMax}%</span> read`;
}, 500);

function openModal(name) {
  const modal = name === 'share' ? $('#shareModal') : $('#sourcesModal');
  if (name === 'share') {
    $('#shareTally').textContent = isChinese
      ? `${state.points} 个浏览器数据点 · 0 个问题`
      : `${state.points} browser data points · 0 questions asked`;
  }
  modal.showModal();
}

$$('[data-open]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openModal(link.dataset.open);
}));

$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));

$$('[data-share]').forEach(button => button.addEventListener('click', async () => {
  const url = location.href;
  const text = isChinese
    ? '一个页面没有问我任何问题，却描述出了我的设备。'
    : 'A page just described my device without asking a question.';
  const destinations = {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    bluesky: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  };
  if (button.dataset.share === 'copy') {
    await navigator.clipboard.writeText(url);
    button.textContent = staticCopy[language].copied;
    setTimeout(() => button.textContent = staticCopy[language].copyLink, 1800);
    return;
  }
  open(destinations[button.dataset.share], '_blank', 'noopener,noreferrer');
}));

collect().then(data => {
  const observations = makeObservations(data);
  renderObservations(observations);
  runChoreography(observations, data);
}).catch(() => {
  $('#scanning').innerHTML = isChinese
    ? '<p>无法读取这个浏览器。这是个不同寻常的好消息。</p>'
    : '<p>Unable to read this browser. That is unusually good news.</p>';
});
