import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadConfigFromUrl } from '@/core/config';
import { createRoot } from "react-dom/client";
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
} from "@babylonjs/core";
import { createCameraLabController } from "@/core/camera/cameraLabController.ts";
import { createCameraLabScene } from "@/core/scene/createCameraLabScene.ts";
import { createFloatingCameraControlPanel } from "@/core/ui/FloatingCameraControlPanel.ts";
import { requestDevServer } from "@/core/network/devServerPortResolver.ts";
import {
  MONSTER_CONFIG_URL,
  MONSTER_STRIPE_PRESET_URL,
  STRIPE_PRESET_URL,
  MonsterVisualManager,
  normalizeMonsterConfigLibrary,
  normalizeMonsterStripePresetLibrary,
  normalizeStripePresetLibrary,
  type MonsterDisplayConfigLibrary,
  type MonsterStripePresetLibrary,
  type StripePresetLibrary,
  type VisualBattlefield,
  type VisualMonster,
} from "@/core/monster";
import {
  createDefaultMonsterAttackParameters,
  getMonsterAttackDefinition,
  monsterAttackDefinitions,
  normalizeMonsterAttackParameters,
  type MonsterAttackPreset,
  type MonsterAttackPresetLibrary,
} from "@/core/monster-attack-motion";

type Monster = {
  id: string;
  monsterConfigKey: string;
  monsterStripePresetKey: string;
  positionMode: "grid" | "center";
  slots: number;
  row: number;
  column: number;
};
type Battlefield = {
  id: string;
  name: string;
  width: number;
  cellSize: number;
  rowSpacing: number;
  monsters: Monster[];
};
type StripeRule = {
  id: string;
  startRow: number;
  monsterStripePresetKey: string;
};
type AttackDirection = "forward" | "backward" | "left" | "right";

const FORMATION_URL = "/config/monsterBattlefieldFormations.json",
  RULE_URL = "/config/monsterBattlefieldStripeRules.json",
  ATTACK_URL = "/config/monsterAttackConfigs.json",
  ATTACK_API = "/api/monster-attack-configs";
