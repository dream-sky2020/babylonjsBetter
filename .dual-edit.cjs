const fs=require('fs');const p='tools/model-shake-lab/ModelShakeLab.tsx';let s=fs.readFileSync(p,'utf8');
s=s.replace('type ProxyShape }', 'type ProxyShape, type WeaponHand, type WeaponTrack, mirrorWeaponTrack }');
s=s.replace("import { createWeaponProxyDebug } from './weaponProxyDebug.ts';\nimport { createModelEntity, type ModelEntity } from '@/core/model';",`import { useWeaponSlot, type WeaponLabRuntime as Runtime } from './useWeaponSlot.ts';
import { createWeaponAnimationExamples } from '@/core/model/preset/firstPersonWeaponExamples.ts';`);
s=s.slice(0,s.indexOf('type Runtime ='))+s.slice(s.indexOf('type IconName ='));
s=s.slice(0,s.indexOf('const DEFAULT_PROJECT:'))+`const EXAMPLES = createWeaponAnimationExamples();
const DEFAULT_PROJECT = EXAMPLES['right-hand-slash'];
const HANDS = ['right', 'left'] as const;
const handName = (hand: WeaponHand) => hand === 'right' ? '右手' : '左手';
`+s.slice(s.indexOf('const cloneProject ='));
const applyEnd=s.indexOf('\nconst material =');s=s.slice(0,applyEnd)+`
const applyProjectPose = (runtime: Runtime, project: AnimationProject, time: number) => {
  for (const hand of HANDS) applyPose(runtime.slots[hand].weaponPose, sampleAnimation(project.weapons[hand].keyframes, time));
};
`+s.slice(applyEnd);
s=s.replace(' const modelEntityRef = useRef<ModelEntity | null>(null);','');
s=s.replace('const [project, setProject] = useState<AnimationProject>(() => cloneProject(DEFAULT_PROJECT)); const projectRef = useRef(project);',`const [rig, setRig] = useState<AnimationProject>(() => cloneProject(DEFAULT_PROJECT)); const projectRef = useRef(rig);
  const [activeHand, setActiveHand] = useState<WeaponHand>('right');
  const project = useMemo(() => ({ ...rig, ...rig.weapons[activeHand] }), [rig, activeHand]);`);
s=s.replace(' const [loading, setLoading] = useState(false);','');
s=s.replace('savedSnapshot === JSON.stringify(project)','savedSnapshot === JSON.stringify(rig)');
s=s.replace('useEffect(() => { projectRef.current = project; }, [project]);','useEffect(() => { projectRef.current = rig; }, [rig]);');
s=s.replace("const weaponPose = new TransformNode('weapon-animation-pose', scene); weaponPose.parent = viewmodelRoot;\n    const weaponAsset = new TransformNode('weapon-asset-adjustment', scene); weaponAsset.parent = weaponPose;",`const makeSlot = (hand: WeaponHand) => {
      const weaponPose = new TransformNode(hand + '-weapon-animation-pose', scene); weaponPose.parent = viewmodelRoot;
      const weaponAsset = new TransformNode(hand + '-weapon-installation', scene); weaponAsset.parent = weaponPose;
      return { weaponPose, weaponAsset };
    };
    const slots = { right: makeSlot('right'), left: makeSlot('left') };`);
