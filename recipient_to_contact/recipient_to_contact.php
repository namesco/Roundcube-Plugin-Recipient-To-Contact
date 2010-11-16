<?php
/**
 * Plugin allows users to add new contacts to address books.
 *
 * @category  Roundcube
 * @package   Plugin
 * @author    Vladimir Minakov <vminakov@names.co.uk>
 * @copyright 2009-2010 Namesco Limited
 * @license   http://www.gnu.org/licenses/gpl-3.0.txt GPLv3 License
 * @version   0.1.2
 */

/**
 * Short description of new_contacts
 *
 * If a user sends an email to recipients, which are not in addressbooks, the plugins allows users
 * to selectively add those recipients to existing addressbook.
 *
 * @category  Roundcube
 * @package   Plugin
 * @author    Vladimir Minakov <vminakov@names.co.uk>
 * @copyright 2009-2010 Namesco Limited
 * @license   http://www.gnu.org/licenses/gpl-3.0.txt GPLv3 License
 * @version   0.1.2
 */
class recipient_to_contact extends rcube_plugin
{
    /**
     * Plugin is used for 'mail' and 'settings' tasks.
     *
     * @var string
     */
    public $task = 'mail|settings';

    /**
     * Instance of rcmail.
     *
     * @var rcmail
     */
    protected $rcmail;

    /**
     * List of addressbooks for searching existing and adding new contacts.
     *
     * @var array
     */
    protected $addressbooks = array();

    /**
     * Plugins initializer.
     *
     * @return void
     */
    public function init()
    {
        $this->rcmail = rcmail::get_instance();

        // check that jQuery UI plugin is activated
        if (in_array('jqueryui', $this->rcmail->config->get('plugins')) == false) {
            raise_error(array(
                'code' => 500,
                'type' => 'php',
                'file' => __FILE__,
                'line' => __LINE__,
                'message' => "Could not initialize recipient_to_contact plugin. "
                             . "jQuery UI plugin is not installed/activated"
            ), true, false);
            return;
		}

        // load configuration
        if (file_exists($this->home . '/config/config.inc.php')) {
            $this->load_config('config/config.inc.php');
        } else {
            $this->load_config('config/config.inc.php.dist');
        }

        $is_enabled = $this->rcmail->config->get('use_recipienttocontact', 'default');

        if ($is_enabled === 'default') {
            $is_enabled = $this->rcmail->config->get('recipient_to_contact_enabled_by_default');
            $this->rcmail->config->set('use_recipienttocontact', $is_enabled);
        }

        // register hooks and actions if the plugin is enabled (by default or though preferences section)
        if ($is_enabled) {
            $this->add_hook('message_sent', array($this, 'check_recipients'));
            $this->add_hook('render_mailboxlist', array($this, 'register_dialog'));

            $this->register_action('plugin.recipient_to_contact_get_contacts', array($this, 'get_contacts'));
            $this->register_action('plugin.recipient_to_contact_add_contact', array($this, 'add_contact'));

            // fetch addressbook sources. If no addressbooks set in the config file, use the same addressbooks
            // configured for autocompletition
            $enabled_addressbooks = $this->rcmail->config->get('recipient_to_contact_addressbooks');
            if (empty($enabled_addressbooks)) {
                $this->addressbooks = $this->get_addressbooks(
                        $this->rcmail->config->get('autocomplete_addressbooks'));
            } else {
                $this->addressbooks = $this->get_addressbooks($enabled_addressbooks);
            }

        }
        // hooks for preferences section
        $this->add_hook('preferences_list', array($this, 'prefs_content'));
        $this->add_hook('preferences_sections_list', array($this, 'prefs_section_link'));
        $this->add_hook('preferences_save', array($this, 'prefs_save'));

        $this->add_texts('localization', true);
    }

    /**
     * Checks wether recipients exist in any of the addressbooks.
     *
     * @param array $args Default hook parameters.
     *
     * @return void
     */
    public function check_recipients($args)
    {
        // don't process the sent message, if it's a 'Read Receipt' response
        if (isset($args['headers']['Content-Type'])
                && strpos($args['headers']['Content-Type'], 'report-type=disposition-notification') !== false) {
            return $args;
        }

        $rcube_imap = new rcube_imap(null);

        // build recipients array
        $recipients = $rcube_imap->decode_address_list($args['headers']['To']);
        if (isset($args['headers']['Cc'])) {
            $recipients = array_merge($recipients, $rcube_imap->decode_address_list($args['headers']['Cc']));
        }
        if (isset($args['headers']['Bcc'])) {
            $recipients = array_merge($recipients, $rcube_imap->decode_address_list($args['headers']['Bcc']));
        }

        // stores contacts that don't exist in current address books
        $new_contacts = array();

        // iterate over recipients and search for them in address books
        foreach ($recipients as $recipient) {
            // flag to denote if the current recipient doesn't exist in any of the address books
            $is_new_contact = true;

            // interate over over address books and search for a contact with the same email address
            foreach ($this->addressbooks as $abook_id => $address_source) {
                $address_book = $this->rcmail->get_address_book($abook_id);
                $search_result = $address_book->search('email', $recipient['mailto']);

                // the contact already exist. skip the rest address books and move to next recipient
                if ($search_result->count > 0) {
                    $is_new_contact = false;
                    break;
                }
            }

            // store the non-existing recipient
            if ($is_new_contact) {
                $new_contacts[] = $recipient;
            }
        }

        if (!empty($new_contacts)) {
            $_SESSION['recipient_to_contact'] = $new_contacts;
        }
    }

