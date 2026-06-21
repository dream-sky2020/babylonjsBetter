// ui-manager.ts
import type { SkillData, UnitConfig } from './types.ts';
import './editor/unit-card.ts';
import './editor/skill-card.ts';
import './editor/skill-editor.ts';

type CampSide = 'left' | 'right';

type SkillEditorElement = HTMLElement & {
  setSkillId: (id: string) => void;
  getSkillId: () => string;
  setValues: (data: Partial<SkillData>) => void;
  getData: () => SkillData;
};

type SkillCardElement = HTMLElement & {
  setData: (data: Partial<SkillData>) => void;
};

type UICallbacks = {
  log: (msg: string) => void;
};

export class ClashUIManager {
  private readonly selectedUnits: Record<CampSide, UnitInputElement | null> = {
    left: null,
    right: null,
  };

  private readonly selectedSkillIds: Record<CampSide, string | null> = {
    left: null,
    right: null,
  };

  private readonly activeSkillEditors: Record<CampSide, SkillEditorElement | null> = {
    left: null,
    right: null,
  };

  private readonly callbacks: UICallbacks;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
  }

  public bindGlobalEvents(): void {
    document.getElementById('add-unit-left')?.addEventListener('click', () => this.addUnit('left'));
    document.getElementById('add-unit-right')?.addEventListener('click', () => this.addUnit('right'));
    document.getElementById('add-skill-left')?.addEventListener('click', () => this.addSkill('left'));
    document.getElementById('add-skill-right')?.addEventListener('click', () => this.addSkill('right'));
  }

  public getSelectedUnit(camp: CampSide): UnitInputElement | null {
    return this.selectedUnits[camp];
  }

  public getSelectedSkillData(camp: CampSide): SkillData | null {
    this.persistActiveSkill(camp);
    const unit = this.selectedUnits[camp];
    if (!unit) return null;

    const selectedSkillId = this.selectedSkillIds[camp] ?? unit.getData().activeSkillId ?? null;
    if (!selectedSkillId) return null;
    return (unit.getData().skills ?? []).find((skill) => skill.skillId === selectedSkillId) ?? null;
  }

  public updateSelectionUI(): void {
    this.persistActiveSkill('left');
    this.persistActiveSkill('right');

    this.renderSkillsPanel('left');
    this.renderSkillsPanel('right');

    const statusEl = document.getElementById('selection-status');
    if (statusEl) {
      const leftName = this.selectedUnits.left ? this.selectedUnits.left.getData().name : '未选择';
      const rightName = this.selectedUnits.right ? this.selectedUnits.right.getData().name : '未选择';
      const leftSkillName = this.getSelectedSkillData('left')?.skillName || '未选择技能';
      const rightSkillName = this.getSelectedSkillData('right')?.skillName || '未选择技能';

      statusEl.textContent = `当前对决: [左] ${leftName} - ${leftSkillName} VS [右] ${rightName} - ${rightSkillName}`;
    }

    document.querySelectorAll('unit-card').forEach((card) => card.classList.remove('selected'));
    this.syncSelectedUnitPanel('left');
    this.syncSelectedUnitPanel('right');
  }

  public updateUnitCard(unit: UnitInputElement): void {
    const card = document.querySelector(`unit-card[data-unit-id="${unit.getUnitId()}"]`) as { setData?: (data: UnitConfig) => void } | null;
    if (card?.setData) {
      card.setData(unit.getData());
    }
  }

  public addUnit(camp: CampSide, config?: Partial<UnitConfig>): void {
    const list = document.getElementById(`unit-list-${camp}`);
    if (!list) return;

    const unit = document.createElement('unit-input') as UnitInputElement;
    const id = `${camp === 'left' ? 'L' : 'R'}${Math.floor(Math.random() * 10000)}`;

    customElements.whenDefined('unit-input').then(() => {
      unit.setUnitId(id);
      if (config) {
        const defaultActiveSkillId = config.activeSkillId ?? config.skills?.[0]?.skillId;
        unit.setValues({
          ...config,
          skills: config.skills ?? [],
          activeSkillId: defaultActiveSkillId,
        });
      } else {
        unit.setValues({ name: `单位 ${id}`, skills: [], activeSkillId: undefined });
      }

      const card = document.createElement('unit-card') as HTMLElement & { setData: (data: UnitConfig) => void };
      card.setAttribute('data-unit-id', id);
      card.setData(unit.getData());
      list.appendChild(card);

      card.addEventListener('click', () => {
        this.persistActiveSkill(camp);
        this.selectedUnits[camp] = unit;
        this.selectedSkillIds[camp] = null;
        this.updateSelectionUI();
      });

      unit.addEventListener('remove-unit', () => {
        if (this.selectedUnits[camp] === unit) {
          this.selectedUnits[camp] = null;
          this.selectedSkillIds[camp] = null;
          this.activeSkillEditors[camp] = null;
          const editorContainer = document.getElementById(`editor-container-${camp}`);
          if (editorContainer) editorContainer.innerHTML = '';
          const skillEditorContainer = document.getElementById(`skill-editor-container-${camp}`);
          if (skillEditorContainer) skillEditorContainer.innerHTML = '';
        }
        card.remove();
        this.updateSelectionUI();
      });

      if (!this.selectedUnits[camp]) {
        this.selectedUnits[camp] = unit;
        this.updateSelectionUI();
      }
    });
  }

  public addSkill(camp: CampSide, config?: Partial<SkillData>): void {
    const unit = this.selectedUnits[camp];
    if (!unit) {
      this.callbacks.log(`请先在${camp === 'left' ? '左' : '右'}侧选择单位，再添加技能`);
      return;
    }

    this.persistActiveSkill(camp);

    const unitData = unit.getData();
    const skillId = config?.skillId ?? `${camp === 'left' ? 'LS' : 'RS'}${Math.floor(Math.random() * 10000)}`;
    const newSkill: SkillData = {
      skillId,
      skillName: config?.skillName ?? `技能 ${skillId}`,
      tags: config?.tags ?? ['active'],
      dice: config?.dice ?? [{ tags: ['slash'], min: 1, max: 6, effects: [] }],
      skillEffects: config?.skillEffects ?? [],
    };

    unit.setValues({ skills: [...(unitData.skills ?? []), newSkill], activeSkillId: newSkill.skillId });
    this.updateUnitCard(unit);
    this.selectedSkillIds[camp] = newSkill.skillId;
    this.renderSkillsPanel(camp);
    this.updateSelectionUI();
  }

  private persistActiveSkill(camp: CampSide): void {
    const unit = this.selectedUnits[camp];
    const editor = this.activeSkillEditors[camp];
    if (!unit || !editor) return;

    const latestSkill = editor.getData();
    const unitData = unit.getData();
    const nextSkills = (unitData.skills ?? []).map((skill) => (skill.skillId === latestSkill.skillId ? latestSkill : skill));
    unit.setValues({ skills: nextSkills, activeSkillId: latestSkill.skillId });
    this.updateUnitCard(unit);
  }

  private renderSkillEditor(camp: CampSide): void {
    const container = document.getElementById(`skill-editor-container-${camp}`);
    const unit = this.selectedUnits[camp];
    if (!container || !unit) return;

    const unitData = unit.getData();
    const selectedSkillId = this.selectedSkillIds[camp];
    const selectedSkill = (unitData.skills ?? []).find((skill) => skill.skillId === selectedSkillId);
    if (!selectedSkill) {
      this.activeSkillEditors[camp] = null;
      container.innerHTML = '';
      return;
    }

    const editor = document.createElement('skill-editor') as SkillEditorElement;
    editor.setSkillId(selectedSkill.skillId);
    editor.setValues(selectedSkill);
    editor.addEventListener('remove-skill', () => {
      const currentUnit = this.selectedUnits[camp];
      if (!currentUnit) return;
      const currentData = currentUnit.getData();
      const remaining = (currentData.skills ?? []).filter((item) => item.skillId !== selectedSkill.skillId);
      currentUnit.setValues({ skills: remaining, activeSkillId: remaining[0]?.skillId });
      this.updateUnitCard(currentUnit);
      this.selectedSkillIds[camp] = remaining[0]?.skillId ?? null;
      this.renderSkillsPanel(camp);
      this.updateSelectionUI();
    });

    this.activeSkillEditors[camp] = editor;
    container.innerHTML = '';
    container.appendChild(editor);
  }

  private renderSkillsPanel(camp: CampSide): void {
    const list = document.getElementById(`skill-list-${camp}`);
    const container = document.getElementById(`skill-editor-container-${camp}`);
    const unit = this.selectedUnits[camp];
    if (!list || !container) return;

    list.innerHTML = '';
    if (!unit) {
      this.selectedSkillIds[camp] = null;
      this.activeSkillEditors[camp] = null;
      container.innerHTML = '';
      return;
    }

    const unitData = unit.getData();
    const skills = unitData.skills ?? [];
    if (skills.length === 0) {
      this.selectedSkillIds[camp] = null;
      this.activeSkillEditors[camp] = null;
      unit.setValues({ activeSkillId: undefined });
      this.updateUnitCard(unit);
      container.innerHTML = '';
      return;
    }

    const preferredSkillId = this.selectedSkillIds[camp] ?? unitData.activeSkillId ?? null;
    const hasCurrent = skills.some((skill) => skill.skillId === preferredSkillId);
    const selectedId = hasCurrent ? preferredSkillId : skills[0].skillId;
    this.selectedSkillIds[camp] = selectedId;
    unit.setValues({ activeSkillId: selectedId ?? undefined });
    this.updateUnitCard(unit);

    skills.forEach((skillData) => {
      const card = document.createElement('skill-card') as SkillCardElement;
      card.setAttribute('data-skill-id', skillData.skillId);
      card.setData(skillData);
      if (skillData.skillId === selectedId) {
        card.classList.add('selected');
      }
      card.addEventListener('click', () => {
        this.persistActiveSkill(camp);
        this.selectedSkillIds[camp] = skillData.skillId;
        this.renderSkillsPanel(camp);
        this.updateSelectionUI();
      });
      list.appendChild(card);
    });

    this.renderSkillEditor(camp);
  }

  private syncSelectedUnitPanel(camp: CampSide): void {
    const selectedUnit = this.selectedUnits[camp];
    if (!selectedUnit) return;

    const card = document.querySelector(`unit-card[data-unit-id="${selectedUnit.getUnitId()}"]`);
    if (card) card.classList.add('selected');

    const container = document.getElementById(`editor-container-${camp}`);
    if (container && !container.contains(selectedUnit)) {
      container.innerHTML = '';
      container.appendChild(selectedUnit);
    }
  }
}