s=s.replace('const disposeWeapon = null; runtimeRef.current = { engine, scene, firstPersonCamera, orbitCamera, viewmodelRoot, weaponPose, weaponAsset, disposeWeapon };','runtimeRef.current = { engine, scene, firstPersonCamera, orbitCamera, viewmodelRoot, slots };');
s=s.replace('applyPose(weaponPose, projectRef.current.keyframes[0])','applyProjectPose(runtimeRef.current, projectRef.current, 0)');
s=s.replace('applyPose(runtime.weaponPose, sampleAnimation(current.keyframes, time))','applyProjectPose(runtime, current, time)');
s=s.replace('runtimeRef.current?.disposeWeapon?.(); modelEntityRef.current?.dispose(); ', '');
const effectStart=s.indexOf('  useEffect(() => {\n    const runtime = runtimeRef.current; if (!runtime) return; const { asset } = project;');
const effectEnd=s.indexOf('\n  const stopPlayback',effectStart);
s=s.slice(0,effectStart)+`  useEffect(() => {
    const runtime = runtimeRef.current; if (runtime && !playing) applyProjectPose(runtime, rig, currentTime);
  }, [rig, currentTime, playing]);
`+s.slice(effectEnd);
s=s.replace('applyPose(runtime.weaponPose, sampleAnimation(projectRef.current.keyframes, 0))','applyProjectPose(runtime, projectRef.current, 0)');
s=s.replace('setProject(projectRef.current); setSelectedId(initial.keyframes[0].id);','setRig(projectRef.current); setSelectedId(initial.weapons.right.keyframes[0].id);');
const debugStart=s.indexOf('  useEffect(() => {\n    const runtime = runtimeRef.current; if (!runtime) return;\n    return createWeaponProxyDebug');
const debugEnd=s.indexOf('  const loadManifestModel',debugStart);
s=s.slice(0,debugStart)+`  const rightLoading = useWeaponSlot(runtimeRef, 'right', rig.weapons.right, showProxy, showMarkers, setStatus);
  const leftLoading = useWeaponSlot(runtimeRef, 'left', rig.weapons.left, showProxy, showMarkers, setStatus);
  const loading = rightLoading || leftLoading;
`+s.slice(debugEnd);
const updaterStart=s.indexOf('  const updateProject =');const updaterEnd=s.indexOf('  const updateFrameVec',updaterStart);
s=s.slice(0,updaterStart)+`  const updateTrack = (change: (track: WeaponTrack) => WeaponTrack) => setRig(current => ({ ...current, weapons: { ...current.weapons, [activeHand]: change(current.weapons[activeHand]) } }));
  const updateProject = (patch: Partial<AnimationProject & WeaponTrack>) => {
    const { proxy, asset, keyframes, enabled, ...global } = patch;
    setRig(current => ({ ...current, ...global, weapons: { ...current.weapons, [activeHand]: {
      ...current.weapons[activeHand], ...(proxy ? { proxy } : {}), ...(asset ? { asset } : {}), ...(keyframes ? { keyframes } : {}), ...(enabled === undefined ? {} : { enabled }),
    } } }));
  };
  const updateAsset = (patch: Partial<WeaponTrack['asset']>) => updateTrack(current => ({ ...current, asset: { ...current.asset, ...patch } }));
  const updateAssetVec = (channel: 'offset' | 'rotation', axis: keyof Vec3, value: number) => updateTrack(current => ({ ...current, asset: { ...current.asset, [channel]: { ...current.asset[channel], [axis]: value } } }));
  const updateFrame = (patch: Partial<WeaponKeyframe>) => updateTrack(current => ({ ...current, keyframes: current.keyframes.map(frame => frame.id === selectedFrame.id ? { ...frame, ...patch } : frame).sort((a, b) => a.time - b.time) }));
  const selectHand = (hand: WeaponHand) => { setActiveHand(hand); setSelectedId(rig.weapons[hand].keyframes[0].id); };
  const toggleHand = (hand: WeaponHand, enabled: boolean) => {
    if (!enabled && !rig.weapons[hand === 'right' ? 'left' : 'right'].enabled) return setStatus('至少保留一个启用的代理体');
    setRig(current => ({ ...current, weapons: { ...current.weapons, [hand]: { ...current.weapons[hand], enabled } } }));
  };
`+s.slice(updaterEnd);
s=s.replaceAll('setProject((current) => ({ ...current, keyframes:', 'updateTrack((current) => ({ ...current, keyframes:');
s=s.replaceAll('applyPose(runtime.weaponPose, frame)', 'applyProjectPose(runtime, projectRef.current, frame.time)');
s=s.replaceAll('applyPose(runtime.weaponPose, sampleAnimation(project.keyframes, time))', 'applyProjectPose(runtime, projectRef.current, time)');
s=s.replaceAll('applyPose(runtime.weaponPose, sampleAnimation(projectRef.current.keyframes, time))', 'applyProjectPose(runtime, projectRef.current, time)');
s=s.replace('runtime.weaponPose.computeWorldMatrix(true)', 'runtime.slots[activeHand].weaponPose.computeWorldMatrix(true)');
s=s.replace('const clean = { ...next, keyframes: [...next.keyframes].sort((a, b) => a.time - b.time) }; projectRef.current = clean; setProject(clean); setSelectedId(clean.keyframes[0].id);',"const clean = parseWeaponProject(next); projectRef.current = clean; setRig(clean); const hand = clean.weapons.right.enabled ? 'right' : 'left'; setActiveHand(hand); setSelectedId(clean.weapons[hand].keyframes[0].id);");
s=s.replace('parseWeaponProject(project); const snapshot = JSON.stringify(project)', 'parseWeaponProject(rig); const snapshot = JSON.stringify(rig)');
s=s.replace('JSON.stringify(project, null, 2)','JSON.stringify(rig, null, 2)');
s=s.replace('...project.keyframes.map(frame => frame.time)', '...HANDS.flatMap(hand => rig.weapons[hand].keyframes.map(frame => frame.time))');
s=s.replace('保存包含代理体、单个模型安装变换和动画关键帧。','保存包含左右手代理体、各自的模型安装变换和独立关键帧，共享同一播放时间。');
s=s.replace('<strong>关键帧轨道</strong>', '<strong>{handName(activeHand)}关键帧轨道</strong>');
s=s.replace('<span>{project.asset.name}</span>',"<span>{HANDS.filter(hand => rig.weapons[hand].enabled).map(hand => handName(hand) + ' · ' + rig.weapons[hand].asset.name).join(' / ')}</span>");
const tabs='<div className="tabs">';s=s.replace(tabs,`<div className="hand-selector">
        <div className="view-switch" role="group" aria-label="编辑武器挂载位">{HANDS.map(hand => <button key={hand} className={activeHand === hand ? 'active' : ''} onClick={() => selectHand(hand)}>{handName(hand)}{rig.weapons[hand].enabled ? '' : '（停用）'}</button>)}</div>
        <label className="toggle-row"><span>启用{handName(activeHand)}代理体</span><input type="checkbox" checked={project.enabled} onChange={event => toggleHand(activeHand, event.target.checked)} /></label>
        <small>青色：右手 · 紫色：左手。只编辑所选手，播放与擦洗同时驱动两手。</small>
      </div>
      `+tabs);
