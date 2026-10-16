import './style.css';

type Line = { speaker: string; role: string; text: string };
type Response = { text: string; next: string };
type Scene = { lines: Line[]; choices?: Response[]; quest: string; location?: string; ending?: boolean };
type Transcript = { speaker: string; text: string; player?: boolean };
type Save = { version: 1; scene: string; line: number; transcript: Transcript[]; turns: number };
const story: Record<string, Scene> = {
  gate: { quest: '寻找通往灯塔的路', lines: [{ speaker: '守门人 · 伊莱', role: '北城门值守', text: '又一个赶末班船的旅人。雾已经淹过堤岸，北边的灯塔却三夜没有亮了。\n告诉我，你为什么要在这个时候出城？' }], choices: [
    { text: '我要去灯塔。有人在那里等我。', next: 'lighthouse' },
    { text: '这座城发生了什么？', next: 'rumor' },
    { text: '我只是路过，想搭最后一班船。', next: 'ferry' },
  ] },
  rumor: { quest: '打听失明灯塔的传闻', lines: [
    { speaker: '守门人 · 伊莱', role: '北城门值守', text: '第三夜，灯塔熄灭。第二夜，海上再没有星星。昨夜，有人听见雾里传来了钟声。\n可我们的钟，二十年前就沉在海底了。' },
    { speaker: '守门人 · 伊莱', role: '北城门值守', text: '我在这里守了半辈子。不是每一个从北门出去的人，都能回来。\n如果你执意要去，我可以给你一枚旧钥匙。' },
  ], choices: [{ text: '接过钥匙，前往灯塔。', next: 'key' }, { text: '我需要一点时间。先去渡口。', next: 'ferry' }] },
  lighthouse: { quest: '取得灯塔钥匙', lines: [{ speaker: '守门人 · 伊莱', role: '北城门值守', text: '等你的人……是不是穿着一件蓝色的雨衣？\n她今天清晨来过。留下一枚钥匙，说会有一个记得星星的人来取。' }], choices: [{ text: '是她。把钥匙给我吧。', next: 'key' }, { text: '她还说了什么？', next: 'promise' }] },
  promise: { quest: '寻找失散的同伴', lines: [{ speaker: '守门人 · 伊莱', role: '北城门值守', text: '她说：“如果他来了，告诉他，约定不会因为灯熄灭就消失。”\n这句话我记了一整天。现在，它属于你了。' }], choices: [{ text: '收好钥匙。我们还有一个约定。', next: 'key' }, { text: '先去渡口找找她。', next: 'ferry' }] },
  key: { quest: '旧铜钥匙已获得 · 前往灯塔', lines: [
    { speaker: '守门人 · 伊莱', role: '北城门值守', text: '拿好。这是灯塔侧门的钥匙。铜已经旧了，但它还记得自己的锁。\n沿着石阶一直走，别回应雾里的声音。' },
    { speaker: '旅人 · 你', role: '远行者', text: '钥匙落入掌心，还带着一点温度。\n城门在身后缓缓打开。你终于看见，那条一直伸向海里的路。' },
  ], choices: [{ text: '走入雾中。', next: 'dawn' }, { text: '向守门人道谢。', next: 'thanks' }] },
  thanks: { quest: '旧铜钥匙已获得 · 前往灯塔', lines: [{ speaker: '守门人 · 伊莱', role: '北城门值守', text: '不用谢我。\n等灯亮起来的时候，让我也看一眼。' }], choices: [{ text: '我答应你。', next: 'dawn' }] },
  ferry: { quest: '前往旧渡口', location: '旧渡口 / OLD HARBOR', lines: [{ speaker: '守门人 · 伊莱', role: '北城门值守', text: '渡口在西边。船长会等到最后一声钟响。\n不过，旅人——有些路今晚可以绕过，明天却还是会回到你面前。' }], choices: [{ text: '去渡口，登上末班船。', next: 'departure' }, { text: '停下脚步。还是去灯塔吧。', next: 'lighthouse' }] },
  dawn: { quest: '序章完成 · 灯塔的约定', location: '灯塔石阶 / THE LIGHTHOUSE', ending: true, lines: [{ speaker: '雾港终端', role: '序章 · 完', text: '你向灯塔走去。脚下的石阶一节节亮起，仿佛有人在另一端，替你数着归途。\n\n未完待续。' }] },
  departure: { quest: '序章完成 · 另一条航路', location: '旧渡口 / OLD HARBOR', ending: true, lines: [{ speaker: '雾港终端', role: '序章 · 完', text: '最后一班渡船离开了雾港。你站在船尾，看见一束微弱的光，从遥远的北岸升起。\n\n也许，这仍然是一个开始。' }] },
};
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const saveKey = 'jrpg-terminal-dialogue:save:v1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let sceneId = 'gate', lineIndex = 0, turns = 1, transcript: Transcript[] = [];
let typing = false, selectedChoice = 0, auto = false, speed = reducedMotion ? 0 : 25;
let typeTimer: ReturnType<typeof setTimeout> | undefined, autoTimer: ReturnType<typeof setTimeout> | undefined;
let displayed = 0;
const scene = () => story[sceneId]!;
const line = () => scene().lines[lineIndex]!;
const dialogOpen = () => !!document.querySelector('dialog[open]');
const notify = (message: string) => { $('notice').textContent = message; };
const stopTimers = () => { clearTimeout(typeTimer); clearTimeout(autoTimer); };
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (auto && !typing && !dialogOpen() && lineIndex + 1 < scene().lines.length) autoTimer = setTimeout(advance, 1800);
}
function renderChoices() {
  const responses = lineIndex + 1 === scene().lines.length ? scene().choices ?? (scene().ending ? [{ text: '重新开始旅程。', next: 'gate' }] : []) : [];
  $('choices').replaceChildren();
  const container = document.querySelector<HTMLElement>('.responses')!;
  container.hidden = !responses.length;
  responses.forEach((response, index) => {
    const button = document.createElement('button'); button.className = `choice${index === selectedChoice ? ' active' : ''}`;
    button.disabled = typing; button.setAttribute('aria-label', response.text);
    const cursor = document.createElement('span'); cursor.className = 'choice-cursor'; cursor.textContent = '>';
    const number = document.createElement('span'); number.className = 'choice-index'; number.textContent = `[${index + 1}]`;
    const text = document.createElement('span'); text.textContent = response.text;
    const arrow = document.createElement('span'); arrow.className = 'choice-arrow'; arrow.textContent = '↵'; arrow.setAttribute('aria-hidden', 'true');
    button.append(cursor, number, text, arrow); button.onclick = () => choose(response); $('choices').append(button);
  });
}
function finishTyping() {
  clearTimeout(typeTimer); typing = false; $('dialogue-text').textContent = line().text;
  $('read-status').textContent = scene().ending ? '本段旅程已结束' : '接收完毕';
  const hasNext = lineIndex + 1 < scene().lines.length;
  $('advance').hidden = !hasNext; $('advance').innerHTML = '继续 <span>↵</span>';
  renderChoices(); notify(hasNext ? '按 Enter 继续' : '等待你的回应'); scheduleAuto();
}
function typeNext() {
  const characters = Array.from(line().text);
  if (displayed >= characters.length) { finishTyping(); return; }
  displayed++; $('dialogue-text').textContent = characters.slice(0, displayed).join('');
  typeTimer = setTimeout(typeNext, speed);
}
function render(record = true) {
  stopTimers(); selectedChoice = 0;
  $('speaker').textContent = line().speaker; $('speaker-role').textContent = line().role;
  $('quest-status').textContent = `任务：${scene().quest}`; $('location').textContent = scene().location ?? '北城门 / NORTH GATE';
  $('session-number').textContent = String(turns).padStart(3, '0');
  $('portrait-label').textContent = line().speaker.startsWith('守门') ? 'GATEKEEPER' : line().speaker.startsWith('旅人') ? 'TRAVELER' : 'TERMINAL';
  if (record) transcript.push({ speaker: line().speaker, text: line().text });
  $('dialogue-text').textContent = ''; displayed = 0; typing = speed > 0;
  $('read-status').textContent = '接收中…'; $('advance').hidden = false; $('advance').textContent = '显示全文 ↵';
  renderChoices(); if (typing) typeNext(); else finishTyping();
}
function advance() {
  if (typing) { finishTyping(); return; }
  if (lineIndex + 1 < scene().lines.length) { lineIndex++; render(); }
}
function choose(response: Response) {
  if (typing) return;
  if (response.next === 'gate' && scene().ending) { restart(); return; }
  transcript.push({ speaker: '你的回应', text: response.text, player: true });
  sceneId = response.next; lineIndex = 0; turns++; render();
}
function restart() { sceneId = 'gate'; lineIndex = 0; turns = 1; transcript = []; render(); notify('新的旅程已经开始'); }
function setAuto(value: boolean) { auto = value; $('auto').setAttribute('aria-pressed', String(auto)); $('auto').textContent = auto ? '[A] 停止自动' : '[A] 自动阅读'; scheduleAuto(); }
function openDialog(id: string) { clearTimeout(autoTimer); $(id) instanceof HTMLDialogElement && ($(id) as HTMLDialogElement).showModal(); }
function showHistory() {
  $('log-entries').replaceChildren();
  transcript.forEach(entry => { const item = document.createElement('li'); const speaker = document.createElement('strong'); speaker.textContent = entry.speaker; const text = document.createElement('span'); text.textContent = entry.text; if (entry.player) item.className = 'player-response'; item.append(speaker, text); $('log-entries').append(item); });
  openDialog('log-dialog');
}
function save() {
  try { localStorage.setItem(saveKey, JSON.stringify({ version: 1, scene: sceneId, line: lineIndex, transcript, turns } satisfies Save)); notify('存档完成 · 当前旅程已记录'); } catch { notify('浏览器无法保存存档'); }
}
function load() {
  try {
    const raw = localStorage.getItem(saveKey); if (!raw) { notify('没有存档 · 先按 S 记录旅程'); return; }
    const saved = JSON.parse(raw) as Save;
    if (saved.version !== 1 || !story[saved.scene] || !Number.isInteger(saved.line) || !story[saved.scene]!.lines[saved.line] || !Number.isInteger(saved.turns) || saved.turns < 1 || !Array.isArray(saved.transcript) || !saved.transcript.every(entry => entry && typeof entry.speaker === 'string' && typeof entry.text === 'string')) throw new Error('Invalid save');
    sceneId = saved.scene; lineIndex = saved.line; transcript = saved.transcript; turns = saved.turns; setAuto(false); render(false); notify('读档完成 · 欢迎回来');
  } catch { notify('存档无法读取，请重新存档'); }
}
function setTheme(theme: string) { document.body.dataset.theme = theme; $('phosphor-label').textContent = theme === 'amber' ? 'P3 AMBER' : 'P1 GREEN'; $('theme').setAttribute('value', theme); ($('theme') as HTMLSelectElement).value = theme; }
$('advance').onclick = advance; $('dialogue-text').onclick = () => { if (typing) finishTyping(); };
$('auto').onclick = () => setAuto(!auto); $('history').onclick = showHistory; $('save').onclick = save; $('load').onclick = load; $('restart').onclick = restart; $('settings').onclick = () => openDialog('settings-dialog');
$('phosphor').onclick = () => setTheme(document.body.dataset.theme === 'amber' ? 'green' : 'amber');
($('speed') as HTMLSelectElement).value = String(speed);
$('speed').onchange = event => { speed = Number((event.target as HTMLSelectElement).value); if (typing && speed === 0) finishTyping(); };
$('theme').onchange = event => setTheme((event.target as HTMLSelectElement).value);
$('scanlines').onchange = event => document.body.classList.toggle('no-scanlines', !(event.target as HTMLInputElement).checked);
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => { button.onclick = () => button.closest('dialog')?.close(); });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', scheduleAuto));
document.addEventListener('keydown', event => {
  if (dialogOpen() || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  if (key === 'a') setAuto(!auto); else if (key === 'l') showHistory(); else if (key === 's') save(); else if (key === 'r') load();
  else if (key === 'arrowup' || key === 'arrowdown') {
    const buttons = [...$('choices').querySelectorAll<HTMLButtonElement>('button')]; if (!buttons.length || typing) return;
    event.preventDefault(); selectedChoice = (selectedChoice + (key === 'arrowdown' ? 1 : -1) + buttons.length) % buttons.length; buttons.forEach((button, index) => button.classList.toggle('active', index === selectedChoice)); buttons[selectedChoice]?.focus();
  } else if (/^[1-9]$/.test(key) && !typing) { $('choices').querySelectorAll<HTMLButtonElement>('button')[Number(key) - 1]?.click(); }
  else if (key === 'enter' || key === ' ') {
    if (event.target instanceof HTMLButtonElement && !event.target.classList.contains('choice')) return;
    event.preventDefault(); if (typing) finishTyping(); else if (lineIndex + 1 < scene().lines.length) advance(); else $('choices').querySelectorAll<HTMLButtonElement>('button')[selectedChoice]?.click();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(autoTimer); else scheduleAuto(); });
render();
