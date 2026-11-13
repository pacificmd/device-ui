// The exports that work from a tarball are in publishConfig, and only pnpm writes them into what it packs.
// Packed by anything else, the package's exports would point at ./src, which isn't shipped. So refuse.
const agent = process.env.npm_config_user_agent ?? '';
if (!agent.startsWith('pnpm/')) {
  console.error(
    `device-ui: pack and publish with pnpm (pnpm pack, pnpm publish), not ${agent.split(' ')[0] || 'this tool'}.\n` +
    "Only pnpm applies publishConfig.exports; without it the exports point at ./src, which isn't in the tarball.",
  );
  process.exit(1);
}
