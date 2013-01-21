<?php
/**
 * Verify that each localization string defined in each of the l10n files is
 * actually used in the plugin, highlighting missing or unused keys.
 */

// All paths will be relative to this one.
define('PLUGIN_ROOT', __DIR__ . DIRECTORY_SEPARATOR . 'recipient_to_contact' . DIRECTORY_SEPARATOR);

// Use regular expressions (now we have 2 problems) to match the gettext function
// and pull out all the keys we're attempting to use.

$expectedKeys = array();
foreach (glob(PLUGIN_ROOT . '*.*') AS $fileName) {
	$fileContents = file_get_contents($fileName);

	if (preg_match_all('{gettext\(([\'"])[^\1]+?\1}', $fileContents, $matches)) {
		foreach ($matches[0] as $match) {
			// Remove the "gettext('" and trailing quote, and store in mirrored array.
			$match = substr($match, 9, -1);
			$expectedKeys[$match] = $match;
		}
	}
}

// We now know what keys we are expecting to find. So no, parse the l10n files
// and verify their contents.
foreach (glob(PLUGIN_ROOT . 'localization/*.inc') as $fileName) {
	echo basename($fileName), PHP_EOL;

	// reset the warnings counter.
	$warnings = 0;

	// Make sure the labels array is empty before loading the file.
	$labels = array();

	// Load up the include file, which populates the $labels variable.
	include $fileName;

	// Pretend that 'loading' is included, as it's part of the core application.
	$labels['loading'] = 'Loading...';

	// Look for keys that aren't used first.
	foreach ($labels as $key => $label) {
		if (! array_key_exists($key, $expectedKeys)) {
			// This label is never used.
			echo 'Warning: extraneous translation. Key: ', $key, PHP_EOL;
			$warnings++;
		}
	}

	// Now, look for missing keys.
	foreach ($expectedKeys as $key) {
		if (! array_key_exists($key, $labels)) {
			// This key is missing!
			echo 'Warning: missing translation. Key: ', $key, PHP_EOL;
			$warnings++;
		}
	}

	if ($warnings === 0) {
		echo 'All OK.', PHP_EOL;
	}

	// Space out the results.
	echo PHP_EOL;
}