import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as ChevronRight, a as Shield, c as Hash, d as FolderUp, f as FolderPlus, g as Disc, h as FilePlus, i as Trash2, l as HardDrive, m as File, n as Usb, o as Save, p as FolderOpen, s as Menu, t as X, u as Folder, v as ChevronDown } from "../_libs/lucide-react.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { n as inflate, t as deflate } from "../_libs/pako.mjs";
import { n as xo, r as yo, t as mo } from "../_libs/react-resizable-panels.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BWug0Igo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function formatBytes(n) {
	if (!Number.isFinite(n)) return "—";
	const units = [
		"Б",
		"КБ",
		"МБ",
		"ГБ",
		"ТБ"
	];
	let value = n;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index += 1;
	}
	const digits = index === 0 ? 0 : value >= 100 ? 0 : 1;
	return `${value.toFixed(digits)} ${units[index]}`;
}
function formatWhen(ms) {
	const date = new Date(ms);
	const p = (n) => String(n).padStart(2, "0");
	return `${p(date.getUTCDate())}.${p(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`;
}
function downloadBlob(blob, name) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 8e3);
}
var MEDIA = [
	{
		id: "cd700",
		label: "CD 700 МБ",
		bytes: 734003200
	},
	{
		id: "dvd47",
		label: "DVD 4.7 ГБ",
		bytes: 4707319808
	},
	{
		id: "dvd85",
		label: "DVD 8.5 ГБ",
		bytes: 8543666176
	}
];
function mediaById(id) {
	return MEDIA.find((item) => item.id === id) ?? MEDIA[1];
}
var DB_NAME = "arca-studio";
function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
			if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
