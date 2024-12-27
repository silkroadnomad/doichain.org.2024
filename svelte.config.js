import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'public',
			assets: 'public',
			fallback: 'offline.html',
			precompress: true,
			strict: false
		}),
		prerender: {
			entries: [
				'/',
				'/example-name-1',  // Example known nameId
				'/example-name-2'   // Example known nameId
			]
		}
	},
	preprocess: vitePreprocess()
};

export default config;
