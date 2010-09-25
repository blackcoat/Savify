/**
 * @TODO:
 * + queryString: Spaces within saved data
 * - review why decodeURIComponent isn't working as expected
 * + account for '=' within form values
 * - Element Support
 *   + textarea
 *   + select
 *   + select multiple
 *   + checkboxes
 *   + radio buttons
 *   > (misc. HTML5 elements)
 *      - value changes via Chrome's built-in up/down value controls are not saved
 * + Multiple forms on the same page
 * - Operate on other elements:
 *   > fieldset
 *   > input, select, textarea
 * - Full DOM support (for dynamic forms)
 * - Exception handling for localStorage memory limits
 */

(function($) {	
	
	$.fn.savify = function( settings ) {
		// List of default settings for Savify
		var options = {
			parser: 'queryString'
		},
		_savify;

		// Override our options with any settings passed by the user
		if (settings) $.extend(options, settings);
		
		if (typeof $.fn.savify._savify == 'undefined'){
			_savify = $.fn.savify._savify = {
				// A list of forms that have elements being savified.
				// The handler that clears the data will be attached
				// to each of these forms.
				forms: [],

				// A list of parsing engines that can transform
				// the DOM state of a <form> to/from a string...
				parsers: {
					// A custom parser based on jQuery.serialize()
					// All form data is stored as a serialized query string
					queryString: {
						serialize: function( form ) {
							return $(form).serialize();
						},
						unserialize: function( form, serializedData ) {					
							var formData = {},
								formElements = $(form).find('input,select,textarea'),

								// Start unserializing the information saved by
								// jQuery.serialize()
								// http://api.jquery.com/serialize/
								pairs = serializedData.split('&'),
								pair;

							for (var i = 0; i < pairs.length; i++){
								// Split the serialized form data into a 
								// key (i.e. input name, stored in [0] ), and
								// value (stored in [1] ).  The key/value pair
								// needs to be decoded after splitting to prevent
								// bugs when handling values (or keys) containing
								// the '=' character.
								// 
								// @REVIEW - Why doesn't decodeURIComponent
								// properly decode "+" characters from localStorage for me?
								// Am I doing something wrong?  (presumably so)
								// I feel like I shouldn't need to run replace()
								pair = $.map( pairs[i].replace(/\+/g, ' ').split('='), decodeURIComponent );

								// If data already exists for this key,
								// store an array of values for that same key
								// jQuery.val() can handle an array of values for <select multiple>
								if (formData[pair[0]]){
									// Add to the array if it already exists,
									// otherwise, create the array
									$.isArray(formData[pair[0]]) ? 
										formData[pair[0]][formData[pair[0]].length] = pair[1] :
										formData[pair[0]] = [formData[pair[0]], pair[1]];
								}
								else {
									formData[pair[0]] = pair[1];
								}
							}

							for (var key in formData) {
								var elements = formElements.filter('[name="' + key + '"]');

								// If the serialize elements are checkboxes, check them off...
								// Anything that wasn't checked wouldn't have been serialized
								// in the first place
								if (elements.is(':checkbox')){
									elements.attr('checked', 'checked');
								}
								else if (elements.is(':radio')){
									elements.filter('[value="' + formData[key] + '"]').attr('checked', 'checked');
								}
								else {
									elements.val(formData[key]);
								}
							}
						}
					},
					serializeDOM: {

					}
				},
				storageEngines: {
					// Uses the HTML5 Storage API
					// For a good intro, read:  http://diveintohtml5.org/storage.html
					localStorage: {
						name: "localStorage",
						autoload: function( element, parser ) {
							var storedData = localStorage.getItem(this.key(element));

							// localStorage will return 'null' if there is no data
							// stored for the specified key
							if (!!storedData) {
								parser.unserialize(element, storedData);
							}
							return;
						},
						clear: function( event ) {
							localStorage.removeItem(event.data.storage.key( this ));
							return true;
						},
						isSupported: function() {
							return ('localStorage' in window) && window.localStorage !== null;
						},
						/**
						 * Generates a storage key for the element being saved
						 */
						key: function( element ) {
							// @TODO - use the jQuery selector instead of the ID ??
							return location.pathname + '#' + $(element).attr('id');
						},
						save: function( event ) {
							return localStorage.setItem(event.data.storage.key( event.data.form ), 
								event.data.parser.serialize(event.data.form));
						}
					}
				},
				selectStorageEngine: function() {
					// Look through our storage engines, see if one of them
					// is supported, and return it for Savify to use
					for(var e in this.storageEngines){
						if (this.storageEngines[e].isSupported()){
							return this.storageEngines[e];
						}
					}
					return null; // no engine supported.  Savify won't work (>_<)
				}
			};
		}
		
		
		// Since our storage engines can only save strings, we need a 
		// parser to transform the DOM into a string
		var parser = _savify.parsers[options.parser];
		
		// Choose a storage engine.  If no engine is supported by this
		// browser, Savify can't do its job.
		var storage = _savify.selectStorageEngine();
		if (storage === null) return this;
		
		// Loop through each of the elements in the current jQuery scope
		this.each(function() {
			// We can only Savify a <form>.  Ignore any other elements for now...
			// @TODO - add support for savifying specific elements and their children,
			// e.g. 'input,select,textarea' or 'fieldset#autosaved', etc.
			if (('nodeName' in this) && this.nodeName == 'FORM'){
				// Whenever one of our form elements is altered,
				// save the modified form control using our chosen storage engine.
				// While we're at it, same the actual forms that each
				// of our form controls belongs to.  We will need to
				// attach 'submit' handlers to each one.
				$(this).find('input,textarea,select').bind(
					'change keyup click', { parser: parser, form: this, storage: storage }, storage.save 
				).each(function() {
					if ('form' in this && $.inArray(this.form, _savify.forms) === -1){
						$.merge(_savify.forms, [this.form]);
					}
				});
				$(this).bind('submit', {storage: storage}, storage.clear );
				
				// Automatically load our saved data (if we have any) 
				// when this page loads
				
				// @TODO - make the handler invokation more generic
				// Ideally, this should be run once, referencing a saved
				// set of selected elements that can be accessed by storage.autoload
				storage.autoload( this, parser );
			}
		});
		
		return this;
	};
})(jQuery);  // Execute this script immediately, passing in the default jQuery object