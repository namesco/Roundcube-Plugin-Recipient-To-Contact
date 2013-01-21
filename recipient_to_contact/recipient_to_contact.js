/**
 * Clients scripts for recipient_to_contact plugin.
 *
 * Draws the jQuery UI Dialog with a form a to create new contacts. Pre-fills email addresses
 * and contact names. Allows multiple creation of new contacts.
 *
 * @category  RoundCube
 * @package   Plugin
 * @author    Vladimir Minakov <vminakov@names.co.uk>, Gianfelice Catini <info@gianfelicecatini.it>
 * @copyright 2009-2010 Namesco Limited
 * @license   http://www.gnu.org/licenses/gpl-3.0.txt GPLv3 License
 * @version   0.2
 */

/**
 * Initializer. Draws the dialog and requests contact data from server.
 *
 * @return void
 */
rcmail.addEventListener('init', function() {
    rcmail.addEventListener('plugin.recipient_to_contact_populate_dialog', recipient_to_contact.populate_dialog);

    // enable compatibility mode with keyboard_shortcuts plugin
    if (rcmail.env.keyboard_shortcuts != undefined && rcmail.env.keyboard_shortcuts == true) {
        recipient_to_contact.withShortcuts = true;
    }

    // create dialog container
    var dialog = $('<div></div>').attr('id', 'new-contacts-dialog')
                 .appendTo(document.body);

    rcmail.http_post('plugin.recipient_to_contact_get_contacts', {});
});

/**
 * Namespace for the recipient_to_contact plugin.
 */
