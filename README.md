# Roundcube Recipient To Contact Plugin

## About

Recipient To Contact is a plugin to quickly add new contacts to address books. When sending an email to recipients that aren't in the address book, this plugin displays a form to quickly save these contacts. Inspired by Automatic Addressbook plugin.

Features:

 * Simple jQuery UI based interface.
 * Parses 'To:', 'Cc:' and 'Bcc:' and automatically fills name and email address fields.
 * Configurable: which address books to use for searching; default behavior; etc.
 * Can be activated/deactivated through User Preferences section.
 * Advanced error handling.

## Requirements

1. Plugin is maintained against Roundcube 0.7 and later
2. jQuery UI plugin is required, which can be obtained from http://underwa.ter.net/roundcube-plugins or http://myroundcube.googlecode.com

## Installation

1. Download latest stable release from GitHub.
2. Extract the downloaded archive, and place the `recipient_to_contact` directory in `plugins/` folder.
3. Add `recipient_to_contact` to `$rcmail_config['plugins']` in your Roundcube config.

## Configuration

The default config file is `plugins/recipient_to_contact/config.inc.php.dist`.
Rename this to `plugins/recipient_to_contact/config.inc.php` and edit it there.

Configuration options:

`recipient_to_contact_addressbooks`

A list of address book IDs, which would be used for searching existing contacts. For example, if it contains `array('sql', 'global', 'ldap')` the plugin will look for existing contacts only in these address books. The default (an empty array) means the plugin will use address books specified in the `autocomplete_addressbooks` option in the Roundcube configuration file.

`recipient_to_contact_enabled_by_default`

Whether the plugin is enabled or disabled for users by default. If set to true, the plugin is enabled and users can disable it through settings menu.

## License

This plugin is distributed under the GPLv3 license. Please see http://www.gnu.org/licenses/gpl-3.0.txt for the complete license.