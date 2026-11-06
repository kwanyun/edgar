'use strict';

const data = window.EDGAR_DATA;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const players = [];

class Comparison {
  constructor(root, {autoplay = false} = {}) {
    this.root = root;
    this.autoplay = autoplay && !reducedMotion;
    this.playing = false;
    this.inView = true;
    this.ready = 0;
    this.generation = 0;
    this.root.innerHTML = `<div class="media-stage">
      <div class="video-pane before"><video muted playsinline preload="metadata" disablepictureinpicture aria-label="Original avatar before refinement"></video><span class="video-label">Before</span></div>
      <div class="video-pane after"><video muted playsinline preload="metadata" disablepictureinpicture aria-label="EDGAR-refined Gaussian avatar"></video><span class="video-label">EDGAR refined</span></div>
      <input class="reveal-input" type="range" min="0" max="100" step="1" value="50" aria-label="Before and after divider">
      <div class="reveal-line" aria-hidden="true"><span>↔</span></div>
    </div>
    <div class="comparison-controls"><button class="play-toggle" type="button" aria-label="Play synchronized videos" title="Play / pause">▶</button><input class="timeline" type="range" min="0" max="1" value="0" step="1" aria-label="Video frame"><output class="time-label">0.0 / 0.0 s</output><span class="sync-label">SYNCHRONIZED</span></div>
    <p class="loading-notice" role="status"></p>`;
    this.before = $('.before video', root);
    this.after = $('.after video', root);
    this.videos = [this.before, this.after];
    this.timeline = $('.timeline', root);
    this.playButton = $('.play-toggle', root);
    this.output = $('.time-label', root);
    this.notice = $('.loading-notice', root);
    this.playButton.addEventListener('click', () => this.playing ? this.pause() : this.play());
    this.timeline.addEventListener('input', () => { this.pause(); this.seek(Number(this.timeline.value) / this.view.fps); });
    $('.reveal-input', root).addEventListener('input', e => {
      root.style.setProperty('--reveal', `${e.target.value}%`);
      e.target.setAttribute('aria-valuetext', `${e.target.value}% original avatar, ${100 - e.target.value}% EDGAR`);
    });
    this.before.addEventListener('timeupdate', () => this.updateTime());
    this.before.addEventListener('ended', () => {
      if (this.playing) { this.seek(0); this.play(); }
    });
    this.videos.forEach(video => {
      video.muted = true;
      video.addEventListener('error', () => this.showNotice('The video could not be loaded. The paired preview images remain available.'));
    });
    const observer = new IntersectionObserver(entries => {
      this.inView = entries[0].isIntersecting;
      if (!this.inView) this.pause();
      else if (this.autoplay && this.ready === 2) { this.autoplay = false; this.play(); }
    }, {threshold: 0.15});
    observer.observe(root);
    players.push(this);
  }
  load(view) {
    this.pause();
    this.view = view;
    this.ready = 0;
    const generation = ++this.generation;
    this.playButton.disabled = true;
    this.notice.classList.remove('visible');
    this.timeline.max = view.frames - 1;
    this.timeline.value = Math.min(view.fps, view.frames - 1);
    this.root.dataset.view = view.id;
    this.videos.forEach((video, index) => {
      video.poster = index ? view.posterAfter : view.posterBefore;
      video.onloadedmetadata = () => {
        if (generation !== this.generation) return;
        video.currentTime = Math.min(1, Math.max(0, video.duration - 1 / view.fps));
        this.ready++;
        if (this.ready === 2) {
          this.playButton.disabled = false;
          this.updateTime();
          if (this.autoplay && this.inView) { this.autoplay = false; this.play(); }
        }
      };
      video.src = index ? view.after : view.before;
      video.load();
    });
    this.updateTime(1);
  }
  async play() {
    if (this.ready < 2) return;
    players.forEach(p => { if (p !== this) p.pause(); });
    if (this.before.ended || this.before.currentTime >= this.before.duration - .03) this.seek(0);
    if (Math.abs(this.after.currentTime - this.before.currentTime) > .015) this.after.currentTime = this.before.currentTime;
    this.playing = true;
    this.playButton.textContent = 'Ⅱ';
    this.playButton.setAttribute('aria-label', 'Pause synchronized videos');
    try {
      await Promise.all(this.videos.map(v => v.play()));
      if (!this.playing) { this.videos.forEach(v => v.pause()); return; }
      this.notice.classList.remove('visible');
      this.tick();
    } catch {
      this.pause();
      this.showNotice('Playback is unavailable in this browser. Use the frame slider to inspect the comparison.');
    }
  }
  pause() {
    this.playing = false;
    this.videos.forEach(v => v.pause());
    cancelAnimationFrame(this.animation);
    this.playButton.textContent = '▶';
    this.playButton.setAttribute('aria-label', 'Play synchronized videos');
  }
  tick() {
    cancelAnimationFrame(this.animation);
    if (!this.playing) return;
    const delta = this.after.currentTime - this.before.currentTime;
    if (Math.abs(delta) > Math.max(.06, 1.5 / this.view.fps) && !this.after.seeking) this.after.currentTime = this.before.currentTime;
    this.updateTime();
    this.animation = requestAnimationFrame(() => this.tick());
  }
  seek(time) {
    if (!this.view) return;
    const max = (this.view.frames - 1) / this.view.fps;
    const target = Math.min(Math.max(time, 0), max);
    this.videos.forEach(v => { if (v.readyState >= 1) v.currentTime = target; });
    this.updateTime(target);
  }
  updateTime(time = this.before.currentTime || 0) {
    if (!this.view) return;
    const frame = Math.min(this.view.frames - 1, Math.round(time * this.view.fps));
    this.timeline.value = frame;
    this.timeline.setAttribute('aria-valuetext', `Frame ${frame + 1} of ${this.view.frames}`);
    this.output.textContent = `${time.toFixed(1)} / ${(this.view.frames / this.view.fps).toFixed(1)} s`;
  }
  layout(mode) {
    this.root.classList.toggle('reveal', mode === 'reveal');
    $('.reveal-input', this.root).tabIndex = mode === 'reveal' ? 0 : -1;
  }
  showNotice(message) { this.notice.textContent = message; this.notice.classList.add('visible'); }
}

