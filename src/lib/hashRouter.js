import { readable } from 'svelte/store';
import { browser } from '$app/environment';

// A helper to read the current hash minus the leading '#'
function getHash() {
	if (!browser) return '';
	return window.location.hash ? window.location.hash.slice(1) : '';
}

// Extract nameId from hash path (e.g., "#/PeaceDove-CC" -> "PeaceDove-CC")
function extractNameId(hash) {
	if (!hash) return '';
	// Remove leading slash if present
	return hash.startsWith('/') ? hash.slice(1) : hash;
}

// Create a readable store that updates when the hash changes
export const hashRoute = readable(getHash(), (set) => {
	if (!browser) return;

	function onHashChange() {
		set(getHash());
	}

	window.addEventListener('hashchange', onHashChange);
	return () => window.removeEventListener('hashchange', onHashChange);
});

// Create a derived store specifically for nameId
export const currentNameId = readable('', (set) => {
	if (!browser) return;

	function updateNameId() {
		const hash = getHash();
		set(extractNameId(hash));
	}

	// Set initial value
	updateNameId();

	// Update on hash changes
	window.addEventListener('hashchange', updateNameId);
	return () => window.removeEventListener('hashchange', updateNameId);
});
