import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const file = fileURLToPath(new URL('package.json', import.meta.url));
const json = readFileSync(file, 'utf8');
const pkg = JSON.parse(json);

export default defineConfig({
	plugins: [
		sveltekit(),
		nodePolyfills({
			// exclude: ['fs'],
			globals: {
				Buffer: true,
				global: true,
				process: true,
				crypto: true
			},
			protocolImports: true
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	define: {
		'__APP_VERSION__': JSON.stringify(pkg.version),
	}
});
