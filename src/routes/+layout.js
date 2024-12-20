export const ssr = false;
export const prerender = false; //a separate html file will be created for this page inside the public folder!
export const trailingSlash = 'always'; //means an index.html will be created inside of a 'page' subfolder instead of just a page.html

import { network } from '$lib/doichain/doichain-store.js'; // import svelte store
import { browser } from '$app/environment'; // if we are not rendering on a server side this is true
import { setupElectrumConnection } from '$lib/doichain/electrumConnection.js'; // connects and manages the connection to an electrums server

let _network;
network.subscribe((value) => (_network = value));

if (browser) {
	setupElectrumConnection(_network);
}