    /**
     * Binds a JavaScript which renders a dialog for adding new contacts.
     *
     * @param array $args Default hook parameters.
     *
     * @return void
     */
    public function register_dialog($args)
    {
        if (isset($_SESSION['recipient_to_contact'])) {
            $this->include_script('recipient_to_contact.js');
        }

        return $args;
    }

    /**
     * Fetches new contacts and a list of available address books and calls a clients side script
     * to process them.
     *
     * @return void
     */
    public function get_contacts()
    {
        if (!isset($_SESSION['recipient_to_contact'])) {
            $this->rcmail->output->command('plugin.recipient_to_contact_populate_dialog', array());
        } else {
            $contacts = $_SESSION['recipient_to_contact'];
            $address_books = $this->addressbooks;

            $this->rcmail->session->remove('recipient_to_contact');
            $this->rcmail->session->regenerate_id();

            $this->rcmail->output->command('plugin.recipient_to_contact_populate_dialog', array(
                'contacts'      => $contacts,
                'address_books' => $address_books
            ));
        }
    }

    /**
     * Adds contacts to selected addressbook.
     *
     * @return void
     */
    public function add_contact()
    {
        // response that will be sent to client
        $response = array();

        // get request data
        $contacts = get_input_value('_contacts', RCUBE_INPUT_POST);
        $addressbook_id = get_input_value('_addressbook', RCUBE_INPUT_POST);

        // iterate over each contact, validate and create new permament contacts
        foreach ($contacts as $key => $contact) {
            $response[$key] = array('status' => '', 'message' => '');

            // name cannot be empty
            if (empty($contact['_name'])) {
                $response[$key]['status'] = 'fail';
                $response[$key]['message'] = Q($this->gettext('response_name_empty'));
                continue;
            }

            // email should be valid
            if (!check_email($contact['_email'], false)) {
                $response[$key]['status'] = 'fail';
                $response[$key]['message'] = Q($this->gettext('response_email_invalid'));
                continue;
            }

            $addressbook = $this->rcmail->get_address_book($addressbook_id);

            // create new contact and check, if it was successful
            if ($addressbook->insert(
                    array('name' => $contact['_name'], 'email' => $contact['_email'])) == false) {
                $response[$key]['status'] = 'fail';
                $response[$key]['message'] = Q($this->gettext('response_server_error'));
                continue;
            }

            $response[$key]['status'] = 'ok';
            $response[$key]['message'] = Q($this->gettext('response_confirm'));
        }

        // return reponse to client
        $response = array('contacts' => $response);
        $this->rcmail->output->command('plugin.recipient_to_contact_add_contact_response', $response);

    }

    /**
     * Shows an option in prefrences section to enable or disable the plugin.
     *
     * @param array $args Default hook arguments.
     *
     * @return array
     */
    public function prefs_content($args)
    {
        // ensure we are in the right section
        if ($args['section'] == 'recipienttocontact') {

            $field_id = 'rcmfd_use_recipienttocontact';

            // current status: plugin can be enabled or disabled
            $use_recipienttocontact = $this->rcmail->config->get('use_recipienttocontact');

            // checkbox element to change the status of the plugin
            $checkbox = new html_checkbox(
                    array('name' => '_use_recipienttocontact',
                          'id' => $field_id,
                          'value' => 1,
                          'style' => 'margin-left: -300px')
            );

            $args['blocks']['recipienttocontact']['options']['description'] = array(
                'title' =>   html::div(null, Q($this->gettext('prefs_descr'))) . html::br(),
                'content' => ''
            );

            $args['blocks']['recipienttocontact']['name'] = $this->gettext('prefs_title');
            $args['blocks']['recipienttocontact']['options']['use_subscriptions'] = array(
                'title' => html::label($field_id, Q($this->gettext('prefs_option'))),
                'content' => $checkbox->show($use_recipienttocontact ? 1 : 0),
            );
        }

        return $args;
    }

    /**
     * Adds a link to prefrences section.
     *
     * @param array $args Default hook arguments.
     *
     * @return array
     */
    public function prefs_section_link($args)
    {
		$args['list']['recipienttocontact'] = array(
            'id' => 'recipienttocontact',
			'section' => Q($this->gettext('prefs_title'))
        );

		return $args;
    }

    /**
     * Saves the preferences.
     *
     * @param array $args Default hook arguments.
     *
     * @return array
     */
    public function prefs_save($args)
    {
        // ensure that we are in the relevant section
        if ($args['section'] == 'recipienttocontact') {
            // check if the plugin has been activated or deactivated
            if (get_input_value('_use_recipienttocontact', RCUBE_INPUT_POST) !== null) {
                $args['prefs']['use_recipienttocontact'] = true;
            } else {
                $args['prefs']['use_recipienttocontact'] = false;
            }
        }

        return $args;
    }

    /**
     * Returns a list of addressbooks, filtered by ids.
     *
     * Output format identical to rcmail::get_address_sources().
     *
     * @param array $ids      IDs of addressbooks.
     * @param bool  $writable If set to true, fetches only writable addressbooks.
     *
     * @see rcmail::get_address_sources().
     *
     * @return array Addressbooks sources.
     */
    protected function get_addressbooks(array $ids, $writable = false)
    {
        $ids = array_flip($ids);

        // handle 'sql' addressbook properly: get_address_sources identifies sql addressbook as '0'
        if (isset($ids['sql'])) {
            unset($ids['sql']);
            $ids[0] = 0;
        }
        $all_addresbooks = $this->rcmail->get_address_sources();

        // return standard output from get_address_sources including only addressbooks specified in $ids
        return array_intersect_key($all_addresbooks, $ids);
    }
}