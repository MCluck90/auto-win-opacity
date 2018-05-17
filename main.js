#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const openInEditor = require('open-in-editor');
const winOpacity = require('win-opacity');
const argv = require('minimist')(process.argv.slice(2));
const configPath = path.join(__dirname, 'config.json');

// Copy the example config if a user config does not exist
if (!fs.existsSync(configPath)) {
	fs.copyFileSync(path.join(__dirname, 'config.example.json', configPath));
}

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
 * @param {object[]} winConfig The different opacity settings
 */
const applyOpacities = (winConfig) => {
	// Parse the patterns into regular expressions
	const patterns = winConfig.map(({ pattern, opacity }) => ({
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
if (argv._.includes('kill')) {
	// Add the kill flag to the config so that the running process knows it should die
	const configSource = fs.readFileSync(configPath).toString();
	const config = JSON.parse(configSource);
	config.kill = true;

	// Write it to the config file while retaining the same style of whitespace
	fs.writeFileSync(configPath, retainWhitespace(configSource, config));
} else if (argv._.includes('edit')) {
	// Attempt to open the config file in the users editor choice
	// Find out which editor to open the config file in
	let editorType = argv.e || argv.editor || 'code';
	const editor = openInEditor.configure({
		editor: editorType
	});
	try {
		editor.open(configPath)
			.then(() => {}, (err) => {
				// There's some weird phrasing in the open-in-editor module
				// Try to fix that
				err = err.replace('does not implemented', 'is not implemented');
				console.error(err);
			});
	} catch (e) {
		console.error(`Unknown editor type: ${editorType}`);
	}
} else {
	poll();
}