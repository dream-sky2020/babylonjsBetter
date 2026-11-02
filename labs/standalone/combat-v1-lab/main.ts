import { getPhaseActors, type CombatCharacter } from '../../../core/combat_v1/index.ts';
import { sampleBattle, useDemoSkill, nextDemoPhase, stepNonAlly, skills } from './model.ts';
import './style.css';

let battle = sampleBattle();
let actorId = 'knight', targetId = 'boss', message = '战斗已开始。选择角色和目标，再下达指令。';
const app = document.querySelector<HTMLDivElement>('#app')!;
const names = (id: string) => battle.characters.find(value => value.id === id)?.name ?? id;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const phaseName = () => battle.phase === 'ally' ? '我方回合' : '非我方回合';
const outcomes = { victory: '战斗胜利！', defeat: '战斗失败', draw: '平局', escaped: '已撤离' };

function card(actor: CombatCharacter): string {
  const dead = actor.stats.hp <= 0;
  return `<button class="unit ${actor.id === targetId ? 'target' : ''} ${actor.id === actorId ? 'selected' : ''} ${dead ? 'dead' : ''}" data-unit="${actor.id}" aria-label="选择${actor.name}">
    <span class="portrait ${actor.faction}">${actor.faction === 'ally' ? '♟' : actor.faction === 'neutral' ? '♙' : '♜'}</span><span class="unit-body"><b>${actor.name}</b><small>${dead ? '无法行动' : `正常 ${actor.actions.normal}　额外 ${actor.actions.extra}`}</small><span class="bar"><i style="width:${actor.stats.hp / actor.stats.maxHp * 100}%"></i></span><span class="numbers">HP ${actor.stats.hp} / ${actor.stats.maxHp} <em>MP ${actor.stats.mp}</em></span></span></button>`;
}

