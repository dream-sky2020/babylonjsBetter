const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.setPath('userData',resolveRepoPath('.asset-migration/scene-electron-test'));
app.commandLine.appendSwitch('no-sandbox');
if (process.platform !== 'win32') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}
const reportPath = resolveRepoPath('node_modules/.cache/scene-environment-browser.json');
const report = value => { fs.mkdirSync(resolveRepoPath('node_modules/.cache'), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(value, null, 2)); };
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  window.webContents.on('console-message', details => {
    if (/Error compiling effect|SHADER ERROR/i.test(details.message)) console.error(details.message);
  });
  try {
    await window.loadURL(process.env.SCENE_ENVIRONMENT_TEST_URL);
    const result = await window.webContents.executeJavaScript(`(async () => {
      const check = (value, message) => { if (!value) throw new Error(message); };
      let phase = 'initial';
      const wait = async predicate => { for (let i=0;i<600;i++) { if (predicate()) return; await new Promise(r=>setTimeout(r,50)); } throw new Error(phase + ': ' + (document.querySelector('#status')?.textContent || 'Timeout')); };
      const ready = () => !document.querySelector('#load').disabled && document.querySelector('#status').textContent.includes('已通过');
      const select = name => { const row = [...document.querySelectorAll('.editor-hierarchy-row')].find(row=>row.querySelector('.editor-hierarchy-label').textContent === name); check(row, 'Missing row '+name); row.click(); };
      const input = label => document.querySelector('[aria-label="'+label+'"]');
      const button = text => [...document.querySelectorAll('button')].find(b=>b.textContent === text);
      const set = (label, value) => { const element=input(label); check(element,'Missing field '+label); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})); };
      const draft = () => { const value=JSON.parse(document.querySelector('#preset-json').textContent); return value.scene || value; };
      await wait(ready);
      const verification = await import('/@id/virtual:scene-environment-verification');
      const runtime = () => verification.scene();
      const captureRuntime = () => [runtime().meshes, runtime().transformNodes, runtime().materials, runtime().lights, runtime().animationGroups, runtime().lights.map(light=>light.getShadowGenerator())].map(items=>items.slice());
      const assertRuntime = snapshot => check(captureRuntime().every((items,index)=>items.length===snapshot[index].length && items.every((item,i)=>item===snapshot[index][i])), 'Transform preview rebuilt models, materials, lights, animations or shadows');
      const width = () => runtime().getMeshByName('box').getBoundingInfo().boundingBox.extendSize.x * 2;
      const loadPreset = async key => {
        const preset = document.querySelector('#preset'); preset.value = key;
        preset.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#load').click();
        await wait(() => ready() && document.querySelector('#current-scene-key').value === key);
      };
      phase = 'reload the saved scene without navigating';
      await loadPreset('toon');
      const sceneBeforeReload = runtime();
      const cameraBeforeReload = sceneBeforeReload.activeCamera;
      const loadTime = performance.timeOrigin;
      select('Browser Box');
      const catalog = await fetch('/api/scene-environment-presets').then(response => response.json());
      const writeExternal = async declaration => {
        const response = await fetch('/api/scene-environment-presets', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetKey: 'toon', declaration }),
        });
        check(response.ok, 'Could not update the temporary scene file');
      };
      await writeExternal({ ...catalog.data.toon, clearColor: '#335577' });
      check(draft().clearColor !== '#335577', 'Scene changed before clicking reload');
      document.querySelector('#reload-preset').click();
      await wait(() => ready() && draft().clearColor === '#335577' && !document.querySelector('#reload-preset').disabled);
      check(performance.timeOrigin === loadTime && runtime() === sceneBeforeReload
        && runtime().activeCamera === cameraBeforeReload, 'Reload replaced the page or camera');
      check(document.querySelector('#scene-inspector').textContent.includes('Browser Box'), 'Reload lost the selected object');
      await writeExternal({ ...catalog.data.toon, models: [{ ...catalog.data.toon.models[0], modelPath: 'resources/does-not-exist.glb' }] });
      const beforeFailure = captureRuntime();
      document.querySelector('#reload-preset').click();
      await wait(() => !document.querySelector('#reload-preset').disabled && document.querySelector('#status').textContent.includes('加载失败'));
      assertRuntime(beforeFailure);
      check(draft().clearColor === '#335577', 'Failed reload replaced the editor data');
      await writeExternal(catalog.data.toon);
      const meshFor = (key, id) => runtime().getTransformNodeByName(key+':'+id).getChildMeshes().find(mesh => mesh.getTotalVertices() > 0);
      const isToon = mesh => mesh.subMeshes.some(part => part.effect?.isReady() && part.effect.fragmentSourceCode.includes('previewTone'));
      const outline = () => runtime().effectLayers.find(layer => layer.name === 'scene-art-outline');
      const setShading = async (mode, key, id) => {
        await wait(() => input('着色模式') && !input('着色模式').matches(':disabled'));
        input('着色模式').value = mode;
        input('着色模式').dispatchEvent(new Event('change', { bubbles: true }));
        await wait(() => input('着色模式')?.value === mode && !input('着色模式').matches(':disabled'));
        const mesh = meshFor(key,id);
        if (!mesh.isAnInstance) await wait(() => mesh.subMeshes.some(part => part.effect?.isReady())
          && isToon(mesh) === ['toon','toon-outline','ink-outline'].includes(mode));
      };
      phase = 'outline isolation and pixel width';
      await loadPreset('toon');
      select('Browser Model');
      const beforeToon = JSON.stringify(draft());
      const batchMesh = meshFor('toon','model'), sibling = meshFor('toon','sibling');
      const original = batchMesh.material;
      check(batchMesh.getClassName() === 'InstancedMesh' && sibling.material === original, 'Test models must share a hardware instance material');
      await setShading('outline','toon','model');
      const layer = outline();
      check(layer?.hasMesh(batchMesh) && !layer.hasMesh(sibling) && input('细描边宽度').value === '1', 'Outline did not isolate the selected hardware instance at 1 px');
      check(meshFor('toon','model') === batchMesh && batchMesh.material === original, 'Outline-only mode replaced the source mesh or material');
      phase = 'overhead outline readiness';
      const scene = runtime(), engine = scene.getEngine(), previousCamera = scene.activeCamera;
      batchMesh.computeWorldMatrix(true);
      const bounds = batchMesh.getBoundingInfo().boundingBox, center = bounds.centerWorld;
      const camera = new verification.FreeCamera('outline-test-top', center.clone(), scene);
      camera.position.y += 50; camera.position.z -= 0.01; camera.upVector.set(0,0,1); camera.setTarget(center);
      camera.mode = verification.Camera.ORTHOGRAPHIC_CAMERA;
      scene.activeCamera = camera;
      const captureAtZoom = async (zoom, target = batchMesh, rows = 1) => {
        const renderWidth = engine.getRenderWidth(), renderHeight = engine.getRenderHeight();
        target.computeWorldMatrix(true);
        const targetBounds = target.getBoundingInfo().boundingBox;
        const focus = targetBounds.centerWorld;
        // Avoid the exact vertical look-at singularity, even for float-sized models.
        camera.position.copyFrom(focus); camera.position.y += 50; camera.position.z -= 0.01; camera.setTarget(focus);
        const size = Math.max(targetBounds.extendSizeWorld.x,targetBounds.extendSizeWorld.z) * zoom;
        camera.orthoTop = size; camera.orthoBottom = -size;
        camera.orthoRight = size * renderWidth / renderHeight; camera.orthoLeft = -camera.orthoRight;
        await new Promise(resolve => scene.onAfterRenderObservable.addOnce(resolve));
        return engine.readPixels(0, Math.floor((renderHeight - rows) / 2), renderWidth, rows);
      };
      const measuredWidth = async (zoom, color = [16,18,26], target = batchMesh) => {
        const row = await captureAtZoom(zoom, target);
        let run = 0, longest = 0;
        for (let i = 0; i < row.length; i += 4) {
          const ink = color.every((channel, offset) => Math.abs(row[i + offset] - channel) <= 3);
          run = ink ? run + 1 : 0;
          longest = Math.max(longest,run);
        }
        return longest;
      };
      let outlineRegionShare = 1;
      try {
        await wait(() => layer.isLayerReady());
        // The merge can be ready before the first hardware-instanced mask has rendered.
        let thin = 0;
        for (let frame = 0; frame < 20 && thin === 0; frame++) thin = await measuredWidth(2.4);
        const thinZoomed = await measuredWidth(4.1);
        if (thin !== 1 || thinZoomed !== 1) {
          const target = layer._mainTexture;
          const { width, height } = target.getSize();
          const y = Math.floor(height / 2);
          const mask = await target.readPixels(0,0,null,true,false,0,y,width,1);
          const depthTarget = scene._depthRenderer?.[camera.uniqueId]?.getDepthMap();
          const depth = await depthTarget?.readPixels(0,0,null,true,false,0,y,width,1);
          const pixels = await engine.readPixels(0,y,width,1);
          const sample = [];
          for(let x=1;x<width;x++) if(mask && mask[x*4]!==mask[(x-1)*4]) {
            sample.push([x,...mask.slice(x*4-4,x*4+4),depth?.[x*4-4],depth?.[x*4],...pixels.slice(x*4-4,x*4+4)]);
            if(sample.length===4) break;
          }
          throw new Error('1 px outline changed across overhead zoom: '+JSON.stringify({
            thin, thinZoomed, width, height, sample, region: layer.screenRegion.bounds,
            activeCamera: scene.activeCamera.name, shouldRender: layer.shouldRender(),
          }));
        }
        phase = 'outline draw region and occluder filtering';
        const region = layer.screenRegion.bounds;
        outlineRegionShare = (region.right - region.left) * (region.top - region.bottom);
        check(outlineRegionShare > 0 && outlineRegionShare < 0.4, 'Sparse outline still composites most of the frame: '+outlineRegionShare);
        const unrelated = scene.getMeshByName('box');
        const oldPosition = unrelated.position.clone(), oldScale = unrelated.scaling.clone();
        unrelated.position.copyFrom(center); unrelated.position.x += camera.orthoRight * 0.78;
        unrelated.scaling.set(0.1, 0.1, 0.1);
        try {
          await measuredWidth(4.1);
          const active = scene.getActiveMeshes();
          const depthMap = scene._depthRenderer[camera.uniqueId].getDepthMap();
          const candidates = depthMap.getCustomRenderList(0, active.data, active.length);
          check(active.data.slice(0,active.length).includes(unrelated) && candidates.includes(batchMesh) && !candidates.includes(unrelated),
            'The outline depth pass should omit a visible mesh outside the outlined region');
        } finally { unrelated.position.copyFrom(oldPosition); unrelated.scaling.copyFrom(oldScale); }
        phase = 'changing outline width to 2 px';
        set('细描边宽度','2');
        await wait(() => input('细描边宽度').value === '2');
        const thick = await measuredWidth(2.4), thickZoomed = await measuredWidth(4.1);
        check(thick === 2 && thickZoomed === 2, '2 px outline changed across overhead zoom: '+[thick,thickZoomed]);
        phase = 'independent outline colors and brush strokes';
        select('Browser Sibling'); await setShading('outline','toon','sibling');
        check(input('细描边宽度').value === '1', 'Sibling inherited the edited width');
        set('描边颜色','#28c849');
        select('Browser Model');
        await wait(() => input('细描边宽度')?.value === '2');
        check(input('描边颜色').value === '#10121a', 'Sibling color edit changed the other model');
        set('描边颜色','#dd375b');
        check(outline() === layer && layer.hasMesh(batchMesh) && layer.hasMesh(sibling), 'Models should share one outline layer');
        check(await measuredWidth(2.4, [221,55,91]) === 2, 'First model did not render its own 2 px color');
        check(await measuredWidth(2.4, [40,200,73], sibling) === 1, 'Sibling did not render its own 1 px color');
        const blocker = scene.getMeshByName('box');
        const originalPosition = blocker.position.clone(), originalScale = blocker.scaling.clone();
        const coverSize = Math.max(bounds.extendSizeWorld.x, bounds.extendSizeWorld.z) * 2;
        blocker.position.copyFrom(center); blocker.position.y += 3;
        blocker.scaling.set(coverSize, 1, coverSize);
        try { check(await measuredWidth(2.4, [221,55,91]) === 0, 'The hidden outline rendered through the foreground box'); }
        finally { blocker.position.copyFrom(originalPosition); blocker.scaling.copyFrom(originalScale); }
        const hard = await captureAtZoom(2.4,batchMesh,16);
        const setBrush = value => {
          const field = input('描线笔触'); field.value = value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setBrush('dry');
        const dry = await captureAtZoom(2.4,batchMesh,16);
        setBrush('wash');
        const wash = await captureAtZoom(2.4,batchMesh,16);
        let variedInkPixels = 0;
        for (let i = 0; i < hard.length; i += 4) {
          if (Math.abs(hard[i]-221) > 3 || Math.abs(hard[i+1]-55) > 3 || Math.abs(hard[i+2]-91) > 3) continue;
          if (Math.abs(hard[i]-dry[i]) > 4 && Math.abs(dry[i]-wash[i]) > 4) variedInkPixels++;
        }
        check(variedInkPixels > 10, 'Hard, dry and wash brushes did not render distinct outlines: '+variedInkPixels);
        phase = 'varying pen pressure on a single edge';
        const edgeWidths = async () => {
          const rowCount = 160;
          const frame = await captureAtZoom(2.4,batchMesh,rowCount);
          const rowWidth = frame.length / (rowCount * 4);
          return Array.from({length: rowCount}, (_, y) => {
            let stroke = 0;
            for (let x = 0; x < rowWidth / 2; x++) {
              const i = (y * rowWidth + x) * 4;
              if (Math.abs(frame[i]-221) <= 3 && Math.abs(frame[i+1]-55) <= 3 && Math.abs(frame[i+2]-91) <= 3) stroke++;
              else if (stroke) break;
            }
            return stroke;
          });
        };
        setBrush('hard');
        const evenEdge = await edgeWidths();
        setBrush('pressure');
        await wait(() => input('细描边宽度')?.getAttribute('aria-valuetext')?.includes('1 到 4'));
        const pressureEdge = await edgeWidths();
        const widthsOnSameEdge = pressureEdge.filter((value, rowIndex) => value > 0 && evenEdge[rowIndex] === 2);
        check(widthsOnSameEdge.filter(width => width === 1).length >= 4 && widthsOnSameEdge.filter(width => width >= 3).length >= 4,
          'Pressure brush did not physically narrow and widen along the same edge: '+[...new Set(widthsOnSameEdge)]);
        phase = 'custom pressure limits and antialias coverage';
        set('最小线宽','2');
        await wait(() => input('细描边宽度')?.getAttribute('aria-valuetext')?.includes('2 到 4'));
        set('最大线宽','2');
        await wait(() => input('细描边宽度')?.getAttribute('aria-valuetext')?.includes('2 到 2'));
        const limitedEdge = await edgeWidths();
        check(evenEdge.filter((value, index) => value === 2 && limitedEdge[index] === 2).length > 60
          && limitedEdge.every((value, index) => evenEdge[index] !== 2 || value === 2), 'Equal brush limits did not render a uniform 2 px edge');
        const solidOutline = await captureAtZoom(2.4,batchMesh,16);
        await setShading('source','toon','model');
        const noOutline = await captureAtZoom(2.4,batchMesh,16);
        await setShading('outline','toon','model');
        check(!input('平滑描边').checked, 'Antialias should be off by default');
        input('平滑描边').click();
        await wait(() => input('平滑描边')?.checked);
        const smoothOutline = await captureAtZoom(2.4,batchMesh,16);
        let partialPixels = 0;
        let solidPixels = 0;
        let changedPixels = 0;
        for (let i = 0; i < solidOutline.length; i += 4) {
          if (Math.abs(solidOutline[i]-221) > 3 || Math.abs(solidOutline[i+1]-55) > 3
            || Math.abs(solidOutline[i+2]-91) > 3) continue;
          solidPixels++;
          const channels = [0, 1, 2];
          const deltas = channels.map(channel => solidOutline[i + channel] - noOutline[i + channel]);
          const blended = channels.map(channel => smoothOutline[i + channel] - noOutline[i + channel]);
          const contrast = deltas.reduce((sum, delta) => sum + delta * delta, 0);
          if (contrast < 48 * 48) continue;
          const coverage = deltas.reduce((sum, delta, channel) => sum + delta * blended[channel], 0) / contrast;
          if (Math.abs(coverage - 1) > 0.1) changedPixels++;
          if (coverage > 0.2 && coverage < 0.8
            && blended.every((value, channel) => Math.abs(value - deltas[channel] * coverage) <= 4)) partialPixels++;
        }
        check(partialPixels > 10, 'Antialias did not add partial-pixel coverage to the edge: '
          +JSON.stringify({ solidPixels, changedPixels, partialPixels, radius: layer.maxWidth }));
        select('Browser Sibling');
        await wait(() => input('描边颜色')?.value === '#28c849');
        check(input('描线笔触').value === 'hard' && input('细描边宽度').value === '1' && !input('平滑描边').checked, 'Brush changes leaked into the sibling');
        await setShading('source','toon','sibling');
        select('Browser Model');
        await wait(() => input('描线笔触')?.value === 'pressure');
      } finally { scene.activeCamera = previousCamera; camera.dispose(); }
      phase = 'toon isolation and compilation';
      await setShading('toon-outline','toon','model');
      const toonMaterial = meshFor('toon','model').material;
      check(toonMaterial.getClassName() === 'PBRMaterial' && toonMaterial.albedoTexture?.name === original.albedoTexture?.name
        && toonMaterial.needAlphaTesting() && toonMaterial.alphaCutOff === original.alphaCutOff, 'Toon preview lost the source texture or cutout');
      check(meshFor('toon','sibling') === sibling && sibling.material === original && !isToon(sibling), 'Toon preview affected the shared sibling');
      check(outline() === layer && layer.hasMesh(meshFor('toon','model')) && !layer.hasMesh(sibling), 'Outline did not follow the isolated preview mesh');
      await setShading('ink-outline','toon','model');
      await wait(() => meshFor('toon','model').subMeshes.some(part => part.effect?.defines.includes('#define SCENE_ENVIRONMENT_INK_PREVIEW')));
      check(JSON.stringify(draft()) === beforeToon, 'Toon preview changed the declaration');
      phase = 'shared outline registrations';
      const outlineBox = scene.getMeshByName('box'), outlineCylinder = scene.getMeshByName('cylinder');
      const externalRoot = new verification.TransformNode('external-outline-root', scene);
      const external = verification.getSceneOutline(scene).register({
        root: externalRoot, meshes: [outlineBox], style: verification.defaultOutlineStyle,
      });
      check(outline() === layer && layer.hasMesh(outlineBox) && layer.hasMesh(meshFor('toon','model')),
        'External caller and Lab did not share the same mask');
      await setShading('source','toon','model');
      check(outline() === layer && layer.hasMesh(outlineBox) && !layer.hasMesh(meshFor('toon','model')),
        'Disabling Lab preview removed the independent registration');
      external.update({ meshes: [outlineCylinder], style: { ...verification.defaultOutlineStyle, color: '#aa3355' } });
      check(outline() === layer && !layer.hasMesh(outlineBox) && layer.hasMesh(outlineCylinder), 'Registration did not follow the replacement mesh');
      externalRoot.dispose();
      external.dispose();
      check(!outline() && !scene._depthRenderer?.[previousCamera.uniqueId], 'Removing the last outline left a mask or depth renderer behind');
      await loadPreset('child');
      phase = 'range down to 2';
      select('Browser Box');
      const tree = document.querySelector('#scene-hierarchy .editor-hierarchy-tree');
      const shiftArrow = key => tree.dispatchEvent(new KeyboardEvent('keydown',{key,shiftKey:true,bubbles:true}));
      shiftArrow('ArrowDown'); await wait(()=>document.querySelector('#scene-inspector').textContent.includes('已选择 2 个对象'));
      phase = 'range down to 3';
      shiftArrow('ArrowDown'); await wait(()=>document.querySelector('#scene-inspector').textContent.includes('已选择 3 个对象'));
      phase = 'range up to 2';
      shiftArrow('ArrowUp'); await wait(()=>document.querySelector('#scene-inspector').textContent.includes('已选择 2 个对象'));
      check(input('批量位置 X'),'Common vector field missing from multi-selection');
      check(!input('批量模型路径（GLB / GLTF）'),'Non-common model field shown for geometry selection');
      const batchRuntime = captureRuntime();
      set('批量位置 X','6'); await wait(()=>!button('批量应用并预览').disabled); button('批量应用并预览').click();
      phase = 'batch apply';
      await wait(()=>ready() && draft().objects[0].position[0]===6 && draft().objects[1].position[0]===6);
      assertRuntime(batchRuntime); check(runtime().getMeshByName('box').position.x===6,'Batch transform was not applied to the live node');
      check(document.querySelector('#scene-inspector').textContent.includes('已选择 2 个对象'),'Batch selection was lost after rebuild');
      button('撤销').click(); await wait(()=>ready() && draft().objects[0].position[0]===0 && draft().objects[1].position[0]===0);
      assertRuntime(batchRuntime);
      phase = 'existing regression';
      const boxRow = [...document.querySelectorAll('.editor-hierarchy-row')].find(row=>row.querySelector('.editor-hierarchy-label')?.textContent==='Browser Box');
      check(boxRow, 'Missing box row for context menu');
      boxRow.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2,clientX:120,clientY:120}));
      await wait(()=>button('添加模型'));
      button('添加模型').click();
      let assetEntry=button('添加模型').closest('.command-menu-entry');
      for(const segment of ['GLB','artist_t4kum','ClosedBoxes']){
        const submenu=assetEntry.querySelector(':scope > .command-submenu');
        const folder=[...submenu.children].map(entry=>entry.querySelector(':scope > button')).find(entry=>entry?.hasAttribute('aria-haspopup') && entry.textContent.includes(segment));
        if(folder){folder.click();assetEntry=folder.closest('.command-menu-entry');}
      }
      await wait(()=>button('ClosedBox01.glb'));
      button('ClosedBox01.glb').click();
      await wait(()=>ready() && draft().models.length===2 && draft().models[1].modelPath.endsWith('artist_t4kum/ClosedBoxes/ClosedBox01.glb'));
      check(draft().models[1].parentId==='object:box','Added model did not inherit the context parent');
      check(runtime().getTransformNodeByName('child:'+draft().models[1].id).parent===runtime().getMeshByName('box'),'Async model was not attached to its declared parent');
      button('撤销').click(); await wait(()=>ready() && draft().models.length===1);
      phase = 'object clipboard and delete';
      const openObjectMenu = name => {
        const row=[...document.querySelectorAll('.editor-hierarchy-row')].find(row=>row.querySelector('.editor-hierarchy-label')?.textContent===name);
        check(row, 'Missing object row '+name);
        row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2,clientX:120,clientY:120}));
      };
      openObjectMenu('Browser Box'); button('复制对象').click();
      openObjectMenu('Browser Box'); button('粘贴到此节点').click();
      await wait(()=>ready() && draft().objects.some(item=>item.id==='box-copy-1'));
      check(draft().objects.find(item=>item.id==='box-copy-1').parentId==='object:box','Copied object parent was not set');
      openObjectMenu('Browser Box 副本'); button('剪切对象').click();
      await wait(()=>ready() && !draft().objects.some(item=>item.id==='box-copy-1'));
      document.querySelector('.environment-hierarchy-menu-area').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2,clientX:120,clientY:120}));
      button('粘贴到根层级').click();
      await wait(()=>ready() && draft().objects.some(item=>item.id==='box-copy-1'));
      check(draft().objects.find(item=>item.id==='box-copy-1').parentId===null,'Cut object was not pasted at root');
      openObjectMenu('Browser Box 副本'); button('删除对象').click();
      await wait(()=>ready() && !draft().objects.some(item=>item.id==='box-copy-1'));
      button('撤销').click(); await wait(()=>ready() && draft().objects.some(item=>item.id==='box-copy-1'));
      button('重做').click(); await wait(()=>ready() && !draft().objects.some(item=>item.id==='box-copy-1'));
      select('Browser Hemi'); await wait(()=>input('地面颜色')); check(!input('阴影预设（清空关闭阴影）'),'Hemi exposed shadow');
      select('Browser Sun'); await wait(()=>input('阴影预设（清空关闭阴影）')); check(!input('照明范围'),'Sun exposed point range');
      select('Browser Point'); await wait(()=>input('照明范围'));
      select('Browser Model'); await wait(()=>input('模型路径（GLB / GLTF）'));
      check(input('旋转（弧度） X')?.value==='0' && input('缩放 Y')?.value==='1','Optional vector defaults not shown per axis');
      const modelRuntime = captureRuntime();
      const liveModel = runtime().getTransformNodeByName('child:model');
      set('位置 X','-6'); set('旋转（弧度） X','0.5'); set('缩放 Y','2');
      await wait(()=>!button('应用并预览').disabled); button('应用并预览').click();
      await wait(()=>ready() && draft().models[0].rotation?.[0]===0.5 && draft().models[0].scaling?.[1]===2);
      assertRuntime(modelRuntime); check(liveModel.position.x===-6 && Math.abs((liveModel.rotationQuaternion?.toEulerAngles() || liveModel.rotation).x-.5)<1e-5 && liveModel.scaling.y===2,'Live model transform did not update');
      button('撤销').click(); await wait(()=>ready() && draft().models[0].rotation===undefined && draft().models[0].scaling===undefined);
      assertRuntime(modelRuntime); check(liveModel.position.x===-4 && liveModel.scaling.y===1,'Undo did not restore transform defaults');
      button('重做').click(); await wait(()=>ready() && liveModel.scaling.y===2); assertRuntime(modelRuntime);
      button('撤销').click(); await wait(()=>ready() && liveModel.scaling.y===1); assertRuntime(modelRuntime);
      const transformCount = runtime().transformNodes.length;
      set('模型路径（GLB / GLTF）','resources/Model/GLB/scene-environment-test-missing.glb'); await new Promise(r=>setTimeout(r,50)); button('应用并预览').click();
      await wait(()=>document.querySelector('#status').textContent.includes('加载失败'));
      check(runtime().getMeshByName('box').isEnabled(), 'Failed candidate hid previous preview');
      check(runtime().transformNodes.length===transformCount,'Failed model leaked transform nodes');
      button('撤销').click(); await wait(()=>ready() && draft().models[0].modelPath.endsWith('artist_t4kum/ClosedBoxes/ClosedBox02.glb'));
      select('Browser Cylinder'); await wait(()=>input('圆周细分')); check(!input('深度'),'Cylinder exposed box depth');
      select('Browser Box'); await wait(()=>input('宽度'));
      set('宽度','-3'); await wait(()=>!button('应用并预览').disabled); button('应用并预览').click(); await wait(()=>document.querySelector('[role=alert]')); check(draft().objects[0].geometry.width===2,'Invalid edit changed draft');
      set('宽度','6'); await new Promise(r=>setTimeout(r,50)); button('应用并预览').click(); await wait(()=>ready() && draft().objects[0].geometry.width===6); await wait(()=>input('宽度')?.value==='6');
      check(Math.abs(width()-6)<0.001,'Geometry was not rebuilt');
      button('撤销').click(); await wait(()=>ready() && draft().objects[0].geometry.width===2); await wait(()=>input('宽度')?.value==='2');
      check(Math.abs(width()-2)<0.001,'Undo did not rebuild geometry');
      button('重做').click(); await wait(()=>ready() && draft().objects[0].geometry.width===6); await wait(()=>input('宽度')?.value==='6');
      check(Math.abs(width()-6)<0.001,'Redo did not rebuild geometry');
      button('撤销').click(); button('重做').click(); await wait(()=>ready() && draft().objects[0].geometry.width===6);
      // Create a persisted hierarchy through the actual menus/Inspector.
      const row = name => [...document.querySelectorAll('.editor-hierarchy-row')].find(item => item.querySelector('.editor-hierarchy-label')?.textContent===name);
      const context = async (element, label) => { element.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2,clientX:130,clientY:180})); await wait(()=>button(label)); button(label).click(); };
      await context(row('Browser Model'), '添加 Socket 挂点');
      await wait(()=>ready() && draft().transformNodes.length===1);
      check(runtime().getTransformNodeByName(draft().transformNodes[0].id).parent===runtime().getTransformNodeByName('child:model'),'Forward reference to an async model parent was not resolved');
      button('撤销').click(); await wait(()=>ready() && draft().transformNodes.length===0);
      await context(document.querySelector('.environment-hierarchy-menu-area'), '添加空节点');
      await wait(()=>ready() && draft().transformNodes.length===1 && input('用途'));
      set('名称','动画根节点'); set('位置 X','10'); await wait(()=>!button('应用并预览').disabled); button('应用并预览').click();
      await wait(()=>ready() && row('动画根节点'));
      await context(row('动画根节点'), '添加 Rig');
      await wait(()=>ready() && draft().transformNodes.length===2 && row('Rig 1'));
      await context(row('Rig 1'), '添加 Socket 挂点');
      await wait(()=>ready() && draft().transformNodes.length===3 && row('Socket 挂点 1'));
      const socketId = 'transform:' + draft().transformNodes[2].id;
      check(draft().transformNodes[2].parentId==='transform:'+draft().transformNodes[1].id,'Socket parent was not persisted');
      select('动画根节点'); await wait(()=>input('父节点')); check(input('父节点').options.length===5,'Root parent options should exclude its descendants and lights');
      select('Browser Box'); await wait(()=>input('父节点'));
      const before = runtime().getMeshByName('box'); before.computeWorldMatrix(true); const beforePosition = before.getAbsolutePosition().asArray();
      input('父节点').value=socketId; input('父节点').dispatchEvent(new Event('change',{bubbles:true}));
      await wait(()=>!button('应用父节点').disabled); button('应用父节点').click();
      await wait(()=>ready() && draft().objects[0].parentId===socketId);
      const assertPosition = expected => { const mesh=runtime().getMeshByName('box'); mesh.computeWorldMatrix(true); check(mesh.getAbsolutePosition().asArray().every((value,i)=>Math.abs(value-expected[i])<0.001),'World position changed incorrectly'); };
      assertPosition(beforePosition);
      check(row('Browser Box').closest('.editor-hierarchy-branch').parentElement.closest('.editor-hierarchy-branch').querySelector('.editor-hierarchy-label').textContent==='Socket 挂点 1','Tree does not reflect the declared parent');
      select('动画根节点'); await wait(()=>input('位置 X')); set('位置 X','15'); await wait(()=>!button('应用并预览').disabled); button('应用并预览').click();
      await wait(()=>ready() && draft().transformNodes[0].position[0]===15); assertPosition([beforePosition[0]+5,beforePosition[1],beforePosition[2]]);
      button('撤销').click(); await wait(()=>ready() && draft().transformNodes[0].position[0]===10); assertPosition(beforePosition);
      button('撤销').click(); await wait(()=>ready() && !draft().objects[0].parentId); assertPosition(beforePosition);
      button('重做').click(); await wait(()=>ready() && draft().objects[0].parentId===socketId); assertPosition(beforePosition);
      await context(row('Browser Box'), '移至根层级（保持世界姿态）');
      await wait(()=>ready() && draft().objects[0].parentId===null); assertPosition(beforePosition);
      button('撤销').click(); await wait(()=>ready() && draft().objects[0].parentId===socketId);
      const dragNode = async (sourceName, targetName, placement, valid=true) => {
        const source=row(sourceName); const transfer=new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
        await new Promise(r=>setTimeout(r,30));
        const target=targetName ? row(targetName) : document.querySelector('.editor-hierarchy-root-drop');
        const bounds=target.getBoundingClientRect(); const ratio=placement==='before' ? .1 : placement==='after' ? .9 : .5;
        const options={bubbles:true,cancelable:true,dataTransfer:transfer,clientX:bounds.left+30,clientY:bounds.top+bounds.height*ratio};
        target.dispatchEvent(new DragEvent('dragover',options));
        await new Promise(r=>setTimeout(r,30));
        check(target.classList.contains(targetName ? 'drop-invalid' : 'invalid')===!valid,'Unexpected drop validation');
        target.dispatchEvent(new DragEvent('drop',options));
        source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));
      };
      await dragNode('Browser Cylinder','Socket 挂点 1','inside');
      await wait(()=>ready() && draft().objects[2].parentId===socketId);
      await dragNode('Browser Cylinder','Browser Box','before');
      await wait(()=>ready() && draft().objects[2].order<draft().objects[0].order);
      check(row('Socket 挂点 1').closest('.editor-hierarchy-branch').querySelectorAll('.editor-hierarchy-row')[1].querySelector('.editor-hierarchy-label').textContent==='Browser Cylinder','Before-drop did not reorder the tree');
      button('撤销').click(); await wait(()=>ready() && draft().objects[0].order<draft().objects[2].order);
      button('重做').click(); await wait(()=>ready() && draft().objects[2].order<draft().objects[0].order);
      const validDraft=JSON.stringify(draft());
      await dragNode('动画根节点','Browser Box','inside',false);
      check(JSON.stringify(draft())===validDraft,'Invalid cyclic drop changed the document');
      await dragNode('Browser Cylinder',null,'root-end');
      await wait(()=>ready() && draft().objects[2].parentId===null);
      button('撤销').click(); await wait(()=>ready() && draft().objects[2].parentId===socketId);
      // Only authored objects belong in the tree, regardless of GLTF nesting depth.
      check(![...document.querySelectorAll('.editor-hierarchy-row')].some(item=>item.dataset.objectId.includes('/render:')),'Imported render nodes leaked into the authoring tree');
      check(row('Browser Model').closest('.editor-hierarchy-branch').querySelectorAll('.editor-hierarchy-row').length===1,'Model without authored children must be one row');
      check(row('Browser Model').querySelector('.editor-hierarchy-chevron').classList.contains('empty'),'Model incorrectly shows an expandable internal hierarchy');
      select('Browser Model'); await wait(()=>input('模型路径（GLB / GLTF）'));
      const assetSection=[...document.querySelectorAll('.editor-inspector-section-heading')].find(b=>b.querySelector('strong')?.textContent==='模型资产校正');
      check(assetSection,'Missing asset properties panel'); assetSection.click(); await wait(()=>input('原点偏移 X'));
      check(input('原点偏移 X').readOnly && input('资产缩放 X').readOnly,'Shared asset properties should retain their read-only ownership');
      check(Number(input('资产缩放 X').value)===runtime().getTransformNodeByName('child:model:asset-profile').scaling.x,'Asset panel did not reflect the loaded model');
      check(!row('场景配置').draggable,'Scene config should not be draggable');
      // Marker visibility is local UI state, not a declaration edit or history entry.
      const authored=JSON.stringify(draft());
      const handles=()=>runtime().meshes.filter(mesh=>mesh.name.startsWith('editor:marker:'));
      check(handles().length===3 && handles().every(mesh=>mesh.isEnabled() && mesh.isPickable && mesh.doNotSerialize),'Missing editor-only pickable markers');
      button('挂点标记').click(); check(handles().every(mesh=>!mesh.isEnabled()),'Marker toggle did not hide handles');
      check(JSON.stringify(draft())===authored,'Marker visibility leaked into the declaration');
      await dragNode('Browser Cylinder','Browser Box','after');
      await wait(()=>ready() && draft().objects[0].order<draft().objects[2].order);
      check(handles().every(mesh=>!mesh.isEnabled()),'Preview rebuild lost marker visibility');
      button('挂点标记').click(); check(handles().every(mesh=>mesh.isEnabled()),'Markers did not reappear');
      phase = 'material increment';
      select('Browser Model'); await wait(()=>input('材质 0 baseColor'));
      await setShading('toon','child','model');
      const oldMeshes = runtime().meshes.slice(); const oldRoots = runtime().transformNodes.slice(); const oldGroups = runtime().animationGroups.slice(); const oldCamera = runtime().activeCamera;
      set('材质 0 baseColor','resources/__material-test.png'); await new Promise(r=>setTimeout(r,50)); button('应用材质并预览').click();
      await wait(()=>ready() && draft().models[0].materialOverrides?.[0]?.textures.baseColor.path==='resources/__material-test.png');
      await wait(() => isToon(meshFor('child','model')));
      check(runtime().meshes.length===oldMeshes.length && runtime().meshes.every((m,i)=>m===oldMeshes[i]),'Material edit recreated meshes');
      check(runtime().transformNodes.every((m,i)=>m===oldRoots[i]) && runtime().animationGroups.every((g,i)=>g===oldGroups[i]) && runtime().activeCamera===oldCamera,'Material edit disturbed scene identity');
      button('撤销').click(); await wait(()=>ready() && !draft().models[0].materialOverrides);
      button('重做').click(); await wait(()=>ready() && draft().models[0].materialOverrides?.length===1);
      await wait(() => isToon(meshFor('child','model')));
      document.querySelector('#save-preset').click(); await wait(()=>document.querySelector('#status').textContent.includes('已保存到'));
      return { toonPreview: true, pixelOutline: true, outlineRegionShare, croppedOutlineDepth: true, independentOutlineStyles: true, inkBrushes: true, variableWidthBrush: true, pressureWidthLimits: true, outlineSmoothing: true, outlineOcclusion: true, sharedOutlineRegistrations: true, dragReparent: true, siblingOrder: true, rejectedCycle: true, declarationOnlyTree: true, editorMarkers: true, hierarchy: true, reparentWorldPose: true, parentTransform: true, hierarchyUndoRedo: true, fields: true, validation: true, rebuildSelection: true, undoRedo: true, modelFailureCleanup: true, rapidHistory: true, save: true };
    })()`);
    await new Promise(resolve => { window.webContents.once('did-finish-load', resolve); window.reload(); });
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<600;i++) { const select=document.querySelector('#preset'); if(select?.options.length && !document.querySelector('#load').disabled) { select.value='child'; select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#load').click(); break; } await new Promise(r=>setTimeout(r,50)); }
      for(let i=0;i<600;i++) { if(document.querySelector('#current-scene-key').value==='child' && !document.querySelector('#load').disabled) { const p=JSON.parse(document.querySelector('#preset-json').textContent).scene; if(p.objects[0].geometry.width!==6) throw new Error('Saved width not restored'); if(p.transformNodes.length!==3 || p.objects[0].parentId!=='transform:'+p.transformNodes[2].id) throw new Error('Saved hierarchy not restored'); if(p.objects[2].parentId!==p.objects[0].parentId || !(p.objects[0].order<p.objects[2].order)) throw new Error('Saved drag order not restored'); return; } await new Promise(r=>setTimeout(r,50)); } throw new Error('Refresh timeout');
    })()`);
    await window.webContents.executeJavaScript(`(async()=>{
      const preset=JSON.parse(document.querySelector('#preset-json').textContent).scene;
      if(preset.models[0].materialOverrides?.[0]?.textures?.baseColor?.path!=='resources/__material-test.png') throw new Error('Saved material binding was not restored after refresh');
      const findModelRow = () => [...document.querySelectorAll('.editor-hierarchy-row')].find(item => item.querySelector('.editor-hierarchy-label')?.textContent === 'Browser Model');
      let row = findModelRow();
      for (let i = 0; !row && i < 40; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        row = findModelRow();
      }
      if(!row) throw new Error('Missing model row for screenshot');
      row.click();
      for(let i=0;i<40;i++) {
        if(document.querySelector('[aria-label="缩放 X"]')) {
          if(document.querySelector('[aria-label="着色模式"]')?.value!=='source') throw new Error('Temporary shading survived reload');
          return;
        }
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw new Error('Model vector inputs did not render');
    })()`);
    const capture = await window.webContents.capturePage();
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/scene-environment-browser.png'), capture.toPNG());
    console.log('Development browser checks passed, including brush limits and edge smoothing.');
    const productionWindow = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
    window.destroy();
    await productionWindow.loadURL(process.env.SCENE_ENVIRONMENT_PRODUCTION_URL);
    await productionWindow.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<600;i++) { const select=document.querySelector('#preset'); if(select?.options.length) { if(![...select.options].some(o=>o.value==='minimal-city')) throw new Error('Production did not read bundled catalog'); select.value='minimal-city'; select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#load').disabled=false; document.querySelector('#load').click(); break; } await new Promise(r=>setTimeout(r,50)); }
      for(let i=0;i<600;i++) { if(document.querySelector('#current-scene-key')?.value==='minimal-city' && !document.querySelector('#load').disabled) return; await new Promise(r=>setTimeout(r,50)); } throw new Error('Production catalog preview failed: '+document.querySelector('#status')?.textContent);
    })()`);
    report({ ...result, reload: true, productionCatalog: true }); app.exit(0);
  } catch (error) { report({ error: String(error), stack: error.stack }); console.error(error); app.exit(1); }
});
setTimeout(()=>{report({error:'Browser regression timed out'});app.exit(1);},150000).unref();
