import { detectFileType, renderQRImage, splitQRs } from 'bbqr'
// import { UR, UREncoder } from '@ngraveio/bc-ur'
import {
	// CryptoHDKey,
	// CryptoKeypath,
	// CryptoOutput,
	// PathComponent,
	// ScriptExpressions,
	CryptoPSBT,
	// CryptoAccount,
	// Bytes,
} from '@keystonehq/bc-ur-registry/dist';
import vkQr from '@vkontakte/vk-qr';
import {Psbt} from "bitcoinjs-lib";

function base64ToHex(base64) {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * RenderBCUR
 * @param qrData
 * @returns {Promise<void>}
 */
export const renderBCUR = async (qrData) => {

	if (!qrData) {
        return;
    }
	const maxFragmentLength = 50
	// not account. lets try psbt
	const parts = [];
	try {
		const qrDataHex = base64ToHex(qrData)
		Psbt.fromHex(qrDataHex); // will throw if not PSBT hex
		const data = Buffer.from(qrDataHex,'hex');
		const cryptoPSBT = new CryptoPSBT(data);
		const encoder = cryptoPSBT.toUREncoder(maxFragmentLength);

		for (let c = 1; c <= encoder.fragmentsLength; c++) {
			const ur = encoder.nextPart();
			parts.push(ur);
		}
	} catch (_) {console.log("an error",_)}

	const qrSvgs = parts.map(part => {
		const qrSvg = vkQr.createQR(part, {
			qrSize: 256,
			isShowLogo: false
		});
		// console.log("qrSvg", qrSvg);
		return qrSvg;
	});
	console.log(` generated ${qrSvgs.length } qrcode svgs `)
	return qrSvgs;
}


/**
 * Generates a bbqr (better bitcoin qr) code
 * @see https://github.com/coinkite/BBQr (js lib included)
 * @param qrData
 * @returns {Promise<string>}
 */
export const renderBBQR = async (qrData) => {
	if(!qrData) return

	const detected = await detectFileType(qrData) //.then(_detected => {
		// console.log("detected.fileType",detected.fileType);
	const splitResult = splitQRs(detected.raw, detected.fileType, {
		// these are optional - default values are shown
		encoding: 'Z', // Z or 2 for Zlib compressed base32 encoding
		minSplit: 1, // minimum number of parts to return
		maxSplit: 1295, // maximum number of parts to return
		minVersion: 5, // minimum QR code version
		maxVersion: 40, // maximum QR code version
	});

	// console.log("splitResult.version",splitResult.version)
	// console.log("splitResult.encoding",splitResult.encoding)
	// console.log("splitResult.parts",splitResult.parts)

	const imgBuffer = await renderQRImage(splitResult.parts, splitResult.version, {
		// optional settings - values here are the defaults
		frameDelay: 250,
		randomizeOrder: false,
	})
	// convert to data URL for display
	const base64String = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
	const imgDataUrl = `data:image/png;base64,${base64String}`;
	return imgDataUrl;
}