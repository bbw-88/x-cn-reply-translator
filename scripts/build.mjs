import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const vendor = join(dist, 'vendor');
const cache = join(root, '.model-cache');
const models = join(dist, 'models', 'zh-en');
const modelUrl = 'https://huggingface.co/Xenova/opus-mt-zh-en/resolve/e4256ee55366f450a3776810608c82b60e430a76/';
const modelFiles = {
  'config.json': '293d318fce41dbf04114eac45037bb88a32d7c4ee21011a75e24a8b98ca45ad1',
  'generation_config.json': '8dc29fef0fe82109f94ef3c2e6ea6bded3215d357b226c34cf7b4630726766c9',
  'tokenizer_config.json': '08849acc0a539c4749d8665e9d6217735503a97871ccebeea8a762d5fba1acf7',
  'tokenizer.json': 'b306d0301cf280bfd647d7067b5ade2a97b987e6d678df110703c002433643ff',
  'onnx/encoder_model_quantized.onnx': '84d5e171b626bc8b6b220d022ac58696e9528c25deeacca62b5cbf4364547a99',
  'onnx/decoder_model_merged_quantized.onnx': 'c6b7f04ff1ba0fbd1bf6852599b4c0cad6fe512d57cd887f44ef36cf705424cb',
};

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function copyModelFile(file, expected) {
  const cached = join(cache, file);
  const actual = await sha256(cached).catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  if (actual !== expected) {
    const pending = cached + '.download';
    await mkdir(dirname(cached), { recursive: true });
    console.log('Downloading ' + file);
    try {
      const response = await fetch(new URL(file, modelUrl), { signal: AbortSignal.timeout(300_000) });
      if (!response.ok || !response.body) throw new Error(file + ' HTTP ' + response.status);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(pending));
      if (await sha256(pending) !== expected) throw new Error('SHA-256 mismatch for ' + file);
      await rename(pending, cached);
    } finally {
      await rm(pending, { force: true });
    }
  }
  await cp(cached, join(models, file));
}

const require = createRequire(import.meta.url);
const transformers = dirname(require.resolve('@huggingface/transformers'));
const ortRequire = createRequire(join(transformers, 'transformers.web.min.js'));
const ort = dirname(ortRequire.resolve('onnxruntime-web'));
await mkdir(vendor, { recursive: true });
await cp(join(root, 'src'), dist, { recursive: true });
await cp(join(root, 'licenses'), join(dist, 'licenses'), { recursive: true });
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md']) {
  await cp(join(root, file), join(dist, file));
}

await build({
  entryPoints: [join(transformers, 'transformers.web.min.js')],
  outfile: join(vendor, 'transformers.web.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'chrome116',
  legalComments: 'eof',
  minify: true,
});

for (const ext of ['mjs', 'wasm']) {
  const jsep = 'ort-wasm-simd-threaded.jsep.' + ext;
  const wasm = 'ort-wasm-simd-threaded.' + ext;
  await cp(join(transformers, jsep), join(vendor, jsep));
  await cp(join(ort, wasm), join(vendor, wasm));
}

for (const [file, digest] of Object.entries(modelFiles)) await copyModelFile(file, digest);
console.log('Chrome extension ready in dist/');