if (!data || !data.groups?.length) {
  $('#view-title').textContent = 'Comparison media is unavailable. Please use the manuscript below.';
} else {
  const hero = new Comparison($('#hero-player'), {autoplay: true});
  const main = new Comparison($('#main-player'));
  hero.load(data.groups.find(g => g.id === data.hero.group).views.find(v => v.id === data.hero.view));
  let activeGroup = data.groups[0];
  let activeView = activeGroup.views[0];
  const tabs = $('#pipeline-tabs');
  data.groups.forEach(group => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = group.label;
    button.dataset.group = group.id;
    button.addEventListener('click', () => selectGroup(group));
    tabs.append(button);
  });
  function selectGroup(group) {
    activeGroup = group;
    $$('button', tabs).forEach(button => button.setAttribute('aria-pressed', button.dataset.group === group.id));
    $('#pipeline-context').textContent = group.context;
    const options = $('#view-options');
    const rotating = group.id === 'cap4d';
    $('#view-options-heading').textContent = rotating ? 'ROTATING NOVEL VIEWS' : 'CHOOSE A VIEW';
    options.setAttribute('aria-label', rotating ? 'Rotating novel-view sample' : 'Camera view');
    options.replaceChildren();
    group.views.forEach(view => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'view-option';
      button.dataset.view = view.id;
      button.innerHTML = `<img src="${escapeHTML(view.thumbnail)}" alt="" loading="lazy" width="43" height="53"><span>${escapeHTML(view.label)}</span>`;
      button.addEventListener('click', () => selectView(view));
      options.append(button);
    });
    selectView(group.views[0]);
  }
  function selectView(view) {
    activeView = view;
    $$('.view-option').forEach(button => button.setAttribute('aria-pressed', button.dataset.view === view.id));
    $('#view-title').textContent = `${activeGroup.label} · ${view.label}`;
    $('#comparison-note').textContent = view.note;
    $('#show-reference').hidden = !view.reference;
    main.load(view);
  }
  selectGroup(activeGroup);
  $$('[data-layout]').forEach(button => button.addEventListener('click', () => {
    $$('[data-layout]').forEach(b => b.setAttribute('aria-pressed', b === button));
    main.layout(button.dataset.layout);
  }));
  $('#zoom-toggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', on);
    button.innerHTML = on ? 'Full frame <span aria-hidden="true">↙</span>' : 'Zoom detail <span aria-hidden="true">↗</span>';
    main.root.classList.toggle('zoomed', on);
  });
  $('#show-reference').addEventListener('click', () => openMedia('Recorded reference', activeView.reference, 'video', 'Same camera and motion as the comparison.'));
}

