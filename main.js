#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const openInEditor = require('open-in-editor');
const winOpacity = require('win-opacity');
const configPath = path.join(__dirname, 'config.json');

/**
 * Converts an object to JSON while attempting to retain the original whitespace format
 * @param {string} source Original source
 * @param {object} obj The object to convert to JSON
 */
const retainWhitespace = (source, obj) => {
	// Search for spaces in the file
	const spacesInFile = /\n( +)/.exec(source);
	let spaces = 2;
	if (spacesInFile) {
		// If spaces appear to be used for indentation, count how many are used
		spaces = spacesInFile[1].length;
	}

	// Convert the object to JSON with the correct number of spaces
	let finalOutput = JSON.stringify(obj, null, spaces);
	if (!spacesInFile) {
		// Unless it appears that tabs were used, then use those instead
		finalOutput = finalOutput.replace(new RegExp(' '.repeat(spaces), 'g'), '\t');
	}
	return finalOutput;
};

/**
 * Applies the desired opacity levels to different windows
 * @param {object[]} config The different opacity settings
 */
const applyOpacities = (config) => {
	// Parse the patterns into regular expressions
	const patterns = config.map(({ pattern, opacity }) => ({
		pattern: new RegExp(pattern),
		opacity
	}));

	// Grab all of the visible windows
	const windows = winOpacity.getWindows();
	for (const window of windows) {
		for (const { opacity, pattern } of patterns) {
			// Apply the desired opacity to a window on the first pattern it matches
			if (pattern.test(window.title)) {
				winOpacity.setOpacity(window, opacity);
				break;
			}
		}
	}
};

/**
 * Periodically update the opacity of windows
 */
const poll = () => {
	// Read the configuration in fresh in case the user updated it
	const configSource = fs.readFileSync(configPath).toString();
	const config = JSON.parse(configSource);

	// If the config contains a `kill` key, end the process
	if (config.kill) {
		// Remove the kill flag to avoid constantly killing it every time it starts
		delete config.kill;
		fs.writeFileSync(configPath, retainWhitespace(configSource, config));
		return;
	}

	// Set the opacity of any configured windows
	applyOpacities(config.windows);

	// If the user has specified a polling interval,
	// wait that long before applying it again
	if (config.pollInMilliseconds > 0) {
		setTimeout(poll, config.pollInMilliseconds);
	}
};

// If the user is requesting that the process is killed
if (process.argv.includes('kill')) {
	// Add the kill flag to the config so that the running process knows it should die
	const configSource = fs.readFileSync(configPath).toString();
	const config = JSON.parse(configSource);
	config.kill = true;

	// Write it to the config file while retaining the same style of whitespace
	fs.writeFileSync(configPath, retainWhitespace(configSource, config));
} else if (process.argv.includes('edit')) {
	// If the user requests to edit the config
	// open Visual Studio Code
	const editor = openInEditor.configure({
		editor: 'code'
	});
	editor.open(configPath);
} else {
	poll();
}