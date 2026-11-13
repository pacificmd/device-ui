#!/usr/bin/env node
// `npx device-ui <tool> ...`: the tools for building a real thing as a device, in anyone's project. The device-ui repository runs
// the same files as `pnpm ref`, `pnpm measure`, `pnpm trace` and `pnpm look`.
import { existsSync, watch } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const TOOLS = {
  new: 'new <id> <wMm> <hMm>: a device page to start from, devices/<id>.html',
  ref: 'ref <id> "<what it is>": real photos into reference/<id>/, with one sheet to read; ref <id> --front <n> picks the straight-on one',
  measure: 'measure <photo> <wMm>[x<hMm>] --corners x,y x,y x,y x,y: the photo straightened onto a mm grid, .look/measure.png; run without corners for a pixel grid',
  trace: 'trace <photo> <wMm>[x<hMm>] name=x,y | name=x,y,w,h,ink ...: curved outlines and lettering off a straight-on photo, in mm, ready for a path',
  serve: 'serve [dir]: serves the folder on localhost so a device page can be opened in a browser, until ctrl-c',
  look: 'look <page.html> [--crop x,y,w,h] [--try steps] [--scene] [--debug view] [--live]: every state of its device as pictures and words, in .look/',
};
const [tool, ...rest] = process.argv.slice(2);
if (!TOOLS[tool]) {
  console.log(`npx device-ui <tool>\n\n${Object.values(TOOLS).map(t => `  ${t}`).join('\n')}\n\nref, measure, trace and look need Playwright: npm i -D playwright && npx playwright install chromium`);
  process.exit(tool ? 1 : 0);
}

if (tool === 'serve') {
  const { serve } = await import('./serve.mjs');
  const { url } = await serve(rest[0] ?? '.', +(process.env.PORT ?? 0));
  console.log(`${url}/  Device pages are under it by their path, as ${url}/devices/<id>.html. Stop with ctrl-c.`);
} else if (tool !== 'look') {
  // Each reads its own arguments, as it does when the repository runs it.
  process.argv = [process.argv[0], join(import.meta.dirname, `${tool}.mjs`), ...rest];
  await import(`./${tool}.mjs`);
} else {
  const { look } = await import('./look.mjs');
  const { serve } = await import('./serve.mjs');
  // Pages are served from here, so one that reaches up to node_modules finds it.
  const root = process.cwd();
  const pages = rest.filter(a => /\.html?$/.test(a));
  for (const p of pages) {
    if (!existsSync(p)) {
      console.error(`No such page: ${p}`);
      process.exit(1);
    }
    if (relative(root, resolve(p)).startsWith('..')) {
      console.error(`${p} is outside ${root}. Run look from a folder that holds both the page and node_modules.`);
      process.exit(1);
    }
  }
  const server = await serve(root);
  const url = p => `${server.url}/${relative(root, resolve(p)).split('\\').join('/')}`;
  await look({
    argv: rest,
    usage: `npx device-ui ${TOOLS.look}`,
    open: (page, target) => page.goto(url(target)),
    // reference/<id>/front.jpg, as ref leaves it, beside the page or where look runs.
    photo: id => pages.map(p => join(dirname(resolve(p)), 'reference', id, 'front.jpg')).concat(join(root, 'reference', id, 'front.jpg')).find(f => existsSync(f)),
    watch: async (context, again) => {
      for (const p of pages) watch(p, again);
    },
  });
}
