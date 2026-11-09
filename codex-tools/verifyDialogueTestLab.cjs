const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], network = [], checks = [];
  win.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => { network.push(details.url); callback({ cancel: true }); });
  const page = source => win.webContents.executeJavaScript(source);
  const wait = async expression => {
    const deadline = Date.now() + 30000;
    while (!await page(expression)) {
      if (Date.now() > deadline) throw new Error(`超时：${expression}\n${await page('document.body.innerText.slice(0, 2000)')}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  const click = selector => page(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const select = (field, value) => page(`(() => {
    const input = document.querySelector('[data-lab-panel="dialogue"] [data-lab-setting="${field}"]');
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  try {
    await win.loadFile(resolveRepoPath('node_modules/.cache/dialogue-test-build/labs/composable/dialogue-test-lab/index.html'));
    await wait(`document.querySelector('.lab-global-status')?.textContent.startsWith('已组合') && !document.querySelector('[data-dialogue-test]').disabled`);
    assert.equal(await page(`(() => {
      const picker = document.querySelector('[data-lab-panel="dialogue"] select[data-lab-setting="ui-preset"]');
      const textOnly = picker.querySelector('option[value="default_dialogue_ui"]');
      const other = picker.querySelector('option[value="message_bar_default"]');
      return picker.value === 'dialogue_test_ui' && textOnly.disabled && textOnly.textContent.includes('缺少可见的对话选项')
        && other.disabled && other.textContent.includes('缺少可见的对白正文');
    })()`), true);
    assert.equal(await page(`document.querySelectorAll('[data-viewport-layer="ui:dialogue"]').length`), 0);
    await click('[data-dialogue-test]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('欢迎来到对话测试场景')`);
    assert.equal(await page(`document.querySelector('[data-dialogue-test]').disabled`), true);
    await click('[data-dialogue-next]');
    await wait(`document.querySelectorAll('[data-dialogue-choice]').length === 2`);
    assert.equal(await page(`document.querySelector('[data-ui-node="speaker-name"]').textContent`), '向导');
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dialogue-test.png'), (await win.webContents.capturePage()).toPNG());
    await click('[data-dialogue-choice="greeting:about"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]').textContent.includes('操作面板只负责发送开始请求')`);
    await click('[data-dialogue-next]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]').textContent.includes('同一个对话服务')`);
    await click('[data-dialogue-next]');
    await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]') && !document.querySelector('[data-dialogue-test]').disabled`);
    checks.push('configured dialogue + UI preset + multiple lines + branch + normal completion');
    await click('[data-dialogue-test]'); await wait(`!!document.querySelector('[data-dialogue-cancel]')`);
    await click('[data-dialogue-cancel]'); await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    checks.push('cancel + restart');
    await click('[data-dialogue-test]'); await wait(`!!document.querySelector('[data-dialogue-next]')`);
    await page(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', key: 'Enter', bubbles: true }));`);
    await wait(`document.querySelectorAll('[data-dialogue-choice]').length === 2`);
    await page(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2', key: '2', bubbles: true }));`);
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]').textContent.includes('下次再聊')`);
    await page(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));`);
    await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    checks.push('keyboard continue + branch + cancel');
    await select('entry', 'about');
    assert.equal(await page(`document.querySelector('[data-lab-panel="dialogue"] select[data-lab-setting="ui-preset"] option[value="default_dialogue_ui"]').disabled`), false);
    await select('ui-preset', 'default_dialogue_ui');
    await click('[data-dialogue-test]');
    await wait(`document.querySelector('[data-ui-document="default_dialogue_ui"] [data-ui-node="dialogue-box"]')?.textContent.includes('操作面板只负责发送开始请求')`);
    await click('[data-dialogue-stop]');
    await select('entry', 'greeting');
    await wait(`document.querySelector('[data-dialogue-status]').textContent.includes('缺少可见的对话选项') && document.querySelector('[data-dialogue-test]').disabled`);
    assert.equal(await page(`document.querySelectorAll('[data-viewport-layer="ui:dialogue"]').length`), 0);
    await select('ui-preset', 'dialogue_test_ui');
    await click('[data-dialogue-test]'); await wait(`!!document.querySelector('[data-dialogue-cancel]')`);
    await click('[data-dialogue-cancel]'); await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    checks.push('the picker explains incompatibility, allows a text-only UI for a text-only entry and recovers when a choice-capable UI is selected');

    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dialogue-test.json'), JSON.stringify({ passed: true, checks, errors, network }, null, 2));
    console.log(JSON.stringify({ passed: true, checks })); win.destroy(); app.exit(0);
  } catch (error) {
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dialogue-test.json'), JSON.stringify({ passed: false, checks, errors, network, error: String(error) }, null, 2));
    console.error(error); console.error(errors); win.destroy(); app.exit(1);
  }
});
