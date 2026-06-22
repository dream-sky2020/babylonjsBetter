import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCombatStore } from './store.ts';
import { UnitCard } from './editor/UnitCard.tsx';
import { UnitEditor } from './editor/UnitEditor.tsx';
import { SkillCard } from './editor/SkillCard.tsx';
import { SkillEditor } from './editor/SkillEditor.tsx';
import type { UnitConfig } from './types.ts';

// 假设这些全局函数已经存在或将通过 props 传递
declare global {
  interface Window {
    startClash: () => void;
    endTurn: () => void;
  }
}

export const App: React.FC = () => {
  // 使用 useShallow 确保只有当 ID 数组的内容真正变化时才触发重绘
  const leftUnitIds = useCombatStore(useShallow(state => state.leftUnits.map(u => u.id)));
  const rightUnitIds = useCombatStore(useShallow(state => state.rightUnits.map(u => u.id)));
  
  const selectedLeftUnitId = useCombatStore(state => state.selectedLeftUnitId);
  const selectedRightUnitId = useCombatStore(state => state.selectedRightUnitId);
  const logs = useCombatStore(state => state.logs);
  const addUnit = useCombatStore(state => state.addUnit);
  const addSkill = useCombatStore(state => state.addSkill);
  
  // 这里的选择器是稳定的，因为返回的是对象引用或 undefined
  const selectedLeftUnit = useCombatStore(state => state.leftUnits.find(u => u.id === selectedLeftUnitId));
  const selectedRightUnit = useCombatStore(state => state.rightUnits.find(u => u.id === selectedRightUnitId));

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAddUnit = (side: 'left' | 'right') => {
    const id = `${side === 'left' ? 'A' : 'B'}${Date.now()}`;
    const newUnit: UnitConfig = {
      id,
      name: '新单位',
      hp: 100,
      maxHp: 100,
      shield: 0,
      tempShield: 0,
      sanity: 45,
      maxSanity: 45,
      chaos: 0,
      chaosThreshold: 100,
      status: [],
      skills: [],
    };
    addUnit(side, newUnit);
  };

  return (
    <div className="main-layout" style={{ maxWidth: '1500px', margin: '0 auto', display: 'flex', gap: '20px', padding: '20px', alignItems: 'flex-start' }}>
      <aside
        style={{
          width: '300px',
          minWidth: '300px',
          background: '#1f2328',
          color: '#f8f9fa',
          borderRadius: '12px',
          padding: '15px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          position: 'sticky',
          top: '20px',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>战斗控制台</div>
        <button
          onClick={() => window.endTurn?.()}
          style={{ width: '100%', padding: '12px', cursor: 'pointer', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', background: '#fd7e14' }}
        >
          回合结束
        </button>
        <button
          onClick={() => window.startClash?.()}
          style={{ width: '100%', padding: '12px', cursor: 'pointer', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', background: '#28a745' }}
        >
          开启拼点
        </button>
        <div style={{ marginTop: '4px', fontWeight: 'bold', opacity: 0.9 }}>战斗日志</div>
        <div
          ref={logRef}
          style={{ flex: 1, minHeight: '300px', overflowY: 'auto', background: '#111418', color: '#9dff9d', padding: '12px', borderRadius: '8px', fontFamily: "'Courier New', monospace", fontSize: '13px', boxSizing: 'border-box' }}
        >
          {logs.length === 0 ? '系统就绪，等待指令...' : logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ textAlign: 'center', margin: '10px 0' }}>战斗逻辑调试模拟器 - React 版</h2>

        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: '#495057', background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.05)' }}>
          {selectedLeftUnitId && selectedRightUnitId
            ? `已选择: ${selectedLeftUnit?.name} vs ${selectedRightUnit?.name}`
            : '请从左右阵营各选择一个单位进行拼点'}
        </div>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'flex-start' }}>
          {/* 左侧阵营 */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', flex: 1, minWidth: '300px', borderTop: '5px solid #007bff' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #dee2e6' }}>左侧阵营 (Camp A)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto', padding: '5px' }}>
              {leftUnitIds.map(id => (
                <UnitCard key={id} side="left" unitId={id} />
              ))}
            </div>
            <button
              onClick={() => handleAddUnit('left')}
              style={{ width: '100%', padding: '8px', marginTop: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + 添加单位
            </button>
          </div>

          {/* 右侧阵营 */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', flex: 1, minWidth: '300px', borderTop: '5px solid #dc3545' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #dee2e6' }}>右侧阵营 (Camp B)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto', padding: '5px' }}>
              {rightUnitIds.map(id => (
                <UnitCard key={id} side="right" unitId={id} />
              ))}
            </div>
            <button
              onClick={() => handleAddUnit('right')}
              style={{ width: '100%', padding: '8px', marginTop: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + 添加单位
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', minHeight: '400px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee', color: '#495057' }}>左侧单位详情</div>
            {selectedLeftUnitId && (
              <UnitEditor side="left" unitId={selectedLeftUnitId} isSelected={true} />
            )}
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', minHeight: '400px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee', color: '#495057' }}>右侧单位详情</div>
            {selectedRightUnitId && (
              <UnitEditor side="right" unitId={selectedRightUnitId} isSelected={true} />
            )}
          </div>
        </div>

        {/* 技能部分 */}
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', flex: 1, minWidth: '300px', borderTop: '5px solid #007bff' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #dee2e6' }}>左侧出战技能</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto', padding: '5px' }}>
              {selectedLeftUnit?.skills.map((skill) => (
                <SkillCard
                  key={skill.skillId}
                  side="left"
                  unitId={selectedLeftUnit.id}
                  skillId={skill.skillId}
                />
              ))}
            </div>
            <button
              onClick={() => selectedLeftUnitId && addSkill('left', selectedLeftUnitId)}
              style={{ width: '100%', padding: '8px', marginTop: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + 添加左侧技能
            </button>
          </div>

          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', flex: 1, minWidth: '300px', borderTop: '5px solid #dc3545' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #dee2e6' }}>右侧出战技能</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto', padding: '5px' }}>
              {selectedRightUnit?.skills.map((skill) => (
                <SkillCard
                  key={skill.skillId}
                  side="right"
                  unitId={selectedRightUnit.id}
                  skillId={skill.skillId}
                />
              ))}
            </div>
            <button
              onClick={() => selectedRightUnitId && addSkill('right', selectedRightUnitId)}
              style={{ width: '100%', padding: '8px', marginTop: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + 添加右侧技能
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', minHeight: '400px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee', color: '#495057' }}>左侧技能详情</div>
            {selectedLeftUnitId && selectedLeftUnit?.activeSkillId && (
              <SkillEditor side="left" unitId={selectedLeftUnitId} skillId={selectedLeftUnit.activeSkillId} />
            )}
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', minHeight: '400px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee', color: '#495057' }}>右侧技能详情</div>
            {selectedRightUnitId && selectedRightUnit?.activeSkillId && (
              <SkillEditor side="right" unitId={selectedRightUnitId} skillId={selectedRightUnit.activeSkillId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
