let model;
let queue = Promise.resolve();

function getModel() {
  model ??= (async () => {
    const { env, pipeline } = await import('./vendor/transformers.web.js');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.useBrowserCache = false;
    env.localModelPath = new URL('./models/', location.href).href;
    env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', location.href).href;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    return pipeline('translation', 'zh-en', { device: 'wasm', dtype: 'q8' });
  })().catch((error) => {
    model = undefined;
    throw error;
  });
  return model;
}

const han = /\p{Script=Han}/u;
const literal = /(https?:\/\/[^\s\u3000-\u303f\uff00-\uffef]+|(?<![\p{L}\p{N}_])@[\w]{1,15}(?![\w])|(?<![\p{L}\p{N}_])#[\w]+)/u;

async function translateDraft(text) {
  const translate = await getModel();
  const lines = text.split('\n');
  const english = [];
  for (const line of lines) {
    const pieces = line.split(literal);
    for (let i = 0; i < pieces.length; i += 2) {
      const part = pieces[i];
      if (!han.test(part)) continue;
      const [result] = await translate(part.trim(), { max_new_tokens: 384, num_beams: 3 });
      const translation = result?.translation_text?.trim();
      if (!translation) throw new Error('Empty translation');
      const before = i > 0 && !/^\s*[,.:;!?，。！？]/u.test(translation) ? ' ' : '';
      const after = i + 1 < pieces.length && !/\s$/u.test(translation) ? ' ' : '';
      pieces[i] = before + translation + after;
    }
    english.push(pieces.join('').trim());
  }
  return english.join('\n').trim();
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'engine' || sender.tab || sender.id !== chrome.runtime.id) return;
  const text = message.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 450) {
    respond({ error: '请输入 1–450 字的中文。' });
    return;
  }
  const job = queue.then(() => translateDraft(text));
  queue = job.catch(() => {});
  job.then(
    (translation) => respond({ translation }),
    (error) => {
      console.error('Local translation failed', error?.name);
      respond({ error: '本地翻译失败，中文已保留。请重试。' });
    },
  );
  return true;
});
