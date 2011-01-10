/**
 * Clients scripts for recipient_to_contact plugin.
 *
 * Draws the jQuery UI Dialog with a form a to create new contacts. Pre-fills email addresses
 * and contact names. Allows multiple creation of new contacts.
 *
 * @category  RoundCube
 * @package   Plugin
 * @author    Vladimir Minakov <vminakov@names.co.uk>
 * @copyright 2009-2010 Namesco Limited
 * @license   http://www.gnu.org/licenses/gpl-3.0.txt GPLv3 License
 * @version   0.1.2
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
    * Generates dialog contect (form for adding new contacts), adds event listeners for ajax requests.
    *
    * Called, when the event plugin.recipient_to_contact_populate_dialog is triggered. Expects response data
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
        
        // create the table and table header
        var table = $('<table></table>').append(
            $('<tr>').append("<td>" + rcmail.gettext('dialog_contact_name', 'recipient_to_contact') + "</td>"
                           + "<td>" + rcmail.gettext('dialog_email', 'recipient_to_contact') + "</td>"
                           + "<td><input type='checkbox' id='new-contacts-select-all' /></td>")
        ).appendTo($('#new-contacts-dialog'));


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

            // generate dropdwon list with address books
            $('<td></td>').append(
                $('<input />').attr('type', 'checkbox')
            ).appendTo(row);

            row.appendTo(table);
        });

        // add 'Select All' functionality to the checbox in the form header
        $('#new-contacts-select-all').click(function() {
           var checked_status = this.checked;
           $(this).parents('table').find('input:checkbox').each(function() {
               this.checked = checked_status;
           });
        });

        // generate select box for addressbooks
        $('<div></div>').css('text-align', 'center').css('margin-top', '15px')
        .text(rcmail.gettext('dialog_add_selected', 'recipient_to_contact')).append(
            function() {
                var select = $('<select></select>').attr('name', '_addressbook')
                select.change(recipient_to_contact.add_new_contact);
                select.append(
                    $('<option></option>').val('none').text('')
                );
                $.each(response.address_books, function(key, address_book) {
                    select.append(
                        $('<option></option>').val(key).text(address_book['name'])
                    );
                });
                return select;
            }()
        ).appendTo($('#new-contacts-dialog'));

        // initialize the dialog
        recipient_to_contact.show_dialog();
    },

    /**
     * Adds new contact to the selected addressbook.
     *
     * Performs client-side validation and sends request to server. Triggered when by onChange event
     * on the addressbooks' select box.
     *
     * @return void
     */
    add_new_contact: function()
    {
        // verify that at least one checkbox has been selected. ignore the very first checkbox (Select All)
        var checked = $('#new-contacts-dialog').find('input:checked').not('#new-contacts-select-all');
        if (checked.length == 0) {
            rcmail.display_message(rcmail.gettext('response_contact_not_selected', 'recipient_to_contact'), 'error');
            $('#new-contacts-dialog select option:eq(0)').attr('selected', 'selected');
            return;
        }

        // stores new contacts that will be sent to server
        var new_contacts = [];

        var is_valid = true;

        checked.each(function() {
           // for each selected checkbox find corresponding input fields with contact's name and email
           var contact = $(this).parents('tr').first().find('input:text');

           // validate contact's name
           if ($(contact[0]).val() == '') {
               rcmail.display_message(rcmail.gettext('response_name_empty', 'recipient_to_contact'), 'error');
               $('#new-contacts-dialog select option:eq(0)').attr('selected', 'selected');
               is_valid = false;
               return;
           }

           // validate email
           if (!rcube_check_email($(contact[1]).val())) {
               rcmail.display_message(rcmail.gettext('response_email_invalid', 'recipient_to_contact'), 'error');
               $('#new-contacts-dialog select option:eq(0)').attr('selected', 'selected');
               is_valid = false;
               return;
           }

           new_contacts.push(contact[0]);
           new_contacts.push(contact[1]);
        });

        // if there weren't any validation errors, serialize new contacts data and send it to server
        if (is_valid) {
            var data = $(new_contacts).add($('#new-contacts-dialog select')).serialize();

            rcmail.display_message(rcmail.gettext('loading'), 'loading', true);
            rcmail.addEventListener('plugin.recipient_to_contact_add_contact_response', recipient_to_contact.add_contact_handler);
            rcmail.http_post('plugin.recipient_to_contact_add_contact', data);
        }

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
    					$(this).dialog("close");

                        // re-enable keyboard_shortcuts plugin
                        if (recipient_to_contact.withShortcuts) {
                            rcmail.env.keyboard_shortcuts = true;
                        }

                        // description below
                        rcube_event.add_listener({event:bw.opera?'keypress':'keydown', object: rcmail.message_list, method:'key_press'});
                        rcube_event.add_listener({event:'keydown', object:rcmail.message_list, method:'key_down'});
    				}
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
     * Handles the add contact response from server.
     *
     * Removes the row from dialog, if the contact has been added successfully
     * or shows validation errors.
     *
     * @param array $response Response array from server.
     *
     * @return void
     */
    add_contact_handler: function(response)
    {
        var error_messages = [];

        // iterate over contacts recieved from server.
        // Remove rows from table, which have been added successfully or populate error_messages array.
        $.each(response.contacts, function(key, contact) {
            if (contact.status == 'ok') {
                $("#new-contacts-dialog input[name^=_contacts\\[" + key + "\\]]").parents('tr').remove();
            } else {
                error_messages.push(contact.message);
            }
        });

        // if all contacts have been added successfully, show confirmation message and delete the dialog.
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
            }
        } else {
            // otherwise show all errors
            $.each(error_messages, function() {
                rcmail.display_message(this, 'error');
            });
        }

        $('#new-contacts-dialog select option:eq(0)').attr('selected', 'selected');
    }
}
