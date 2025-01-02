import { unixfs } from '@helia/unixfs';
import { fileTypeFromBuffer } from 'file-type';

export const getImageUrlFromIPFS = async (helia, tokenURI) => {
	let cid;
	if (tokenURI.startsWith('ipfs://') || tokenURI.startsWith('ipns://')) {
		cid = tokenURI.split('//')[1];
	}
	// console.log("loading image from cid",cid)
	const fs = unixfs(helia);
	const chunks = [];
	for await (const chunk of fs.cat(cid)) {
		chunks.push(chunk);
	}
	const buffer = Buffer.concat(chunks);
	const fileType = await fileTypeFromBuffer(buffer);
	const mimeType = fileType ? fileType.mime : 'application/octet-stream'; // default to a generic binary type
	const blob = new Blob([buffer], { type: mimeType });
	// const blob = new Blob([buffer], { type: 'image/jpg' });
	const url = URL.createObjectURL(blob); 
	return url
};