const section: React.CSSProperties = {
  padding: 12,
  border: "1px solid #273348",
  borderRadius: 8,
  background: "#151d29",
};
const uid = () =>
  `monster_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const numberOr = (value: unknown, fallback: number) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const positiveInt = (value: unknown, fallback = 1) =>
  Math.max(1, Math.round(numberOr(value, fallback)));
const indexInt = (value: unknown, fallback = 0) =>
  Math.max(0, Math.round(numberOr(value, fallback)));
const cloneMonsters = (items: Monster[]) => items.map((item) => ({ ...item }));
const normalizeBattlefield = (
  value: Partial<Battlefield>,
  id: string,
): Battlefield => ({
  id,
  name: typeof value.name === "string" ? value.name : id,
  width: positiveInt(value.width, 6),
  cellSize: Math.max(0.01, numberOr(value.cellSize, 2.5)),
  rowSpacing: Math.max(0.01, numberOr(value.rowSpacing, 4)),
  monsters: Array.isArray(value.monsters)
    ? value.monsters.map((item, index) => ({
        id: item.id || `${id}_${index}`,
        monsterConfigKey: item.monsterConfigKey || "",
        monsterStripePresetKey: item.monsterStripePresetKey || "",
        positionMode: item.positionMode === "center" ? "center" : "grid",
        slots: positiveInt(item.slots),
        row: indexInt(item.row),
        column: indexInt(item.column, index),
      }))
    : [],
});
const toVisualMonster = (item: Monster): VisualMonster => ({
  id: item.id,
  monsterConfigKey: item.monsterConfigKey,
  monsterStripePresetKey: item.monsterStripePresetKey,
  chaos: { value: 0, threshold: 100, duration: 0 },
  position: {
    row: item.row,
    column: item.column,
    size: item.slots,
    isOccupyingFullRowCentered: item.positionMode === "center",
  },
});
const toVisualField = (field: Battlefield): VisualBattlefield => ({
  ...field,
  monsters: field.monsters.map(toVisualMonster),
});
const directionVector = (direction: AttackDirection) =>
  direction === "backward"
    ? new Vector3(0, 0, -1)
    : direction === "left"
      ? new Vector3(-1, 0, 0)
      : direction === "right"
        ? new Vector3(1, 0, 0)
        : new Vector3(0, 0, 1);
const fetchJson = async (url: string) => {
  return loadConfigFromUrl(url);
};
const normalizePreset = (key: string, value: any): MonsterAttackPreset => {
  const definition = getMonsterAttackDefinition(
    String(value?.modeId || monsterAttackDefinitions[0]?.id),
  );
  return {
    presetKey: key,
    name: String(value?.name || definition.name || key),
    modeId: definition.id,
    parameters: normalizeMonsterAttackParameters(
      definition.parameters,
      value?.parameters,
    ),
  };
};
const CommitNumberInput: React.FC<{
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ value, onCommit, min, max, step }) => {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);
  const commit = () => {
    editing.current = false;
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed)) {
      onCommit(parsed);
      setDraft(String(parsed));
    } else setDraft(String(value));
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    stageRef = useRef<HTMLElement>(null),
    visualManagerRef = useRef<MonsterVisualManager | null>(null),
    playerRef = useRef<Mesh | null>(null);
  const repeatRef = useRef<{ monsterId: string; delayMs: number } | null>(null),
    attackAgainRef = useRef<() => void>(() => {});
  const configsRef = useRef<MonsterDisplayConfigLibrary>({}),
    monsterStripesRef = useRef<MonsterStripePresetLibrary>({}),
    stripesRef = useRef<StripePresetLibrary>({}),
    rulesRef = useRef<StripeRule[]>([]);
  const [configs, setConfigs] = useState<MonsterDisplayConfigLibrary>({}),
    [monsterStripes, setMonsterStripes] = useState<MonsterStripePresetLibrary>(
      {},
    ),
    [stripes, setStripes] = useState<StripePresetLibrary>({});
  const [battlefields, setBattlefields] = useState<Record<string, Battlefield>>(
      {},
    ),
    [placements, setPlacements] = useState<Record<string, Monster[]>>({}),
    [rulesByField, setRulesByField] = useState<Record<string, StripeRule[]>>(
      {},
    ),
    [attackPresets, setAttackPresets] = useState<MonsterAttackPresetLibrary>(
      {},
    );
  const [activeId, setActiveId] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [selectedPresetKey, setSelectedPresetKey] = useState(""),
    [attackPlayer, setAttackPlayer] = useState(true),
    [attackDirection, setAttackDirection] =
      useState<AttackDirection>("forward"),
    [playerPosition, setPlayerPosition] = useState({ x: 0, z: 6, height: 1.8 }),
    [repeatDelay, setRepeatDelay] = useState(450),
    [repeatRunning, setRepeatRunning] = useState(false),
    [message, setMessage] = useState("正在加载配置...");
  const source = battlefields[activeId],
    field = useMemo(
      () =>
        source
          ? { ...source, monsters: placements[activeId] || source.monsters }
          : null,
      [source, placements, activeId],
    ),
    selected = field?.monsters.find((item) => item.id === selectedId),
    rules = rulesByField[activeId] || [],
    attackPreset =
      attackPresets[selectedPresetKey] || Object.values(attackPresets)[0],
    attackDefinition = getMonsterAttackDefinition(
      attackPreset?.modeId || monsterAttackDefinitions[0]?.id,
    ),
    attackParameters =
      attackPreset?.parameters ||
      createDefaultMonsterAttackParameters(attackDefinition.parameters);

  useEffect(() => {
    Promise.all([
      fetchJson(MONSTER_CONFIG_URL),
      fetchJson(MONSTER_STRIPE_PRESET_URL),
      fetchJson(STRIPE_PRESET_URL),
      fetchJson(FORMATION_URL),
      fetchJson(RULE_URL),
      fetchJson(ATTACK_URL),
    ])
      .then(
        ([
          rawConfigs,
          rawMonsterStripes,
          rawStripes,
          rawFields,
          rawRules,
          rawAttacks,
        ]) => {
          const nextConfigs = normalizeMonsterConfigLibrary(rawConfigs),
            nextMonsterStripes =
              normalizeMonsterStripePresetLibrary(rawMonsterStripes),
            nextStripes = normalizeStripePresetLibrary(rawStripes),
            nextFields = Object.fromEntries(
              Object.entries(rawFields || {}).map(([id, value]) => [
                id,
                normalizeBattlefield(value as Partial<Battlefield>, id),
              ]),
            ),
            nextAttacks = Object.fromEntries(
              Object.entries(rawAttacks || {}).map(([key, value]) => [
                key,
                normalizePreset(key, value),
              ]),
            );
          configsRef.current = nextConfigs;
          monsterStripesRef.current = nextMonsterStripes;
          stripesRef.current = nextStripes;
          setConfigs(nextConfigs);
          setMonsterStripes(nextMonsterStripes);
          setStripes(nextStripes);
          setBattlefields(nextFields);
          setPlacements(
            Object.fromEntries(
              Object.entries(nextFields).map(([id, item]) => [
                id,
                cloneMonsters(item.monsters),
              ]),
            ),
          );
          setRulesByField(
            Object.fromEntries(
              Object.keys(nextFields).map((id) => [
                id,
                Array.isArray(rawRules?.[id]?.rules)
                  ? rawRules[id].rules.map((rule: StripeRule) => ({ ...rule }))
                  : [],
              ]),
            ),
          );
          setAttackPresets(nextAttacks);
          setSelectedPresetKey(Object.keys(nextAttacks)[0] || "");
          setActiveId(Object.keys(nextFields)[0] || "");
          setMessage(
            `已加载 ${Object.keys(nextFields).length} 个战场和 ${Object.keys(nextAttacks).length} 个攻击配置。`,
          );
        },
      )
      .catch((error) => setMessage(`加载失败：${String(error)}`));
  }, []);
  useEffect(() => {
    configsRef.current = configs;
    monsterStripesRef.current = monsterStripes;
    stripesRef.current = stripes;
    rulesRef.current = rules;
  }, [configs, monsterStripes, stripes, rules]);
  useEffect(() => {
    if (field && !field.monsters.some((item) => item.id === selectedId))
      setSelectedId(field.monsters[0]?.id || "");
  }, [field, selectedId]);
  useEffect(() => {
    repeatRef.current = null;
    setRepeatRunning(false);
  }, [activeId, selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current,
      stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = createCameraLabScene(canvas);
    context.camera.target.set(0, -1, -8);
    context.camera.radius = 34;
    const camera = createCameraLabController(context.camera),
      panel = createFloatingCameraControlPanel(stage, camera);
    visualManagerRef.current = new MonsterVisualManager(context.scene);
    const player = MeshBuilder.CreateBox(
        "attackPlayer",
        { width: 1.5, height: 1, depth: 1.5 },
        context.scene,
      ),
      playerMaterial = new StandardMaterial(
        "attackPlayerMaterial",
        context.scene,
      );
    playerMaterial.diffuseColor = new Color3(0.12, 0.82, 0.32);
    playerMaterial.emissiveColor = new Color3(0.03, 0.28, 0.09);
    player.material = playerMaterial;
    player.isPickable = false;
    playerRef.current = player;
    const drag = { active: false, id: -1, x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (camera.state.lookControlMode === "pointerLock") {
        void canvas.requestPointerLock?.();
        return;
      }
      drag.active = true;
      drag.id = event.pointerId;
      drag.x = event.clientX;
      drag.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      if (!drag.active || drag.id !== event.pointerId) return;
      camera.handlePointerDelta(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
      panel.syncFromController();
    };
    const up = (event: PointerEvent) => {
      if (!drag.active || drag.id !== event.pointerId) return;
      drag.active = false;
      canvas.style.cursor = "grab";
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    };
    const locked = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas)
        camera.handlePointerDelta(event.movementX, event.movementY);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        !["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(event.code)
      )
        return;
      camera.keys.add(event.code);
      event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => camera.keys.delete(event.code),
      resize = () => context.engine.resize();
    const wheel = (event: WheelEvent) => {
      if (camera.state.mode === "orbit") {
        event.preventDefault();
        camera.handleWheel(event.deltaY);
        panel.syncFromController();
      }
    };
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("mousemove", locked);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("resize", resize);
    context.engine.runRenderLoop(() => {
      const dt = context.engine.getDeltaTime() / 1000;
      camera.update(dt);
      panel.updateStatus();
      visualManagerRef.current?.update(dt);
      context.scene.render();
    });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      document.removeEventListener("mousemove", locked);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", resize);
      visualManagerRef.current?.dispose();
      visualManagerRef.current = null;
      panel.dispose();
      context.dispose();
      playerRef.current = null;
    };
  }, []);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const height = Math.max(0.1, numberOr(playerPosition.height, 1.8));
    player.position.set(
      numberOr(playerPosition.x, 0),
      -2.0875 + height / 2,
      numberOr(playerPosition.z, 6),
    );
    player.scaling.set(1, height, 1);
  }, [playerPosition]);

  const renderField = (nextField: Battlefield) => {
    const manager = visualManagerRef.current;
    if (!manager) return;
    manager.setDistanceStripeRules({ battlefieldId: nextField.id, name: `${nextField.id} 条纹距离规则`, rules: rulesRef.current });
    manager.sync(toVisualField(nextField), { configs: configsRef.current, monsterStripes: monsterStripesRef.current, stripes: stripesRef.current }, selectedId);
  };
  useEffect(() => {
    if (field && Object.keys(configs).length) renderField(field);
  }, [activeId, configs]);
  const patchPlacements = (next: Monster[]) =>
    activeId && setPlacements((all) => ({ ...all, [activeId]: next }));
  const stopRepeat = () => {
    repeatRef.current = null;
    setRepeatRunning(false);
  };
  const attackSelected = () => {
    if (!selected || !attackPreset || !attackDefinition) return;
    const monsterPosition = visualManagerRef.current?.getMonsterWorldPosition(selected.id);
    if (!monsterPosition) return;
    const playerDelta = new Vector3(
        playerPosition.x - monsterPosition.x,
        0,
        playerPosition.z - monsterPosition.z,
      ),
      playerDistance = playerDelta.length(),
      parameters = { ...attackParameters };
    if (attackPlayer && "distance" in attackDefinition.parameters)
      parameters.distance = playerDistance;
    visualManagerRef.current?.playMonsterAttack(
      selected.id,
      { ...attackPreset, parameters },
      attackPlayer && playerDistance > 0.0001
        ? playerDelta.scale(1 / playerDistance)
        : directionVector(attackDirection),
      () => {
        if (repeatRef.current?.monsterId === selected.id)
          window.setTimeout(() => attackAgainRef.current(), repeatRef.current.delayMs);
      },
    );
  };
  attackAgainRef.current = attackSelected;
  const toggleRepeat = () => {
    if (repeatRunning) {
      stopRepeat();
      return;
    }
    if (!selected) return;
    repeatRef.current = {
      monsterId: selected.id,
      delayMs: Math.max(0, repeatDelay),
    };
    setRepeatRunning(true);
    attackSelected();
  };
  const patchMonster = (patch: Partial<Monster>) => {
    if (!selected || !field) return;
    stopRepeat();
    const next = { ...selected, ...patch },
      items = field.monsters.map((item) =>
        item.id === selected.id ? next : item,
      );
    patchPlacements(items);
    visualManagerRef.current?.stopMonsterAttack(selected.id);
    queueMicrotask(() => renderField({ ...field, monsters: items }));
  };
  const applyRules = (next: StripeRule[]) => {
    setRulesByField((all) => ({ ...all, [activeId]: next }));
    rulesRef.current = next;
    queueMicrotask(() => field && renderField(field));
  };
  const patchRule = (id: string, patch: Partial<StripeRule>) =>
    applyRules(
      rules
        .map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
        .sort((a, b) => a.startRow - b.startRow),
    );
  const patchPreset = (patch: Partial<MonsterAttackPreset>) => {
    if (!attackPreset) return;
    setAttackPresets((all) => ({
      ...all,
      [attackPreset.presetKey]: normalizePreset(attackPreset.presetKey, {
        ...attackPreset,
        ...patch,
      }),
    }));
  };
  const patchParameter = (key: string, value: number | boolean | string) =>
    attackPreset &&
    patchPreset({ parameters: { ...attackPreset.parameters, [key]: value } });
  const selectMode = (modeId: string) => {
    const definition = getMonsterAttackDefinition(modeId);
    if (definition)
      patchPreset({
        modeId: definition.id,
        parameters: createDefaultMonsterAttackParameters(definition.parameters),
      });
  };
  const addPreset = () => {
    const definition = monsterAttackDefinitions[0],
      key = "attack_" + Date.now().toString(36),
      preset: MonsterAttackPreset = {
        presetKey: key,
        name: "新攻击配置",
        modeId: definition.id,
        parameters: createDefaultMonsterAttackParameters(definition.parameters),
      };
    setAttackPresets((all) => ({ ...all, [key]: preset }));
    setSelectedPresetKey(key);
  };
  const duplicatePreset = () => {
    if (!attackPreset) return;
    const key = attackPreset.presetKey + "_copy_" + Date.now().toString(36);
    setAttackPresets((all) => ({
      ...all,
      [key]: {
        ...attackPreset,
        presetKey: key,
        name: attackPreset.name + " 副本",
        parameters: { ...attackPreset.parameters },
      },
    }));
    setSelectedPresetKey(key);
  };
  const deletePreset = () => {
    if (!attackPreset || Object.keys(attackPresets).length <= 1) return;
    const next = { ...attackPresets };
    delete next[attackPreset.presetKey];
    setAttackPresets(next);
    setSelectedPresetKey(Object.keys(next)[0] || "");
  };
  const saveAttacks = async () => {
    try {
      const payload = Object.fromEntries(
        Object.entries(attackPresets).map(([key, value]) => [
          key,
          normalizePreset(key, value),
        ]),
      );
      const response = await requestDevServer(ATTACK_API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        result = await response.json();
      if (!response.ok || result.success === false)
        throw new Error(
          result.errors?.[0] || result.message || "HTTP " + response.status,
        );
      setMessage(
        "已保存 " +
          Object.keys(payload).length +
          " 个攻击配置到 config/monsterAttackConfigs.json。",
      );
    } catch (error) {
      setMessage("保存失败：" + String(error));
    }
  };
  const addMonster = () => {
    if (!field) return;
    const key = Object.keys(configs)[0];
    if (!key) return;
    const item: Monster = {
        id: uid(),
        monsterConfigKey: key,
        monsterStripePresetKey: configs[key]?.monsterStripePresetKey || "",
        positionMode: "grid",
        slots: 1,
        row: 0,
        column: 0,
      },
      items = [...field.monsters, item];
    patchPlacements(items);
    setSelectedId(item.id);
    queueMicrotask(() => renderField({ ...field, monsters: items }));
  };
  const reset = () => {
    if (!source) return;
    stopRepeat();
    const items = cloneMonsters(source.monsters);
    patchPlacements(items);
    setSelectedId(items[0]?.id || "");
    queueMicrotask(() => renderField({ ...source, monsters: items }));
  };
  const groups = [
    ...new Set(
      Object.values(attackDefinition.parameters).map(
        (parameter) => parameter.group || "参数",
      ),
    ),
  ];
  return (
    <div
      className="attack-lab"
      style={{
        height: "100vh",
        padding: 14,
        display: "grid",
        gridTemplateColumns: "440px minmax(0,1fr)",
        gap: 14,
      }}
    >
      <aside
        style={{
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 5px" }}>怪物攻击动画 Lab</h2>
          <div style={{ color: "#8291a8", fontSize: 12 }}>
            选中怪物后，可使用任意攻击配置进行预览。
          </div>
        </div>
        <section style={section}>
          <label>战场配置</label>
          <select
            value={activeId}
            onChange={(event) => setActiveId(event.target.value)}
          >
            {Object.values(battlefields).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.id}
              </option>
            ))}
          </select>
          {field && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 7,
                marginTop: 9,
                color: "#aab7ca",
                fontSize: 12,
              }}
            >
              <span>{field.width} 列</span>
              <span>格宽 {field.cellSize}</span>
              <span>行距 {field.rowSpacing}</span>
            </div>
          )}
        </section>
        <section style={section}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong>攻击方式配置库</strong>
            <button onClick={addPreset}>新建</button>
          </div>
          <label>当前配置</label>
          <select
            value={attackPreset?.presetKey || ""}
            onChange={(event) => setSelectedPresetKey(event.target.value)}
          >
            {Object.values(attackPresets).map((item) => (
              <option key={item.presetKey} value={item.presetKey}>
                {item.name} · {item.presetKey}
              </option>
            ))}
          </select>
          {attackPreset && (
            <>
              <label>配置名称</label>
              <input
                value={attackPreset.name}
                onChange={(event) => patchPreset({ name: event.target.value })}
              />
              <label>攻击模式</label>
              <select
                value={attackDefinition.id}
                onChange={(event) => selectMode(event.target.value)}
              >
                {monsterAttackDefinitions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.id}
                  </option>
                ))}
              </select>
              <div
                style={{
                  color: "#8291a8",
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginTop: 7,
                }}
              >
                {attackDefinition.description}
              </div>
              {groups.map((group) => (
                <div
                  key={group}
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid #273348",
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{group}</strong>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {Object.entries(attackDefinition.parameters)
                      .filter(
                        ([, parameter]) =>
                          (parameter.group || "参数") === group,
                      )
                      .map(([key, parameter]) => (
                        <div key={key}>
                          {parameter.type === "number" ? (
                            <>
                              <label>{parameter.label}</label>
                              <CommitNumberInput
                                min={parameter.min}
                                max={parameter.max}
                                step={parameter.step}
                                value={Number(attackParameters[key])}
                                onCommit={(value) => patchParameter(key, value)}
                              />
                            </>
                          ) : parameter.type === "boolean" ? (
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(attackParameters[key])}
                                onChange={(event) =>
                                  patchParameter(key, event.target.checked)
                                }
                              />
                              {parameter.label}
                            </label>
                          ) : (
                            <>
                              <label>{parameter.label}</label>
                              <select
                                value={String(attackParameters[key])}
                                onChange={(event) =>
                                  patchParameter(key, event.target.value)
                                }
                              >
                                {parameter.options.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 7,
                  marginTop: 10,
                }}
              >
                <button onClick={duplicatePreset}>复制配置</button>
                <button
                  disabled={Object.keys(attackPresets).length <= 1}
                  onClick={deletePreset}
                >
                  删除配置
                </button>
              </div>
            </>
          )}
        </section>
        <section style={section}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong>距离条纹规则</strong>
            <button
              onClick={() =>
                applyRules([
                  ...rules,
                  {
                    id: uid(),
                    startRow: Math.max(
                      1,
                      ...rules.map((rule) => rule.startRow + 1),
                    ),
                    monsterStripePresetKey:
                      Object.keys(monsterStripes)[0] || "",
                  },
                ])
              }
            >
              添加规则
            </button>
          </div>
          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: "grid",
                gridTemplateColumns: "92px 1fr 58px",
                gap: 7,
                alignItems: "end",
              }}
            >
              <div>
                <label>从第几行</label>
                <CommitNumberInput
                  min={1}
                  step={1}
                  value={rule.startRow}
                  onCommit={(value) =>
                    patchRule(rule.id, { startRow: positiveInt(value) })
                  }
                />
              </div>
              <div>
                <label>怪物条纹</label>
                <select
                  value={rule.monsterStripePresetKey}
                  onChange={(event) =>
                    patchRule(rule.id, {
                      monsterStripePresetKey: event.target.value,
                    })
                  }
                >
                  {Object.entries(monsterStripes).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.name || key}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() =>
                  applyRules(rules.filter((item) => item.id !== rule.id))
                }
              >
                删除
              </button>
            </div>
          ))}
        </section>
        <section style={section}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>怪物</strong>
            <button onClick={addMonster}>添加怪物</button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
              marginTop: 8,
            }}
          >
            <button onClick={reset}>恢复战场默认</button>
            <button
              onClick={() => {
                if (!field) return;
                stopRepeat();
                patchPlacements([]);
                renderField({ ...field, monsters: [] });
              }}
            >
              清空
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 9,
            }}
          >
            {field?.monsters.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  textAlign: "left",
                  borderColor: item.id === selectedId ? "#65a8ff" : "#3a4961",
                  background: item.id === selectedId ? "#183b61" : "#202b3d",
                }}
              >
                {index + 1}.{" "}
                {configs[item.monsterConfigKey]?.name || item.monsterConfigKey}{" "}
                · 第 {item.row + 1} 行
              </button>
            ))}
          </div>
        </section>
        {selected && (
          <section style={section}>
            <label>怪物配置</label>
            <select
              value={selected.monsterConfigKey}
              onChange={(event) => {
                const key = event.target.value;
                patchMonster({
                  monsterConfigKey: key,
                  monsterStripePresetKey:
                    configs[key]?.monsterStripePresetKey || "",
                });
              }}
            >
              {Object.entries(configs).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name || key} · {key}
                </option>
              ))}
            </select>
            <label>位置模式</label>
            <select
              value={selected.positionMode}
              onChange={(event) =>
                patchMonster({
                  positionMode:
                    event.target.value === "center" ? "center" : "grid",
                })
              }
            >
              <option value="grid">格子定位</option>
              <option value="center">绝对居中</option>
            </select>
            <label>所在行（从 1 开始）</label>
            <CommitNumberInput
              min={1}
              step={1}
              value={selected.row + 1}
              onCommit={(value) => patchMonster({ row: indexInt(value - 1) })}
            />
            {selected.positionMode === "grid" && (
              <>
                <label>占用格数</label>
                <CommitNumberInput
                  min={1}
                  step={1}
                  value={selected.slots}
                  onCommit={(value) =>
                    patchMonster({ slots: positiveInt(value) })
                  }
                />
                <label>所在列（从 1 开始）</label>
                <CommitNumberInput
                  min={1}
                  step={1}
                  value={selected.column + 1}
                  onCommit={(value) =>
                    patchMonster({ column: indexInt(value - 1) })
                  }
                />
              </>
            )}
            <button
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => {
                if (!field) return;
                stopRepeat();
                const items = field.monsters.filter(
                  (item) => item.id !== selected.id,
                );
                patchPlacements(items);
                queueMicrotask(() =>
                  renderField({ ...field, monsters: items }),
                );
              }}
            >
              删除此怪物
            </button>
          </section>
        )}
        <section style={section}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 12,
                height: 12,
                background: "#39cf61",
                display: "inline-block",
              }}
            />
            <strong>玩家位置</strong>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 8,
            }}
          >
            <div>
              <label>X 偏移</label>
              <CommitNumberInput
                step={0.1}
                value={playerPosition.x}
                onCommit={(value) =>
                  setPlayerPosition((current) => ({ ...current, x: value }))
                }
              />
            </div>
            <div>
              <label>Z 偏移</label>
              <CommitNumberInput
                step={0.1}
                value={playerPosition.z}
                onCommit={(value) =>
                  setPlayerPosition((current) => ({ ...current, z: value }))
                }
              />
            </div>
            <div>
              <label>玩家高度</label>
              <CommitNumberInput
                min={0.1}
                max={20}
                step={0.1}
                value={playerPosition.height}
                onCommit={(value) =>
                  setPlayerPosition((current) => ({
                    ...current,
                    height: Math.max(0.1, value),
                  }))
                }
              />
            </div>
          </div>
        </section>
        <section style={section}>
          <strong>攻击测试</strong>
          <label>攻击目标</label>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
          >
            <button
              aria-pressed={attackPlayer}
              onClick={() => setAttackPlayer(true)}
              style={{
                borderColor: attackPlayer ? "#65a8ff" : "#3a4961",
                background: attackPlayer ? "#183b61" : "#202b3d",
              }}
            >
              攻击玩家位置
            </button>
            <button
              aria-pressed={!attackPlayer}
              onClick={() => setAttackPlayer(false)}
              style={{
                borderColor: !attackPlayer ? "#65a8ff" : "#3a4961",
                background: !attackPlayer ? "#183b61" : "#202b3d",
              }}
            >
              按方向测试
            </button>
          </div>
          {!attackPlayer && (
            <>
              <label>攻击方向</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 6,
                }}
              >
                {(
                  [
                    ["forward", "向前"],
                    ["backward", "向后"],
                    ["left", "向左"],
                    ["right", "向右"],
                  ] as Array<[AttackDirection, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={attackDirection === value}
                    onClick={() => setAttackDirection(value)}
                    style={{
                      borderColor:
                        attackDirection === value ? "#65a8ff" : "#3a4961",
                      background:
                        attackDirection === value ? "#183b61" : "#202b3d",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            disabled={!selected || !attackPreset}
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => {
              stopRepeat();
              attackSelected();
            }}
          >
            {attackPlayer ? "攻击玩家位置" : "播放一次攻击"}
          </button>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid #273348",
            }}
          >
            <strong style={{ fontSize: 13 }}>自动攻击</strong>
            <label>两次攻击间隔 / ms</label>
            <CommitNumberInput
              min={0}
              max={10000}
              step={50}
              value={repeatDelay}
              onCommit={(value) =>
                setRepeatDelay(Math.max(0, Math.round(value)))
              }
            />
            <button
              disabled={!selected || !attackPreset}
              style={{ width: "100%", marginTop: 8 }}
              onClick={toggleRepeat}
            >
              {repeatRunning ? "停止自动攻击" : "开始自动攻击"}
            </button>
          </div>
        </section>
        <section style={section}>
          <button style={{ width: "100%" }} onClick={() => void saveAttacks()}>
            保存全部攻击配置
          </button>
          <div
            style={{
              color: "#9dacbf",
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 8,
            }}
          >
            {message}
          </div>
        </section>
      </aside>
      <main
        ref={stageRef}
        style={{
          minWidth: 0,
          position: "relative",
          border: "1px solid #273348",
          borderRadius: 8,
          overflow: "hidden",
          background: "#080d14",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 10,
            color: "#c1cede",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          攻击只改变视觉姿态，结束后恢复原位置与比例 · 条纹按怪物所在行更新
        </div>
      </main>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
