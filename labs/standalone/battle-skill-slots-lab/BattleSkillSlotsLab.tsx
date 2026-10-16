import React, { useMemo, useState } from 'react';
import { BattleSkillSlotsPanel, type BattleDebuff, type BattleSkillSlotData } from '@/core/ui';

type RoleId = 'self' | 'ally-a' | 'ally-b';

type SlotState = {
  id: RoleId;
  roleName: string;
  skillName: string;
  charge: number;
  chargeMax: number;
  isTeammate: boolean;
  hpCurrent?: number;
  hpMax?: number;
  negativeStatuses: BattleDebuff[];
};

const DEBUFF_POOL: Array<{ id: string; label: string; duration: number }> = [
  { id: 'poison', label: '中毒', duration: 8 },
  { id: 'burn', label: '灼烧', duration: 6 },
  { id: 'slow', label: '减速', duration: 5 },
  { id: 'silence', label: '沉默', duration: 4 },
  { id: 'bleed', label: '流血', duration: 7 }
];

const DEFAULT_SLOTS: SlotState[] = [
  {
    id: 'self',
    roleName: '自己',
    skillName: '烈空斩',
    charge: 70,
    chargeMax: 100,
    isTeammate: false,
    negativeStatuses: []
  },
  {
    id: 'ally-a',
    roleName: '队友A',
    skillName: '救援脉冲',
    charge: 88,
    chargeMax: 100,
    isTeammate: true,
    hpCurrent: 860,
    hpMax: 1200,
    negativeStatuses: [{ id: 'poison', name: '中毒', stacks: 2, remainingSec: 8 }]
  },
  {
    id: 'ally-b',
    roleName: '队友B',
    skillName: '重锤冲锋',
    charge: 40,
    chargeMax: 100,
    isTeammate: true,
    hpCurrent: 1130,
    hpMax: 1400,
    negativeStatuses: [{ id: 'slow', name: '减速', remainingSec: 5 }]
  }
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const statusExists = (list: BattleDebuff[], id: string): boolean => list.some((item) => item.id === id);

export const BattleSkillSlotsLab: React.FC = () => {
  const [slots, setSlots] = useState<SlotState[]>(DEFAULT_SLOTS);
  const [activeId, setActiveId] = useState<RoleId>('self');
  const [waveExpand, setWaveExpand] = useState(68);
  const [lineWidth, setLineWidth] = useState(2.1);
  const [showGlow, setShowGlow] = useState(false);
  const [themeColor, setThemeColor] = useState('#4ade80');
  const [eventLog, setEventLog] = useState<string[]>(['已启动战斗槽位实验室']);

  const activeSlot = useMemo(
    () => slots.find((item) => item.id === activeId) ?? slots[0],
    [activeId, slots]
  );

  const appendLog = (text: string) => {
    setEventLog((prev) => [text, ...prev].slice(0, 10));
  };

  const patchSlot = (id: RoleId, updater: (slot: SlotState) => SlotState) => {
    setSlots((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleUseSkill = (slotId: string) => {
    patchSlot(slotId as RoleId, (slot) => ({ ...slot, charge: 0 }));
    appendLog(`${slotId} 释放了技能`);
  };

  const fillCharge = (id: RoleId, value: number) => {
    patchSlot(id, (slot) => ({ ...slot, charge: clamp(value, 0, slot.chargeMax) }));
  };

  const adjustHp = (id: RoleId, value: number) => {
    patchSlot(id, (slot) => {
      if (!slot.isTeammate) return slot;
      const hpMax = Math.max(1, slot.hpMax ?? 1);
      return { ...slot, hpCurrent: clamp(value, 0, hpMax) };
    });
  };

  const toggleDebuff = (id: RoleId, debuffId: string) => {
    patchSlot(id, (slot) => {
      const spec = DEBUFF_POOL.find((item) => item.id === debuffId);
      if (!spec) return slot;
      const exists = slot.negativeStatuses.some((item) => item.id === debuffId);
      const next = exists
        ? slot.negativeStatuses.filter((item) => item.id !== debuffId)
        : [
            ...slot.negativeStatuses,
            { id: spec.id, name: spec.label, stacks: 1, remainingSec: spec.duration }
          ];
      return { ...slot, negativeStatuses: next };
    });
  };

  const slotViewData: BattleSkillSlotData[] = slots;
  const activeChargePercent = Math.round((activeSlot.charge / Math.max(1, activeSlot.chargeMax)) * 100);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#020604',
        color: '#d1fae5',
        fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        overflow: 'hidden'
      }}
    >
      <aside
        style={{
          borderRight: '1px solid rgba(74, 222, 128, 0.25)',
          padding: 16,
          overflowY: 'auto',
          background: 'rgba(8, 18, 13, 0.92)',
          display: 'grid',
          alignContent: 'start',
          gap: 10
        }}
      >
        <h3 style={{ margin: 0, color: '#4ade80' }}>战斗槽位 UI Lab</h3>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          基于 `OscilloscopeWrapper` 的技能槽位联调：充能遮罩、释放技能、队友血量、负面状态。
        </div>

        <label>
          当前编辑槽位
          <select
            value={activeId}
            onChange={(event) => setActiveId(event.target.value as RoleId)}
            style={{ width: '100%', marginTop: 4 }}
          >
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.roleName}（{slot.skillName}）
              </option>
            ))}
          </select>
        </label>

        <label>
          充能 {activeChargePercent}%
          <input
            type="range"
            min={0}
            max={activeSlot.chargeMax}
            step={1}
            value={activeSlot.charge}
            onChange={(event) => fillCharge(activeSlot.id, Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              fillCharge(activeSlot.id, activeSlot.chargeMax);
              appendLog(`${activeSlot.roleName} 充能拉满`);
            }}
          >
            充能拉满
          </button>
          <button
            type="button"
            onClick={() => {
              fillCharge(activeSlot.id, 0);
              appendLog(`${activeSlot.roleName} 充能清空`);
            }}
          >
            清空充能
          </button>
        </div>

        {activeSlot.isTeammate ? (
          <>
            <label>
              队友血量 {activeSlot.hpCurrent ?? 0} / {activeSlot.hpMax ?? 0}
              <input
                type="range"
                min={0}
                max={activeSlot.hpMax ?? 1}
                step={1}
                value={activeSlot.hpCurrent ?? 0}
                onChange={(event) => adjustHp(activeSlot.id, Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </label>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12 }}>负面状态</div>
              {DEBUFF_POOL.map((debuff) => {
                const exists = statusExists(activeSlot.negativeStatuses, debuff.id);
                return (
                  <label key={debuff.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={exists}
                      onChange={() => {
                        toggleDebuff(activeSlot.id, debuff.id);
                        appendLog(`${activeSlot.roleName} ${exists ? '移除' : '添加'} ${debuff.label}`);
                      }}
                    />
                    {debuff.label}
                  </label>
                );
              })}
            </div>
          </>
        ) : null}

        <hr style={{ borderColor: 'rgba(74, 222, 128, 0.2)', width: '100%' }} />

        <label>
          波纹扩展 {waveExpand}px
          <input
            type="range"
            min={24}
            max={120}
            step={1}
            value={waveExpand}
            onChange={(event) => setWaveExpand(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          线宽 {lineWidth.toFixed(1)}
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={lineWidth}
            onChange={(event) => setLineWidth(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          边框主题色
          <input
            type="color"
            value={themeColor}
            onChange={(event) => setThemeColor(event.target.value)}
            style={{ marginTop: 4, width: '100%', height: 34 }}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={showGlow}
            onChange={(event) => setShowGlow(event.target.checked)}
          />
          启用轮廓发光
        </label>

        <div
          style={{
            marginTop: 4,
            border: '1px solid rgba(74, 222, 128, 0.25)',
            borderRadius: 8,
            padding: 8,
            background: 'rgba(3, 10, 7, 0.64)'
          }}
        >
          <div style={{ fontSize: 12, color: '#86efac', marginBottom: 6 }}>战斗事件日志</div>
          <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            {eventLog.map((text, idx) => (
              <div key={`${text}-${idx}`}>{text}</div>
            ))}
          </div>
        </div>
      </aside>

      <main
        style={{
          minWidth: 0,
          minHeight: 0,
          padding: 24,
          overflowY: 'auto'
        }}
      >
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <BattleSkillSlotsPanel
            slots={slotViewData}
            onUseSkill={handleUseSkill}
            waveExpand={waveExpand}
            wrapperConfig={{
              colorTheme: themeColor,
              lineWidth,
              enableLineGlow: showGlow,
              clearFillAlpha: 0.24
            }}
          />
        </div>
      </main>
    </div>
  );
};