function render(): void {
  const available = getPhaseActors(battle).filter(value => value.faction === 'ally');
  if (!available.some(value => value.id === actorId)) actorId = available[0]?.id ?? '';
  if (!battle.characters.some(value => value.id === targetId && value.stats.hp > 0)) targetId = battle.characters.find(value => value.faction === 'enemy' && value.stats.hp > 0)?.id ?? '';
  const actor = battle.characters.find(value => value.id === actorId);
  const manual = battle.status === 'active' && battle.phase === 'ally' && !!actor;
  const totalDamage = battle.records.reduce((sum, record) => sum + (record.type === 'damage' && record.source.userId ? record.hpDamage : 0), 0);
  const totalHealing = battle.records.reduce((sum, record) => sum + (record.type === 'healing' && record.source.userId ? record.hpRestored : 0), 0);
  app.innerHTML = `<main class="desktop"><div class="desktop-heading"><span class="desktop-icon">⚔</span><div><h1>战斗实验室</h1><p>Combat v1 · 回合制战斗演示</p></div><a href="../../../index.html">返回实验室 ↗</a></div>
    <section class="xp-window"><header class="titlebar"><b>▣　Combat v1 — 战斗控制台</b><span class="window-controls" aria-hidden="true">─　□　<span>×</span></span></header>
    <nav class="menubar"><button id="reset">新战斗 (N)</button><span>我方 / 非我方两阶段</span><span>手动指令模式</span></nav>
    <div class="toolbar"><div><span class="phase-light"></span><b>${battle.status === 'finished' ? outcomes[battle.result!.outcome] : phaseName()}</b><small>第 ${battle.round} 轮</small></div><div><button id="step" ${battle.phase !== 'nonAlly' || battle.status !== 'active' ? 'disabled' : ''}>非我方单步 ▶</button><button id="next" ${battle.status !== 'active' ? 'disabled' : ''}>${battle.phase === 'ally' ? '结束我方回合' : '结束非我方回合'} »</button></div></div>
    <div class="workspace"><aside><h2>我方队伍 <span>PARTY</span></h2>${battle.characters.filter(value => value.faction === 'ally').map(card).join('')}<div class="tip"><b>操作提示</b><p>点击我方卡片选择行动者，点击其他卡片选择目标。</p><p>治疗需要选择我方目标。振奋每场可获得一次额外行动。</p></div></aside>
    <section class="center"><div class="battlefield"><div class="field-caption">GREEN HILL / 训练场 <span>01</span></div><div class="hills"></div><div class="field-party"><span>♟<small>艾琳</small></span><span>♟<small>米洛</small></span><i>VS</i><span class="foe">♜<small>铁甲守卫</small></span><span class="foe">♟<small>史莱姆</small></span></div><div class="field-label">${battle.status === 'finished' ? outcomes[battle.result!.outcome] : phaseName()}</div></div>
    <div class="command-panel"><h2>下达指令 <span>COMMAND</span></h2><div class="selectors"><label>行动者<select id="actor" ${manual ? '' : 'disabled'}>${available.map(value => `<option value="${value.id}" ${value.id === actorId ? 'selected' : ''}>${value.name}</option>`).join('')}</select></label><label>目标<select id="target">${battle.characters.filter(value => value.stats.hp > 0).map(value => `<option value="${value.id}" ${value.id === targetId ? 'selected' : ''}>${value.name}</option>`).join('')}</select></label></div><div class="skills">${Object.values(skills).map(skill => {
      const limits = actor?.skills.find(value => value.skillId === skill.id)?.usageLimits.battle;
      const blocked = !manual || !!limits?.cooldown?.remaining || limits?.uses?.remaining === 0 || (limits?.cost.mp ?? 0) > (actor?.stats.mp ?? 0);
      return `<button data-skill="${skill.id}" ${blocked ? 'disabled' : ''}><b>${skill.name}</b><small>${skill.description}</small><span>${limits?.cooldown ? `冷却 ${limits.cooldown.remaining} / ${limits.cooldown.turns}　` : ''}${limits?.uses ? `剩余 ${limits.uses.remaining} 次` : '不限次数'}</span></button>`;
    }).join('')}</div></div></section>
    <aside><h2>敌人与中立 <span>OTHER</span></h2>${battle.characters.filter(value => value.faction !== 'ally').map(card).join('')}<div class="tip"><b>战斗统计</b><p>我方有效伤害 <strong>${totalDamage}</strong></p><p>我方有效治疗 <strong>${totalHealing}</strong></p><p>Boss 每阶段行动 2 次；旅人在非我方阶段自我治疗。</p></div></aside></div>
    <section class="log-panel"><h2>结算记录 <span>已提交 ${battle.records.length} 条</span></h2><div class="log-scroll"><table><thead><tr><th>轮 / 阶段</th><th>来源 → 目标</th><th>技能</th><th>结算</th></tr></thead><tbody>${battle.records.slice().reverse().map(record => `<tr><td>${record.round} / ${record.phase === 'ally' ? '我方' : '非我方'}</td><td>${names(record.source.actorId ?? '')} → ${names(record.targetId)}</td><td>${skills[record.source.definitionId]?.name ?? record.source.definitionId}</td><td class="${record.type}">${record.type === 'damage' ? `伤害 ${record.hpDamage}${record.overkill ? ` · 过量 ${record.overkill}` : ''}` : `治疗 ${record.hpRestored} · 过量 ${record.overheal}`}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">等待第一条战斗记录……</td></tr>'}</tbody></table></div></section>
    <footer class="statusbar" role="status">${escape(message)}</footer></section><footer class="taskbar"><span class="start">▦ 开始</span><span class="task">▣ 战斗控制台</span><span class="clock">COMBAT v1</span></footer></main>`;
  document.querySelector('#reset')!.addEventListener('click', () => { battle = sampleBattle(); actorId = 'knight'; targetId = 'boss'; message = '已开始新的战斗。'; render(); });
  document.querySelector('#next')!.addEventListener('click', () => act(() => { battle = nextDemoPhase(battle, true); message = `进入${phaseName()}，第 ${battle.round} 轮。`; }));
  document.querySelector('#step')!.addEventListener('click', () => act(() => { battle = stepNonAlly(battle); message = battle.phase === 'ally' ? '非我方行动结束，进入我方回合。' : '已执行一次非我方行动。'; }));
  document.querySelector('#actor')!.addEventListener('change', event => { actorId = (event.target as HTMLSelectElement).value; render(); });
  document.querySelector('#target')!.addEventListener('change', event => { targetId = (event.target as HTMLSelectElement).value; render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(button => button.addEventListener('click', () => { const id = button.dataset.unit!; if (available.some(value => value.id === id)) actorId = id; targetId = id; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(button => button.addEventListener('click', () => act(() => { const skill = button.dataset.skill!; battle = useDemoSkill(battle, actorId, skill === 'rally' ? actorId : targetId, skill); message = `${names(actorId)}使用了${skills[skill].name}。`; })));
}
function act(action: () => void): void { try { action(); if (battle.status === 'finished') message = outcomes[battle.result!.outcome]; } catch (error) { message = error instanceof Error ? error.message : String(error); } render(); }
render();