s=s.replace('<h2>武器模型</h2>', '<h2>{handName(activeHand)} · 武器模型</h2>');
s=s.replace('<div className="tip"><b>制作提示</b>',`<button className="reset-button" onClick={() => { const other = activeHand === 'right' ? 'left' : 'right'; updateTrack(current => ({ ...current, keyframes: mirrorWeaponTrack(rig.weapons[other]).keyframes })); setStatus('已镜像另一手动作；模型安装参数保留'); }}>用另一手的镜像动作替换当前轨道</button>
        <div className="tip"><b>制作提示</b>`);
s=s.replace('<label className="wide-field"><span>读取 config 预设',`<label className="wide-field"><span>动画示例（替换双手配置与模型安装）</span><select aria-label="动画示例" value="" onChange={event => { const key = event.target.value; setPresetKey(key); setSavedSnapshot(''); replaceProject(cloneProject(EXAMPLES[key]), '已应用示例：' + EXAMPLES[key].name); }}><option value="">选择攻击 / 射击示例</option>{Object.entries(EXAMPLES).map(([key, entry]) => <option key={key} value={key}>{entry.name}</option>)}</select></label>
        <label className="wide-field"><span>读取 config 预设`);
// Replace the lower two channels with independent hand overview rows.
const lowerStart=s.indexOf('            <div className="timeline-lane position-lane">');
const lowerEnd=s.indexOf('            <div className="playhead"',lowerStart);
s=s.slice(0,lowerStart)+`            {HANDS.map(hand => <div key={hand} className={\x60timeline-lane hand-lane hand-\x24{hand} \x24{rig.weapons[hand].enabled ? '' : 'disabled'}\x60}>
              {rig.weapons[hand].keyframes.map(frame => <button key={frame.id} className={\x60channel-key \x24{hand === 'right' ? 'position-key' : 'rotation-key'} \x24{hand === activeHand && frame.id === selectedFrame.id ? 'active' : ''}\x60} style={{ left: \x60\x24{frame.time / rig.duration * 100}%\x60 }} onPointerDown={event => event.stopPropagation()} onClick={() => { selectHand(hand); setSelectedId(frame.id); scrub(frame.time); }} title={\x60\x24{handName(hand)} · \x24{frame.label} · \x24{frame.time.toFixed(3)}s\x60} aria-label={\x60\x24{handName(hand)}关键帧 \x24{frame.label}\x60}><i /></button>)}
            </div>)}
`+s.slice(lowerEnd);
s=s.replace('<span><i className="lane-dot position" />位置</span><span><i className="lane-dot rotation" />旋转</span>', '<span><i className="lane-dot position" />右手</span><span><i className="lane-dot rotation" />左手</span>');
fs.writeFileSync(p,s);
