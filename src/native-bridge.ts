/** Derived from Native Translate pageBridge.ts (MIT, Henry Zhang).
 * See UPSTREAM.md and licenses/Native-Translate-LICENSE.txt. */
const BRIDGE_REQ_TYPE = '__XCN_NATIVE_REQ_V2';
const BRIDGE_RES_TYPE = '__XCN_NATIVE_RES_V2';
interface TranslatorInstance {
  ready?: Promise<void>;
  translate(text: string): Promise<string>;
}
type Progress = (progress: number) => void;
interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (m: EventTarget) => void;
}
type PageBridgeWindow = Window & typeof globalThis & {
  Translator?: { create(options: TranslatorCreateOptions): Promise<TranslatorInstance> };
  translation?: { createTranslator(options: TranslatorCreateOptions): Promise<TranslatorInstance> };
  __xCnNativeBridgeInit?: boolean;
};
const win = window as PageBridgeWindow;
let cachedTranslator: TranslatorInstance | undefined;
let creating: Promise<TranslatorInstance> | undefined;
const progressListeners = new Set<Progress>();
function resolveAdapter() {
  if (win.Translator && typeof win.Translator.create === 'function') return { create: win.Translator.create.bind(win.Translator) };
  if (win.translation && typeof win.translation.createTranslator === 'function') return { create: win.translation.createTranslator.bind(win.translation) };
  return null;
}
async function getTranslator(onProgress: Progress) {
  if (cachedTranslator) return cachedTranslator;
  progressListeners.add(onProgress);
  try {
    if (!creating) {
      const adapter = resolveAdapter();
      if (!adapter) throw new Error('Translator API unavailable');
      // Create immediately during the originating click's user activation.
      creating = adapter.create({sourceLanguage:'zh',targetLanguage:'en',monitor(m) {
        m.addEventListener('downloadprogress', (e: Event) => {
          const value = (e as Event & {loaded:number}).loaded;
          if (Number.isFinite(value)) for (const listener of progressListeners) listener(value);
        });
      }}).then(async translator => {
        if (translator.ready) await translator.ready;
        cachedTranslator = translator;
        return translator;
      }).finally(() => { creating = undefined; });
    }
    return await creating;
  } finally { progressListeners.delete(onProgress); }
}
const han = /\p{Script=Han}/u;
const literal = /(https?:\/\/[^\s\u3000-\u303f\uff00-\uffef]+|(?<![\p{L}\p{N}_])@[\w]{1,15}(?![\w])|(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+)/u;
async function translateDraft(translator: TranslatorInstance, text: string) {
  const output: string[] = [];
  for (const line of text.split('\n')) {
    const pieces = line.split(literal);
    for (let i = 0; i < pieces.length; i += 2) {
      if (!han.test(pieces[i])) continue;
      const translation = (await translator.translate(pieces[i].trim())).trim();
      if (!translation) throw new Error('Empty translation');
      pieces[i] = (i > 0 ? ' ' : '') + translation + (i + 1 < pieces.length ? ' ' : '');
    }
    output.push(pieces.join('').trim());
  }
  return output.join('\n');
}
function errorToMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('API unavailable')) return '当前页面无法使用 Chrome 本机翻译。请确认使用桌面 Chrome 138 或更新版本。';
  if (name === 'NotAllowedError') return '请再次点击翻译按钮，以启动 Chrome 语言包。';
  return 'Chrome 本机翻译未完成。首次使用请联网下载语言包后再试，中文已保留。';
}
if (!win.__xCnNativeBridgeInit) {
  win.__xCnNativeBridgeInit = true;
  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.type !== BRIDGE_REQ_TYPE ||
        typeof data.id !== 'string' || data.id.length > 80 || data.action !== 'translate' ||
        typeof data.text !== 'string' || !data.text.trim() || data.text.length > 450) return;
    const respond = (payload: object) => window.postMessage({type:BRIDGE_RES_TYPE,id:data.id,...payload},location.origin);
    void (async () => {
      try {
        const translator = await getTranslator(progress => respond({progress}));
        const result = await translateDraft(translator, data.text);
        respond({ok:true,result});
      } catch (error) { respond({ok:false,error:errorToMessage(error)}); }
    })();
  });
}
