import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', '.netlify/', 'node_modules/', 'old/', 'drizzle/'] },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
];
