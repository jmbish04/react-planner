// Rasterize an SVG floorplan to PNG inside the Worker using resvg-wasm.
// The .wasm is bundled as a WebAssembly.Module and the font as binary data
// (see wrangler.jsonc "rules" for *.ttf).
import { initWasm, Resvg } from '@resvg/resvg-wasm';
// @ts-ignore wrangler bundles .wasm imports as a WebAssembly.Module
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';
// @ts-ignore .ttf imported as binary (ArrayBuffer) via the wrangler Data rule
import fontData from '../assets/font.ttf';

let ready: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!ready) ready = initWasm(wasmModule as WebAssembly.Module);
  return ready;
}

export async function svgToPng(svg: string): Promise<Uint8Array> {
  await ensureWasm();
  const resvg = new Resvg(svg, {
    background: 'white',
    font: {
      fontBuffers: [new Uint8Array(fontData as ArrayBuffer)],
      defaultFontFamily: 'DejaVu Sans',
      loadSystemFonts: false,
    },
  });
  return resvg.render().asPng();
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}
