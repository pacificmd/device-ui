// What every tool shares: a browser the engine can draw in, the name a tool goes by, and private folders that never reach git.
// The tools run in this repository through `pnpm <tool>` and in anyone's project through `npx device-ui <tool>`, from these same files.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** How to call a tool here: `pnpm look` inside this repository, `npx device-ui look` anywhere else. */
export const cmd = name => (process.env.npm_lifecycle_event === name ? `pnpm ${name}` : `npx device-ui ${name}`);

const NEED = 'This needs Playwright and its Chromium, which device-ui doesn\'t install for you:\n  npm i -D playwright && npx playwright install chromium';

/**
 * Playwright, from the project the tool is run in first, then from beside the library. Either package will do.
 * It's heavy and only these tools want it, so it's never a dependency: without it the tool says how to get it and stops.
 */
export async function playwright() {
  for (const from of [join(process.cwd(), 'noop.js'), import.meta.filename]) {
    const require = createRequire(from);
    for (const name of ['playwright', '@playwright/test']) {
      let path;
      try {
        path = require.resolve(name);
      } catch {
        continue;
      }
      const m = await import(pathToFileURL(path).href);
      const chromium = m.chromium ?? m.default?.chromium;
      if (chromium) return { chromium };
    }
  }
  console.error(NEED);
  process.exit(1);
}

/** A plain Chromium for reading photos, with what to do when its browser binary isn't installed. */
export async function chromium() {
  const { chromium } = await playwright();
  return {
    launch: options => chromium.launch(options).catch(e => {
      console.error(/Executable doesn't exist|browserType.launch/.test(e.message) ? NEED : e.message);
      process.exit(1);
    }),
  };
}

/**
 * A folder of the tools' own, made if it isn't there, with a `.gitignore` of `*` in it, so what's in it never goes into
 * anyone's repository: pictures the tools make, and photos of things, which belong to whoever took them.
 */
export function privateDir(dir) {
  const full = resolve(dir);
  mkdirSync(full, { recursive: true });
  if (!existsSync(join(full, '.gitignore'))) writeFileSync(join(full, '.gitignore'), '# Made by device-ui\'s tools. Never committed.\n*\n');
  return full;
}

// Software GL draws the same pixels on any machine, and needs no GPU. It is about six times slower.
export const SOFTWARE = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const GPU = { darwin: 'metal', win32: 'd3d11', linux: 'gl' };
/** A browser driven by a script still plays what its clicks start, out loud on whoever's machine runs it. Sound still runs, unheard. */
export const MUTE = ['--mute-audio'];

/**
 * Chromium flags for this machine's GPU, or for software GL where there isn't one. `DEVICE_UI_GL=software` forces software.
 * Linux without /dev/dri is a sandbox or a container, and asking for a GPU there only wastes a launch.
 */
export function gpuArgs(platform = process.platform) {
  const angle = GPU[platform];
  if (process.env.DEVICE_UI_GL === 'software' || !angle || (platform === 'linux' && !existsSync('/dev/dri'))) return SOFTWARE;
  return [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'];
}

/** The engine turns itself off without these, and every part falls back to a plain control. */
const probe = () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl?.getExtension('EXT_color_buffer_float')) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
};

/** A browser the engine can run in: the GPU if it works, otherwise software GL. */
export async function launch() {
  const { launch } = await chromium();
  const tries = [...new Set([gpuArgs(), SOFTWARE])];
  for (const args of tries) {
    const browser = await launch({ args: [...args, ...MUTE] });
    const page = await browser.newPage();
    const renderer = await page.evaluate(probe).catch(() => null);
    await page.close();
    if (renderer) return { browser, renderer, software: /swiftshader|llvmpipe|software/i.test(renderer) };
    await browser.close();
  }
  throw new Error('No usable WebGL2 here, with the GPU or in software GL, so nothing would be drawn.');
}
