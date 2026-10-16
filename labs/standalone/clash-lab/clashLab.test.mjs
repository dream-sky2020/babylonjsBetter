import assert from 'node:assert/strict';
import test from 'node:test';

test('standalone Clash Lab initializes and runs combat through its UI actions', async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  try {
    await import('./main.ts');
    const { useCombatStore } = await import('./store.ts');
    const state = useCombatStore.getState();
    assert.equal(state.leftUnits.length, 1);
    assert.equal(state.rightUnits.length, 1);
    assert.equal(state.selectedLeftUnitId, 'A1');
    assert.equal(state.selectedRightUnitId, 'B1');

    await t.test('fixed dice resolve shields before HP and publish combat logs', () => {
      for (const [side, id, roll] of [['left', 'A1', 10], ['right', 'B1', 1]]) {
        const unit = state.getUnit(id);
        const skills = unit.skills.map(skill => ({ ...skill, dice: [{ min: roll, max: roll, tags: ['slash'], effects: [] }], skillEffects: [] }));
        state.updateUnit(side, id, { skills, status: [], shield: side === 'right' ? 3 : 0, tempShield: side === 'right' ? 2 : 0 });
      }
      window.startClash();
      const target = state.getUnit('B1');
      assert.equal(target.tempShield, 0);
      assert.equal(target.shield, 0);
      assert.equal(target.hp, 195);
      assert.equal(state.getUnit('A1').hp, 250);
      assert.ok(useCombatStore.getState().logs.some(log => log.includes('5 点实际伤害')));
      assert.ok(!useCombatStore.getState().logs.some(log => log.includes('执行失败')));
    });

    await t.test('end turn consumes burn and advances the round', () => {
      state.updateUnit('right', 'B1', { status: [{ type: 'burn', power: 3, stack: 2 }] });
      window.endTurn();
      assert.equal(state.getUnit('B1').hp, 192);
      assert.equal(state.getUnit('B1').status.find(status => status.type === 'burn').stack, 1);
      assert.ok(useCombatStore.getState().logs.some(log => log.includes('进入第 2 回合')));
    });

    await t.test('missing skill is rejected before combat changes HP', () => {
      state.updateUnit('left', 'A1', { activeSkillId: 'missing-skill' });
      window.startClash();
      assert.equal(state.getUnit('B1').hp, 192);
      assert.ok(useCombatStore.getState().logs.at(-1).includes('请先为双方选择技能'));
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
