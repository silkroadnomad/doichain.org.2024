import { nameShow } from '$lib/doichain/nameShow.js';
import { debounce } from 'lodash';

export const checkName = debounce((electrumClient, currentNameAddress, name, callback) => {
	console.log('debounce', electrumClient, currentNameAddress, name);
	_checkName(electrumClient, currentNameAddress, name).then((result) => {
		console.log('debounce-result', result);
		callback(result);
	});
}, 300);

export async function _checkName(electrumClient, currentNameAddress, _name) {
	console.log('_checkName', electrumClient, currentNameAddress, _name);
	let nameErrorMessage = '';
	let utxoErrorMessage = '';
	let isNameValid = true;
	let isUTXOAddressValid = true;
	let currentNameOp;
	let currentNameUtxo;
	let nameExists;

	if (!_name) {
		const nameErrorMessage = `No name provided`;
		return { nameErrorMessage };
	}

	if (_name.split(' ').length > 1) {
		const nameErrorMessage = `Only one name is allowed`;
		return { nameErrorMessage };
	}
	if (_name.length > 3) {
		console.log('nameShow', _name);
		const res = await nameShow(electrumClient, _name);
		console.log('res', res);
		if (res.length > 0) {
			for (let utxo of res) {
				const scriptPubKey = utxo.scriptPubKey;
				if (scriptPubKey && scriptPubKey.nameOp) {
					currentNameAddress = scriptPubKey.addresses[0];
					currentNameOp = scriptPubKey.nameOp;
					currentNameUtxo = {
						...utxo,
						nameOp: currentNameOp,
						address: currentNameAddress,
						hash: utxo.txid || utxo.hash || utxo.tx_hash // Add this line
					};
					nameExists = true;
					break;
				}
			}
			nameErrorMessage = `Name "${_name}" already registered under address ${currentNameAddress}`;
			isNameValid = false;
			return {
				currentNameAddress,
				currentNameOp,
				currentNameUtxo,
				nameErrorMessage,
				utxoErrorMessage,
				nameExists,
				isNameValid,
				isUTXOAddressValid
			};
		} else {
			isNameValid = true;
			return {
				currentNameAddress,
				nameErrorMessage,
				utxoErrorMessage,
				isNameValid,
				isUTXOAddressValid
			};
		}
	} else {
		nameErrorMessage = `Name "${_name}" is too short`;
		isNameValid = false;
		return {
			currentNameAddress,
			nameErrorMessage,
			utxoErrorMessage,
			isNameValid,
			isUTXOAddressValid
		};
	}
}
