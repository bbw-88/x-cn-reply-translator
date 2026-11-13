let opening;

async function openEngine() {
  if (opening) return opening;
  opening = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('engine.html')],
    });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'engine.html',
        reasons: ['WORKERS'],
        justification: 'Run the bundled local translation model with browser WebAssembly.',
      });
    }
  })();
  try {
    await opening;
  } finally {
    opening = undefined;
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'background' || !sender.tab) return;
  const origin = new URL(sender.url).origin;
  if (origin !== 'https://x.com' && origin !== 'https://twitter.com') return;

  openEngine()
    .then(() => chrome.runtime.sendMessage({ ...message, target: 'engine' }))
    .then(respond, (error) => { console.error('Engine initialization failed', error); respond({ error: '翻译暂时不可用。刷新 X 页面后可以重试。' }); });
  return true;
});