function bare(node) {
	const copy = { ...node };
	delete copy.blob;
	return copy;
}
async function loadStudio() {
	if (typeof indexedDB === "undefined") return null;
	try {
		const db = await openDb();
		const saved = await new Promise((resolve, reject) => {
			const req = db.transaction("kv", "readonly").objectStore("kv").get("state");
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		if (!saved?.nodes?.length) {
			db.close();
			return null;
		}
		const nodes = {};
		await new Promise((resolve, reject) => {
			const store = db.transaction("blobs", "readonly").objectStore("blobs");
			let pending = saved.nodes.length;
			if (!pending) {
				resolve();
				return;
			}
			for (const node of saved.nodes) {
				const req = store.get(node.id);
				req.onsuccess = () => {
					const blob = req.result;
					nodes[node.id] = blob ? {
						...node,
						blob,
						size: node.size || blob.size
					} : { ...node };
					pending -= 1;
					if (pending === 0) resolve();
				};
				req.onerror = () => reject(req.error);
			}
		});
		db.close();
		return {
			...saved,
			nodes
		};
	} catch {
		return null;
	}
}
var timer;
function scheduleSave(snapshot) {
	if (typeof indexedDB === "undefined") return;
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		saveNow(snapshot);
	}, 350);
}
async function saveNow(snapshot) {
	try {
		const db = await openDb();
		await new Promise((resolve, reject) => {
			const tx = db.transaction(["kv", "blobs"], "readwrite");
			tx.objectStore("kv").put({
				...snapshot,
				nodes: snapshot.nodes.map(bare)
			}, "state");
			const blobs = tx.objectStore("blobs");
			blobs.clear();
			for (const node of snapshot.nodes) if (node.blob) blobs.put(node.blob, node.id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch {}
}
function bytesPart(data) {
	const copy = new ArrayBuffer(data.byteLength);
	new Uint8Array(copy).set(data);
	return copy;
}
function blobOf(data, type) {
	return new Blob([bytesPart(data)], type ? { type } : void 0);
}
function dvOf(b) {
	return new DataView(b.buffer, b.byteOffset, b.byteLength);
}
function put16both(b, o, v) {
	const dv = dvOf(b);
	dv.setUint16(o, v & 65535, true);
	dv.setUint16(o + 2, v & 65535, false);
}
function put32both(b, o, v) {
	const dv = dvOf(b);
	dv.setUint32(o, v >>> 0, true);
	dv.setUint32(o + 4, v >>> 0, false);
}
function read32(b, o, le = true) {
	return dvOf(b).getUint32(o, le);
}
function padAscii(s, n, fill = 32) {
	const out = new Uint8Array(n);
	out.fill(fill);
	const clean = s.replace(/[^\x20-\x7e]/g, "");
	for (let i = 0; i < Math.min(n, clean.length); i++) out[i] = clean.charCodeAt(i);
	return out;
}
function padAChars(s, n) {
	return padAscii(s.toUpperCase().replace(/[^A-Z0-9_ ]/g, " ").replace(/\s+/g, " ").trim() || "ARCA", n, 32);
}
function encodeUcs2be(s) {
	const chars = Array.from(s);
	const out = new Uint8Array(chars.length * 2);
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i].codePointAt(0);
		const v = c > 65535 ? 63 : c;
		out[i * 2] = v >> 8 & 255;
		out[i * 2 + 1] = v & 255;
	}
	return out;
}
function decodeUcs2be(b, o, len) {
	let s = "";
	const n = len - len % 2;
	for (let i = 0; i < n; i += 2) s += String.fromCharCode(b[o + i] << 8 | b[o + i + 1]);
	return s.replace(/\u0000+$/g, "").replace(/\s+$/g, "");
}
function padUcs2(s, nBytes) {
	const out = new Uint8Array(nBytes);
	for (let i = 0; i + 1 < nBytes; i += 2) {
		out[i] = 0;
		out[i + 1] = 32;
	}
	const enc = encodeUcs2be(Array.from(s).slice(0, nBytes / 2).join(""));
	out.set(enc, 0);
	return out;
}
function date17(ms) {
	const d = new Date(ms);
	const p = (n, w = 2) => String(n).padStart(w, "0");
	const text = p(d.getUTCFullYear(), 4) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "00";
	const out = /* @__PURE__ */ new Uint8Array(17);
	for (let i = 0; i < 16; i++) out[i] = text.charCodeAt(i);
	out[16] = 0;
	return out;
}
function writeDirDate(b, o, ms) {
	const d = new Date(ms);
	b[o] = Math.max(0, Math.min(255, d.getUTCFullYear() - 1900));
	b[o + 1] = d.getUTCMonth() + 1;
	b[o + 2] = d.getUTCDate();
	b[o + 3] = d.getUTCHours();
	b[o + 4] = d.getUTCMinutes();
	b[o + 5] = d.getUTCSeconds();
	b[o + 6] = 0;
}
function readDirDate(b, o) {
	const year = 1900 + b[o];
	const month = b[o + 1] || 1;
	const day = b[o + 2] || 1;
	return Date.UTC(year, month - 1, day, b[o + 3] || 0, b[o + 4] || 0, b[o + 5] || 0);
}
var SECTOR = 2048;
/** 512-byte BIOS boot sector. Prints a message and halts. El Torito load segment 0x07C0. */
function makeBootSector(message = "ARCA BOOT OK") {
	const sector = /* @__PURE__ */ new Uint8Array(512);
	sector.set([
		49,
		192,
		142,
		216,
		142,
		192,
		142,
		208,
		188,
		0,
		124,
		251,
		190,
		32,
		124,
		180,
		14,
		172,
		132,
		192,
		116,
		4,
		205,
		16,
		235,
		247,
		244,
		235,
		253
	], 0);
	const msg = new TextEncoder().encode(message.replace(/[^\x20-\x7e]/g, " ").slice(0, 30));
	sector.set(msg, 32);
	sector[32 + msg.length] = 0;
	sector[510] = 85;
	sector[511] = 170;
	return sector;
}
function emulationCode(kind) {
	switch (kind) {
		case "floppy120": return 1;
		case "floppy144": return 2;
		case "floppy288": return 3;
		case "hdd": return 4;
		default: return 0;
	}
}
function emulationFromCode(code) {
	switch (code) {
		case 1: return "floppy120";
		case 2: return "floppy144";
		case 3: return "floppy288";
		case 4: return "hdd";
		default: return "none";
	}
}
var BAD_ISO = /[^A-Z0-9_]/g;
function cleanToken(s, max, fallback) {
	return s.toUpperCase().replace(BAD_ISO, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, max) || fallback;
}
function iso9660Name(original, isDir, used) {
	const base = original.normalize("NFKC");
	let stem = base;
	let ext = "";
	if (!isDir) {
		const dot = base.lastIndexOf(".");
		if (dot > 0 && dot < base.length - 1) {
			stem = base.slice(0, dot);
			ext = base.slice(dot + 1);
		}
	}
	let stemC = cleanToken(stem, 8, isDir ? "DIR" : "FILE");
	const extC = isDir ? "" : ext ? cleanToken(ext, 3, "TXT") : "";
	let body = extC ? `${stemC}.${extC}` : stemC;
	let n = 1;
	const keyOf = (b) => isDir ? b : `${b};1`;
	while (used.has(keyOf(body))) {
		const suffix = String(n++);
		stemC = cleanToken(stem, Math.max(1, 8 - suffix.length), "F").slice(0, 8 - suffix.length) + suffix;
		body = extC ? `${stemC}.${extC}` : stemC;
	}
	used.add(keyOf(body));
	return {
		stored: isDir ? body : `${body};1`,
		mangled: (isDir ? body : body) !== base.toUpperCase()
	};
}
var BAD_JOLIET = /[\\/:*?";\u0000-\u001f]/g;
function longName(original, max, used) {
	const base = original.normalize("NFC");
	let name = base.replace(BAD_JOLIET, "_").slice(0, max);
	if (!name) name = "file";
	let mangled = name !== base;
	let n = 1;
	while (used.has(name.toLocaleUpperCase("ru"))) {
		const suffix = `~${n++}`;
		name = (base.replace(BAD_JOLIET, "_").slice(0, Math.max(1, max - suffix.length)) || "f") + suffix;
		mangled = true;
	}
	used.add(name.toLocaleUpperCase("ru"));
	return {
		stored: name,
		mangled
	};
}
function crc16(data) {
	let crc = 0;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i] << 8;
		for (let b = 0; b < 8; b++) crc = (crc & 32768) !== 0 ? (crc << 1 ^ 4129) & 65535 : crc << 1 & 65535;
	}
	return crc & 65535;
}
function finishTag(sector, id, location, descLen) {
	const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
	dv.setUint16(0, id, true);
	dv.setUint16(2, 2, true);
	dv.setUint16(6, 1, true);
	const bodyLen = Math.max(0, descLen - 16);
	const body = sector.subarray(16, 16 + bodyLen);
	dv.setUint16(8, crc16(body), true);
	dv.setUint16(10, bodyLen, true);
	dv.setUint32(12, location >>> 0, true);
	let sum = 0;
	for (let i = 0; i < 16; i++) if (i !== 4) sum = sum + sector[i] & 255;
	sector[4] = sum;
}
function regid(id, suffix) {
	const b = /* @__PURE__ */ new Uint8Array(32);
	const bytes = new TextEncoder().encode(id).slice(0, 23);
	b.set(bytes, 1);
	if (suffix) for (let i = 0; i < Math.min(8, suffix.length); i++) b[24 + i] = suffix[i];
	return b;
}
function charspec() {
	const b = /* @__PURE__ */ new Uint8Array(64);
	const info = new TextEncoder().encode("OSTA Compressed Unicode");
	b.set(info, 1);
	return b;
}
function dstring(s, size) {
	const out = new Uint8Array(size);
	const chars = Array.from(s);
	if (chars.every((c) => c.charCodeAt(0) < 128)) {
		const n = Math.min(chars.length, size - 2);
		out[0] = 8;
		for (let i = 0; i < n; i++) out[1 + i] = chars[i].charCodeAt(0);
		out[size - 1] = n + 1;
	} else {
		const n = Math.min(chars.length, Math.floor((size - 2) / 2));
		out[0] = 16;
		for (let i = 0; i < n; i++) {
			const c = chars[i].codePointAt(0);
			const v = c > 65535 ? 63 : c;
			out[1 + i * 2] = v >> 8 & 255;
			out[2 + i * 2] = v & 255;
		}
		out[size - 1] = 1 + n * 2;
	}
	return out;
}
function timestamp(ms) {
	const b = /* @__PURE__ */ new Uint8Array(12);
	const dv = new DataView(b.buffer);
	dv.setUint16(0, 4096, true);
	const d = new Date(ms);
	dv.setUint16(2, d.getUTCFullYear(), true);
	b[4] = d.getUTCMonth() + 1;
	b[5] = d.getUTCDate();
	b[6] = d.getUTCHours();
	b[7] = d.getUTCMinutes();
	b[8] = d.getUTCSeconds();
	return b;
}
function putLongAd(dv, o, length, location) {
	dv.setUint32(o, length >>> 0, true);
	dv.setUint32(o + 4, location >>> 0, true);
	dv.setUint16(o + 8, 0, true);
}
function putU64(dv, o, n) {
	const lo = n >>> 0;
	const hi = Math.floor(n / 2 ** 32) >>> 0;
	dv.setUint32(o, lo, true);
	dv.setUint32(o + 4, hi, true);
}
function encodeIdent(name) {
	const chars = Array.from(name);
	if (chars.every((c) => (c.codePointAt(0) ?? 0) < 128)) {
		const b = new Uint8Array(1 + chars.length);
		b[0] = 8;
		for (let i = 0; i < chars.length; i++) b[1 + i] = chars[i].charCodeAt(0);
		return b;
	}
	const b = new Uint8Array(1 + chars.length * 2);
	b[0] = 16;
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i].codePointAt(0);
		const v = c > 65535 ? 63 : c;
		b[1 + i * 2] = v >> 8 & 255;
		b[2 + i * 2] = v & 255;
	}
	return b;
}
function flatten(root) {
	const out = [];
	const walk = (n) => {
		out.push(n);
		if (n.isDir) for (const c of n.children) walk(c);
	};
	walk(root);
	return out;
}
function fidLength(identLen) {
	let len = 38 + identLen;
	return len + (4 - len % 4) % 4;
}
function dirFidBytes(node, parent) {
	let bytes = fidLength(0);
	for (const c of node.children) bytes += fidLength(encodeIdent(c.name).length);
	const sectors = Math.max(1, Math.ceil(bytes / SECTOR));
	return {
		bytes,
		sectors
	};
}
function allocateUdf(root, take) {
	const all = flatten(root);
	let uid = 16;
	for (const n of all) n.uniqueId = uid++;
	const mainVds = take(16);
	const reserveVds = take(16);
	const lvid = take(1);
	const fsd = take(1);
	const assign = (node, _parent) => {
		if (node.isDir) {
			for (const c of node.children) assign(c, node);
			const info = dirFidBytes(node, node);
			node.fidBytes = info.bytes;
			node.fidSector = take(info.sectors);
		}
		node.feBytes = 176 + (node.isDir ? 1 : node.size > 0 ? Math.max(1, Math.ceil(node.size / 1073739776)) : 0) * 8;
		node.feSector = take(1);
	};
	assign(root, null);
	const avdpLast = take(1);
	const totalSectors = avdpLast + 1;
	let fileCount = 0;
	let dirCount = 0;
	for (const n of all) if (n.isDir) dirCount++;
	else fileCount++;
	return {
		nodes: all,
		mainVds,
		reserveVds,
		lvid,
		fsd,
		avdpLast,
		totalSectors,
		fileCount,
		dirCount
	};
}
function writeFid(sector, offset, sectorNum, opts) {
	const ident = opts.parent ? /* @__PURE__ */ new Uint8Array(0) : encodeIdent(opts.name);
	const len = fidLength(ident.length);
	const slice = sector.subarray(offset, offset + len);
	const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
	dv.setUint16(offset + 16, 1, true);
	let ch = 0;
	if (opts.hidden) ch |= 1;
	if (opts.isDir || opts.parent) ch |= 2;
	if (opts.parent) ch |= 8;
	sector[offset + 18] = ch;
	sector[offset + 19] = ident.length;
	putLongAd(dv, offset + 20, opts.feBytes, opts.feSector);
	dv.setUint16(offset + 36, 0, true);
	if (ident.length) sector.set(ident, offset + 38);
	finishTag(slice, 257, sectorNum, len);
	return len;
}
function writeDirectory(node, parent) {
	const sectors = Math.max(1, Math.ceil((node.fidBytes ?? 0) / SECTOR));
	const pages = [];
	for (let i = 0; i < sectors; i++) pages.push(new Uint8Array(SECTOR));
	let page = 0;
	let pos = 0;
	const emit = (opts) => {
		const len = fidLength((opts.parent ? /* @__PURE__ */ new Uint8Array(0) : encodeIdent(opts.name)).length);
		if (pos + len > 2048) {
			page++;
			pos = 0;
		}
		pos += writeFid(pages[page], pos, (node.fidSector ?? 0) + page, opts);
	};
	emit({
		name: "",
		hidden: false,
		isDir: true,
		parent: true,
		feSector: parent.feSector ?? 0,
		feBytes: parent.feBytes ?? 176
	});
	const kids = [...node.children].sort((a, b) => a.name.localeCompare(b.name, "ru"));
	for (const c of kids) emit({
		name: c.name,
		hidden: c.hidden,
		isDir: c.isDir,
		parent: false,
		feSector: c.feSector ?? 0,
		feBytes: c.feBytes ?? 176
	});
	return pages;
}
function writeFileEntry(node, parentFe) {
	const sector = new Uint8Array(SECTOR);
	const dv = new DataView(sector.buffer);
	const fe = node.feSector ?? 0;
	dv.setUint32(16, 0, true);
	dv.setUint16(20, 4, true);
	dv.setUint16(22, 0, true);
	dv.setUint16(24, 1, true);
	sector[27] = node.isDir ? 4 : 5;
	dv.setUint32(28, parentFe >>> 0, true);
	dv.setUint16(32, 0, true);
	dv.setUint16(34, 0, true);
	dv.setUint32(36, 4294967295, true);
	dv.setUint32(40, 4294967295, true);
	dv.setUint32(44, 32767, true);
	dv.setUint16(48, 1, true);
	putU64(dv, 56, node.isDir ? node.fidBytes ?? 0 : node.size);
	putU64(dv, 64, node.isDir ? Math.max(1, Math.ceil((node.fidBytes ?? 0) / SECTOR)) : node.size > 0 ? Math.ceil(node.size / SECTOR) : 0);
	const ts = timestamp(node.mtime);
	sector.set(ts, 72);
	sector.set(ts, 84);
	sector.set(ts, 96);
	dv.setUint32(108, 1, true);
	sector.set(regid("*Arca"), 128);
	putU64(dv, 160, node.uniqueId ?? 16);
	dv.setUint32(168, 0, true);
	if (node.isDir) {
		dv.setUint32(172, 8, true);
		const recorded = Math.max(1, Math.ceil((node.fidBytes ?? 0) / SECTOR)) * SECTOR;
		dv.setUint32(176, recorded >>> 0, true);
		dv.setUint32(180, node.fidSector ?? 0, true);
	} else if (node.size > 0) {
		const maxExt = 1073739776;
		const ads = [];
		let left = node.size;
		let loc = node.dataSector;
		while (left > 0) {
			const len = Math.min(maxExt, left);
			const stored = Math.ceil(len / SECTOR) * SECTOR;
			ads.push({
				len: stored,
				loc
			});
			const sectors = stored / SECTOR;
			loc += sectors;
			left -= len;
		}
		dv.setUint32(172, ads.length * 8, true);
		ads.forEach((ad, i) => {
			dv.setUint32(176 + i * 8, ad.len >>> 0, true);
			dv.setUint32(180 + i * 8, ad.loc >>> 0, true);
		});
	} else dv.setUint32(172, 0, true);
	finishTag(sector, 261, fe, node.feBytes ?? 176);
	return sector;
}
function writeVds(plan, volumeId, which) {
	const base = which === "main" ? plan.mainVds : plan.reserveVds;
	const pages = [];
	for (let i = 0; i < 16; i++) pages.push(new Uint8Array(SECTOR));
	const now = Date.UTC(2026, 10, 9, 1, 0, 0);
	const pvd = pages[0];
	const pdv = new DataView(pvd.buffer);
	pdv.setUint32(16, 1, true);
	pdv.setUint32(20, 0, true);
	pvd.set(dstring(volumeId, 32), 24);
	pdv.setUint16(56, 1, true);
	pdv.setUint16(58, 1, true);
	pdv.setUint16(60, 3, true);
	pdv.setUint16(62, 3, true);
	pdv.setUint32(64, 1, true);
	pdv.setUint32(68, 1, true);
	pvd.set(dstring(volumeId, 128), 72);
	pvd.set(charspec(), 200);
	pvd.set(charspec(), 264);
	pvd.set(regid("*Arca"), 344);
	pvd.set(timestamp(now), 376);
	pvd.set(regid("*Arca"), 388);
	finishTag(pvd, 1, base, 512);
	const impl = pages[1];
	new DataView(impl.buffer).setUint32(16, 2, true);
	impl.set(regid("*UDF LV Info"), 20);
	impl.set(charspec(), 52);
	impl.set(dstring(volumeId, 128), 116);
	impl.set(regid("*Arca"), 352);
	finishTag(impl, 4, base + 1, 512);
	const part = pages[2];
	const pp = new DataView(part.buffer);
	pp.setUint32(16, 3, true);
	pp.setUint16(20, 1, true);
	pp.setUint16(22, 0, true);
	part.set(regid("+NSR02"), 24);
	pp.setUint32(184, 1, true);
	pp.setUint32(188, 0, true);
	pp.setUint32(192, plan.totalSectors >>> 0, true);
	part.set(regid("*Arca"), 196);
	finishTag(part, 5, base + 2, 512);
	const lvd = pages[3];
	const lv = new DataView(lvd.buffer);
	lv.setUint32(16, 4, true);
	lvd.set(charspec(), 20);
	lvd.set(dstring(volumeId, 128), 84);
	lv.setUint32(212, SECTOR, true);
	lvd.set(regid("*OSTA UDF Compliant", [
		2,
		1,
		0,
		0,
		0,
		0,
		0,
		0
	]), 216);
	const root = plan.nodes[0];
	putLongAd(lv, 248, root.feBytes ?? 176, root.feSector ?? 0);
	putLongAd(lv, 248, 512, plan.fsd);
	lv.setUint32(264, 6, true);
	lv.setUint32(268, 1, true);
	lvd.set(regid("*Arca"), 272);
	lv.setUint32(432, SECTOR, true);
	lv.setUint32(436, plan.lvid >>> 0, true);
	lvd[440] = 1;
	lvd[441] = 6;
	lv.setUint16(442, 1, true);
	lv.setUint16(444, 0, true);
	finishTag(lvd, 6, base + 3, 446);
	const unalloc = pages[4];
	const uv = new DataView(unalloc.buffer);
	uv.setUint32(16, 5, true);
	uv.setUint32(20, 0, true);
	finishTag(unalloc, 7, base + 4, 24);
	const term = pages[5];
	finishTag(term, 8, base + 5, 16);
	return pages;
}
function writeLvid(plan, volumeStamp) {
	const b = new Uint8Array(SECTOR);
	const dv = new DataView(b.buffer);
	b.set(timestamp(volumeStamp), 16);
	dv.setUint32(28, 2, true);
	putU64(dv, 40, plan.dirCount + plan.fileCount + 16 >>> 0);
	dv.setUint32(72, 1, true);
	dv.setUint32(72, 1, true);
	dv.setUint32(76, 46, true);
	dv.setUint32(80, 0, true);
	dv.setUint32(84, plan.totalSectors >>> 0, true);
	b.set(regid("*Arca"), 88);
	dv.setUint32(120, plan.fileCount >>> 0, true);
	dv.setUint32(124, plan.dirCount >>> 0, true);
	dv.setUint16(128, 258, true);
	dv.setUint16(130, 258, true);
	dv.setUint16(132, 258, true);
	finishTag(b, 9, plan.lvid, 134);
	return b;
}
function writeFsd(plan, volumeId, stamp) {
	const b = new Uint8Array(SECTOR);
	const dv = new DataView(b.buffer);
	b.set(timestamp(stamp), 16);
	dv.setUint16(28, 3, true);
	dv.setUint16(30, 3, true);
	dv.setUint32(32, 1, true);
	dv.setUint32(36, 1, true);
	dv.setUint32(40, 1, true);
	dv.setUint32(44, 0, true);
	b.set(charspec(), 48);
	b.set(dstring(volumeId, 128), 112);
	b.set(charspec(), 240);
	b.set(dstring(volumeId, 32), 304);
	const root = plan.nodes[0];
	putLongAd(dv, 400, root.feBytes ?? 176, root.feSector ?? 0);
	b.set(regid("*OSTA UDF Compliant", [
		2,
		1,
		0,
		0,
		0,
		0,
		0,
		0
	]), 416);
	finishTag(b, 256, plan.fsd, 512);
	return b;
}
function writeAvdp(location, main, reserve) {
	const b = new Uint8Array(SECTOR);
	const dv = new DataView(b.buffer);
	dv.setUint32(16, 16 * SECTOR, true);
	dv.setUint32(20, main >>> 0, true);
	dv.setUint32(24, 16 * SECTOR, true);
	dv.setUint32(28, reserve >>> 0, true);
	finishTag(b, 2, location, 512);
	return b;
}
/** Metadata pieces. Sector 256 is the anchor and must stay free of other data. */
function emitUdf(root, plan, volumeId, stamp) {
	const pieces = [];
	const main = writeVds(plan, volumeId, "main");
	const reserve = writeVds(plan, volumeId, "reserve");
	main.forEach((data, i) => pieces.push({
		sector: plan.mainVds + i,
		data
	}));
	reserve.forEach((data, i) => pieces.push({
		sector: plan.reserveVds + i,
		data
	}));
	pieces.push({
		sector: plan.lvid,
		data: writeLvid(plan, stamp)
	});
	pieces.push({
		sector: plan.fsd,
		data: writeFsd(plan, volumeId, stamp)
	});
	const byName = /* @__PURE__ */ new Map();
	const linkParent = (node, parent) => {
		byName.set(node, parent);
		if (node.isDir) for (const c of node.children) linkParent(c, node);
	};
	linkParent(root, root);
	for (const node of plan.nodes) {
		const parent = byName.get(node) ?? root;
		pieces.push({
			sector: node.feSector ?? 0,
			data: writeFileEntry(node, parent.feSector ?? node.feSector ?? 0)
		});
		if (node.isDir && node.fidSector != null) writeDirectory(node, parent).forEach((data, i) => pieces.push({
			sector: node.fidSector + i,
			data
		}));
	}
	const avdp256 = writeAvdp(256, plan.mainVds, plan.reserveVds);
	const avdpEnd = writeAvdp(plan.avdpLast, plan.mainVds, plan.reserveVds);
	pieces.push({
		sector: 256,
		data: avdp256
	});
	if (plan.avdpLast !== 256) pieces.push({
		sector: plan.avdpLast,
		data: avdpEnd
	});
	return pieces;
}
function udfTagOk(sector) {
	if (sector.length < 16) return false;
	let sum = 0;
	for (let i = 0; i < 16; i++) if (i !== 4) sum = sum + sector[i] & 255;
	return sum === sector[4];
}
function recLen(nameLen) {
	const n = 33 + nameLen;
	return n + (n & 1);
}
function dirPayload(names) {
	let pos = recLen(1) + recLen(1);
	for (const name of names) {
		const n = recLen(name.length);
		if (pos % 2048 + n > 2048) pos = Math.ceil((pos + 1) / SECTOR) * SECTOR;
		pos += n;
	}
	const sectors = Math.max(1, Math.ceil(pos / SECTOR));
	return {
		bytes: pos,
		sectors
	};
}
function writeRec(target, o, extent, size, mtime, flags, name) {
	const len = recLen(name.length);
	const dv = new DataView(target.buffer, target.byteOffset, target.byteLength);
	target[o] = len;
	dv.setUint32(o + 2, extent >>> 0, true);
	dv.setUint32(o + 6, extent >>> 0, false);
	dv.setUint32(o + 10, size >>> 0, true);
	dv.setUint32(o + 14, size >>> 0, false);
	writeDirDate(target, o + 18, mtime);
	target[o + 25] = flags;
	dv.setUint16(o + 28, 1, true);
	dv.setUint16(o + 30, 1, false);
	target[o + 32] = name.length;
	target.set(name, o + 33);
	return len;
}
function renderDir(selfExtent, parentExtent, selfSize, parentSize, mtime, entries) {
	const { sectors } = dirPayload(entries.map((e) => e.name));
	const out = new Uint8Array(sectors * SECTOR);
	let pos = 0;
	const put = (extent, size, mt, flags, name) => {
		const n = recLen(name.length);
		if (pos % 2048 + n > 2048) pos = Math.ceil(pos / SECTOR) * SECTOR;
		pos += writeRec(out, pos, extent, size, mt, flags, name);
	};
	put(selfExtent, selfSize, mtime, 2, new Uint8Array([0]));
	put(parentExtent, parentSize, mtime, 2, new Uint8Array([1]));
	for (const e of entries) put(e.extent, e.size, e.mtime, e.flags, e.name);
	return out;
}
function pathTable(dirs, joliet) {
	const chunksLe = [];
	const chunksBe = [];
	for (const dir of dirs) {
		const name = dir.dirNumber === 1 ? new Uint8Array([0]) : joliet ? encodeUcs2be(dir.jolietName) : new TextEncoder().encode(dir.isoName);
		const len = 8 + name.length + (name.length & 1);
		const le = new Uint8Array(len);
		const be = new Uint8Array(len);
		le[0] = name.length;
		be[0] = name.length;
		const extent = joliet ? dir.jolietExtent : dir.isoExtent;
		new DataView(le.buffer).setUint32(2, extent >>> 0, true);
		new DataView(be.buffer).setUint32(2, extent >>> 0, false);
		new DataView(le.buffer).setUint16(6, dir.parentNumber, true);
		new DataView(be.buffer).setUint16(6, dir.parentNumber, false);
		le.set(name, 8);
		be.set(name, 8);
		chunksLe.push(le);
		chunksBe.push(be);
	}
	const join = (parts) => {
		const n = parts.reduce((s, p) => s + p.length, 0);
		const out = new Uint8Array(n);
		let o = 0;
		for (const p of parts) {
			out.set(p, o);
			o += p.length;
		}
		return out;
	};
	return {
		le: join(chunksLe),
		be: join(chunksBe)
	};
}
function orderDirs(root) {
	root.dirNumber = 1;
	root.parentNumber = 1;
	const list = [root];
	for (let i = 0; i < list.length; i++) {
		const parent = list[i];
		const kids = parent.children.filter((c) => c.isDir).sort((a, b) => a.isoName < b.isoName ? -1 : a.isoName > b.isoName ? 1 : 0);
		for (const kid of kids) {
			kid.parentNumber = parent.dirNumber;
			kid.dirNumber = list.length + 1;
			list.push(kid);
		}
	}
	return list;
}
function toUdf(node) {
	return {
		name: node.udfName,
		isDir: node.isDir,
		hidden: !!node.src.hidden,
		mtime: node.src.mtime,
		dataSector: node.dataExtent,
		size: node.isDir ? 0 : node.src.size || node.src.blob?.size || 0,
		children: node.isDir ? node.children.map(toUdf) : []
	};
}
function bootCatalog(extent, size, emulation) {
	const b = new Uint8Array(SECTOR);
	const dv = new DataView(b.buffer);
	b[0] = 1;
	b[1] = 0;
	const id = "ARCA EL TORITO";
	for (let i = 0; i < 14; i++) b[4 + i] = id.charCodeAt(i);
	b[30] = 85;
	b[31] = 170;
	let sum = 0;
	for (let i = 0; i < 16; i++) {
		if (i === 14) continue;
		sum = sum + dv.getUint16(i * 2, true) & 65535;
	}
	dv.setUint16(28, 65536 - sum & 65535, true);
	b[32] = 136;
	b[33] = emulation;
	dv.setUint16(34, 0, true);
	b[36] = 0;
	const sectors512 = Math.max(1, Math.ceil(size / 512));
	dv.setUint16(38, sectors512, true);
	dv.setUint32(40, extent >>> 0, true);
	return b;
}
function buildIso(input) {
	const warnings = [];
	const useJoliet = input.filesystem !== "iso9660";
	const useUdf = input.filesystem === "udf";
	const jolietMax = useUdf ? 64 : 64;
	const udfMax = 255;
	const usedIso = /* @__PURE__ */ new Set();
	const usedJoliet = /* @__PURE__ */ new Set();
	const usedUdf = /* @__PURE__ */ new Set();
	const convert = (src, isRoot) => {
		src.children && src.blob == null && !src.boot && src.size == null || Array.isArray(src.children);
		const dir = Array.isArray(src.children);
		if (isRoot) return {
			src,
			isDir: true,
			isoName: "",
			jolietName: "",
			udfName: "",
			mangled: false,
			children: (src.children ?? []).map((c) => convert(c, false)),
			isoExtent: 0,
			jolietExtent: 0,
			dataExtent: 0,
			dataSectors: 0,
			dirNumber: 1,
			parentNumber: 1,
			isoDirSectors: 1,
			jolietDirSectors: 1
		};
		const iso = iso9660Name(src.name, dir, usedIso);
		const jol = longName(src.name, jolietMax, usedJoliet);
		const udf = longName(src.name, udfMax, usedUdf);
		if (!useJoliet && iso.mangled) warnings.push(`${src.name} → ${iso.stored.replace(/;1$/, "")} (ISO 9660, только 8.3)`);
		else if (useJoliet && jol.mangled) warnings.push(`${src.name} → ${jol.stored} (имя укорочено для Joliet, 64 символа)`);
		if (useUdf && udf.mangled) warnings.push(`${src.name} → ${udf.stored} (UDF, 255 символов)`);
		return {
			src,
			isDir: dir,
			isoName: dir ? iso.stored : iso.stored,
			jolietName: jol.stored,
			udfName: udf.stored,
			mangled: iso.mangled || jol.mangled,
			children: dir ? (src.children ?? []).map((c) => convert(c, false)) : [],
			isoExtent: 0,
			jolietExtent: 0,
			dataExtent: 0,
			dataSectors: 0,
			dirNumber: 0,
			parentNumber: 0,
			isoDirSectors: 1,
			jolietDirSectors: 1
		};
	};
	const root = convert(input.root, true);
	const dirs = orderDirs(root);
	for (const dir of dirs) {
		const isoSorted = [...dir.children].sort((a, b) => a.isoName < b.isoName ? -1 : a.isoName > b.isoName ? 1 : 0);
		const jolSorted = [...dir.children].sort((a, b) => a.jolietName < b.jolietName ? -1 : a.jolietName > b.jolietName ? 1 : 0);
		dir.isoDirSectors = dirPayload(childNamesFrom(isoSorted, false)).sectors;
		dir.jolietDirSectors = dirPayload(childNamesFrom(jolSorted, true)).sectors;
	}
	const isoPathLen = pathTableByteLength(dirs, false);
	const jolietPathLen = useJoliet ? pathTableByteLength(dirs, true) : 0;
	let cursor = 16;
	const take = (n) => {
		if (n <= 0) return cursor;
		if (useUdf) {
			if (cursor === 256) cursor = 257;
			if (cursor < 256 && cursor + n > 256) cursor = 257;
		}
		const s = cursor;
		cursor += n;
		return s;
	};
	const pvdSector = take(1);
	if (pvdSector !== 16) throw new Error("PVD must occupy sector 16");
	const bootNode = findBoot(root);
	const bootRec = bootNode ? take(1) : -1;
	const svdSector = useJoliet ? take(1) : -1;
	const termSector = take(1);
	const catSector = bootNode ? take(1) : -1;
	const isoL = take(Math.max(1, Math.ceil(isoPathLen / SECTOR)));
	const isoM = take(Math.max(1, Math.ceil(isoPathLen / SECTOR)));
	const jolL = useJoliet ? take(Math.max(1, Math.ceil(jolietPathLen / SECTOR))) : -1;
	const jolM = useJoliet ? take(Math.max(1, Math.ceil(jolietPathLen / SECTOR))) : -1;
	for (const dir of dirs) dir.isoExtent = take(dir.isoDirSectors);
	if (useJoliet) for (const dir of dirs) dir.jolietExtent = take(dir.jolietDirSectors);
	const files = [];
	const walkFiles = (n) => {
		if (!n.isDir) files.push(n);
		for (const c of n.children) walkFiles(c);
	};
	walkFiles(root);
	for (const file of files) {
		const size = file.src.size ?? file.src.blob?.size ?? 0;
		file.dataSectors = size > 0 ? Math.ceil(size / SECTOR) : 0;
		file.dataExtent = file.dataSectors ? take(file.dataSectors) : 0;
	}
	let udfPlan = null;
	let udfRoot = null;
	if (useUdf) {
		udfRoot = toUdf(root);
		udfRoot.name = input.volumeId || "ARCA";
		udfPlan = allocateUdf(udfRoot, take);
		if (udfPlan.avdpLast < 256) udfPlan.totalSectors = 257;
		else udfPlan.totalSectors = Math.max(udfPlan.totalSectors, udfPlan.avdpLast + 1);
	}
	const totalSectors = useUdf && udfPlan ? udfPlan.totalSectors : cursor;
	const stamp = input.root.mtime || Date.UTC(2026, 10, 9);
	const pieces = [];
	const add = (sector, data, length) => {
		if (length <= 0) return;
		pieces.push({
			sector,
			data: data instanceof Uint8Array ? bytesPart(data) : data,
			length
		});
	};
	const dirEntries = (node, joliet) => {
		return [...node.children].sort((a, b) => {
			const an = joliet ? a.jolietName : a.isoName;
			const bn = joliet ? b.jolietName : b.isoName;
			return an < bn ? -1 : an > bn ? 1 : 0;
		}).map((c) => {
			const size = c.isDir ? (joliet ? c.jolietDirSectors : c.isoDirSectors) * SECTOR : c.src.size ?? c.src.blob?.size ?? 0;
			const flags = (c.isDir ? 2 : 0) | (c.src.hidden ? 1 : 0);
			const name = joliet ? encodeUcs2be(c.jolietName) : new TextEncoder().encode(c.isoName);
			return {
				extent: c.isDir ? joliet ? c.jolietExtent : c.isoExtent : c.dataExtent,
				size: size >>> 0,
				mtime: c.src.mtime,
				flags,
				name,
				node: c,
				fullSize: size
			};
		});
	};
	const writeTreeDirs = (joliet) => {
		for (const dir of dirs) {
			const parent = dirs.find((d) => d.dirNumber === dir.parentNumber) ?? dir;
			const selfSize = (joliet ? dir.jolietDirSectors : dir.isoDirSectors) * SECTOR;
			const parentSize = (joliet ? parent.jolietDirSectors : parent.isoDirSectors) * SECTOR;
			const entries = dirEntries(dir, joliet).flatMap((e) => {
				if (e.node.isDir || e.fullSize <= 4294967295) return [{
					extent: e.extent,
					size: e.fullSize >>> 0,
					mtime: e.mtime,
					flags: e.flags,
					name: e.name
				}];
				const max = 4294965248;
				const out = [];
				let left = e.fullSize;
				let extent = e.extent;
				while (left > 0) {
					const chunk = Math.min(max, left);
					const last = left - chunk <= 0;
					out.push({
						extent,
						size: chunk,
						mtime: e.mtime,
						flags: e.flags | (last ? 0 : 128),
						name: e.name
					});
					extent += Math.ceil(chunk / SECTOR);
					left -= chunk;
				}
				return out;
			});
			const bytes = renderDir(joliet ? dir.jolietExtent : dir.isoExtent, joliet ? parent.jolietExtent : parent.isoExtent, selfSize, parentSize, dir.src.mtime || stamp, entries);
			const reserved = (joliet ? dir.jolietDirSectors : dir.isoDirSectors) * SECTOR;
			if (bytes.length !== reserved) throw new Error("Размер каталога ISO не сошёлся при сборке.");
			add(joliet ? dir.jolietExtent : dir.isoExtent, bytes, bytes.length);
		}
	};
	const isoPath = pathTable(dirs, false);
	const jolietPath = useJoliet ? pathTable(dirs, true) : null;
	const pvd = new Uint8Array(SECTOR);
	writeVpd(pvd, 1, input, totalSectors, isoPath.le.length, isoL, isoM, root, false, stamp);
	add(pvdSector, pvd, SECTOR);
	if (bootNode && bootRec >= 0) {
		const br = new Uint8Array(SECTOR);
		br[0] = 0;
		br.set(new TextEncoder().encode("CD001"), 1);
		br[6] = 1;
		const sys = "EL TORITO SPECIFICATION";
		for (let i = 0; i < 23; i++) br[7 + i] = sys.charCodeAt(i);
		new DataView(br.buffer).setUint32(71, catSector >>> 0, true);
		add(bootRec, br, SECTOR);
	}
	if (useJoliet && svdSector >= 0) {
		const svd = new Uint8Array(SECTOR);
		writeVpd(svd, 2, input, totalSectors, jolietPath.le.length, jolL, jolM, root, true, stamp);
		svd.set([
			37,
			47,
			69
		], 88);
		add(svdSector, svd, SECTOR);
	}
	const term = new Uint8Array(SECTOR);
	term[0] = 255;
	term.set(new TextEncoder().encode("CD001"), 1);
	term[6] = 1;
	add(termSector, term, SECTOR);
	if (bootNode && catSector >= 0) {
		const size = bootNode.src.size ?? bootNode.src.blob?.size ?? 512;
		add(catSector, bootCatalog(bootNode.dataExtent, size, emulationCode(input.bootEmulation)), SECTOR);
	}
	const padSector = (bytes) => {
		if (bytes.length % 2048 === 0) return bytes;
		const out = new Uint8Array(Math.ceil(bytes.length / SECTOR) * SECTOR);
		out.set(bytes);
		return out;
	};
	const leP = padSector(isoPath.le);
	const beP = padSector(isoPath.be);
	add(isoL, leP, leP.length);
	add(isoM, beP, beP.length);
	if (jolietPath && jolL >= 0 && jolM >= 0) {
		const jle = padSector(jolietPath.le);
		const jbe = padSector(jolietPath.be);
		add(jolL, jle, jle.length);
		add(jolM, jbe, jbe.length);
	}
	writeTreeDirs(false);
	if (useJoliet) writeTreeDirs(true);
	for (const file of files) {
		const size = file.src.size ?? file.src.blob?.size ?? 0;
		if (!size || !file.src.blob) continue;
		const pad = (SECTOR - size % SECTOR) % SECTOR;
		const data = pad ? new Blob([file.src.blob, bytesPart(new Uint8Array(pad))]) : file.src.blob;
		add(file.dataExtent, data, file.dataSectors * SECTOR);
	}
	if (useUdf && udfPlan && udfRoot) {
		const sync = (b, u) => {
			u.dataSector = b.dataExtent;
			u.size = b.isDir ? 0 : b.src.size || b.src.blob?.size || 0;
			b.children.forEach((c, i) => sync(c, u.children[i]));
		};
		sync(root, udfRoot);
		const udfPieces = emitUdf(udfRoot, udfPlan, (input.volumeId || "ARCA").slice(0, 30), stamp);
		for (const p of udfPieces) add(p.sector, p.data, p.data.length);
	}
	pieces.sort((a, b) => a.sector - b.sector);
	const parts = [];
	let at = 0;
	for (const p of pieces) {
		const pos = p.sector * SECTOR;
		if (pos < at) throw new Error(`Перекрытие секторов при сборке ISO (сектор ${p.sector}).`);
		if (pos > at) parts.push(bytesPart(new Uint8Array(pos - at)));
		parts.push(p.data);
		at = pos + p.length;
	}
	const end = totalSectors * SECTOR;
	if (at < end) parts.push(bytesPart(new Uint8Array(end - at)));
	return {
		blob: new Blob(parts, { type: "application/x-iso9660-image" }),
		bytes: end,
		warnings
	};
}
function childNamesFrom(children, joliet) {
	const names = [];
	for (const c of children) {
		const name = joliet ? encodeUcs2be(c.jolietName) : new TextEncoder().encode(c.isoName);
		const size = c.isDir ? 0 : c.src.size ?? c.src.blob?.size ?? 0;
		const n = c.isDir || size <= 4294967295 ? 1 : Math.ceil(size / 4294965248);
		for (let i = 0; i < Math.max(1, n); i++) names.push(name);
	}
	return names;
}
function pathTableByteLength(dirs, joliet) {
	let n = 0;
	for (const dir of dirs) {
		const nameLen = dir.dirNumber === 1 ? 1 : joliet ? encodeUcs2be(dir.jolietName).length : new TextEncoder().encode(dir.isoName).length;
		n += 8 + nameLen + (nameLen & 1);
	}
	return n;
}
function findBoot(node) {
	if (node.src.boot && !node.isDir) return node;
	for (const c of node.children) {
		const hit = findBoot(c);
		if (hit) return hit;
	}
	return null;
}
function writeVpd(b, type, input, totalSectors, pathSize, lpath, mpath, root, joliet, stamp) {
	b[0] = type;
	b.set(new TextEncoder().encode("CD001"), 1);
	b[6] = 1;
	b.set(padAChars("ARCA", 32), 8);
	if (joliet) b.set(padUcs2(input.volumeId || "ARCA", 32), 40);
	else b.set(padAChars(input.volumeId || "ARCA", 32), 40);
	put32both(b, 80, totalSectors);
	put16both(b, 120, 1);
	put16both(b, 124, 1);
	put16both(b, 128, SECTOR);
	put32both(b, 132, pathSize);
	new DataView(b.buffer).setUint32(140, lpath >>> 0, true);
	new DataView(b.buffer).setUint32(148, mpath >>> 0, false);
	const rootSize = (joliet ? root.jolietDirSectors : root.isoDirSectors) * SECTOR;
	writeRec(b, 156, joliet ? root.jolietExtent : root.isoExtent, rootSize, root.src.mtime || stamp, 2, new Uint8Array([0]));
	const label = input.volumeId || "ARCA";
	b.set(joliet ? padUcs2(label, 128) : padAscii(label.toUpperCase(), 128), 190);
	b.set(padAscii(input.publisher || "ARCA", 128), 318);
	b.set(padAscii(input.preparer || "ARCA", 128), 446);
	b.set(padAscii(input.application || "ARCA", 128), 574);
	b.set(date17(stamp), 813);
	b.set(date17(stamp), 830);
	b[881] = 1;
}
function crc32(data) {
	let crc = 4294967295;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i];
		for (let b = 0; b < 8; b++) {
			const mask = -(crc & 1);
			crc = crc >>> 1 ^ 3988292384 & mask;
		}
	}
	return (crc ^ 4294967295) >>> 0;
}
function hex32(n) {
	return n.toString(16).padStart(8, "0");
}
function rotl(x, n) {
	return x << n | x >>> 32 - n;
}
/** MD5, RFC 1321. Returns lowercase hex. */
function md5(data) {
	const n = data.length;
	const bitLen = n * 8;
	const withPad = n + 1;
	const total = withPad + (56 - withPad % 64 + 64) % 64 + 8;
	const buf = new Uint8Array(total);
	buf.set(data, 0);
	buf[n] = 128;
	const view = new DataView(buf.buffer);
	view.setUint32(total - 8, bitLen >>> 0, true);
	view.setUint32(total - 4, Math.floor(bitLen / 2 ** 32), true);
	let a0 = 1732584193;
	let b0 = 4023233417;
	let c0 = 2562383102;
	let d0 = 271733878;
	const s = [
		7,
		12,
		17,
		22,
		7,
		12,
		17,
		22,
		7,
		12,
		17,
		22,
		7,
		12,
		17,
		22,
		5,
		9,
		14,
		20,
		5,
		9,
		14,
		20,
		5,
		9,
		14,
		20,
		5,
		9,
		14,
		20,
		4,
		11,
		16,
		23,
		4,
		11,
		16,
		23,
		4,
		11,
		16,
		23,
		4,
		11,
		16,
		23,
		6,
		10,
		15,
		21,
		6,
		10,
		15,
		21,
		6,
		10,
		15,
		21,
		6,
		10,
		15,
		21
	];
	const K = /* @__PURE__ */ new Uint32Array(64);
	for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
	for (let off = 0; off < total; off += 64) {
		const M = /* @__PURE__ */ new Uint32Array(16);
		for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true);
		let A = a0;
		let B = b0;
		let C = c0;
		let D = d0;
		for (let i = 0; i < 64; i++) {
			let F;
			let g;
			if (i < 16) {
				F = B & C | ~B & D;
				g = i;
			} else if (i < 32) {
				F = D & B | ~D & C;
				g = (5 * i + 1) % 16;
			} else if (i < 48) {
				F = B ^ C ^ D;
				g = (3 * i + 5) % 16;
			} else {
				F = C ^ (B | ~D);
				g = 7 * i % 16;
			}
			F = F + A + K[i] + M[g] >>> 0;
			A = D;
			D = C;
			C = B;
			B = B + rotl(F, s[i]) >>> 0;
		}
		a0 = a0 + A >>> 0;
		b0 = b0 + B >>> 0;
		c0 = c0 + C >>> 0;
		d0 = d0 + D >>> 0;
	}
	const out = /* @__PURE__ */ new Uint8Array(16);
	const ov = new DataView(out.buffer);
	ov.setUint32(0, a0, true);
	ov.setUint32(4, b0, true);
	ov.setUint32(8, c0, true);
	ov.setUint32(12, d0, true);
	return [...out].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha(data, alg) {
	const digest = await crypto.subtle.digest(alg, data.slice());
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var SYNC = [
	0,
	255,
	255,
	255,
	255,
	255,
	255,
	255,
	255,
	255,
	255,
	0
];
function findMarker(data, marker) {
	outer: for (let i = 0; i + marker.length <= data.length; i++) {
		for (let j = 0; j < marker.length; j++) if (data[i + j] !== marker[j]) continue outer;
		return i;
	}
	return -1;
}
function looksLikeIso(data) {
	if (data.length < 34816) return false;
	const o = 16 * SECTOR;
	return data[o] === 1 && data[o + 1] === 67 && data[o + 2] === 68 && data[o + 3] === 48 && data[o + 4] === 48 && data[o + 5] === 49;
}
function findCd001(data) {
	const step = data.length > 8e6 ? SECTOR : 1;
	for (let i = 0; i + 6 < data.length; i += step) if ((data[i] === 1 || data[i] === 2 || data[i] === 0) && data[i + 1] === 67 && data[i + 2] === 68 && data[i + 3] === 48 && data[i + 4] === 48 && data[i + 5] === 49 && (i % 2048 === 0 || step === 1)) {
		if (i % 2048 !== 0) continue;
		return i;
	}
	return -1;
}
function mode1To2048(data) {
	const count = Math.floor(data.length / 2352);
	const out = new Uint8Array(count * SECTOR);
	for (let i = 0; i < count; i++) out.set(data.subarray(i * 2352 + 16, i * 2352 + 16 + SECTOR), i * SECTOR);
	return out;
}
function hasSync(data) {
	if (data.length < 2352) return false;
	for (let i = 0; i < SYNC.length; i++) if (data[i] !== SYNC[i]) return false;
	return data.length % 2352 === 0;
}
/**
* Bring NRG, MDF, IMG, BIN/2352 or a raw ISO to a 2048-byte-sector image.
* NRG/MDF are located by the CD001 descriptor; BIN strips the 16-byte header and ECC.
*/
function convertToIso(data, filename = "") {
	const lower = filename.toLowerCase();
	if (looksLikeIso(data)) return {
		detected: lower.endsWith(".img") ? "IMG (сырой ISO)" : "ISO 9660",
		iso: data
	};
	if (hasSync(data)) {
		const iso = mode1To2048(data);
		if (!looksLikeIso(iso) && findCd001(iso) < 0) throw new Error("BIN/IMG 2352 не содержит том ISO 9660.");
		const cd = findCd001(iso);
		return {
			detected: "Mode1 / 2352 (BIN, IMG)",
			iso: cd >= 32768 ? iso.subarray(cd - 16 * SECTOR) : iso
		};
	}
	const tail = data.length >= 8 ? String.fromCharCode(...data.subarray(data.length - 8)) : "";
	const nrg = tail.includes("NERO") || tail.includes("NER5") || lower.endsWith(".nrg");
	const cd = findCd001(data);
	if (cd >= 32768) {
		const iso = data.subarray(cd - 16 * SECTOR);
		let detected = "Образ с заголовком";
		if (nrg || lower.endsWith(".nrg")) detected = "NRG (Nero)";
		else if (lower.endsWith(".mdf")) detected = "MDF (Alcohol)";
		else if (lower.endsWith(".img")) detected = "IMG";
		else if (lower.endsWith(".bin")) detected = "BIN";
		return {
			detected,
			iso
		};
	}
	if (findMarker(data, [
		73,
		115,
		90,
		33
	]) === 0) throw new Error("Это ISZ. Откройте его напрямую — Арка распакует контейнер.");
	throw new Error("В файле нет тома ISO 9660 (метка CD001).");
}
var MAGIC = [
	73,
	115,
	90,
	33
];
var BLOCK = 32 * SECTOR;
/**
* UltraISO ISZ (ezbsystems spec): 48-byte packed header, chunk pointers,
* zlib blocks. ptr_len is 4: 24-bit length + flag in the high byte.
* Flags: 0x00 zeros, 0x40 stored, 0x80 zlib. Password and split archives are rejected.
*/
function writeIsz(iso) {
	const sect = SECTOR;
	const pad = (sect - iso.length % sect) % sect;
	const padded = pad ? concat([iso, new Uint8Array(pad)]) : iso;
	const totalSectors = padded.length / sect;
	const nblocks = Math.ceil(padded.length / BLOCK) || 1;
	const ptrLen = 4;
	const ptrBytes = new Uint8Array(nblocks * ptrLen);
	const chunks = [];
	for (let i = 0; i < nblocks; i++) {
		const slice = padded.subarray(i * BLOCK, Math.min(padded.length, (i + 1) * BLOCK));
		let allZero = true;
		for (let k = 0; k < slice.length; k++) if (slice[k] !== 0) {
			allZero = false;
			break;
		}
		let flag = 0;
		let payload = /* @__PURE__ */ new Uint8Array(0);
		if (!allZero) {
			const z = deflate(slice);
			if (z.length < slice.length) {
				flag = 128;
				payload = z;
			} else {
				flag = 64;
				payload = slice;
			}
		}
		const len = payload.length;
		const o = i * ptrLen;
		ptrBytes[o] = len & 255;
		ptrBytes[o + 1] = len >> 8 & 255;
		ptrBytes[o + 2] = len >> 16 & 255;
		ptrBytes[o + 3] = flag;
		chunks.push(payload);
	}
	const header = /* @__PURE__ */ new Uint8Array(48);
	const dv = new DataView(header.buffer);
	header.set(MAGIC);
	header[4] = 48;
	header[5] = 1;
	dv.setUint32(6, 1095910209, true);
	dv.setUint16(10, sect, true);
	dv.setUint32(12, totalSectors, true);
	header[16] = 0;
	dv.setBigUint64(17, 0n, true);
	dv.setUint32(25, nblocks, true);
	dv.setUint32(29, BLOCK, true);
	header[33] = ptrLen;
	header[34] = 0;
	const ptrOffs = 48;
	const dataOffs = ptrOffs + ptrBytes.length;
	dv.setUint32(35, ptrOffs, true);
	dv.setUint32(39, 0, true);
	dv.setUint32(43, dataOffs, true);
	return concat([
		header,
		ptrBytes,
		...chunks
	]);
}
function readIsz(data) {
	if (data.length < 48 || data[0] !== MAGIC[0] || data[1] !== MAGIC[1] || data[2] !== MAGIC[2] || data[3] !== MAGIC[3]) throw new Error("Файл не похож на ISZ (нет подписи IsZ!).");
	const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const headerSize = data[4] || 48;
	const ver = data[5];
	if (ver !== 1) throw new Error(`Версия ISZ ${ver} не поддерживается.`);
	const sect = dv.getUint16(10, true) || 2048;
	const totalSectors = dv.getUint32(12, true);
	if (data[16] !== 0) throw new Error("ISZ защищён паролем. Снимите пароль и откройте снова.");
	const nblocks = dv.getUint32(25, true);
	const blockSize = dv.getUint32(29, true);
	data[33] ?? data[headerSize > 33 ? 33 : 33];
	const ptrLenSafe = data[33];
	const segOffs = dv.getUint32(39, true);
	const ptrOffs = dv.getUint32(35, true);
	const dataOffs = dv.getUint32(43, true);
	if (segOffs !== 0) throw new Error("Составной ISZ из нескольких частей не поддерживается.");
	if (ptrLenSafe < 2 || ptrLenSafe > 8) throw new Error("Повреждена таблица блоков ISZ.");
	if (!blockSize || !nblocks) throw new Error("Пустой заголовок ISZ.");
	const totalSize = totalSectors * sect;
	const out = new Uint8Array(totalSize);
	let dataCursor = dataOffs || headerSize + nblocks * ptrLenSafe;
	const table = ptrOffs || headerSize;
	for (let i = 0; i < nblocks; i++) {
		let value = 0n;
		const base = table + i * ptrLenSafe;
		for (let k = 0; k < ptrLenSafe; k++) value |= BigInt(data[base + k] ?? 0) << BigInt(8 * k);
		const shift = BigInt(8 * (ptrLenSafe - 1));
		const flag = Number(value >> shift & 255n);
		const len = Number(value & (1n << shift) - 1n);
		const offset = i * blockSize;
		const need = Math.min(blockSize, totalSize - offset);
		if (need <= 0) break;
		if (flag === 0) {} else if (flag === 64) {
			out.set(data.subarray(dataCursor, dataCursor + len).subarray(0, need), offset);
			dataCursor += len;
		} else if (flag === 128) {
			const raw = inflate(data.subarray(dataCursor, dataCursor + len));
			out.set(raw.subarray(0, need), offset);
			dataCursor += len;
		} else if (flag === 192) throw new Error("ISZ сжат bzip2. Сожмите образ методом zlib.");
		else throw new Error(`Неизвестный тип блока ISZ: ${flag.toString(16)}`);
	}
	return out;
}
function concat(parts) {
	const n = parts.reduce((s, p) => s + p.length, 0);
	const out = new Uint8Array(n);
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}
function isCd001(data, sector) {
	const o = sector * SECTOR;
	if (o + 6 >= data.length) return false;
	return data[o + 1] === 67 && data[o + 2] === 68 && data[o + 3] === 48 && data[o + 4] === 48 && data[o + 5] === 49;
}
function readRoot(data, sector) {
	const o = sector * SECTOR + 156;
	return {
		extent: read32(data, o + 2, true),
		size: read32(data, o + 10, true)
	};
}
function readTree(data, whole, extent, size, joliet, bootExtent) {
	const bytes = data.subarray(extent * SECTOR, extent * SECTOR + size);
	const out = [];
	let bootHit = false;
	let pending = null;
	const flush = () => {
		if (!pending) return;
		const { cont: _c, parts, key: _k, ...node } = pending;
		if (!node.children) {
			node.blob = new Blob(parts);
			node.size = parts.reduce((s, p) => s + p.size, 0);
		}
		out.push(node);
		pending = null;
	};
	let p = 0;
	while (p < bytes.length) {
		if (bytes[p] === 0) {
			p = Math.min(bytes.length, Math.ceil((p + 1) / SECTOR) * SECTOR);
			continue;
		}
		const len = bytes[p];
		if (len < 34 || p + len > bytes.length) break;
		const ext = read32(bytes, p + 2, true);
		const sz = read32(bytes, p + 10, true);
		const flags = bytes[p + 25];
		const nameLen = bytes[p + 32];
		const nameBytes = bytes.subarray(p + 33, p + 33 + nameLen);
		const isDir = (flags & 2) !== 0;
		const hidden = (flags & 1) !== 0;
		const cont = (flags & 128) !== 0;
		if (!(nameLen === 1 && (nameBytes[0] === 0 || nameBytes[0] === 1))) {
			let name = joliet ? decodeUcs2be(nameBytes, 0, nameBytes.length) : new TextDecoder().decode(nameBytes).replace(/;1$/, "");
			if (!name) name = "UNNAMED";
			const mtime = readDirDate(bytes, p + 18);
			if (pending && pending.key === name && pending.cont) {
				if (!isDir) pending.parts.push(whole.slice(ext * SECTOR, ext * SECTOR + sz));
				pending.cont = cont;
				if (!cont) flush();
			} else {
				flush();
				if (isDir) {
					const nested = readTree(data, whole, ext, sz, joliet, bootExtent);
					if (nested.bootHit) bootHit = true;
					out.push({
						name,
						mtime,
						hidden,
						children: nested.nodes
					});
				} else {
					const node = {
						name,
						mtime,
						hidden,
						key: name,
						cont,
						parts: [whole.slice(ext * SECTOR, ext * SECTOR + sz)],
						size: sz
					};
					if (ext === bootExtent) {
						node.boot = true;
						bootHit = true;
					}
					pending = node;
					if (!cont) flush();
				}
			}
		}
		p += len;
	}
	flush();
	return {
		nodes: out,
		bootHit
	};
}
function volumeLabel(data, sector, joliet) {
	const o = sector * SECTOR + 40;
	if (joliet) return decodeUcs2be(data, o, 32).trim() || "VOLUME";
	return new TextDecoder().decode(data.subarray(o, o + 32)).replace(/\s+$/g, "").trim() || "VOLUME";
}
function readBoot(data) {
	for (let s = 17; s <= 32; s++) {
		if (!isCd001(data, s)) continue;
		const o = s * SECTOR;
		if (data[o] !== 0) continue;
		if (!new TextDecoder().decode(data.subarray(o + 7, o + 30)).startsWith("EL TORITO")) continue;
		const c = read32(data, o + 71, true) * SECTOR;
		if (c + 64 > data.length || data[c] !== 1 || data[c + 30] !== 85 || data[c + 31] !== 170) continue;
		const entry = c + 32;
		if (data[entry] !== 136 && data[entry] !== 0) continue;
		return {
			emulation: emulationFromCode(data[entry + 1] ?? 0),
			sectorCount512: new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(entry + 6, true),
			extent: new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(entry + 8, true),
			platform: data[c + 1] ?? 0
		};
	}
	return null;
}
function parseIso(data) {
	if (!isCd001(data, 16) || data[32768] !== 1) throw new Error("Это не образ ISO 9660: в секторе 16 нет дескриптора CD001.");
	let jolietSector = -1;
	for (let s = 17; s <= 32; s++) {
		if (!isCd001(data, s) || data[s * 2048] !== 2) continue;
		const e0 = data[s * SECTOR + 88];
		const e1 = data[s * SECTOR + 89];
		const e2 = data[s * SECTOR + 90];
		if (e0 === 37 && e1 === 47 && (e2 === 64 || e2 === 67 || e2 === 69)) {
			jolietSector = s;
			break;
		}
	}
	const filesystem = data.length >= 526336 && data[524288] === 2 && data[524289] === 0 && udfTagOk(data.subarray(524288, 526336)) ? "udf" : jolietSector >= 0 ? "joliet" : "iso9660";
	const desc = jolietSector >= 0 ? jolietSector : 16;
	const boot = readBoot(data);
	const rootRec = readRoot(data, desc);
	const whole = blobOf(data);
	const walked = readTree(data, whole, rootRec.extent, rootRec.size, jolietSector >= 0, boot?.extent ?? -1);
	const children = walked.nodes;
	if (boot && !walked.bootHit) {
		const len = Math.max(512, boot.sectorCount512 * 512);
		const blob = whole.slice(boot.extent * SECTOR, Math.min(whole.size, boot.extent * SECTOR + len));
		children.unshift({
			name: "eltorito.bin",
			mtime: Date.UTC(2026, 10, 9),
			hidden: false,
			boot: true,
			size: blob.size,
			blob
		});
	}
	const label = volumeLabel(data, jolietSector >= 0 ? jolietSector : 16, jolietSector >= 0);
	return {
		volumeId: label,
		filesystem,
		publisher: new TextDecoder().decode(data.subarray(16 * SECTOR + 318, 16 * SECTOR + 318 + 128)).replace(/\s+$/g, "").trim(),
		boot,
		root: {
			name: label,
			mtime: readDirDate(data, 16 * SECTOR + 156 + 18),
			hidden: false,
			children
		}
	};
}
var IMAGE_ROOT = "img-root";
var PC_ROOT = "pc-root";
var DEFAULT_ATTRS = {
	hidden: false,
	system: false,
	archive: true,
	readonly: false
};
var T = Date.UTC(2026, 10, 9, 1, 0, 0);
function attrs(patch) {
	return {
		...DEFAULT_ATTRS,
		...patch
	};
}
function textFile(id, parentId, name, text, patch) {
	const data = new TextEncoder().encode(text);
	return {
		id,
		parentId,
		name,
		kind: "file",
		size: data.length,
		attrs: attrs(patch),
		mtime: T,
		blob: new Blob([data])
	};
}
function dir(id, parentId, name, extra = {}) {
	return {
		id,
		parentId,
		name,
		kind: extra.kind ?? "dir",
		size: 0,
		attrs: attrs(),
		mtime: T,
		...extra
	};
}
function createSeed() {
	const boot = makeBootSector("ARCA BOOT OK");
	return {
		[IMAGE_ROOT]: dir(IMAGE_ROOT, null, "ARCA_DEMO"),
		"img-readme": textFile("img-readme", IMAGE_ROOT, "readme.txt", "Арка — мастер образов.\r\nВерхние окна — содержимое ISO, нижние — компьютер.\r\nПеретащите файлы снизу вверх, чтобы добавить их в образ.\r\nФайл → Свойства задаёт ISO 9660, Joliet или UDF.\r\nСамозагрузка записывает образ на USB и хранит загрузочный сектор.\r\n"),
		"img-autorun": textFile("img-autorun", IMAGE_ROOT, "autorun.inf", "[autorun]\r\nopen=sources\\setup.txt\r\nlabel=ARCA_DEMO\r\n"),
		"img-docs": dir("img-docs", IMAGE_ROOT, "Документы"),
		"img-hello": textFile("img-hello", "img-docs", "Приветствие.txt", "Длинное имя на кириллице. В режиме Joliet и UDF оно сохранится, в чистом ISO 9660 станет 8.3.\r\n"),
		"img-bootdir": dir("img-bootdir", IMAGE_ROOT, "boot"),
		"img-boot": {
			id: "img-boot",
			parentId: "img-bootdir",
			name: "etfsboot.bin",
			kind: "file",
			size: boot.length,
			attrs: attrs({ system: true }),
			mtime: T,
			blob: blobOf(boot),
			boot: true
		},
		"img-sources": dir("img-sources", IMAGE_ROOT, "sources"),
		"img-setup": textFile("img-setup", "img-sources", "setup.txt", "Демонстрационный установщик. Замените файл своим bootmgr или setup.exe.\r\n"),
		[PC_ROOT]: dir(PC_ROOT, null, "Этот компьютер"),
		"drv-c": dir("drv-c", PC_ROOT, "C: Система", {
			kind: "drive",
			driveKind: "fixed",
			capacity: 256 * 1024 ** 3
		}),
		"c-users": dir("c-users", "drv-c", "Пользователи"),
		"c-docs": dir("c-docs", "c-users", "Документы"),
		"c-note": textFile("c-note", "c-docs", "Заметки.txt", "Локальный файл. Перетащите его в верхнее правое окно — он попадёт в образ.\r\n"),
		"c-plan": textFile("c-plan", "c-docs", "План.txt", "1. Собрать папку sources\r\n2. Вшить загрузочный сектор\r\n3. Проверить, что образ влезает на DVD\r\n"),
		"c-win": dir("c-win", "drv-c", "Windows"),
		"c-win-readme": textFile("c-win-readme", "c-win", "readme.txt", "Системная папка виртуального диска C:.\r\n"),
		"drv-d": dir("drv-d", PC_ROOT, "D: Данные", {
			kind: "drive",
			driveKind: "fixed",
			capacity: 512 * 1024 ** 3
		}),
		"d-dist": dir("d-dist", "drv-d", "Дистрибутив"),
		"d-auto": textFile("d-auto", "d-dist", "autorun.inf", "[autorun]\r\nlabel=DATA\r\n"),
		"d-install": textFile("d-install", "d-dist", "install.txt", "Каталог, с которого можно собрать новый образ через «Создать образ с диска».\r\n"),
		"d-music": dir("d-music", "drv-d", "Музыка"),
		"d-m3u": textFile("d-m3u", "d-music", "playlist.m3u", "#EXTM3U\r\n#EXTINF:12,Пример\r\ntrack.wav\r\n"),
		"drv-e": dir("drv-e", PC_ROOT, "E: USB", {
			kind: "drive",
			driveKind: "removable",
			capacity: 16 * 1024 ** 3
		}),
		"e-label": textFile("e-label", "drv-e", "метка.txt", "Съёмный диск на 16 ГБ. Сюда «Записать образ» кладёт файлы с ISO.\r\n"),
		"drv-f": dir("drv-f", PC_ROOT, "F: CD-ROM", {
			kind: "drive",
			driveKind: "optical",
			capacity: 734003200
		}),
		"f-readme": textFile("f-readme", "drv-f", "README.TXT", "Виртуальный компакт-диск. С него можно снять ISO.\r\n"),
		"f-data": dir("f-data", "drv-f", "DATA"),
		"f-info": textFile("f-info", "f-data", "info.txt", "Сектор демо-диска.\r\n")
	};
}
function childrenOf(nodes, id) {
	const list = Object.values(nodes).filter((node) => node.parentId === id);
	list.sort((a, b) => {
		const rank = (node) => node.kind === "file" ? 1 : 0;
		const byKind = rank(a) - rank(b);
		if (byKind) return byKind;
		return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
	});
	return list;
}
function pathOf(nodes, id) {
	const parts = [];
	let cursor = nodes[id];
	while (cursor?.parentId) {
		parts.push(cursor.name);
		cursor = nodes[cursor.parentId];
	}
	return `\\${parts.reverse().join("\\")}` || "\\";
}
function ancestorDrive(nodes, id) {
	let cursor = nodes[id];
	while (cursor) {
		if (cursor.kind === "drive") return cursor;
		cursor = cursor.parentId ? nodes[cursor.parentId] : void 0;
	}
	return null;
}
function isProtected(nodes, id) {
	const drive = ancestorDrive(nodes, id);
	return !!drive && (drive.driveKind === "optical" || drive.driveKind === "virtual");
}
function descendantIds(nodes, id) {
	const out = [];
	const walk = (current) => {
		for (const child of childrenOf(nodes, current)) {
			out.push(child.id);
			walk(child.id);
		}
	};
	walk(id);
	return out;
}
function isUnder(nodes, id, ancestor) {
	let cursor = nodes[id];
	while (cursor) {
		if (cursor.id === ancestor) return true;
		cursor = cursor.parentId ? nodes[cursor.parentId] : void 0;
	}
	return false;
}
function payloadBytes(nodes, rootId) {
	let total = 0;
	let files = 0;
	const walk = (id) => {
		for (const child of childrenOf(nodes, id)) if (child.kind === "file") {
			total += child.size;
			files += 1;
		} else walk(child.id);
	};
	walk(rootId);
	const overhead = 262144 + files * 2048;
	return total + (files || childrenOf(nodes, rootId).length ? overhead : 0);
}
function uniqueName(nodes, parentId, name, ignore) {
	const taken = new Set(childrenOf(nodes, parentId).filter((node) => node.id !== ignore).map((node) => node.name.toLocaleLowerCase("ru")));
	if (!taken.has(name.toLocaleLowerCase("ru"))) return name;
	const dot = name.lastIndexOf(".");
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : "";
	let n = 2;
	let next = `${stem} (${n})${ext}`;
	while (taken.has(next.toLocaleLowerCase("ru"))) {
		n += 1;
		next = `${stem} (${n})${ext}`;
	}
	return next;
}
function countEntries(nodes, id) {
	return childrenOf(nodes, id).length;
}
var STAMP = Date.UTC(2026, 10, 9, 1, 0, 0);
function textBlob(text) {
	const data = new TextEncoder().encode(text);
	return {
		blob: new Blob([data]),
		size: data.length
	};
}
function freshProject(patch) {
	return {
		volumeId: "NEW_VOL",
		publisher: "ARCA",
		preparer: "ARCA",
		application: "ARCA",
		filesystem: "joliet",
		bootable: false,
		bootNodeId: null,
		bootEmulation: "none",
		fileName: "NEW_VOL.iso",
		dirty: false,
		...patch
	};
}
function fileNode(id, parentId, file, name) {
	return {
		id,
		parentId,
		name,
		kind: "file",
		size: file.size,
		attrs: { ...DEFAULT_ATTRS },
		mtime: file.lastModified || STAMP,
		blob: file
	};
}
function dirNode(id, parentId, name) {
	return {
		id,
		parentId,
		name,
		kind: "dir",
		size: 0,
		attrs: { ...DEFAULT_ATTRS },
		mtime: STAMP
	};
}
function clearImage(nodes) {
	const next = {};
	for (const [id, node] of Object.entries(nodes)) if (id === "img-root" || !isUnder(nodes, id, "img-root")) next[id] = node;
	next[IMAGE_ROOT] = {
		...nodes[IMAGE_ROOT],
		name: "NEW_VOL",
		boot: false
	};
	return next;
}
function replaceImage(nodes, root) {
	const next = {};
	for (const [id, node] of Object.entries(nodes)) {
		if (id !== "img-root" && isUnder(nodes, id, "img-root")) continue;
		next[id] = node;
	}
	next[IMAGE_ROOT] = {
		...nodes[IMAGE_ROOT],
		name: root.name || "VOLUME",
		mtime: root.mtime || STAMP,
		boot: false
	};
	const walk = (mem, parentId) => {
		for (const child of mem.children ?? []) {
			const id = crypto.randomUUID();
			const isDir = Array.isArray(child.children);
			const node = {
				id,
				parentId,
				name: child.name,
				kind: isDir ? "dir" : "file",
				size: isDir ? 0 : child.size || child.blob?.size || 0,
				attrs: {
					hidden: !!child.hidden,
					system: !!child.system,
					archive: child.archive !== false,
					readonly: !!child.readonly
				},
				mtime: child.mtime || STAMP,
				blob: child.blob,
				boot: !!child.boot
			};
			next[id] = node;
			if (child.boot);
			if (isDir) walk(child, id);
		}
	};
	walk(root, IMAGE_ROOT);
	return next;
}
function findBootId(nodes) {
	return Object.values(nodes).find((node) => node.boot && isUnder(nodes, node.id, "img-root"))?.id ?? null;
}
async function consumeAttrFile(root) {
	const file = root.children?.find((child) => child.name.toUpperCase() === "ARCA_ATTR.TXT");
	if (!file?.blob) return root;
	const text = await file.blob.text();
	const map = /* @__PURE__ */ new Map();
	for (const line of text.split(/\r?\n/)) {
		if (!line || line.startsWith("#")) continue;
		const [path, flags = ""] = line.split("	");
		if (!path) continue;
		map.set(path, {
			hidden: flags.includes("h"),
			system: flags.includes("s"),
			archive: flags.includes("a"),
			readonly: flags.includes("r")
		});
	}
	const apply = (node, path) => {
		const hit = map.get(path);
		if (hit && path) Object.assign(node, hit);
		node.children?.forEach((child) => apply(child, `${path}/${child.name}`));
	};
	apply(root, "");
	return {
		...root,
		children: root.children?.filter((child) => child !== file)
	};
}
function toMem(nodes, id, bootId) {
	const node = nodes[id];
	if (node.kind === "file") return {
		name: node.name,
		mtime: node.mtime,
		hidden: node.attrs.hidden,
		system: node.attrs.system,
		archive: node.attrs.archive,
		readonly: node.attrs.readonly,
		size: node.size,
		blob: node.blob ?? new Blob([]),
		boot: node.id === bootId
	};
	return {
		name: node.name,
		mtime: node.mtime,
		hidden: node.attrs.hidden,
		children: childrenOf(nodes, id).filter((child) => child.kind !== "drive").map((child) => toMem(nodes, child.id, bootId))
	};
}
function withSidecar(nodes, bootId) {
	const mem = toMem(nodes, IMAGE_ROOT, bootId);
	const lines = ["# arca attrs v1"];
	const walk = (node, path) => {
		if (path) {
			if (node.system || node.readonly || node.archive === false) {
				const flags = `${node.hidden ? "h" : ""}${node.system ? "s" : ""}${node.archive !== false ? "a" : ""}${node.readonly ? "r" : ""}`;
				lines.push(`${path}\t${flags}`);
			}
		}
		node.children?.forEach((child) => walk(child, `${path}/${child.name}`));
	};
	walk(mem, "");
	if (lines.length > 1) {
		const { blob, size } = textBlob(lines.join("\r\n"));
		mem.children = mem.children ?? [];
		mem.children.push({
			name: "ARCA_ATTR.TXT",
			mtime: STAMP,
			hidden: true,
			size,
			blob
		});
	}
	return mem;
}
function cloneInto(nodes, id, parentId, target) {
	const src = nodes[id];
	const nid = crypto.randomUUID();
	const name = uniqueName(target, parentId, src.name);
	target[nid] = {
		...src,
		id: nid,
		parentId,
		name,
		attrs: { ...src.attrs },
		boot: false,
		kind: src.kind === "drive" ? "dir" : src.kind,
		driveKind: void 0
	};
	if (src.kind !== "file") for (const child of childrenOf(nodes, id)) cloneInto(nodes, child.id, nid, target);
	return nid;
}
function selectionOf(state, pane) {
	return pane === "image" ? state.imageSelection : state.pcSelection;
}
function dirOf(state, pane) {
	return pane === "image" ? state.imageDir : state.pcDir;
}
var noticeTimer;
var useStudio = create((set, get) => ({
	nodes: createSeed(),
	project: {
		volumeId: "ARCA_DEMO",
		publisher: "ARCA",
		preparer: "ARCA",
		application: "Арка",
		filesystem: "joliet",
		bootable: true,
		bootNodeId: "img-boot",
		bootEmulation: "none",
		fileName: "ARCA_DEMO.iso",
		dirty: false
	},
	media: "dvd47",
	options: {
		driveLetter: "Z",
		autoMount: false,
		associations: {
			iso: true,
			isz: true,
			nrg: true,
			mdf: true,
			img: true,
			bin: true
		},
		contextMenu: true
	},
	active: "image",
	imageDir: IMAGE_ROOT,
	pcDir: "c-docs",
	imageSelection: ["img-readme"],
	pcSelection: [],
	dialog: null,
	notice: null,
	touched: false,
	dragging: null,
	pendingFile: null,
	hydrated: false,
	setActive: (active) => set({ active }),
	setDialog: (dialog) => set({ dialog }),
	setDragging: (dragging) => set({ dragging }),
	notify: (text) => {
		if (noticeTimer) clearTimeout(noticeTimer);
		set({ notice: text });
		noticeTimer = setTimeout(() => set({ notice: null }), 4200);
	},
	setMedia: (media) => {
		const used = payloadBytes(get().nodes, IMAGE_ROOT);
		const cap = mediaById(media).bytes;
		set({
			media,
			touched: true
		});
		if (used > cap) get().notify(`Образ не влезет на ${mediaById(media).label}. Уберите файлы или выберите диск больше.`);
	},
	setOptions: (patch) => set({
		options: {
			...get().options,
			...patch
		},
		touched: true
	}),
	setAssociation: (key, value) => {
		const options = get().options;
		set({
			touched: true,
			options: {
				...options,
				associations: {
					...options.associations,
					[key]: value
				}
			}
		});
	},
	setProjectPatch: (patch) => {
		const project = {
			...get().project,
			...patch,
			dirty: true
		};
		const nodes = { ...get().nodes };
		if (patch.volumeId && nodes["img-root"]) nodes[IMAGE_ROOT] = {
			...nodes[IMAGE_ROOT],
			name: patch.volumeId
		};
		set({
			project,
			nodes,
			touched: true
		});
	},
	select: (pane, id, mode) => {
		const state = get();
		const current = selectionOf(state, pane);
		const folder = dirOf(state, pane);
		let next = [id];
		if (mode === "toggle") next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
		else if (mode === "range" && current.length) {
			const order = childrenOf(state.nodes, folder).map((node) => node.id);
			const anchor = current[current.length - 1];
			const a = order.indexOf(anchor);
			const b = order.indexOf(id);
			if (a >= 0 && b >= 0) {
				const [from, to] = a < b ? [a, b] : [b, a];
				next = order.slice(from, to + 1);
			}
		}
		set(pane === "image" ? {
			imageSelection: next,
			active: pane
		} : {
			pcSelection: next,
			active: pane
		});
	},
	openDir: (pane, id) => {
		const node = get().nodes[id];
		if (!node || node.kind === "file") return;
		set(pane === "image" ? {
			imageDir: id,
			imageSelection: [],
			active: "image"
		} : {
			pcDir: id,
			pcSelection: [],
			active: "pc"
		});
	},
	newFolder: (name) => {
		const state = get();
		const pane = state.active;
		const parentId = dirOf(state, pane);
		if (pane === "pc" && isProtected(state.nodes, parentId)) {
			get().notify("Этот диск только для чтения.");
			return;
		}
		const trimmed = name.trim();
		if (!trimmed || /[\\/]/.test(trimmed)) {
			get().notify("Имя папки не должно быть пустым и не может содержать \\ или /.");
			return;
		}
		const id = crypto.randomUUID();
		set({
			nodes: {
				...state.nodes,
				[id]: dirNode(id, parentId, uniqueName(state.nodes, parentId, trimmed))
			},
			dialog: null,
			touched: true,
			project: {
				...state.project,
				dirty: pane === "image" ? true : state.project.dirty
			}
		});
	},
	rename: (name) => {
		const state = get();
		const pane = state.active;
		const id = selectionOf(state, pane)[0];
		const node = id ? state.nodes[id] : void 0;
		if (!node || node.kind === "drive" || !node.parentId) return;
		if (pane === "pc" && isProtected(state.nodes, node.id)) {
			get().notify("Этот диск только для чтения.");
			return;
		}
		const trimmed = name.trim();
		if (!trimmed || /[\\/]/.test(trimmed)) {
			get().notify("Некорректное имя.");
			return;
		}
		const nextName = uniqueName(state.nodes, node.parentId, trimmed, node.id);
		const nodes = {
			...state.nodes,
			[id]: {
				...node,
				name: nextName
			}
		};
		if (id === "img-root") {
			set({
				nodes,
				dialog: null,
				touched: true,
				project: {
					...state.project,
					volumeId: nextName,
					dirty: true
				}
			});
			return;
		}
		set({
			nodes,
			dialog: null,
			touched: true,
			project: {
				...state.project,
				dirty: pane === "image" ? true : state.project.dirty
			}
		});
	},
	removeSelected: () => {
		const state = get();
		const pane = state.active;
		const ids = selectionOf(state, pane).filter((id) => {
			const node = state.nodes[id];
			return node && node.kind !== "drive" && node.parentId && id !== "img-root" && id !== "pc-root";
		});
		if (!ids.length) return;
		if (pane === "pc" && ids.some((id) => isProtected(state.nodes, id))) {
			get().notify("Нельзя удалять файлы с компакт-диска или смонтированного образа.");
			return;
		}
		const nodes = { ...state.nodes };
		for (const id of ids) {
			for (const child of descendantIds(nodes, id)) delete nodes[child];
			delete nodes[id];
		}
		let bootNodeId = state.project.bootNodeId;
		if (bootNodeId && !nodes[bootNodeId]) bootNodeId = null;
		set({
			nodes,
			touched: true,
			imageSelection: pane === "image" ? [] : state.imageSelection,
			pcSelection: pane === "pc" ? [] : state.pcSelection,
			project: {
				...state.project,
				bootNodeId,
				bootable: !!bootNodeId && state.project.bootable,
				dirty: pane === "image" ? true : state.project.dirty
			}
		});
	},
	applyAttrs: (attrs) => {
		const state = get();
		const pane = state.active;
		const id = selectionOf(state, pane)[0];
		const node = id ? state.nodes[id] : void 0;
		if (!node || node.kind === "drive") return;
		if (pane === "pc" && isProtected(state.nodes, node.id)) {
			get().notify("Этот диск только для чтения.");
			return;
		}
		set({
			nodes: {
				...state.nodes,
				[node.id]: {
					...node,
					attrs
				}
			},
			dialog: null,
			touched: true,
			project: {
				...state.project,
				dirty: pane === "image" ? true : state.project.dirty
			}
		});
	},
	addExternal: (list, pane) => {
		const files = [...list];
		if (!files.length) return;
		const state = get();
		const parentId = dirOf(state, pane);
		if (pane === "pc" && isProtected(state.nodes, parentId)) {
			get().notify("Этот диск только для чтения. Выберите папку на C:, D: или USB.");
			return;
		}
		const before = payloadBytes(state.nodes, IMAGE_ROOT);
		const nodes = { ...state.nodes };
		const ensureDir = (root, relative) => {
			let cursor = root;
			if (!relative) return cursor;
			for (const part of relative.split("/").filter(Boolean)) {
				const existing = childrenOf(nodes, cursor).find((child) => child.kind !== "file" && child.name.toLocaleLowerCase("ru") === part.toLocaleLowerCase("ru"));
				if (existing) {
					cursor = existing.id;
					continue;
				}
				const id = crypto.randomUUID();
				nodes[id] = dirNode(id, cursor, part);
				cursor = id;
			}
			return cursor;
		};
		for (const file of files) {
			const parts = (file.webkitRelativePath || "").split("/").filter(Boolean);
			const parent = ensureDir(parentId, parts.length > 1 ? parts.slice(0, -1).join("/") : "");
			const id = crypto.randomUUID();
			nodes[id] = fileNode(id, parent, file, uniqueName(nodes, parent, file.name));
		}
		const dirty = pane === "image" ? true : state.project.dirty;
		set({
			nodes,
			touched: true,
			project: {
				...state.project,
				dirty
			},
			active: pane
		});
		if (pane === "image") {
			const after = payloadBytes(nodes, IMAGE_ROOT);
			const cap = mediaById(state.media).bytes;
			if (after > cap && before <= cap) get().notify(`Образ больше не помещается на ${mediaById(state.media).label}.`);
			else get().notify(`В образ добавлено файлов: ${files.length}.`);
		} else get().notify(`Импортировано файлов: ${files.length}.`);
	},
	drop: (to, dirId) => {
		const state = get();
		const drag = state.dragging;
		set({ dragging: null });
		if (!drag || !drag.ids.length) return;
		const target = state.nodes[dirId];
		if (!target || target.kind === "file") return;
		if (to === "pc" && isProtected(state.nodes, dirId)) {
			get().notify("Папка назначения только для чтения.");
			return;
		}
		const ids = drag.ids.filter((id) => {
			const node = state.nodes[id];
			if (!node || node.kind === "drive" || !node.parentId) return false;
			if (id === dirId || isUnder(state.nodes, dirId, id)) return false;
			return true;
		});
		if (!ids.length) return;
		const sameTree = drag.from === "image" === (to === "image");
		const nodes = { ...state.nodes };
		if (sameTree && !(drag.from === "pc" && ids.some((id) => isProtected(state.nodes, id)))) for (const id of ids) {
			const node = nodes[id];
			if (node.parentId === dirId) continue;
			nodes[id] = {
				...node,
				parentId: dirId,
				name: uniqueName(nodes, dirId, node.name, id)
			};
		}
		else for (const id of ids) cloneInto(state.nodes, id, dirId, nodes);
		const dirty = to === "image" || drag.from === "image" ? true : state.project.dirty;
		set({
			nodes,
			touched: true,
			project: {
				...state.project,
				dirty
			}
		});
		const used = payloadBytes(nodes, IMAGE_ROOT);
		if (to === "image" && used > mediaById(state.media).bytes) get().notify(`Образ не влезет на ${mediaById(state.media).label}. Шкала заполнения стала красной.`);
	},
	requestNew: () => {
		if (get().project.dirty) {
			set({
				pendingFile: null,
				dialog: {
					type: "confirm",
					title: "Создать новый образ?",
					body: "Текущий образ не сохранён. Несохранённые файлы внутри него пропадут из проекта.",
					ok: "Создать пустой",
					pending: "new"
				}
			});
			return;
		}
		set({
			pendingFile: null,
			dialog: null
		});
		get().confirmPending();
	},
	requestOpen: (file) => {
		if (get().project.dirty) {
			set({
				pendingFile: file,
				dialog: {
					type: "confirm",
					title: "Открыть другой образ?",
					body: "Текущий проект будет заменён содержимым выбранного файла.",
					ok: "Открыть",
					pending: "open"
				}
			});
			return;
		}
		set({ pendingFile: file });
		get().confirmPending();
	},
	confirmPending: () => {
		const state = get();
		if ((state.dialog?.type === "confirm" ? state.dialog.pending : state.pendingFile ? "open" : "new") === "open" && state.pendingFile) {
			const file = state.pendingFile;
			set({
				dialog: {
					type: "progress",
					title: "Открытие",
					detail: file.name
				},
				pendingFile: null
			});
			openContainer(file);
			return;
		}
		const nodes = clearImage(state.nodes);
		nodes[IMAGE_ROOT] = {
			...nodes[IMAGE_ROOT],
			name: "NEW_VOL"
		};
		set({
			nodes,
			imageDir: IMAGE_ROOT,
			imageSelection: [],
			dialog: null,
			pendingFile: null,
			touched: true,
			project: freshProject({ dirty: false })
		});
	},
	save: async (fileName) => {
		const state = get();
		const name = (fileName || state.project.fileName || "image.iso").replace(/[\\/]/g, "");
		set({ dialog: {
			type: "progress",
			title: "Сборка ISO",
			detail: name
		} });
		await waitFrame();
		try {
			const built = buildIso({
				filesystem: state.project.filesystem,
				volumeId: state.project.volumeId,
				publisher: state.project.publisher,
				preparer: state.project.preparer,
				application: state.project.application,
				bootEmulation: state.project.bootable ? state.project.bootEmulation : "none",
				root: withSidecar(state.nodes, state.project.bootable ? state.project.bootNodeId : null)
			});
			downloadBlob(built.blob, name.endsWith(".iso") ? name : `${name}.iso`);
			set({
				touched: true,
				project: {
					...get().project,
					fileName: name.endsWith(".iso") ? name : `${name}.iso`,
					dirty: false
				},
				dialog: built.warnings.length ? {
					type: "warnings",
					lines: built.warnings
				} : null
			});
			if (!built.warnings.length) get().notify(`Образ сохранён: ${formatQuiet(built.bytes)}.`);
		} catch (error) {
			set({ dialog: {
				type: "text",
				title: "Не удалось собрать образ",
				body: error instanceof Error ? error.message : "Неизвестная ошибка сборки."
			} });
		}
	},
	extract: () => {
		const state = get();
		const ids = state.imageSelection.filter((id) => state.nodes[id] && id !== "img-root");
		if (!ids.length) {
			get().notify("Выберите файлы в образе, которые нужно извлечь.");
			return;
		}
		if (isProtected(state.nodes, state.pcDir)) {
			get().notify("Выберите папку на C:, D: или USB — туда можно извлечь файлы.");
			return;
		}
		const nodes = { ...state.nodes };
		for (const id of ids) cloneInto(state.nodes, id, state.pcDir, nodes);
		set({
			nodes,
			touched: true,
			active: "pc"
		});
		get().notify("Файлы извлечены в выбранную папку компьютера. «Скачать» сохранит их на ваш диск.");
	},
	downloadSelected: () => {
		const state = get();
		const pane = state.active;
		const ids = selectionOf(state, pane).filter((id) => state.nodes[id]?.kind === "file" && state.nodes[id]?.blob);
		if (!ids.length) {
			get().notify("Выберите файл, который нужно скачать.");
			return;
		}
		for (const id of ids) {
			const node = state.nodes[id];
			downloadBlob(node.blob, node.name);
		}
	},
	mount: () => {
		const state = get();
		const letter = state.options.driveLetter || "Z";
		const id = "drv-virtual";
		const nodes = { ...state.nodes };
		for (const child of descendantIds(nodes, id)) delete nodes[child];
		nodes[id] = {
			id,
			parentId: PC_ROOT,
			name: `${letter}: ISODrive`,
			kind: "drive",
			driveKind: "virtual",
			capacity: payloadBytes(state.nodes, IMAGE_ROOT),
			size: 0,
			attrs: { ...DEFAULT_ATTRS },
			mtime: STAMP
		};
		for (const child of childrenOf(state.nodes, IMAGE_ROOT)) cloneInto(state.nodes, child.id, id, nodes);
		set({
			nodes,
			pcDir: id,
			active: "pc",
			touched: true
		});
		get().notify(`Образ смонтирован как ${letter}:. Диск только для чтения.`);
	},
	unmount: () => {
		const nodes = { ...get().nodes };
		if (!nodes["drv-virtual"]) {
			get().notify("Виртуальный привод пуст.");
			return;
		}
		for (const child of descendantIds(nodes, "drv-virtual")) delete nodes[child];
		delete nodes["drv-virtual"];
		set({
			nodes,
			pcDir: get().pcDir === "drv-virtual" || !nodes[get().pcDir] ? "drv-c" : get().pcDir,
			touched: true
		});
		get().notify("Виртуальный привод размонтирован.");
	},
	burnTo: async (driveId) => {
		const state = get();
		set({ dialog: {
			type: "progress",
			title: "Запись",
			detail: "Сборка образа и запись на виртуальный привод"
		} });
		await waitFrame();
		try {
			const built = buildIso(inputFrom(state));
			const nodes = { ...state.nodes };
			const id = driveId === "new" ? "drv-burned" : driveId;
			for (const child of descendantIds(nodes, id)) delete nodes[child];
			nodes[id] = {
				id,
				parentId: PC_ROOT,
				name: nodes[id]?.name ?? "G: DVD-R",
				kind: "drive",
				driveKind: "optical",
				capacity: mediaById(state.media).bytes,
				size: 0,
				attrs: { ...DEFAULT_ATTRS },
				mtime: STAMP
			};
			for (const child of childrenOf(state.nodes, IMAGE_ROOT)) cloneInto(state.nodes, child.id, id, nodes);
			downloadBlob(built.blob, state.project.fileName || "image.iso");
			set({
				nodes,
				dialog: null,
				pcDir: id,
				touched: true,
				project: {
					...state.project,
					dirty: false
				}
			});
			get().notify("Запись завершена. ISO также скачан — его можно прожечь штатной программой Windows.");
		} catch (error) {
			set({ dialog: {
				type: "text",
				title: "Запись прервана",
				body: error instanceof Error ? error.message : "Ошибка записи."
			} });
		}
	},
	writeTo: async (driveId, alsoDownload) => {
		const state = get();
		set({ dialog: {
			type: "progress",
			title: "Запись на USB",
			detail: "Подготовка образа жёсткого диска"
		} });
		await waitFrame();
		try {
			const built = buildIso(inputFrom(state));
			const nodes = { ...state.nodes };
			const id = driveId === "new" ? crypto.randomUUID() : driveId;
			for (const child of descendantIds(nodes, id)) delete nodes[child];
			nodes[id] = {
				id,
				parentId: PC_ROOT,
				name: driveId === "new" ? "H: USB-HDD" : nodes[id]?.name ?? "USB",
				kind: "drive",
				driveKind: "removable",
				capacity: 32 * 1024 ** 3,
				size: 0,
				attrs: { ...DEFAULT_ATTRS },
				mtime: STAMP
			};
			for (const child of childrenOf(state.nodes, IMAGE_ROOT)) cloneInto(state.nodes, child.id, id, nodes);
			if (alsoDownload) downloadBlob(built.blob, state.project.fileName || "image.iso");
			set({
				nodes,
				dialog: null,
				pcDir: id,
				active: "pc",
				touched: true
			});
			get().notify(alsoDownload ? "Образ записан на виртуальный USB и скачан. В Windows его пишут на флешку как есть." : "Образ записан на виртуальный USB. Откройте его в нижнем окне.");
		} catch (error) {
			set({ dialog: {
				type: "text",
				title: "Не удалось записать",
				body: error instanceof Error ? error.message : "Ошибка записи."
			} });
		}
	},
	imageFromDrive: (driveId) => {
		const state = get();
		const drive = state.nodes[driveId];
		if (!drive || drive.kind !== "drive") return;
		const nodes = clearImage(state.nodes);
		nodes[IMAGE_ROOT] = {
			...nodes[IMAGE_ROOT],
			name: drive.name.replace(/[:\\]/g, "").slice(0, 16) || "DISC"
		};
		for (const child of childrenOf(state.nodes, driveId)) cloneInto(state.nodes, child.id, IMAGE_ROOT, nodes);
		const volumeId = nodes["img-root"].name.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 16) || "DISC";
		nodes[IMAGE_ROOT] = {
			...nodes[IMAGE_ROOT],
			name: volumeId
		};
		set({
			nodes,
			imageDir: IMAGE_ROOT,
			imageSelection: [],
			active: "image",
			dialog: null,
			touched: true,
			project: freshProject({
				volumeId,
				fileName: `${volumeId}.iso`,
				dirty: true,
				filesystem: "joliet"
			})
		});
		get().notify(`Новый образ собран с диска ${drive.name}.`);
	},
	compressIsz: async () => {
		const state = get();
		set({ dialog: {
			type: "progress",
			title: "Сжатие ISZ",
			detail: "zlib, блоки по 64 КБ"
		} });
		await waitFrame();
		try {
			const built = buildIso(inputFrom(state));
			const raw = new Uint8Array(await built.blob.arrayBuffer());
			const packed = writeIsz(raw);
			const base = (state.project.fileName || "image.iso").replace(/\.iso$/i, "");
			downloadBlob(blobOf(packed), `${base}.isz`);
			set({ dialog: null });
			get().notify(`ISZ готов: ${formatQuiet(packed.length)} вместо ${formatQuiet(raw.length)}.`);
		} catch (error) {
			set({ dialog: {
				type: "text",
				title: "Сжатие не удалось",
				body: error instanceof Error ? error.message : "Ошибка ISZ."
			} });
		}
	},
	convertAndOpen: async (file, open) => {
		set({ dialog: {
			type: "progress",
			title: "Конвертация",
			detail: file.name
		} });
		await waitFrame();
		try {
			const raw = new Uint8Array(await file.arrayBuffer());
			const converted = file.name.toLowerCase().endsWith(".isz") ? {
				iso: readIsz(raw),
				detected: "ISZ"
			} : convertToIso(raw, file.name);
			const outName = file.name.replace(/\.[^.]+$/, "") + ".iso";
			downloadBlob(blobOf(converted.iso), outName);
			if (open) {
				const parsed = await consumeAttrFile(parseIso(converted.iso).root);
				const parsedAll = parseIso(converted.iso);
				const nodes = replaceImage(get().nodes, parsed);
				const bootNodeId = findBootId(nodes);
				set({
					nodes,
					imageDir: IMAGE_ROOT,
					imageSelection: [],
					dialog: null,
					touched: true,
					project: freshProject({
						volumeId: parsedAll.volumeId.slice(0, 32) || "VOLUME",
						filesystem: parsedAll.filesystem,
						publisher: parsedAll.publisher || "ARCA",
						bootable: !!parsedAll.boot,
						bootNodeId,
						bootEmulation: parsedAll.boot?.emulation ?? "none",
						fileName: outName,
						dirty: false
					})
				});
				if (get().options.autoMount) get().mount();
				get().notify(`Открыт ${converted.detected}: ${parsedAll.volumeId}.`);
			} else {
				set({ dialog: null });
				get().notify(`${converted.detected} преобразован в ISO и скачан.`);
			}
		} catch (error) {
			set({ dialog: {
				type: "text",
				title: "Конвертация не удалась",
				body: error instanceof Error ? error.message : "Формат не распознан."
			} });
		}
	},
	checksumSelected: async () => {
		const state = get();
		const pane = state.active;
		const id = selectionOf(state, pane).find((item) => state.nodes[item]?.kind === "file");
		const node = id ? state.nodes[id] : void 0;
		if (!node?.blob) {
			get().notify("Выберите файл, а не папку.");
			return;
		}
		set({ dialog: {
			type: "progress",
			title: "Контрольные суммы",
			detail: node.name
		} });
		const bytes = new Uint8Array(await node.blob.arrayBuffer());
		const [sha1, sha256] = await Promise.all([sha(bytes, "SHA-1"), sha(bytes, "SHA-256")]);
		set({ dialog: {
			type: "checksum",
			name: node.name,
			size: node.size,
			md5: md5(bytes),
			sha1,
			sha256,
			crc: hex32(crc32(bytes))
		} });
	},
	loadBootFrom: (pane) => {
		const state = get();
		const id = selectionOf(state, pane).find((item) => state.nodes[item]?.kind === "file");
		const node = id ? state.nodes[id] : void 0;
		if (!node?.blob) {
			get().notify("Выберите файл, который станет загрузочным сектором.");
			return;
		}
		const nodes = { ...state.nodes };
		for (const item of Object.values(nodes)) if (item.boot) nodes[item.id] = {
			...item,
			boot: false
		};
		let bootNodeId = node.id;
		if (pane === "pc" || !isUnder(nodes, node.id, "img-root")) {
			let bootDir = childrenOf(nodes, IMAGE_ROOT).find((child) => child.kind === "dir" && child.name.toLowerCase() === "boot");
			if (!bootDir) {
				const dirId = crypto.randomUUID();
				nodes[dirId] = dirNode(dirId, IMAGE_ROOT, "boot");
				bootDir = nodes[dirId];
			}
			bootNodeId = cloneInto(nodes, node.id, bootDir.id, nodes);
		}
		nodes[bootNodeId] = {
			...nodes[bootNodeId],
			boot: true
		};
		set({
			nodes,
			dialog: null,
			touched: true,
			project: {
				...state.project,
				bootable: true,
				bootNodeId,
				dirty: true
			}
		});
		get().notify("Загрузочный файл вшит. Образ помечен как El Torito.");
	},
	extractBoot: () => {
		const state = get();
		const id = state.project.bootNodeId;
		const node = id ? state.nodes[id] : void 0;
		if (!node?.blob) {
			get().notify("В образе нет загрузочного файла. Сначала загрузите его.");
			return;
		}
		if (!isProtected(state.nodes, state.pcDir)) {
			const nodes = { ...state.nodes };
			cloneInto(state.nodes, node.id, state.pcDir, nodes);
			set({
				nodes,
				touched: true
			});
		}
		downloadBlob(node.blob, node.name);
		get().notify("Загрузочный файл извлечён и скачан.");
	},
	makeBoot: () => {
		const sector = makeBootSector("ARCA BOOT OK");
		const state = get();
		const nodes = { ...state.nodes };
		let bootDir = childrenOf(nodes, IMAGE_ROOT).find((child) => child.kind === "dir" && child.name.toLowerCase() === "boot");
		if (!bootDir) {
			const dirId = crypto.randomUUID();
			nodes[dirId] = dirNode(dirId, IMAGE_ROOT, "boot");
			bootDir = nodes[dirId];
		}
		const id = crypto.randomUUID();
		nodes[id] = {
			id,
			parentId: bootDir.id,
			name: uniqueName(nodes, bootDir.id, "etfsboot.bin"),
			kind: "file",
			size: sector.length,
			attrs: {
				...DEFAULT_ATTRS,
				system: true
			},
			mtime: STAMP,
			blob: blobOf(sector),
			boot: true
		};
		for (const item of Object.values(nodes)) if (item.boot && item.id !== id) nodes[item.id] = {
			...item,
			boot: false
		};
		set({
			nodes,
			touched: true,
			project: {
				...state.project,
				bootable: true,
				bootNodeId: id,
				bootEmulation: "none",
				dirty: true
			}
		});
		get().notify("Создан загрузочный сектор BIOS и подключён как El Torito без эмуляции.");
	},
	markHydrated: (snapshot) => {
		if (get().touched || !snapshot) {
			set({ hydrated: true });
			return;
		}
		set({
			...snapshot,
			hydrated: true,
			touched: false
		});
	}
}));
function inputFrom(state) {
	return {
		filesystem: state.project.filesystem,
		volumeId: state.project.volumeId,
		publisher: state.project.publisher,
		preparer: state.project.preparer,
		application: state.project.application,
		bootEmulation: state.project.bootable ? state.project.bootEmulation : "none",
		root: withSidecar(state.nodes, state.project.bootable ? state.project.bootNodeId : null)
	};
}
function formatQuiet(bytes) {
	if (bytes < 1024) return `${bytes} Б`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} КБ`;
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
	return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}
function waitFrame() {
	return new Promise((resolve) => setTimeout(resolve, 40));
}
async function openContainer(file) {
	try {
		const raw = new Uint8Array(await file.arrayBuffer());
		const converted = file.name.toLowerCase().endsWith(".isz") ? {
			iso: readIsz(raw),
			detected: "ISZ"
		} : convertToIso(raw, file.name);
		const parsed = parseIso(converted.iso);
		const root = await consumeAttrFile(parsed.root);
		const nodes = replaceImage(useStudio.getState().nodes, {
			...root,
			name: parsed.volumeId || root.name
		});
		const bootNodeId = findBootId(nodes);
		if (nodes["img-root"]) nodes[IMAGE_ROOT] = {
			...nodes[IMAGE_ROOT],
			name: parsed.volumeId || root.name
		};
		useStudio.setState({
			nodes,
			imageDir: IMAGE_ROOT,
			imageSelection: [],
			dialog: null,
			touched: true,
			active: "image",
			project: freshProject({
				volumeId: (parsed.volumeId || "VOLUME").slice(0, 32),
				filesystem: parsed.filesystem,
				publisher: parsed.publisher || "ARCA",
				bootable: !!parsed.boot,
				bootNodeId,
				bootEmulation: parsed.boot?.emulation ?? "none",
				fileName: file.name.toLowerCase().endsWith(".iso") ? file.name : file.name.replace(/\.[^.]+$/, "") + ".iso",
				dirty: false
			})
		});
		if (useStudio.getState().options.autoMount) useStudio.getState().mount();
		useStudio.getState().notify(`Открыт ${converted.detected}. Файловая система: ${labelFs(parsed.filesystem)}.`);
	} catch (error) {
		useStudio.setState({ dialog: {
			type: "text",
			title: "Не удалось открыть",
			body: error instanceof Error ? error.message : "Файл не является образом диска."
		} });
	}
}
function labelFs(kind) {
	if (kind === "udf") return "UDF";
	if (kind === "joliet") return "Joliet";
	return "ISO 9660";
}
function glyph(node) {
	const className = "size-4 shrink-0 text-accent";
	if (node.kind === "drive") {
		if (node.driveKind === "removable") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Usb, { className });
		if (node.driveKind === "optical") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Disc, { className });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className });
	}
	if (node.kind !== "file") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Folder, { className });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(File, { className: "size-4 shrink-0 text-muted" });
}
function flags(node) {
	const items = [
		["H", node.attrs.hidden],
		["S", node.attrs.system],
		["A", node.attrs.archive],
		["R", node.attrs.readonly]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "font-mono text-xs tracking-wide",
		children: items.map(([letter, on]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: on ? "text-fg" : "text-line",
			children: letter
		}, letter))
	});
}
function Workspace() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-0 flex-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "hidden h-full md:block",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(mo, {
				orientation: "vertical",
				className: "h-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(yo, {
						defaultSize: "52%",
						minSize: "22%",
						className: "min-h-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(mo, {
							orientation: "horizontal",
							className: "h-full",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(yo, {
									defaultSize: "30%",
									minSize: "16%",
									className: "min-h-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tree, { pane: "image" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(xo, { className: "w-1.5 bg-line transition-colors hover:bg-accent" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(yo, {
									minSize: "24%",
									className: "min-h-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Listing, { pane: "image" })
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(xo, { className: "h-1.5 bg-line transition-colors hover:bg-accent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(yo, {
						minSize: "22%",
						className: "min-h-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(mo, {
							orientation: "horizontal",
							className: "h-full",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(yo, {
									defaultSize: "30%",
									minSize: "16%",
									className: "min-h-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tree, { pane: "pc" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(xo, { className: "w-1.5 bg-line transition-colors hover:bg-accent" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(yo, {
									minSize: "24%",
									className: "min-h-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Listing, { pane: "pc" })
								})
							]
						})
					})
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileWorkspace, {})]
	});
}
function MobileWorkspace() {
	const active = useStudio((s) => s.active);
	const setActive = useStudio((s) => s.setActive);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col md:hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 border-b border-line",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: `h-11 text-sm font-medium ${active === "image" ? "bg-accent text-on-accent" : "bg-surface text-muted"}`,
				onClick: () => setActive("image"),
				children: "Образ"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: `h-11 text-sm font-medium ${active === "pc" ? "bg-accent text-on-accent" : "bg-surface text-muted"}`,
				onClick: () => setActive("pc"),
				children: "Компьютер"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid min-h-0 flex-1 grid-rows-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tree, { pane: active }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Listing, { pane: active })]
		})]
	});
}
function Tree({ pane }) {
	const nodes = useStudio((s) => s.nodes);
	const current = useStudio((s) => pane === "image" ? s.imageDir : s.pcDir);
	const openDir = useStudio((s) => s.openDir);
	const setActive = useStudio((s) => s.setActive);
	const drop = useStudio((s) => s.drop);
	const root = pane === "image" ? IMAGE_ROOT : PC_ROOT;
	const [open, setOpen] = (0, import_react.useState)({
		[IMAGE_ROOT]: true,
		[PC_ROOT]: true,
		"drv-c": true,
		"c-users": true,
		"img-docs": true,
		"img-bootdir": true
	});
	const [over, setOver] = (0, import_react.useState)(null);
	const renderNode = (id, depth) => {
		const node = nodes[id];
		if (!node) return null;
		const kids = childrenOf(nodes, id).filter((child) => child.kind !== "file");
		const expanded = open[id] ?? isUnder(nodes, current, id);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: `flex min-h-11 w-full items-center gap-1 pr-2 text-left text-sm md:min-h-8 ${current === id ? "bg-accent/20 text-fg" : "text-fg hover:bg-raised"} ${over === id ? "outline outline-1 outline-accent" : ""}`,
			style: { paddingLeft: `${8 + depth * 14}px` },
			onClick: () => {
				setActive(pane);
				openDir(pane, id);
				if (kids.length) setOpen((state) => ({
					...state,
					[id]: !expanded
				}));
			},
			onDragOver: (event) => {
				event.preventDefault();
				setOver(id);
			},
			onDragLeave: () => setOver((value) => value === id ? null : value),
			onDrop: (event) => {
				event.preventDefault();
				setOver(null);
				drop(pane, id);
			},
			children: [
				kids.length ? expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5 text-muted" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "inline-block size-3.5" }),
				glyph(node),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: node.name
				})
			]
		}), expanded && kids.map((child) => renderNode(child.id, depth + 1))] }, id);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex h-full min-h-0 flex-col bg-inset",
		onMouseDown: () => setActive(pane),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "flex h-9 shrink-0 items-center border-b border-line bg-raised px-3 text-xs font-medium tracking-wide text-muted uppercase",
			children: pane === "image" ? "Дерево образа" : "Дерево компьютера"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-0 flex-1 overflow-auto py-1",
			children: renderNode(root, 0)
		})]
	});
}
function Listing({ pane }) {
	const nodes = useStudio((s) => s.nodes);
	const dir = useStudio((s) => pane === "image" ? s.imageDir : s.pcDir);
	const selection = useStudio((s) => pane === "image" ? s.imageSelection : s.pcSelection);
	const select = useStudio((s) => s.select);
	const openDir = useStudio((s) => s.openDir);
	const setActive = useStudio((s) => s.setActive);
	const setDragging = useStudio((s) => s.setDragging);
	const drop = useStudio((s) => s.drop);
	const addExternal = useStudio((s) => s.addExternal);
	const extract = useStudio((s) => s.extract);
	const setDialog = useStudio((s) => s.setDialog);
	const downloadSelected = useStudio((s) => s.downloadSelected);
	const allowMenu = useStudio((s) => s.options.contextMenu);
	const [over, setOver] = (0, import_react.useState)(false);
	const [menu, setMenu] = (0, import_react.useState)(null);
	const rows = childrenOf(nodes, dir);
	const folder = nodes[dir];
	const onDragStart = (node) => (event) => {
		if (node.kind === "drive") {
			event.preventDefault();
			return;
		}
		const payload = {
			from: pane,
			ids: selection.includes(node.id) ? selection : [node.id]
		};
		setDragging(payload);
		event.dataTransfer.setData("application/x-arca", JSON.stringify(payload));
		event.dataTransfer.effectAllowed = "copyMove";
		if (!selection.includes(node.id)) select(pane, node.id, "set");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: `flex h-full min-h-0 flex-col bg-inset ${over ? "outline outline-1 outline-accent" : ""}`,
		onMouseDown: () => {
			setActive(pane);
			setMenu(null);
		},
		onDragOver: (event) => {
			event.preventDefault();
			setOver(true);
		},
		onDragLeave: () => setOver(false),
		onDrop: (event) => {
			event.preventDefault();
			setOver(false);
			if (event.dataTransfer.files?.length) {
				addExternal(event.dataTransfer.files, pane);
				return;
			}
			drop(pane, dir);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex h-9 shrink-0 items-center gap-2 border-b border-line bg-raised px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate text-xs font-medium text-muted",
					children: pane === "image" ? "Содержимое образа" : "Локальные файлы"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate font-mono text-xs text-fg",
					children: folder?.name
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-[1fr_5.5rem_8.5rem_3.2rem] gap-2 border-b border-line px-2 py-1 text-xs text-muted max-md:grid-cols-[1fr_5rem]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Имя" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-right",
						children: "Размер"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "max-md:hidden",
						children: "Изменён"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "max-md:hidden",
						children: "Атр."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-h-0 flex-1 overflow-auto",
				children: [rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-3 py-6 text-sm text-pretty text-muted",
					children: pane === "image" ? "Образ пуст. Перетащите файлы из нижнего окна или нажмите «Добавить»." : "Папка пуста. Импортируйте файлы с вашего компьютера кнопкой на панели."
				}), rows.map((node) => {
					const selected = selection.includes(node.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						draggable: node.kind !== "drive",
						onDragStart: onDragStart(node),
						onDragEnd: () => setDragging(null),
						onClick: (event) => {
							const mode = event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "set";
							select(pane, node.id, mode);
						},
						onDoubleClick: () => {
							if (node.kind !== "file") openDir(pane, node.id);
							else if (pane === "pc") {
								select("pc", node.id, "set");
								const drag = {
									from: "pc",
									ids: [node.id]
								};
								setDragging(drag);
								drop("image", useStudio.getState().imageDir);
							} else showText(node);
						},
						onContextMenu: (event) => {
							if (!allowMenu) return;
							event.preventDefault();
							if (!selection.includes(node.id)) select(pane, node.id, "set");
							setMenu({
								x: event.clientX,
								y: event.clientY,
								id: node.id
							});
						},
						className: `grid w-full grid-cols-[1fr_5.5rem_8.5rem_3.2rem] items-center gap-2 px-2 text-left text-sm max-md:grid-cols-[1fr_5rem] ${selected ? "bg-accent/25 text-fg" : "hover:bg-raised"} ${node.attrs.hidden ? "opacity-55" : ""} min-h-11 md:min-h-8`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex min-w-0 items-center gap-2",
								children: [
									glyph(node),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: node.name
									}),
									node.boot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "shrink-0 text-xs font-medium text-accent",
										children: "BOOT"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-right font-mono text-xs tabular-nums text-muted",
								children: node.kind === "file" ? formatBytes(node.size) : node.capacity ? formatBytes(node.capacity) : ""
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate font-mono text-xs text-muted max-md:hidden",
								children: formatWhen(node.mtime)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "max-md:hidden",
								children: node.kind === "file" ? flags(node) : null
							})
						]
					}, node.id);
				})]
			}),
			menu && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenu, {
				x: menu.x,
				y: menu.y,
				pane,
				onClose: () => setMenu(null),
				onOpen: () => {
					const node = nodes[menu.id];
					if (node && node.kind !== "file") openDir(pane, node.id);
					else if (node) showText(node);
				},
				onExtract: () => extract(),
				onDownload: () => downloadSelected(),
				onRename: () => setDialog({ type: "rename" }),
				onAttrs: () => setDialog({ type: "attrs" }),
				onDelete: () => useStudio.getState().removeSelected(),
				onChecksum: () => void useStudio.getState().checksumSelected()
			})
		]
	});
}
async function showText(node) {
	if (!node.blob || node.size > 2e5) {
		useStudio.getState().checksumSelected();
		return;
	}
	const text = await node.blob.text();
	if (!(/^[\s\S]*$/.test(text) && !text.includes("\0"))) {
		useStudio.getState().checksumSelected();
		return;
	}
	useStudio.getState().setDialog({
		type: "text",
		title: node.name,
		body: text.slice(0, 8e3)
	});
}
function ContextMenu({ x, y, pane, onClose, onOpen, onExtract, onDownload, onRename, onAttrs, onDelete, onChecksum }) {
	const addToImage = () => {
		const state = useStudio.getState();
		state.setDragging({
			from: "pc",
			ids: state.pcSelection
		});
		state.drop("image", state.imageDir);
	};
	const items = [
		{
			label: "Открыть",
			run: onOpen
		},
		pane === "image" ? {
			label: "Извлечь на компьютер",
			run: onExtract
		} : {
			label: "Добавить в образ",
			run: addToImage
		},
		{
			label: "Скачать",
			run: onDownload
		},
		{
			label: "Переименовать",
			run: onRename
		},
		{
			label: "Атрибуты",
			run: onAttrs
		},
		{
			label: "Контрольная сумма",
			run: onChecksum
		},
		{
			label: "Удалить",
			run: onDelete
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: "fixed inset-0 z-30 cursor-default",
		"aria-label": "Закрыть меню",
		onClick: onClose
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "menu",
		className: "fixed z-40 min-w-52 border border-line bg-raised py-1 shadow-lg",
		style: {
			left: Math.min(x, window.innerWidth - 220),
			top: Math.min(y, window.innerHeight - 280)
		},
		children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			role: "menuitem",
			className: "block h-11 w-full px-3 text-left text-sm hover:bg-accent/20 md:h-9",
			onClick: () => {
				onClose();
				item.run();
			},
			children: item.label
		}, item.label))
	})] });
}
var field = "h-11 w-full border border-line bg-inset px-3 text-sm text-fg outline-none focus:border-accent";
var labelCls = "mb-1 block text-xs font-medium tracking-wide text-muted uppercase";
var primary = "h-11 bg-accent px-4 text-sm font-medium text-on-accent";
var quiet = "h-11 border border-line bg-raised px-4 text-sm text-fg";
var FS = [
	{
		id: "iso9660",
		title: "ISO 9660",
		text: "Короткие имена 8.3 и максимальная совместимость. Длинные имена режутся, файлы больше 4 ГБ не помещаются."
	},
	{
		id: "joliet",
		title: "Joliet",
		text: "Unicode поверх ISO 9660. Кириллица и длинные имена читаются в Windows. Предел имени — 64 символа."
	},
	{
		id: "udf",
		title: "UDF",
		text: "Мост ISO 9660 + UDF. Длинные имена и файлы больше 4 ГБ. Для больших образов данных."
	}
];
var EMU = [
	{
		id: "none",
		label: "Без эмуляции (El Torito)"
	},
	{
		id: "floppy144",
		label: "Дискета 1.44 МБ"
	},
	{
		id: "floppy120",
		label: "Дискета 1.2 МБ"
	},
	{
		id: "floppy288",
		label: "Дискета 2.88 МБ"
	},
	{
		id: "hdd",
		label: "Жёсткий диск"
	}
];
function closeDialog() {
	useStudio.setState({
		dialog: null,
		pendingFile: null
	});
}
function Shell({ title, children, wide }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-3 md:items-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-label": title,
			className: `max-h-[88dvh] w-full overflow-auto border border-line bg-surface shadow-lg ${wide ? "max-w-xl" : "max-w-md"}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 flex h-12 items-center justify-between border-b border-line bg-surface px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "grid size-11 place-items-center text-muted",
					"aria-label": "Закрыть",
					onClick: closeDialog,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-3 p-3",
				children
			})]
		})
	});
}
function Row({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap justify-end gap-2",
		children
	});
}
function selectedNode() {
	const state = useStudio.getState();
	const id = (state.active === "image" ? state.imageSelection : state.pcSelection)[0];
	return id ? state.nodes[id] : void 0;
}
function Properties() {
	const project = useStudio((s) => s.project);
	const setProjectPatch = useStudio((s) => s.setProjectPatch);
	const [volumeId, setVolumeId] = (0, import_react.useState)(project.volumeId);
	const [publisher, setPublisher] = (0, import_react.useState)(project.publisher);
	const [preparer, setPreparer] = (0, import_react.useState)(project.preparer);
	const [application, setApplication] = (0, import_react.useState)(project.application);
	const [filesystem, setFilesystem] = (0, import_react.useState)(project.filesystem);
	const [bootable, setBootable] = (0, import_react.useState)(project.bootable);
	const [bootEmulation, setBootEmulation] = (0, import_react.useState)(project.bootEmulation);
	const chosen = FS.find((item) => item.id === filesystem) ?? FS[1];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Свойства образа",
		wide: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: labelCls,
				htmlFor: "vol",
				children: "Метка тома"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: "vol",
				className: field,
				value: volumeId,
				maxLength: 32,
				onChange: (e) => setVolumeId(e.target.value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "pub",
					children: "Издатель"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "pub",
					className: field,
					value: publisher,
					onChange: (e) => setPublisher(e.target.value)
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "prep",
					children: "Подготовил"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "prep",
					className: field,
					value: preparer,
					onChange: (e) => setPreparer(e.target.value)
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: labelCls,
				htmlFor: "app",
				children: "Приложение"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: "app",
				className: field,
				value: application,
				onChange: (e) => setApplication(e.target.value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: labelCls,
				children: "Файловая система"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-2",
				children: FS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: `flex cursor-pointer gap-3 border px-3 py-2 ${filesystem === item.id ? "border-accent bg-accent/10" : "border-line"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "radio",
						name: "fs",
						className: "mt-1 accent-accent",
						checked: filesystem === item.id,
						onChange: () => setFilesystem(item.id)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm font-medium",
						children: item.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm text-pretty text-muted",
						children: item.text
					})] })]
				}, item.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-pretty text-muted",
				children: [
					"Сейчас выбрано: ",
					chosen.title,
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex h-11 items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "accent-accent",
					checked: bootable,
					onChange: (e) => setBootable(e.target.checked)
				}), "Загрузочный образ (El Torito)"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: labelCls,
				htmlFor: "emu",
				children: "Эмуляция загрузки"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				id: "emu",
				className: field,
				value: bootEmulation,
				disabled: !bootable,
				onChange: (e) => setBootEmulation(e.target.value),
				children: EMU.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: item.id,
					children: item.label
				}, item.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: quiet,
				onClick: closeDialog,
				children: "Отмена"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: primary,
				onClick: () => {
					const id = volumeId.trim();
					if (!id || /[\\/]/.test(id)) {
						useStudio.getState().notify("Метка тома не должна быть пустой и не может содержать \\ или /.");
						return;
					}
					setProjectPatch({
						volumeId: id,
						publisher,
						preparer,
						application,
						filesystem,
						bootable,
						bootEmulation
					});
					closeDialog();
				},
				children: "Применить"
			})] })
		]
	});
}
function NameDialog({ title, initial, submit }) {
	const [name, setName] = (0, import_react.useState)(initial);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
		title,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "flex flex-col gap-3",
			onSubmit: (event) => {
				event.preventDefault();
				submit(name);
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "name",
					children: "Имя"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "name",
					className: field,
					value: name,
					autoFocus: true,
					onChange: (e) => setName(e.target.value)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: quiet,
					onClick: closeDialog,
					children: "Отмена"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: primary,
					children: "OK"
				})] })
			]
		})
	});
}
function AttrsDialog() {
	const node = selectedNode();
	const [attrs, setAttrs] = (0, import_react.useState)(node?.attrs ?? {
		hidden: false,
		system: false,
		archive: true,
		readonly: false
	});
	if (!node || node.kind === "drive") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
		title: "Атрибуты",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty text-muted",
			children: "Выберите файл или папку, а не диск."
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: `Атрибуты — ${node.name}`,
		children: [
			[
				{
					key: "hidden",
					title: "Скрытый"
				},
				{
					key: "system",
					title: "Системный"
				},
				{
					key: "archive",
					title: "Архивный"
				},
				{
					key: "readonly",
					title: "Только чтение"
				}
			].map((box) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex h-11 items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "accent-accent",
					checked: attrs[box.key],
					onChange: (e) => setAttrs({
						...attrs,
						[box.key]: e.target.checked
					})
				}), box.title]
			}, box.key)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-pretty text-muted",
				children: "Скрытый файл останется в образе, но будет помечен в каталоге ISO."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: quiet,
				onClick: closeDialog,
				children: "Отмена"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: primary,
				onClick: () => useStudio.getState().applyAttrs(attrs),
				children: "Применить"
			})] })
		]
	});
}
function WriteDialog() {
	const nodes = useStudio((s) => s.nodes);
	const media = useStudio((s) => s.media);
	const removable = childrenOf(nodes, PC_ROOT).filter((node) => node.driveKind === "removable");
	const [driveId, setDriveId] = (0, import_react.useState)(removable[0]?.id ?? "new");
	const [also, setAlso] = (0, import_react.useState)(true);
	const over = payloadBytes(nodes, IMAGE_ROOT) > mediaById(media).bytes;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Записать образ жёсткого диска",
		wide: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-pretty text-muted",
				children: "Образ собирается в ISO и кладётся на виртуальный USB в нижнем окне. Файл можно скачать и записать на флешку штатной программой Windows. Реальный порт USB из браузера недоступен."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: labelCls,
				htmlFor: "usb",
				children: "Целевой носитель"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				id: "usb",
				className: field,
				value: driveId,
				onChange: (e) => setDriveId(e.target.value),
				children: [removable.map((drive) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: drive.id,
					children: drive.name
				}, drive.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "new",
					children: "Новая флешка H: USB-HDD"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex h-11 items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "accent-accent",
					checked: also,
					onChange: (e) => setAlso(e.target.checked)
				}), "Также скачать готовый ISO"]
			}),
			over && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-danger",
				children: [
					"Образ больше выбранной болванки (",
					mediaById(media).label,
					"). На флешку 32 ГБ он всё ещё может поместиться."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: quiet,
				onClick: closeDialog,
				children: "Отмена"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: primary,
				onClick: () => void useStudio.getState().writeTo(driveId, also),
				children: "Записать"
			})] })
		]
	});
}
function BurnDialog() {
	const nodes = useStudio((s) => s.nodes);
	const media = useStudio((s) => s.media);
	const optical = childrenOf(nodes, PC_ROOT).filter((node) => node.driveKind === "optical");
	const [driveId, setDriveId] = (0, import_react.useState)(optical[0]?.id ?? "new");
	const used = payloadBytes(nodes, IMAGE_ROOT);
	const cap = mediaById(media).bytes;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Запись CD/DVD",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-pretty text-muted",
				children: "Запись идёт на виртуальный привод в этом компьютере. ISO одновременно скачивается — его можно прожечь в Windows."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: labelCls,
				htmlFor: "opt",
				children: "Привод"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				id: "opt",
				className: field,
				value: driveId,
				onChange: (e) => setDriveId(e.target.value),
				children: [optical.map((drive) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: drive.id,
					children: drive.name
				}, drive.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "new",
					children: "Новый DVD-R G:"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: `text-sm ${used > cap ? "text-danger" : "text-muted"}`,
				children: [
					"Размер образа ",
					formatBytes(used),
					" из ",
					formatBytes(cap),
					" (",
					mediaById(media).label,
					")."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: quiet,
				onClick: closeDialog,
				children: "Отмена"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: primary,
				onClick: () => {
					if (used > cap) {
						useStudio.getState().notify("Образ не влезет на выбранную болванку.");
						return;
					}
					useStudio.getState().burnTo(driveId);
				},
				children: "Записать"
			})] })
		]
	});
}
function BootDialog() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Загрузочный файл",
		wide: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty text-muted",
			children: "Выделите boot-сектор в образе или на компьютере и вшейте его. Либо создайте новый сектор BIOS — он ляжет в папку boot и станет каталогом El Torito."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: quiet,
					onClick: () => useStudio.getState().loadBootFrom("image"),
					children: "Взять выделенный файл из образа"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: quiet,
					onClick: () => useStudio.getState().loadBootFrom("pc"),
					children: "Взять выделенный файл с компьютера"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: primary,
					onClick: () => useStudio.getState().makeBoot(),
					children: "Создать загрузочный сектор"
				})
			]
		})]
	});
}
function ChecksumDialog() {
	const dialog = useStudio((s) => s.dialog);
	if (dialog?.type !== "checksum") return null;
	const rows = [
		["MD5", dialog.md5],
		["SHA-1", dialog.sha1],
		["SHA-256", dialog.sha256],
		["CRC32", dialog.crc]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Контрольные суммы",
		wide: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm",
			children: [
				dialog.name,
				" · ",
				formatBytes(dialog.size)
			]
		}), rows.map(([name, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "border border-line bg-inset p-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-1 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs font-medium tracking-wide text-muted uppercase",
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-accent",
					onClick: () => {
						navigator.clipboard.writeText(value).then(() => useStudio.getState().notify(`${name} скопирован.`));
					},
					children: "Копировать"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xs break-all",
				children: value
			})]
		}, name))]
	});
}
function ConvertDialog() {
	const [openAfter, setOpenAfter] = (0, import_react.useState)(true);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Конвертация",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-pretty text-muted",
				children: "NRG, BIN/IMG, MDF и ISZ приводятся к ISO. Префикс заголовка чужого формата отрезается, содержимое сохраняется."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex h-11 items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "accent-accent",
					checked: openAfter,
					onChange: (e) => setOpenAfter(e.target.checked)
				}), "Открыть результат в студии"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: `${primary} inline-flex items-center justify-center`,
				children: ["Выбрать файл", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "file",
					className: "sr-only",
					accept: ".iso,.isz,.nrg,.mdf,.img,.bin,.cue",
					onChange: (event) => {
						const file = event.target.files?.[0];
						event.target.value = "";
						if (file) useStudio.getState().convertAndOpen(file, openAfter);
					}
				})]
			})
		]
	});
}
function IszDialog() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Сжатие ISZ",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty text-muted",
			children: "Образ собирается и упаковывается zlib блоками по 64 КБ. Полученный .isz можно снова открыть через «Открыть» или «Конвертировать»."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: quiet,
			onClick: closeDialog,
			children: "Отмена"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: primary,
			onClick: () => void useStudio.getState().compressIsz(),
			children: "Сжать и скачать"
		})] })]
	});
}
function OptionsDialog() {
	const options = useStudio((s) => s.options);
	const setOptions = useStudio((s) => s.setOptions);
	const setAssociation = useStudio((s) => s.setAssociation);
	const keys = Object.keys(options.associations);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Настройки",
		wide: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: labelCls,
				htmlFor: "letter",
				children: "Буква виртуального привода ISODrive"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				id: "letter",
				className: field,
				value: options.driveLetter,
				onChange: (e) => setOptions({ driveLetter: e.target.value }),
				children: [
					"Z",
					"Y",
					"X",
					"W",
					"V"
				].map((letter) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: letter,
					children: [letter, ":"]
				}, letter))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-11 items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "accent-accent",
					checked: options.autoMount,
					onChange: (e) => setOptions({ autoMount: e.target.checked })
				}), "Монтировать образ сразу после открытия"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-11 items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "accent-accent",
					checked: options.contextMenu,
					onChange: (e) => setOptions({ contextMenu: e.target.checked })
				}), "Контекстное меню в списках файлов"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: labelCls,
				children: "Ассоциации, которые принимает «Открыть»"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-1",
				children: keys.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex h-11 items-center gap-2 text-sm uppercase",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "accent-accent",
							checked: options.associations[key],
							onChange: (e) => setAssociation(key, e.target.checked)
						}),
						".",
						key
					]
				}, key))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-pretty text-muted",
				children: "В Windows эти ассоциации прописываются в реестр. Здесь можно скачать шаблон .reg — его применяют на 64-битной системе вручную, браузер сам реестр не меняет."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: quiet,
				onClick: () => {
					const lines = [
						"Windows Registry Editor Version 5.00",
						"",
						"[HKEY_CLASSES_ROOT\\.iso]",
						"@=\"Arca.Image\"",
						"",
						"[HKEY_CLASSES_ROOT\\Arca.Image]",
						"@=\"Образ диска Арка\"",
						"",
						"[HKEY_CLASSES_ROOT\\Arca.Image\\shell\\open\\command]",
						"@=\"\\\"C:\\\\Program Files\\\\Arca\\\\Arca.exe\\\" \\\"%1\\\"\"",
						""
					];
					for (const key of keys) {
						if (!options.associations[key] || key === "iso") continue;
						lines.push(`[HKEY_CLASSES_ROOT\\.${key}]`, "@=\"Arca.Image\"", "");
					}
					if (options.contextMenu) lines.push("[HKEY_CLASSES_ROOT\\*\\shell\\ArcaAdd]", "@=\"Добавить в образ Арка\"", "", "[HKEY_CLASSES_ROOT\\*\\shell\\ArcaAdd\\command]", "@=\"\\\"C:\\\\Program Files\\\\Arca\\\\Arca.exe\\\" /add \\\"%1\\\"\"", "");
					const text = lines.join("\r\n");
					downloadBlob(new Blob([text]), "arca-associations.reg");
				},
				children: "Скачать .reg"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: primary,
				onClick: closeDialog,
				children: "Готово"
			})] })
		]
	});
}
function FromDiscDialog() {
	const list = childrenOf(useStudio((s) => s.nodes), PC_ROOT).filter((node) => node.kind === "drive");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Создать образ с диска",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty text-muted",
			children: "Содержимое выбранного диска копируется в новый проект. Компакт-диск и смонтированный образ тоже подходят."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-2",
			children: list.map((drive) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: `${quiet} text-left`,
				onClick: () => useStudio.getState().imageFromDrive(drive.id),
				children: [drive.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 block text-xs text-muted",
					children: drive.capacity ? formatBytes(drive.capacity) : "диск"
				})]
			}, drive.id))
		})]
	});
}
function AboutDialog() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "О программе",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty",
			children: "Арка собирает и правит образы дисков: ISO 9660, Joliet и UDF, каталог El Torito, контрольные суммы, конвертация NRG, BIN, MDF и сжатие ISZ."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty text-muted",
			children: "Верхние окна — образ, нижние — компьютер. Файлы переносятся перетаскиванием. Запись на физическую флешку из браузера недоступна: образ скачивается, а в студии появляется виртуальный диск. Проект собирается на Windows x64 в GitHub Actions."
		})]
	});
}
function SaveAsDialog() {
	const fileName = useStudio((s) => s.project.fileName);
	const [name, setName] = (0, import_react.useState)(fileName);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
		title: "Сохранить как",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "flex flex-col gap-3",
			onSubmit: (event) => {
				event.preventDefault();
				useStudio.getState().save(name);
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "fname",
					children: "Имя файла"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "fname",
					className: field,
					value: name,
					onChange: (e) => setName(e.target.value)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: quiet,
					onClick: closeDialog,
					children: "Отмена"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: primary,
					children: "Собрать ISO"
				})] })
			]
		})
	});
}
function TextDialog() {
	const dialog = useStudio((s) => s.dialog);
	if (dialog?.type !== "text") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: dialog.title,
		wide: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "max-h-80 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap",
			children: dialog.body
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: primary,
			onClick: closeDialog,
			children: "Закрыть"
		}) })]
	});
}
function ConfirmDialog() {
	const dialog = useStudio((s) => s.dialog);
	if (dialog?.type !== "confirm") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: dialog.title,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-pretty",
			children: dialog.body
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: quiet,
			onClick: closeDialog,
			children: "Отмена"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: primary,
			onClick: () => useStudio.getState().confirmPending(),
			children: dialog.ok
		})] })]
	});
}
function WarningsDialog() {
	const dialog = useStudio((s) => s.dialog);
	if (dialog?.type !== "warnings") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Предупреждения сборки",
		wide: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "grid gap-2",
			children: dialog.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "border border-line bg-inset px-3 py-2 text-sm text-pretty",
				children: line
			}, line))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: primary,
			onClick: closeDialog,
			children: "Понятно"
		}) })]
	});
}
function ProgressDialog() {
	const dialog = useStudio((s) => s.dialog);
	if (dialog?.type !== "progress") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-label": dialog.title,
			className: "w-full max-w-sm border border-line bg-surface p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium",
					children: dialog.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 truncate font-mono text-xs text-muted",
					children: dialog.detail
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 h-2 overflow-hidden bg-inset",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "arca-indet h-full w-1/3 bg-accent" })
				})
			]
		})
	});
}
function StudioDialogs() {
	const dialog = useStudio((s) => s.dialog);
	(0, import_react.useEffect)(() => {
		if (!dialog || dialog.type === "progress") return;
		const onKey = (event) => {
			if (event.key === "Escape") closeDialog();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [dialog]);
	if (!dialog) return null;
	if (dialog.type === "properties") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Properties, {});
	if (dialog.type === "new-folder") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameDialog, {
		title: "Новая папка",
		initial: "Новая папка",
		submit: (name) => useStudio.getState().newFolder(name)
	});
	if (dialog.type === "rename") {
		const node = selectedNode();
		if (!node) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
			title: "Переименовать",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Сначала выберите файл или папку."
			})
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameDialog, {
			title: "Переименовать",
			initial: node.name,
			submit: (name) => useStudio.getState().rename(name)
		});
	}
	if (dialog.type === "attrs") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AttrsDialog, {});
	if (dialog.type === "write") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WriteDialog, {});
	if (dialog.type === "burn") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BurnDialog, {});
	if (dialog.type === "boot-load") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BootDialog, {});
	if (dialog.type === "checksum") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecksumDialog, {});
	if (dialog.type === "convert") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConvertDialog, {});
	if (dialog.type === "isz") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IszDialog, {});
	if (dialog.type === "options") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionsDialog, {});
	if (dialog.type === "from-disc") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FromDiscDialog, {});
	if (dialog.type === "about") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AboutDialog, {});
	if (dialog.type === "save-as") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SaveAsDialog, {});
	if (dialog.type === "text") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextDialog, {});
	if (dialog.type === "confirm") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmDialog, {});
	if (dialog.type === "warnings") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningsDialog, {});
	if (dialog.type === "progress") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressDialog, {});
	return null;
}
var FS_LABEL = {
	iso9660: "ISO 9660",
	joliet: "Joliet",
	udf: "UDF"
};
function Studio() {
	const openRef = (0, import_react.useRef)(null);
	const filesRef = (0, import_react.useRef)(null);
	const folderRef = (0, import_react.useRef)(null);
	const project = useStudio((s) => s.project);
	const notice = useStudio((s) => s.notice);
	const associations = useStudio((s) => s.options.associations);
	const accept = Object.entries(associations).filter(([, on]) => on).map(([key]) => `.${key}`);
	if (!accept.includes(".iso")) accept.unshift(".iso");
	if (!accept.includes(".cue")) accept.push(".cue");
	(0, import_react.useEffect)(() => {
		folderRef.current?.setAttribute("webkitdirectory", "");
		folderRef.current?.setAttribute("directory", "");
	}, []);
	(0, import_react.useEffect)(() => {
		let live = true;
		loadStudio().then((snapshot) => {
			if (!live) return;
			useStudio.getState().markHydrated(snapshot ? {
				nodes: snapshot.nodes,
				project: snapshot.project,
				media: snapshot.media,
				options: snapshot.options,
				imageDir: snapshot.imageDir,
				pcDir: snapshot.pcDir
			} : null);
		});
		return () => {
			live = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		return useStudio.subscribe((state, prev) => {
			if (!state.hydrated || !state.touched) return;
			if (state.nodes === prev.nodes && state.project === prev.project && state.media === prev.media && state.options === prev.options && state.imageDir === prev.imageDir && state.pcDir === prev.pcDir) return;
			scheduleSave({
				project: state.project,
				media: state.media,
				options: state.options,
				imageDir: state.imageDir,
				pcDir: state.pcDir,
				nodes: Object.values(state.nodes)
			});
		});
	}, []);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			const target = event.target;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
			const key = event.key.toLowerCase();
			if ((event.ctrlKey || event.metaKey) && key === "s") {
				event.preventDefault();
				useStudio.getState().save();
			} else if ((event.ctrlKey || event.metaKey) && key === "n") {
				event.preventDefault();
				useStudio.getState().requestNew();
			} else if (event.key === "F2") {
				event.preventDefault();
				useStudio.getState().setDialog({ type: "rename" });
			} else if (event.key === "Delete") useStudio.getState().removeSelected();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	const addIntoImage = () => {
		const state = useStudio.getState();
		if (!state.pcSelection.length) {
			state.notify("Выделите файлы в нижнем окне — они поедут в образ.");
			return;
		}
		state.setDragging({
			from: "pc",
			ids: state.pcSelection
		});
		state.drop("image", state.imageDir);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh min-h-0 flex-col overflow-hidden bg-bg font-sans text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuBar, {
				groups: [
					{
						id: "file",
						label: "Файл",
						items: [
							{
								label: "Создать",
								hint: "Ctrl+N",
								run: () => useStudio.getState().requestNew()
							},
							{
								label: "Открыть…",
								run: () => openRef.current?.click()
							},
							{
								label: "Сохранить",
								hint: "Ctrl+S",
								run: () => void useStudio.getState().save()
							},
							{
								label: "Сохранить как…",
								run: () => useStudio.getState().setDialog({ type: "save-as" })
							},
							{
								label: "Свойства…",
								run: () => useStudio.getState().setDialog({ type: "properties" })
							}
						]
					},
					{
						id: "action",
						label: "Действие",
						items: [
							{
								label: "Добавить файлы…",
								run: () => filesRef.current?.click()
							},
							{
								label: "Добавить папку…",
								run: () => folderRef.current?.click()
							},
							{
								label: "Новая папка",
								run: () => useStudio.getState().setDialog({ type: "new-folder" })
							},
							{
								label: "Переименовать",
								hint: "F2",
								run: () => useStudio.getState().setDialog({ type: "rename" })
							},
							{
								label: "Удалить",
								hint: "Del",
								run: () => useStudio.getState().removeSelected()
							},
							{
								label: "Атрибуты…",
								run: () => useStudio.getState().setDialog({ type: "attrs" })
							},
							{
								label: "Добавить выделенное в образ",
								run: addIntoImage
							},
							{
								label: "Извлечь на компьютер",
								run: () => useStudio.getState().extract()
							},
							{
								label: "Скачать выделенное",
								run: () => useStudio.getState().downloadSelected()
							}
						]
					},
					{
						id: "boot",
						label: "Самозагрузка",
						items: [
							{
								label: "Записать образ жёсткого диска…",
								run: () => useStudio.getState().setDialog({ type: "write" })
							},
							{
								label: "Записать CD/DVD…",
								run: () => useStudio.getState().setDialog({ type: "burn" })
							},
							{
								label: "Загрузить загрузочный файл…",
								run: () => useStudio.getState().setDialog({ type: "boot-load" })
							},
							{
								label: "Извлечь загрузочный файл",
								run: () => useStudio.getState().extractBoot()
							},
							{
								label: "Создать загрузочный сектор",
								run: () => useStudio.getState().makeBoot()
							}
						]
					},
					{
						id: "tools",
						label: "Инструменты",
						items: [
							{
								label: "Монтировать ISODrive",
								run: () => useStudio.getState().mount()
							},
							{
								label: "Размонтировать",
								run: () => useStudio.getState().unmount()
							},
							{
								label: "Создать образ с диска…",
								run: () => useStudio.getState().setDialog({ type: "from-disc" })
							},
							{
								label: "Конвертировать…",
								run: () => useStudio.getState().setDialog({ type: "convert" })
							},
							{
								label: "Сжать в ISZ…",
								run: () => useStudio.getState().setDialog({ type: "isz" })
							},
							{
								label: "Контрольные суммы",
								run: () => void useStudio.getState().checksumSelected()
							}
						]
					},
					{
						id: "options",
						label: "Опции",
						items: [{
							label: "Настройки…",
							run: () => useStudio.getState().setDialog({ type: "options" })
						}, {
							label: "О программе",
							run: () => useStudio.getState().setDialog({ type: "about" })
						}]
					}
				],
				fileName: project.fileName,
				dirty: project.dirty,
				filesystem: project.filesystem,
				bootable: project.bootable
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toolbar, {
				onNew: () => useStudio.getState().requestNew(),
				onOpen: () => openRef.current?.click(),
				onSave: () => void useStudio.getState().save(),
				onAdd: () => filesRef.current?.click(),
				onFolder: () => folderRef.current?.click(),
				onMkdir: () => useStudio.getState().setDialog({ type: "new-folder" }),
				onExtract: () => useStudio.getState().extract(),
				onDelete: () => useStudio.getState().removeSelected(),
				onWrite: () => useStudio.getState().setDialog({ type: "write" }),
				onBoot: () => useStudio.getState().setDialog({ type: "boot-load" }),
				onMount: () => useStudio.getState().mount(),
				onHash: () => void useStudio.getState().checksumSelected(),
				onProps: () => useStudio.getState().setDialog({ type: "properties" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workspace, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBar, {}),
			notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pointer-events-none fixed bottom-16 left-1/2 z-20 max-w-lg -translate-x-1/2 border border-line bg-raised px-3 py-2 text-center text-sm text-pretty shadow-lg",
				children: notice
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioDialogs, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: openRef,
				type: "file",
				className: "hidden",
				accept: accept.join(","),
				onChange: (event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) useStudio.getState().requestOpen(file);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: filesRef,
				type: "file",
				multiple: true,
				className: "hidden",
				onChange: (event) => {
					const list = event.target.files;
					event.target.value = "";
					if (list?.length) useStudio.getState().addExternal(list, useStudio.getState().active);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: folderRef,
				type: "file",
				multiple: true,
				className: "hidden",
				onChange: (event) => {
					const list = event.target.files;
					event.target.value = "";
					if (list?.length) useStudio.getState().addExternal(list, useStudio.getState().active);
				}
			})
		]
	});
}
function Mark() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		className: "size-6 text-accent",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "9",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "4.2",
				fill: "none",
				stroke: "var(--color-fg)",
				strokeWidth: "1.1"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "1.3",
				fill: "currentColor"
			})
		]
	});
}
function MenuBar({ groups, fileName, dirty, filesystem, bootable }) {
	const [open, setOpen] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const close = () => setOpen(null);
		window.addEventListener("pointerdown", close);
		return () => window.removeEventListener("pointerdown", close);
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "relative z-30 flex h-12 shrink-0 items-center gap-1 border-b border-line bg-bg px-2",
		onPointerDown: (event) => event.stopPropagation(),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 pr-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-semibold tracking-wide",
					children: "Арка"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "hidden items-center md:flex",
				"aria-label": "Главное меню",
				children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `h-9 px-2.5 text-sm ${open === group.id ? "bg-raised text-fg" : "text-muted hover:text-fg"}`,
						"aria-expanded": open === group.id,
						onClick: () => setOpen((value) => value === group.id ? null : group.id),
						children: group.label
					}), open === group.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuList, {
						items: group.items,
						onPick: () => setOpen(null)
					})]
				}, group.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "grid size-11 place-items-center text-fg md:hidden",
				"aria-label": "Меню",
				onClick: () => setOpen((value) => value === "all" ? null : "all"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "ml-auto flex min-w-0 items-center gap-2 pr-1 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden text-muted lg:inline",
						children: FS_LABEL[filesystem]
					}),
					bootable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-accent",
						children: "BOOT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "max-w-40 truncate font-mono text-fg",
						children: fileName
					}),
					dirty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-accent",
						children: "●"
					})
				]
			}),
			open === "all" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-0 top-12 max-h-[70dvh] overflow-auto border-b border-line bg-surface p-2 md:hidden",
				children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-2 py-1 text-xs font-medium tracking-wide text-muted uppercase",
						children: group.label
					}), group.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex h-11 w-full items-center justify-between px-2 text-left text-sm hover:bg-raised",
						onClick: () => {
							setOpen(null);
							item.run();
						},
						children: [item.label, item.hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs text-muted",
							children: item.hint
						})]
					}, item.label))]
				}, group.id))
			})
		]
	});
}
function MenuList({ items, onPick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "menu",
		className: "absolute top-9 left-0 z-40 min-w-64 border border-line bg-raised py-1 shadow-lg",
		children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			role: "menuitem",
			className: "flex h-9 w-full items-center justify-between gap-4 px-3 text-left text-sm hover:bg-accent/20",
			onClick: () => {
				onPick();
				item.run();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }), item.hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-xs text-muted",
				children: item.hint
			})]
		}, item.label))
	});
}
function Tool({ label, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		title: label,
		onClick,
		className: "flex h-11 shrink-0 items-center gap-1.5 px-2 text-xs text-fg hover:bg-raised",
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden sm:inline",
			children: label
		})]
	});
}
function Toolbar(props) {
	const icon = "size-4 text-accent";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line bg-surface px-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Создать",
				onClick: props.onNew,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Открыть",
				onClick: props.onOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Сохранить",
				onClick: props.onSave,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-6 w-px shrink-0 bg-line" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Добавить",
				onClick: props.onAdd,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderUp, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Папка",
				onClick: props.onFolder,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Новая",
				onClick: props.onMkdir,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Извлечь",
				onClick: props.onExtract,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Disc, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Удалить",
				onClick: props.onDelete,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-6 w-px shrink-0 bg-line" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "На USB",
				onClick: props.onWrite,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Usb, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Загрузка",
				onClick: props.onBoot,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Монтировать",
				onClick: props.onMount,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Disc, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Суммы",
				onClick: props.onHash,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hash, { className: icon })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tool, {
				label: "Свойства",
				onClick: props.onProps,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-accent",
					children: "FS"
				})
			})
		]
	});
}
function StatusBar() {
	const nodes = useStudio((s) => s.nodes);
	const active = useStudio((s) => s.active);
	const imageDir = useStudio((s) => s.imageDir);
	const pcDir = useStudio((s) => s.pcDir);
	const media = useStudio((s) => s.media);
	const setMedia = useStudio((s) => s.setMedia);
	const dir = active === "image" ? imageDir : pcDir;
	const folder = nodes[dir];
	const path = folder ? pathOf(nodes, dir) : "\\";
	const count = folder ? countEntries(nodes, dir) : 0;
	const used = payloadBytes(nodes, IMAGE_ROOT);
	const cap = mediaById(media).bytes;
	const over = used > cap;
	const pct = cap > 0 ? Math.min(100, used / cap * 100) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
		className: "flex h-14 shrink-0 items-center gap-2 border-t border-line bg-raised px-2 md:h-12 md:gap-3 md:px-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "min-w-0 flex-1 truncate font-mono text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: path
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted",
					children: [" · ", count]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-28 shrink-0 md:w-52",
				title: `${formatBytes(used)} из ${formatBytes(cap)}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-2 overflow-hidden bg-inset",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `h-full ${over ? "bg-danger" : "bg-ok"}`,
						style: { width: `${pct}%` }
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: `mt-0.5 truncate text-right font-mono text-xs ${over ? "text-danger" : "text-muted"}`,
					children: [over ? "не влезет · " : "", formatBytes(used)]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "sr-only",
				htmlFor: "media",
				children: "Целевой носитель"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				id: "media",
				className: "h-9 max-w-36 shrink-0 border border-line bg-inset px-2 text-xs text-fg",
				value: media,
				onChange: (event) => setMedia(event.target.value),
				children: MEDIA.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: item.id,
					children: item.label
				}, item.id))
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Studio, {});
}
//#endregion
export { Home as component };
