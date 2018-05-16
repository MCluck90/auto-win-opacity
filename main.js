#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const openInEditor = require('open-in-editor');
const winOpacity = require('win-opacity');
const configPath = path.join(__dirname, 'config.json');

function retainWhitespace(source, obj) {
	const spacesInFile = /\n( +)/.exec(source);
	let spaces = 2;
	if (spacesInFile) {
		spaces = spacesInFile[1].length;
	}
	let finalOutput = JSON.stringify(obj, null, spaces);
	if (!spacesInFile) {
		finalOutput = finalOutput.replace(new RegExp(' '.repeat(spaces), 'g'), '\t');
	}
	return finalOutput;
}

let beginPolling = true;

if (process.argv.includes('kill')) {
	const configSource = fs.readFileSync(configPath).toString();
	const config = JSON.parse(configSource);
	config.kill = true;
	fs.writeFileSync(configPath, retainWhitespace(configSource, config));
	beginPolling = false;
}

if (process.argv.includes('edit')) {
	const editor = openInEditor.configure({
		editor: 'code'
	});
	editor.open(configPath);
	beginPolling = false;
}

const applyOpacities = (config) => {
	const patterns = config.map(({ pattern, opacity}) => ({
		pattern: new RegExp(pattern),
		opacity
	}));
	const windows = winOpacity.getWindows();
	for (const window of windows) {
		for (const { opacity, pattern } of patterns) {
			if (pattern.test(window.title)) {
				winOpacity.setOpacity(window, opacity);
				break;
			}
		}
	}
};
function poll() {
	const configSource = fs.readFileSync(configPath).toString();
	const config = JSON.parse(configSource);
	if (config.kill) {
		delete config.kill;
		fs.writeFileSync(configPath, retainWhitespace(configSource, config));
		return;
	}
	applyOpacities(config.windows);

	if (config.pollInMilliseconds > 0) {
		setTimeout(poll, config.pollInMilliseconds);
	}
}
if (beginPolling) {
	poll();
}