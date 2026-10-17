import React, { useEffect, useRef } from 'react';
import { UnitTabs, SkillTabs } from './shared/CombatEntityTabs.tsx';
import { useCombatStore } from './store.ts';
import { UnitEditor } from './editor/UnitEditor.tsx';
import { SkillEditor } from './editor/SkillEditor.tsx';

// 假设这些全局函数已经存在或将通过 props 传递
declare global {
  interface Window {
    startClash: () => void;
    endTurn: () => void;
  }
}

export const App: React.FC = () => {
  const selectedLeftUnitId = useCombatStore(state => state.selectedLeftUnitId);
  const selectedRightUnitId = useCombatStore(state => state.selectedRightUnitId);
  const logs = useCombatStore(state => state.logs);
  
  // 这里的选择器是稳定的，因为返回的是对象引用或 undefined
  const selectedLeftUnit = useCombatStore(state => state.leftUnits.find(u => u.id === selectedLeftUnitId));
  const selectedRightUnit = useCombatStore(state => state.rightUnits.find(u => u.id === selectedRightUnitId));

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

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
        <a href="../../../index.html" style={{ color: '#9dcaff', fontSize: '13px' }}>← 返回 Lab 入口</a>
        <a href="./index.html" style={{ color: '#9dcaff', fontSize: '13px' }}>返回战斗试验台</a>
        <a href="./editor.html" style={{ color: '#9dcaff', fontSize: '13px' }}>Puck 界面编辑器 ↗</a>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Clash Lab · 战斗逻辑测试</div>
        <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#b9c2cc' }}>配置双方单位、技能和状态，观察拼点、伤害与回合结算。</div>
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
            <UnitTabs side="left" />
          </div>

          {/* 右侧阵营 */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', flex: 1, minWidth: '300px', borderTop: '5px solid #dc3545' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #dee2e6' }}>右侧阵营 (Camp B)</h3>
            <UnitTabs side="right" />
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
            <SkillTabs side="left" />
          </div>

          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', flex: 1, minWidth: '300px', borderTop: '5px solid #dc3545' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #dee2e6' }}>右侧出战技能</h3>
            <SkillTabs side="right" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', minHeight: '400px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee', color: '#495057' }}>左侧技能详情</div>
            {selectedLeftUnitId && selectedLeftUnit?.activeSkillId && (
              <SkillEditor key={selectedLeftUnit.activeSkillId} side="left" unitId={selectedLeftUnitId} skillId={selectedLeftUnit.activeSkillId} hideDelete />
            )}
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', minHeight: '400px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee', color: '#495057' }}>右侧技能详情</div>
            {selectedRightUnitId && selectedRightUnit?.activeSkillId && (
              <SkillEditor key={selectedRightUnit.activeSkillId} side="right" unitId={selectedRightUnitId} skillId={selectedRightUnit.activeSkillId} hideDelete />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