const metrics = {
  lpips: {name:'LPIPS',direction:'lower',description:'Perceptual distance · lower is better.',values:[[.2524,.2121],[.2661,.2050],[.1931,.1962]],note:'RGBAvatar and GaussianAvatars improve; CAP4D shows a small LPIPS trade-off.'},
  clip: {name:'CLIP',direction:'higher',description:'Image similarity · higher is better.',values:[[.8877,.9273],[.8407,.8977],[.9393,.9488]],note:'CLIP similarity improves across all three pipelines.'},
  psnr: {name:'PSNR',direction:'higher',description:'Reconstruction quality in dB · higher is better.',values:[[19.4950,21.5199],[18.5994,19.3206],[18.1435,18.1927]],note:'Compare before and after within each pipeline.'},
  l1: {name:'L1',direction:'lower',description:'Reconstruction error · lower is better.',values:[[.0552,.0364],[.0644,.0593],[.0537,.0534]],note:'Reconstruction error decreases across all three pipelines.'}
};
const pipelines = [['RGBAvatar','4 input videos'],['GaussianAvatars','10 input videos'],['CAP4D','4 input images']];
function showMetric(key) {
  const metric = metrics[key];
  $('#metric-description').textContent = metric.description;
  $('#metric-note').textContent = metric.note;
  $$('[data-metric]').forEach(button => button.setAttribute('aria-pressed', button.dataset.metric === key));
  const maximum = Math.max(...metric.values.flat()) * 1.08;
  $('#metric-rows').innerHTML = metric.values.map(([before, after], i) => {
    const change = (after - before) / before * 100;
    const improves = metric.direction === 'lower' ? change < 0 : change > 0;
    const deltaLabel = key === 'psnr' ? `${after >= before ? '+' : ''}${(after - before).toFixed(2)} dB PSNR` : key === 'clip' ? `${after >= before ? '+' : ''}${(after - before).toFixed(4)} CLIP` : `${Math.abs(change).toFixed(1)}% ${change < 0 ? 'lower' : 'higher'} ${metric.name}`;
    return `<article class="metric-row"><h4>${pipelines[i][0]}</h4><p class="setting">${pipelines[i][1]}</p>
      <div class="bar-line" aria-label="Before ${metric.name}: ${before.toFixed(4)}"><div class="bar-track" aria-hidden="true"><div class="bar" style="width:${before/maximum*100}%"></div></div><span>${before.toFixed(key === 'psnr' ? 2 : 4)}</span></div>
      <div class="bar-line" aria-label="EDGAR ${metric.name}: ${after.toFixed(4)}"><div class="bar-track" aria-hidden="true"><div class="bar after-bar" style="width:${after/maximum*100}%"></div></div><span>${after.toFixed(key === 'psnr' ? 2 : 4)}</span></div>
      <p class="metric-change ${improves ? '' : 'decline'}">${deltaLabel}${improves ? '' : ' · trade-off'}</p></article>`;
  }).join('');
}
$$('[data-metric]').forEach(button => button.addEventListener('click', () => showMetric(button.dataset.metric)));
showMetric('lpips');

const dialog = $('#media-dialog');
let dialogTrigger;
function openMedia(title, src, type, caption = '') {
  if (!src) return;
  dialogTrigger = document.activeElement;
  players.forEach(p => p.pause());
  $('#dialog-title').textContent = title;
  $('#dialog-caption').textContent = caption;
  const media = document.createElement(type === 'video' ? 'video' : 'img');
  media.src = src;
  if (type === 'video') { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
  else media.alt = title;
  $('#dialog-content').replaceChildren(media);
  dialog.showModal();
}
function closeDialog() { dialog.close(); }
$('#close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
dialog.addEventListener('close', () => {
  const video = $('video', dialog);
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  $('#dialog-content').replaceChildren();
  dialogTrigger?.focus();
});
$$('[data-figure]').forEach(button => button.addEventListener('click', () => openMedia(button.dataset.title, button.dataset.figure, 'image')));
$('#copy-citation').addEventListener('click', async () => {
  const text = $('#citation-text').textContent;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    $('#copy-status').textContent = 'Citation copied.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#citation-text'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    $('#copy-status').textContent = 'Citation selected. Press Ctrl+C or ⌘C to copy.';
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) players.forEach(player => player.pause()); });

// Keep unreleased resource links empty without reloading the current page.