var recipient_to_contact = {

    /**
     * Keyboard_shortcuts compatibility mode.
     *
     * @var bool
     */
    withShortcuts: false,

    /**
    * Generates dialog box (form for adding new contacts), adds event listeners for ajax requests.
    *
    * Called, when the event plugin.recipient_to_contact_populate_dialog is triggered. It expects response data
    * from server.
    *
    * @parameter array $response Response data. Contains new contacts and address books.
    *
    * @return void
    */
    populate_dialog: function(response)
    {
        // break if the reponse contains no data
        if (response.length == 0) {
            return;
        }

        var table_rows = [];
        table_rows.push('<td>*' + rcmail.gettext('dialog_contact_name', 'recipient_to_contact') + '</td>');
        table_rows.push('<td>*' + rcmail.gettext('dialog_email', 'recipient_to_contact') + '</td>');
        table_rows.push('<td>' + rcmail.gettext('dialog_contact_firstname', 'recipient_to_contact') + '</td>');
        table_rows.push('<td>' + rcmail.gettext('dialog_contact_surname', 'recipient_to_contact') + '</td>');
        table_rows.push('<td>*' + rcmail.gettext('dialog_contact_addressbook', 'recipient_to_contact') + '</td>');
        if (response.use_groups) {
            table_rows.push('<td>' + rcmail.gettext('dialog_contact_group', 'recipient_to_contact') + '</td>');
        }
        table_rows.push('<td><input type="checkbox" id="new-contacts-select-all" /></td>');

        // create the table and table header
        var table = $('<table></table>').append(table_rows.join('\n')).appendTo($('#new-contacts-dialog'));


        // iterate over new contacts contacts and generate a table row for each contact
        $.each(response.contacts, function(key, contact) {
            var row = $('<tr></tr>');

            // generate table cell for contact's name.
            // if contact's name has been recognized by server-side script, prefill the textfiled with it.
            // otherwise, use email's part before '@' as contact's name
            $('<td></td>').append(
                $('<input />').attr('type', 'text').attr('name', '_contacts[' + key + '][_name]').val(
                    (contact['mailto'] == contact['name'])
                        ? contact['mailto'].split('@')[0]
                        : contact['name']
                )
            ).appendTo(row);

            // generate table cell for contact's email address
            $('<td></td>').append(
                $('<input />').attr('type', 'text').attr('name', '_contacts[' + key + '][_email]').val(contact['mailto'])
            ).appendTo(row);

            // generate table cell for contact's name
            $('<td></td>').append(
                $('<input />').attr('type', 'text').attr('name', '_contacts[' + key + '][_firstname]').val('')
            ).appendTo(row);

            // generate table cell for contact's surname
            $('<td></td>').append(
                $('<input />').attr('type', 'text').attr('name', '_contacts[' + key + '][_surname]').val('')
            ).appendTo(row);

            // generate table cell for contact's addressbook
            $('<td></td>').append(
                function() {
                    var select = $('<select></select>').attr('name', '_contacts[' + key + '][_addressbook]').attr('id','select_address_book' + key);
                    $.each(response.address_books, function(key, address_book) {
                        select.append(
                            $('<option></option>').val(key).text(address_book['name'])
                        );
                    });
                    return select;
                }()
            ).appendTo(row);

            // generate table cell for contact's group
            if (response.use_groups) {
                $('<td></td>').append(
                    function() {
                        var select = $('<select></select>').attr('name', '_contacts[' + key + '][_group]').attr('id','select_groups' + key);
                        return select;
                    }()
                ).appendTo(row);
            }

            // generate checkbox for each contact (selected means "I want to save it")
            $('<td></td>').append(
                $('<input />').attr('type', 'checkbox')
            ).appendTo(row);

            row.appendTo(table);

            // bind a function to onChange event on addressbook select: the function takes from DB all group of the selected
            // addressbook
            $('#select_address_book' + key).bind('change', {k: key}, recipient_to_contact.get_addressbook_groups);
            $('#select_address_book' + key).trigger('change');
        });

        // add 'Select All' functionality to the checbox in the form header
        $('#new-contacts-select-all').click(function() {
           var checked_status = this.checked;
           $(this).parents('table').find('input:checkbox').each(function() {
               this.checked = checked_status;
           });
        });

        // initialize the dialog
        recipient_to_contact.show_dialog();
    },

    /**
     * Save selected contacts into the selected addressbook.
     *
     * Performs client-side validation and sends request to server. Triggered by Save button onClick event
     *
     * @return void
     */
    save_contacts: function() {

        // verify that at least one checkbox has been selected. Ignore the very first checkbox (Select All)
        var checked = $('#new-contacts-dialog').find('input:checked').not('#new-contacts-select-all');
        if (checked.length == 0) {
            rcmail.display_message(rcmail.gettext('response_contact_not_selected', 'recipient_to_contact'), 'error');
            return;
        }

        // array stores new contacts that will be sent to server
        var new_contacts = [];

        // used for validation
        var is_valid = true;

        // iterate beetween selected contacts on the dialog box
        checked.each(function() {
            // for each selected checkbox find corresponding input fields with contact's name and email
            var contact_input = $(this).parents('tr').first().find('input:text');
            // for each selected checkbox find corresponding select fields with contact's addressbook and group
            var contact_select = $(this).parents('tr').first().find('select');

            // merge previous results
            var contact = $.merge(contact_input, contact_select);

            // validate contact's visualization name (visualization name is required)
            if ($(contact[0]).val() == '') {
               rcmail.display_message(rcmail.gettext('response_name_empty', 'recipient_to_contact'), 'error');
               is_valid = false;
               return;
            }

            // validate email (email is required)
            if (!rcube_check_email($(contact[1]).val())) {
               rcmail.display_message(rcmail.gettext('response_email_invalid', 'recipient_to_contact'), 'error');
               is_valid = false;
               return;
            }

            // create an array of name=>value that will be serialized by JQuery function
            new_contacts.push(contact[0]);      // visualization name - input text (eg. <input type="text" name="_contacts[0]_name" value="aVisualizationName">)
            new_contacts.push(contact[1]);      // email - input text
            new_contacts.push(contact[2]);      // firstname - input text
            new_contacts.push(contact[3]);      // surname - input text
            new_contacts.push(contact[4]);      // addressbook - select (eg. <select name="_contacts[0]_addressbook><option value="3">group1</option></select>)
            new_contacts.push(contact[5]);      // group - select

        });

        // if there weren't any validation errors, serialize new contacts data and send it to server
        if (is_valid) {
            var data = $(new_contacts).serialize();

            rcmail.display_message(rcmail.gettext('loading'), 'loading', true);
            rcmail.addEventListener('plugin.recipient_to_contact_save_contacts_response', recipient_to_contact.save_contacts_handler);
            rcmail.http_post('plugin.recipient_to_contact_save_contacts', data);
        }

    },

    /**
     * Handles the save_contacts response from server.
     *
     * Removes the row from dialog, if the contact has been added successfully
     * or shows validation errors. Finally it closes dialog box.
     *
     * @param array $response Response array from server.
     *
     * @return void
     */
    save_contacts_handler: function(response)   {

        // it eventually contains errors
        var error_messages = [];

        // iterate over contacts received from server.
        // Remove rows from table, which have been added successfully or populate error_messages array.
        $.each(response.contacts, function(key, contact) {
            if (contact.status == 'ok') {
                $("#new-contacts-dialog input[name^=_contacts\\[" + key + "\\]]").parents('tr').remove();
            } else {
                error_messages.push(contact.message);
            }
        });

        // if all contacts have been added successfully, show confirmation message and close the dialog box.
        if (error_messages.length == 0) {
            rcmail.display_message(rcmail.gettext('response_confirm', 'recipient_to_contact'), 'confirmation');

            if ($('#new-contacts-dialog table tr').length == 1) {
                $('#new-contacts-dialog').remove();

                // re-enable keyboard_shortcuts plugin
                if (recipient_to_contact.withShortcuts) {
                   rcmail.env.keyboard_shortcuts = true;
                }

                // restore rcube_list_widget's event listeners
                rcube_event.add_listener({event:bw.opera?'keypress':'keydown', object: rcmail.message_list, method:'key_press'});
                rcube_event.add_listener({event:'keydown', object:rcmail.message_list, method:'key_down'});
                recipient_to_contact.end();
            }
        } else {
            // otherwise show all errors
            $.each(error_messages, function() {
                rcmail.display_message(this, 'error');
            });
        }

    },

    end: function() {
        rcmail.http_post('plugin.recipient_to_contact_get_contacts', {});
    },

    /**
     * Initializes the Jquey UI Dialog for adding new contacts.
     *
     * @return void
     */
    show_dialog: function()
    {
        $('#new-contacts-dialog').dialog({
            autoResize: true,
            modal: true,
            resizable: false,
            width: 'auto',
            title: rcmail.gettext('dialog_title', 'recipient_to_contact'),
            buttons: {
                Close: function() {
                    $(this).dialog( "close" );
                    // description below
                    rcube_event.add_listener({event:bw.opera?'keypress':'keydown', object: rcmail.message_list, method:'key_press'});
                    rcube_event.add_listener({event:'keydown', object:rcmail.message_list, method:'key_down'});
                    $('#new-contacts-dialog').remove();
                    recipient_to_contact.end();
                }
                Save: recipient_to_contact.save_contacts,
            }
        });

        // pre select all checkboxes by default
        $('#new-contacts-dialog input:checkbox').click();

        // re-enable keyboard shortcuts
        if (recipient_to_contact.withShortcuts) {
            rcmail.env.keyboard_shortcuts = false;
        }

        // rcmail_list_widget captures all keyboard events. Because of that you can't use keys like
        // Space or BackSpace in the input fields in modal dialog. Disable temporarily keyboard
        // event catching and
        rcube_event.remove_listener({event:bw.opera?'keypress':'keydown', object: rcmail.message_list, method:'key_press'});
        rcube_event.remove_listener({event:'keydown', object:rcmail.message_list, method:'key_down'});
    },

    /**
     * Get a list of addressbook's groups from server.
     *
     *
     * @return void
     */
    get_addressbook_groups: function(event)
    {
        // get addressbook id
        address_book_id = $('#select_address_book' + event.data.k).val();       // variable k is the key that identifies the table row from wich we are receiving the request
        // send a request to server in order to get addressbook's groups list
        // enable the "loading" message
        rcmail.display_message(rcmail.gettext('loading'), 'loading', true);
        rcmail.addEventListener('plugin.recipient_to_contact_get_addressbook_groups_response', recipient_to_contact.get_addressbook_groups_handler);
        // we send with the addressbook's id also the row key in order to identify the request's source
        rcmail.http_post('plugin.recipient_to_contact_get_addressbook_groups', 'address_book_id=' + address_book_id + '&key=' + event.data.k);
    },

    /**
     * Handles the get_addressbook_groups response from server.
     *
     * It fills groups' select box with the groups' list got from server.
     *
     * @param array $response Response array from server.
     *
     * @return void
     */
    get_addressbook_groups_handler: function(response)
    {
        // iterate over groups received from server and add them to groups select box, but before we empty select box
        $('#select_groups' + response.key).empty();
        $('#select_groups' + response.key).append($('<option></option>').val('none').text(''));     // for "no group"
        $.each(response.groups, function(key, group) {
            $('#select_groups' + response.key).append(
                $('<option></option>').val(group['ID']).text(group['name'])
            );
        });

        // disable the "loading" message
        rcmail.display_message(rcmail.gettext('loading'), 'loading', false);
    }
}
