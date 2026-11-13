(() => {
  const editorSelector = '[contenteditable="true"][role="textbox"][data-testid^="tweetTextarea_"]';
  const submitSelector = '[data-testid="tweetButton"],[data-testid="tweetButtonInline"]';
  const replyLabel = /^(?:Reply|回复|回覆|返信|답글|Responder|Répondre|Antworten|Rispondi|Balas|Trả lời|Yanıtla|Ответить)$/iu;
  const replyPlaceholder = /Post your reply|Tweet your reply|发布你的回复|發佈你的回覆|發表你的回覆|回复帖子|回覆貼文/iu;
  const han = /\p{Script=Han}/u;
  const panels = new Map();

  function translateLocal(text, progress) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        window.removeEventListener('message', receive);
        reject(new Error('语言包准备或翻译超时，请检查网络后重试。中文已保留。'));
      }, 180000);
      function receive(event) {
        const data = event.data;
        if (event.source !== window || event.origin !== location.origin ||
            data?.type !== '__XCN_NATIVE_RES_V2' || data.id !== id) return;
        if (typeof data.progress === 'number') { progress(data.progress); return; }
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        if (data.ok && typeof data.result === 'string') resolve({translation:data.result});
        else resolve({error:data.error || '翻译未完成，中文已保留。'});
      }
      window.addEventListener('message', receive);
      window.postMessage({type:'__XCN_NATIVE_REQ_V2',id,action:'translate',text},location.origin);
    });
  }

  function isReply(editor) {
    const description = editor.getAttribute('aria-describedby');
    if (description && replyPlaceholder.test(document.getElementById(description)?.textContent ?? '')) {
      return true;
    }
    const dialog = editor.closest('[role="dialog"]');
    for (let scope = editor.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
      if (scope.querySelectorAll(editorSelector).length > 1) break;
      const buttons = scope.querySelectorAll(submitSelector);
      if (buttons.length) {
        return [...buttons].some((button) => replyLabel.test(button.textContent.trim()));
      }
      if (scope === dialog || scope.matches('main')) break;
    }
    return false;
  }

  function draftText(editor) {
    return editor.innerText.replace(/[\u200B\uFEFF]/gu, '').trim();
  }

  async function fillReply(editor, translation, original) {
    editor.focus({ preventScroll: true });
    // X applies its focus state asynchronously. Let it finish before selecting.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!editor.isConnected || draftText(editor) !== original) return false;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) {
      range.setStart(first, 0);
      let last = first;
      while (walker.nextNode()) last = walker.currentNode;
      range.setEnd(last, last.length);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    // Notify React's selection plugin, so Draft.js replaces its model selection.
    editor.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    // Give Draft.js time to synchronize the selection before replacing its content.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (document.activeElement !== editor || !editor.contains(selection.anchorNode) || draftText(editor) !== original) return false;
    if (original && selection.toString().replace(/[\u200B\uFEFF]/gu,'').trim() !== original) return false;

    if (!translation) {
      document.execCommand('delete', false);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return draftText(editor) === '';
    }

    // Draft.js handles paste events and updates its own editor state.
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', translation);
    editor.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData, bubbles: true, cancelable: true,
    }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (draftText(editor) === translation) return true;

    // A native editing command also emits input for ordinary contenteditable fields.
    if (draftText(editor)) return false;
    editor.focus({ preventScroll: true });
    document.execCommand('insertText', false, translation);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return draftText(editor) === translation;
  }

  function mount(editor, anchor) {
    const host = document.createElement('div');
    host.style.display = 'block';
    host.style.margin = '4px 0';
    host.style.flex = 'none';
    host.style.width = '100%';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = [
      '<style>',
      ':host { color-scheme:light dark; }',
      '* { box-sizing:border-box; }',
      'button,textarea { font:inherit; }',
      'button { cursor:pointer; }',
      'button:focus-visible,textarea:focus-visible { outline:2px solid #1d9bf0; outline-offset:2px; }',
      'button:disabled { cursor:default; opacity:.55; }',
      '.wrap { font:14px/1.4 system-ui,"Microsoft YaHei",sans-serif; }',
      '.open,.close { padding:4px 0; color:#1478b5; background:transparent; border:0; font-weight:650; }',
      '.open { padding:5px 10px; border:1px solid currentColor; border-radius:16px; }',
      '.panel { padding:10px; border:1px solid #8899a655; border-radius:12px; background:#1d9bf009; }',
      '[hidden] { display:none !important; }',
      'textarea { width:100%; min-height:65px; display:block; padding:8px; resize:vertical; color:inherit;',
      '  background:transparent; border:1px solid #8899a677; border-radius:8px; }',
      '.controls { margin-top:8px; display:flex; align-items:center; flex-wrap:wrap; gap:8px 12px; }',
      '.translate { background:#1478b5; border:0; border-radius:18px; color:white; font-weight:650; padding:6px 13px; }',
      '.status { margin:6px 0 0; font-size:13px; overflow-wrap:anywhere; }',
      '.status:empty { display:none; }',
      '@media (prefers-color-scheme: dark) { .open,.close { color:#62bcff; } }',
      '</style>',
      '<div class="wrap" lang="zh-CN">',
      '<button class="open" type="button" aria-expanded="false" aria-controls="x-reply-cn-panel">中文回复 → 英文</button>',
      '<button class="direct open" type="button" hidden>翻译框内中文</button>',
      '<div class="panel" id="x-reply-cn-panel" hidden>',
      '<textarea rows="2" maxlength="450" placeholder="在这里写中文回复…" aria-label="中文回复" spellcheck="false"></textarea>',
      '<div class="controls">',
      '<button class="translate" type="button" title="Ctrl+Enter">翻译并填入</button>',
      '<button class="undo close" type="button" hidden>撤销填入</button>',
      '<button class="close" type="button">收起</button>',
      '</div>',
      '<p class="status" role="status" aria-live="polite"></p>',
      '</div></div>',
    ].join('');
    const open = root.querySelector('.open');
    const direct = root.querySelector('.direct');
    const panel = root.querySelector('.panel');
    const source = root.querySelector('textarea');
    const translate = root.querySelector('.translate');
    const close = root.querySelector('button.close:not(.undo)');
    const undo = root.querySelector('.undo');
    const status = root.querySelector('.status');
    let lastFilled = '';
    let busy = false;
    let composing = false;
    const history = [];
    function updateDirect() { direct.hidden = !han.test(draftText(editor)); }
    editor.addEventListener('input', updateDirect);
    updateDirect();

    function toggle(expanded) {
      open.hidden = expanded;
      open.setAttribute('aria-expanded', String(expanded));
      panel.hidden = !expanded;
      (expanded ? source : open).focus({ preventScroll: true });
    }

    async function translateAndFill(fromEditor = false) {
      if (busy || composing) return;
      if (fromEditor) {
        source.value = draftText(editor);
        toggle(true);
      }
      const raw = source.value;
      const text = raw.trim();
      if (!han.test(text)) {
        status.textContent = '请先输入中文。';
        source.focus();
        return;
      }
      if (text.length > 450) { status.textContent = '一次最多翻译 450 个字符，请缩短回复。'; return; }
      const original = draftText(editor);
      if (!fromEditor && original && original !== lastFilled) {
        status.textContent = '原回复框已有文字。请先保留或清空原稿，再填入译文。';
        return;
      }

      busy = true;
      translate.disabled = true;
      direct.disabled = true;
      undo.disabled = true;
      const route = location.href;
      status.textContent = '正在本机翻译。首次需联网下载 Chrome 语言包，请稍候…';
      try {
        const result = await translateLocal(text, (value) => {
          status.textContent = 'Chrome 正在准备语言包 '+Math.round(Math.max(0,Math.min(1,value))*100)+'%，完成后可离线翻译…';
        });
        if (result?.error || !result?.translation) {
          status.textContent = result?.error || '翻译暂时不可用，请重试。';
          return;
        }
        if (!editor.isConnected || !host.isConnected || location.href !== route || !isReply(editor)) return;
        if (composing || source.value !== raw || draftText(editor) !== original || panel.hidden) {
          status.textContent = '草稿有变动，点击「翻译并填入」可重新翻译。';
          return;
        }
        if (!await fillReply(editor, result.translation, original)) {
          status.textContent = 'X 回复框未确认填入，中文已保留。请检查回复框后重试。';
          return;
        }
        lastFilled = result.translation;
        history.push({before:original,after:lastFilled});
        if (history.length > 10) history.shift();
        undo.hidden = false;
        updateDirect();
        status.textContent = '已填入英文，尚未发送。请检查措辞，也可撤销填入。';
      } catch (error) {
        status.textContent = error.message || '翻译未完成，中文已保留。请刷新 X 页面后重试。';
      } finally {
        busy = false;
        translate.disabled = false;
        direct.disabled = false;
        undo.disabled = false;
      }
    }

    open.addEventListener('click', () => toggle(true));
    close.addEventListener('click', () => toggle(false));
    translate.addEventListener('click', () => translateAndFill());
    direct.addEventListener('click', () => translateAndFill(true));
    undo.addEventListener('click', async () => {
      if (busy || !history.length) return;
      const entry = history.at(-1);
      if (draftText(editor) !== entry.after) {
        status.textContent = '英文已被手动修改，为保留你的修改，没有撤销。'; return;
      }
      busy = true;
      translate.disabled = direct.disabled = undo.disabled = true;
      try {
        if (await fillReply(editor, entry.before, entry.after)) {
          history.pop();
          lastFilled = history.at(-1)?.after || '';
          undo.hidden = !history.length;
          updateDirect();
          status.textContent = '已撤销填入，恢复原草稿。';
        } else status.textContent = '未确认撤销，请检查回复框。';
      } finally { busy = false; translate.disabled = direct.disabled = undo.disabled = false; }
    });
    source.addEventListener('compositionstart', () => { composing = true; });
    source.addEventListener('compositionend', () => { composing = false; });
    source.addEventListener('input', () => {
      if (!busy) status.textContent = '';
    });
    for (const type of ['keydown', 'keyup', 'keypress']) {
      root.addEventListener(type, (event) => {
        event.stopPropagation();
        if (type === 'keydown' && event.key === 'Enter' && (event.ctrlKey || event.metaKey) &&
            event.target === source && !event.isComposing && event.keyCode !== 229 && !composing) {
          event.preventDefault();
          translateAndFill();
        }
      });
    }
    // X attaches focus handlers to composer containers. Keep pointer and editing
    // events inside this panel while preserving the textarea's native behavior.
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click',
      'dblclick', 'beforeinput', 'input', 'compositionstart', 'compositionupdate',
      'compositionend', 'paste', 'cut', 'focusin', 'focusout']) {
      root.addEventListener(type, (event) => event.stopPropagation());
    }
    anchor.before(host);
    return host;
  }

  function scan() {
    for (const [editor, host] of panels) {
      if (editor.isConnected && host.isConnected && isReply(editor)) {
        host.shadowRoot.querySelector('.direct').hidden = !han.test(draftText(editor));
        continue;
      }
      host.remove();
      panels.delete(editor);
    }
    for (const editor of document.querySelectorAll(editorSelector)) {
      if (panels.has(editor) || !isReply(editor)) continue;
      // Keep our controls outside X's clickable, horizontal editor label.
      let anchor = editor.closest('[data-testid^="tweetTextarea_"][data-testid$="_label"]') ??
        editor.closest('[data-testid$="RichTextInputContainer"]') ?? editor;
      while (anchor.parentElement && anchor.parentElement !== document.body) {
        const layout = getComputedStyle(anchor.parentElement);
        if (layout.display === 'flex' && layout.flexDirection.startsWith('row')) {
          anchor = anchor.parentElement;
        } else {
          break;
        }
      }
      panels.set(editor, mount(editor, anchor));
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  scan();
})();
