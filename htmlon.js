'use strict';

/* ===========
| HTMLON - class for HTMLon (pronounced HTM-elon), a lightweight WYGIWYG HTML editor.
=========== */

let HTMLON = (() => {


	/* --------------
	| PREP
	-------------- */
	
	//dialog messages
	let msgs = {
		no_container_found: 'Editor exited because container could not be found',
		warn_on_html_mode: 'HTML mode should be used only if you are familiar with HTML (HyperText MarkUp Language). If you are unsure, please consult your web developer. Proceed?',
		enter_link_href: 'Enter a location to link to:'
	};

	//default iframe styles
	let default_ifr_styles = `
	body { margin: 12px; }
	*:not(code) { color: #444; font-family: lato, verdana, sans-serif; font-size: 1rem; }
	h2 { font-size: 2.2rem; }
	h3 { font-size: 1.7rem; }
	h4 { font-size: 1.3rem; }
	code { background: #4e5b71; color: #eee; }
	code:not(.block) { line-height: 1.3rem; padding: .15rem .2rem .05rem .2rem; }
	code.block { display: block; background: #4e5b71; white-space: pre; padding: 1rem 2rem!important; position: relative; }
	code.block::selection { color: #d4653c; background: white; }
	.info { background: #707070; padding: .65rem 1rem; border-left: solid 6px #96B7D8; }
	img { max-width: 100%; }
	blockquote { background: #4D4D4D; border: solid 1px #666; padding: .75em; width: 80%; margin: 0 auto; border-left: solid 2px #E6B174; }
	blockquote p { color: #aDaF9D; }
	blockquote p:first-child { margin-top: 0; }
	blockquote p:last-child { margin-bottom: 0; }
	blockquote small { text-align: right; display: block; color: #E6B174; }
	`;

	//default colour picker options
	let colours = {
		main: ['red', 'yellow', 'orange', 'purple', 'green', 'blue', 'pink', 'magenta'],
		highlight: ['yellow', 'lime', '#ddd', '#fdd']
	};
	
	//defalt font picker options
	let fonts = {arial: 'Arial', verdana: 'Verdana', courier: 'Courier', calibri: 'Calibri', helvetica: 'Helvetica', 'arial narrow': 'Arial narrow'};
	
	/* ---
	| BUTTONS CONFIG
	--- */
	
	let buttons = {
		bold: {text: 'b', callback: 'bold', hint: 'Make text bold'},
		underline: {text: 'u', callback: 'underline', hint: 'Make text underlined'},
		italic: {text: 'i', callback: 'italic', hint: 'Make text italic'},
		sub: {text: 'sub', callback: 'subscript', hint: 'Make text subtext'},
		sup: {text: 'sup', callback: 'superscript', hint: 'Make text supertext'},
		info: {text: 'info', hint: 'Add an info box', callback() {
			let sel_text = this.ifr_win.getSelection();
			this.get_cntnt_doc().execCommand('insertHTML', null, '<p class=info>'+(sel_text.toString() ? sel_text : 'Something interesting here')+'</p>');
		}},
		uList: {text: '&bull;-', callback: 'insertUnorderedList', hint: 'Insert an unordered list (<ul>)'},
		oList: {text: '1)', callback: 'insertOrderedList', hint: 'Insert an orderded list (<ol>)'},
		indent: {text: '&rarr;', hint: 'Indent list item', callback() {
			let li =  this.ifr_win.getSelection().anchorNode.parentNode,
				sel_text = this.ifr_win.getSelection(),
				prev_li = li.previousElementSibling,
				next_li = li.nextElementSibling,
				ul,
				new_li = document.createElement('li');
			if (!sel_text.toString()) sel_text = li.textContent;
			if (/\n/.test(sel_text)) return alert('You can\'t indent multiple list items at once - please do them separately');
			if (!prev_li) return alert('The first item in a list cannot be indented');
			if (li.querySelector('ul')) { ul = li.querySelector('ul'); prev_li.appendChild(ul); }
			else if (prev_li && prev_li.querySelector('ul')) ul = prev_li.querySelector('ul');
			else if (next_li && next_li.querySelector('ul')) ul = next_li.querySelector('ul');
			else {
				ul = document.createElement('ul');
				if (prev_li) prev_li.appendChild(ul); else if (next_li) next_li.appendChild(ul);
			}
			new_li.textContent = sel_text;
			ul.appendChild(new_li);
			this.ifr_win.getSelection().anchorNode.remove();
			if (!li.innerHTML) li.remove();
		}},
		unindent: {text: '&larr;', hint: 'UN-indent list item', callback() {
			let li = this.ifr_win.getSelection().anchorNode.parentNode.closest('li');
			let ul = li.closest('ul ul');
			if (!ul) return alert('List item is not in a nested list');
			ul.parentNode.appendChild(li); //<-- this will actually create some wonky HTML, but get_html() will clean it up
		}},
		heading: {
			text: 'H',
			hint: 'Insert a H2/3 heading',
			callback: function(edit_which, sel_text) {
				let which = prompt('Do you want a <h2> (2) or a <h3> (3)? (You can also impose an ID, separated by a comma, for internal anchors, e.g. "2,my-id")', typeof edit_which != 'string' ? '' : edit_which);
				sel_text = sel_text || this.ifr_win.getSelection();
				if (!which) return;
				if (!/^[23]/.test(which)) return alert("You must enter '2' or '3'");
				if (!/^[23](,[^\s,]+)?/.test(which)) return alert('Bad format, "'+str+'"');
				let spl = which.split(',');
				if (typeof edit_which == 'string') this.ifr_win.getSelection().anchorNode.remove();
				this.get_cntnt_doc().execCommand('insertHTML', null, '<h'+spl[0]+(!spl[1] ? '' : ' id='+spl[1])+'>'+(sel_text.toString() ? sel_text : 'Heading text here')+'</h'+spl[0]+'>');
			}
		},
		quote: {
			text: '&ldquo;',
			callback: function() {
				let sel_text = this.ifr_win.getSelection(),
					attr_text = prompt('Enter the attribution text for this quote (leave it blank if there shouldn\'t be one):', '');
				this.get_cntnt_doc().execCommand('insertHTML', null, '<blockquote><p>'+(sel_text.toString() ? sel_text : 'Write the quote here')+'</p>'+(attr_text ? '<small>- '+attr_text+'</small>' : '')+'</blockquote>');
			},
			hint: 'Insert a block quote'
		},
		nav: {
			text: 'nav',
			callback() {
				let text = this.ifr_win.getSelection();
				text = text.toString() || 'foop';
				this.get_cntnt_doc().execCommand('insertHTML', null, '<nav><ul><li>'+text+'</li></ul></nav>');
			}
		},
		link: {
			text: 'link',
			callback: function(edit, href) {
				let link_text = typeof edit != 'string' ? this.ifr_win.getSelection() : edit;
				if (!link_text.toString()) { alert('Please first select the text that should be linked'); return; }
				href = prompt(msgs.enter_link_href, href || '');
				if (!href) return;
				href = !/^www\./.test(href) ? href : 'http://'+href;
				let	html = '<a href="'+href+'"'+(!(this.params.ext_links_in_new_tab && /^https?:/.test(href)) ? '' : ' target="_blank"')+'>'+link_text+'</a>';
				this.get_cntnt_doc().execCommand('insertHTML', null, html);
			},
			hint: 'Insert a hyperlink'
		},
		highlight: {
			text: 'BG',
			callback: function(evt, col) { this.get_cntnt_doc().execCommand('hiliteColor', false, col); },
			prompt: 'colour:highlight',
			hint: 'Highlight text with a background colour'
		},
		col: {
			text: 'col',
			callback: function(evt, col) { this.get_cntnt_doc().execCommand('foreColor', null, col); },
			prompt: 'colour:main',
			hint: 'Set the text colour'
		},
		font: {
			text: 'font',
			callback: function(evt, font) { this.get_cntnt_doc().execCommand('fontName', false, font.replace(/^"|"$/g, '')); },
			prompt: 'font',
			hint: 'Set the font'
		},
		codeB: {
			text: 'code',
			hint: 'insert a code block',
			callback: function() {
				var sel_text = this.ifr_win.getSelection();
				this.get_cntnt_doc().execCommand('insertHTML', null, '<code class=block>'+(sel_text.toString() ? sel_text : 'let foo;')+'</code><p></p>');
			}
		},
		iCode: {
			text: 'iCode',
			hint: 'insert inline code',
			callback: function() {
				var sel_text = this.ifr_win.getSelection();
				this.get_cntnt_doc().execCommand('insertHTML', null, '<code>'+(sel_text.toString() ? sel_text : 'foo')+'</code>');
			}		
		},
		html: {
			callback: function(evt) {

				//switching to or from HTML mode?
				var html_mode = this.wrapper.className.indexOf('html_mode') != -1;

				//if HTML mode, warn user re: need to know HTML? Log in local storage if agrees and proceeds.
				if (!html_mode && this.params.warn_on_html_mode && !localStorage.getItem('html_mode_warned')) {
					if (!confirm(msgs.warn_on_html_mode)) return; else localStorage.setItem('html_mode_warned', 1);
				}

				//do mode switch - on return to editor
				!html_mode ? this.html_editor.value = this.get_html() : this.get_body().innerHTML = this.html_editor.value;
				!html_mode ? this.wrapper.className += ' html_mode' : this.wrapper.className = this.wrapper.className.replace(' html_mode', '');
			},
			hint: 'Toggle between the HTML editor and the visual editor'
		}
	};

	/* --------------
	| CONSTRUCTOR. Args:
	|	- @params - an object of params (see docs).
	-------------- */

	function construc(params) {
		
		//prep
		this.params = params;
		this.picker_showing = false;
		this.webkit = navigator.appVersion.indexOf('WebKit') != -1;

		//custom buttons?
		if (params.extra_buttons) for (var btn_id in params.extra_buttons) buttons[btn_id] = params.extra_buttons[btn_id];
		
		//default CSS - due to webkit bug whereby DIVs are inserted of Ps, make DIVs look like Ps until we convert them over later
		this.params.css = this.params.css || [];
		if (this.params.css instanceof Array) this.params.css = this.params.css.join('\n');
		if (this.webkit) this.params.css += '\ndiv { margin-top: 12px; }';
		
		//off to building and event-handling
		build.call(this);
		events.call(this);

	}
	
	
	/* --------------
	| API
	-------------- */
	
	//static methods to allow creation of custom buttons, prompts and fonts
	construc.add_button = function(name, config) { buttons[name] = config; return this; };
	construc.add_palette = function(name, cols) {
		for (var i=0, len=cols.length; i<len; i++) cols[i] = format_hex(cols[i]);
		colours[name] = cols;
		return this;
	};
	construc.add_font = function(name, title) { fonts[name] = title; return this; };
	
	//commit HTML to field and return it
	construc.prototype.commit_html = function() {
		this.field.value = this.get_html().replace(/\t|\n/g, '');
		return this.field.value;
	};
	
	//set HTML
	construc.prototype.set_html = function(html) { setTimeout(() => this.get_body().innerHTML = html, 0); };
	
	/* ---
	| get HTML - get from either iframe (if in visual mode) or textarea (HTML mode)
	--- */
	
	construc.prototype.get_html = function() {

		//extract code block content to preserve spacing - it'll be put back later
		let cBlocks = this.get_body().querySelectorAll('code.block'),
			cBlock_contents = [...cBlocks].map(cb => {
				let ret = cb.innerHTML.replace(/\n|<br>/g, '*BREAK*');
				cb.innerHTML = '.';
				return ret;
			});

		//grab HTML		
		var html = this.wrapper.className.indexOf('html_mode') == -1 ? this.get_body().innerHTML : this.html_editor.value;

		//convert any HTML wrongly entered during visual rather than HTML mode
		html = html.replace(/&lt;[a-z]+[^\/&]*&gt;.*&lt;\/[a-z]+&gt;|&lt;[a-z]+ ?\/&gt;/g, function(match) {
			return match.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
		});

		//for webkit, handle but whereby DIVs are inserted instead of Ps, and opening text has no wrapper element */
		if (this.webkit) {
			html = html.replace(/<\/?div>/ig, function(tag) { return tag.replace(/div/i, 'p'); });
			if (this.ifr_doc.body.childNodes[0].nodeType == 3) html = html.replace(/^([^<]+)/, '<p>$1</p>');
		}

		//DESYN USE: don't wrap picset imgs in paragraphs
		html = html.replace(/<p>(<img[^>]+>)<\/p>/gi, function($0, img_tag) { return img_tag; }, html);

		//remove P tags from within LIs
		html = html.replace(/<li>\s*<p>/ig, '<li>').replace(/<\/p>(?=\s*<\/li>)/gi, '');

		//remove P tags from around code.block tags
		html = html.replace(/<p><code /g, '<code ', html);
		html = html.replace(/<\/code><\/p>/, '</code>', html);
		
		//for webkit, handle bug whereby DIVs are inserted instead of Ps, and opening text has no wrapper element */
		if (this.webkit) {
			html = html.replace(/<\/?div>/ig, function(tag) { return tag.replace(/div/i, 'p'); });
			if (this.ifr_doc.body.childNodes[0] && this.ifr_doc.body.childNodes[0].nodeType == 3) html = html.replace(/^([^<]+)/, '<p>$1</p>');
		}

		//format HTML
		html = format_html(html);

		//and strip any empty tags
		html = strip_empty_tags(strip_empty_tags(strip_empty_tags(html)));

		//reinsert code block contents - both in the HTML string and visually in the UI (so that on save, we don't see just the period)
		let i = 0;
		html = html.replace(/(<code[^>]*class="?block"?[^>]*>)\./g, ($0, $1) => {
			i++;
			let html = cBlock_contents[i-1].replace(/\*BREAK\*/g, '\r\n');
			cBlocks[i-1].innerHTML = html;
			return $1+html;
		});

		return html;

	};
	/* --- */
	
	//misc
	construc.prototype.get_cntnt_doc = function() { return this.ifr.contentDocument; };
	construc.prototype.get_body = function() { return this.get_cntnt_doc().querySelector('body'); };
	construc.prototype.get_head = function() { return this.get_cntnt_doc().querySelector('head'); };
	construc.prototype.get_doc = function() { return this.ifr_doc; };
	construc.prototype.get_el = function() { return this.wrapper; };
	construc.prototype.get_cntnt_win = function() { return this.ifr.contentWindow; };
	
	
	/* --------------
	| BUILD (main func - builds stuff and handles button actions)
	-------------- */
	
	function build() {

		var instance_no = document.querySelectorAll('.editor').length;
		
		//establish container
		var container = typeof this.params.container == 'string' ? document.querySelector(this.params.container) : this.params.container;
		if (!container) { alert(msgs.no_container_found); return; }
		
		//wrapper and buttons bar
		container.appendChild(this.wrapper = document.createElement('div'));
		this.wrapper.className = 'htmlon '+(this.params.class || '');
		this.wrapper.appendChild(this.buttons = document.createElement('div'));
		this.buttons.className = 'buttons';
		
		//iframe and HTML editor (if HTML edit allowed)
		this.wrapper.appendChild(this.ifr = document.createElement('iframe'));
		this.ifr_doc = this.ifr.contentDocument || this.ifr.document;
		this.ifr_win = this.ifr.contentWindow;
		if (this.params.allow_html_edit) {
			this.params.buttons.push('html');
			this.wrapper.appendChild(this.html_editor = document.createElement('textarea'));
		}
		
		//log instance on wrapper, for easy API access from DOM
		this.wrapper.htmlon = this;
		
		//hidden field for HTML
		if (typeof this.params.field == 'string') {
			this.wrapper.appendChild(this.field = document.createElement('input'));
			this.field.type = 'hidden';
			this.field.name = this.params.field || 'htmlon'+instance_no+'-html';
		} else
			this.field = this.params.field;
		
		//configure doc - insert any starting HTML or CSS to go into frame and give content editable. Timeout is a hack necessary for Mozilla
		setTimeout(function() {
			this.get_cntnt_doc().body.id = 'htmlon-ifr';
			this.get_cntnt_doc().body.contentEditable = true;
			this.ifr_doc.designMode = 'on';
			if (this.params.css_path) this.get_head().innerHTML += '<link rel="stylesheet" href="'+this.params.css_path+'" />';
			if (this.params.styleWithCSS) this.get_cntnt_doc().execCommand('styleWithCSS');
			if (this.params.html) {
				this.get_body().innerHTML = this.params.html;
				let cBlocks = this.params.html.match(/<code[^>]*>[\s\S]+?(?=<\/code>)/gi);
				this.get_body().querySelectorAll('code').forEach((el, i) => el.innerHTML = cBlocks[i].replace(/<code[^>]*>/, '').replace(/</g, '&lt;'));
			}
			
			this.get_head().innerHTML += '<style>'+default_ifr_styles+this.params.css+'</style>';
		}.bind(this), 0);
		
		//buttons - passed as names of buttons specified in @buttons
		if (this.params.buttons)
			this.params.buttons.forEach(function(val) {
				if (!buttons[val]) return;
				let but = document.createElement('a');
				this.buttons.appendChild(but);
				but.innerHTML = buttons[val].text || '';
				but.title = buttons[val].hint || '';
				but.className = (typeof val == 'string' ? val : buttons[val].text.replace(/\W/g, '_').replace(/_{2,}/g, '_'))+' but';
				but.config = buttons[val];
			}.bind(this));
			
		//colour picker, used by some buttons e.g. highlight
		this.wrapper.appendChild(this.colPick = document.createElement('div'));
		this.colPick.className = 'colour picker';
		var ul, li, button;
		for (var i in colours) {
			this.colPick.appendChild(ul = document.createElement('ul'));
			ul.className = i;
			for (var s=0, len=colours[i].length; s<len; s++) { ul.appendChild(li = document.createElement('li')); li.style.background = colours[i][s]; }
		}
		if (this.params.allow_custom_col !== false) {
			this.colPick.appendChild(this.customColField = document.createElement('input'));
			this.customColField.placeholder = 'custom...';
			this.customColField.className = 'custom-col';
			this.colPick.appendChild(button = document.createElement('button'));
			button.textContent = 'GO';
		}
		
		//font picker
		this.wrapper.appendChild(this.fontPick = document.createElement('div'));
		this.fontPick.className = 'font picker';
		var ul, li;
		this.fontPick.appendChild(ul = document.createElement('ul'));
		for (var i in fonts) { ul.appendChild(li = document.createElement('li')); li.innerHTML = fonts[i]; li.style.fontFamily = i; }
		
	}
	
	/* --------------
	| EVENTS
	-------------- */	
	
	function events() {
	
		/* ---
		| BUTTONS - on click, do callback (or, if callback is a string, assume it's a command for execCommand)
		--- */
		
		this.buttons.addEventListener('click', function(evt) {
			
			//prep
			evt.stopPropagation();
			var but = evt.target;
			if (but.tagName != 'A') return;
			if (this.picker_showing) {
				this.colPick.style.display = this.fontPick.style.display = 'none';
				this.picker_showing = false;
				if (but.className.indexOf('active') != -1) return;
			}
			but.className = but.className.replace('active', '')+' active';
			
			//callback...
			
			if (typeof but.config.callback == 'function') {
				
				//...no prompt required
				if (!but.config.prompt) {
					but.config.callback.call(this, evt)
					but.className = but.className.replace('active', '')
					
				//...prompt (for font, colour etc) required
				} else if (but.config.prompt) {
					
					var picker = this[(but.config.prompt.replace(/:.+$/, '') == 'colour' ? 'col' : 'font')+'Pick'];
					picker.style.left = but.offsetLeft+'px';
					picker.style.display = 'block';
					picker.but = but;
					this.picker_showing = true;
				
					if (/^colour:/.test(but.config.prompt)) {
						var palette_el = this.colPick.querySelector('.'+but.config.prompt.replace(/^colour:/, ''));
						palette_el.style.display = 'block';
					}
					
				}
				
			//string - assume command for execCommand
			} else {
				this.get_cntnt_doc().execCommand(but.config.callback);
				but.className = but.className.replace('active', '');
			}
				
		}.bind(this), false);
		
		/* ---
		| PICKERS
		--- */
		
		//colour picker
		this.colPick.addEventListener('click', function colPickChoice(evt) {
			var clicked = evt.target.tagName.toLowerCase();
			if (!/li|button/.test(clicked)) return;
			var col = this.customColField && this.customColField.value ? format_hex(this.customColField.value) : evt.target.style.backgroundColor;
			this.colPick.but.config.callback.call(this, evt, col);
			this.colPick.but.className = but.className.replace('active', '');
			evt.preventDefault();
		}.bind(this), false);
		
		//font picker
		this.fontPick.addEventListener('click', function fontChoice(evt) {
			if (evt.target.tagName.toLowerCase() != 'li') return;
			this.fontPick.but.config.callback.call(this, evt, evt.target.style.fontFamily);
			this.fontPick.but.className = but.className.replace('active', '');
		}.bind(this), false);
			
		//hide pickers on click-out if showing
		this.ifr_doc.body.addEventListener('click', function() {
			this.colPick.style.display = this.fontPick.style.display = 'none';
			this.picker_showing = false;
		}.bind(this), false);
		this.wrapper.addEventListener('click', function(evt) {
			if (evt.target.className.indexOf('active') == -1 && evt.target.className != 'custom-col')
				this.colPick.style.display = this.fontPick.style.display = 'none';
				this.picker_showing = false;
		}.bind(this), false);
		/* --- */
		
		//non-editable mode - if params allow only styling but not editing, disregard content-inserting keypresses
		if (this.params.editable === false)
			this.ifr_doc.body.addEventListener('keypress', function(evt) { if (!evt.ctrlKey) evt.preventDefault(); }, false);

		/* ---
		| IFRAME EVENTS - on the created elements
		--- */

		this.ifr_win.addEventListener('load', () => {

			//ensure P tags are used on enter press, not BR's - except if active block is LI, h2/3, blockquote or code
			this.get_body().addEventListener('input', function(evt) {
				var curr_block = this.ifr_win.getSelection().anchorNode;
				if (curr_block.parentNode && !curr_block.parentNode.matches('h2, h3, ul, li, li *, blockquote, blockquote *, code.block'))
					this.get_cntnt_doc().execCommand('formatblock', false , 'P');
			}.bind(this), false);

			//code blocks - suppress new <p> tags on enter keypress, which exit the code block
			this.get_body().addEventListener('keypress', evt => {
				if (evt.keyCode != '13' || this.ifr_win.getSelection().anchorNode.parentNode.tagName != 'CODE') return;
				evt.preventDefault();
				this.get_cntnt_doc().execCommand('insertHTML', null, '\n');
			});

			//double click events...
			this.get_body().addEventListener('dblclick', evt => {
				let el = evt.target;
				switch (evt.target.tagName) {
					case 'H2':
					case 'H3':
						buttons.heading.callback.call(this, el.tagName.substr(1, 1)+(!el.id ? '' : ','+el.id), el.textContent);
						break;
					case 'A':
						buttons.link.callback.call(this, el.textContent, el.getAttribute('href'));
						break;
				}
			});

			//paste - strip out unwanted attributes
			this.get_body().addEventListener('paste', evt => {return;
				this.get_cntnt_doc().execCommand('insertHTML', null, '{PASTE-START}');
				setTimeout(() => {
					let ptn;
					this.get_cntnt_doc().execCommand('insertHTML', null, '{PASTE-END}');
					let just_pasted = this.get_html().match(ptn = /\{PASTE-START\}([\s\S]+)\{PASTE-END\}/);
					let frag = document.createElement('div');
					frag.innerHTML = just_pasted[1].replace(/&nbsp;/g, ' ');
					frag.querySelectorAll('*').forEach(el => 
						[...el.attributes].forEach(attr => el.removeAttribute(attr.name))
					);
					this.set_html(this.get_html().replace(ptn, frag.innerHTML));
				}, 1);
			});

		});
		
	}
	
	//and return
	return construc;	
	
	/* --------------
	| MISC/UTILS
	-------------- */
	
	//ensure hex colours start with #
	function format_hex(col) { return col.replace(/^[a-f0-9]{3,6}$/, function(match) { return '#'+match; }); }
	
	//strip empty HTML tags
	function strip_empty_tags(html) { return html.replace(/<[a-z1-6]+[^>]*>\s*<\/[a-z1-6]+>/g, ($0, $1) => { return !/<img/i.test($0) ? '' : $0; }); }
	
	/* ---
	| format HTML
	--- */
	
	function format_html(html) {
	    var tab_count = 0;
	    return html
	    	//.replace(/\t|\n/g, '')
	    	.replace(/(\S)&nbsp;(?=\S)/g, ($0, $1) => $1+' ') //<-- sometimes &nbsp; seems to be used even for single spaces - revert
	    	.replace(/ (style|dir)="[^"]*"/ig, '')
	    	.replace(/<\/?(span|br)[^>]*( ?\/)?>/ig, '')
	    	.replace(/<\/p>(?=\w)/g, '</p><p>')
	        .replace(/<\/?[a-z]+( [^>]*)? ?\/?>/g, function(repl) {return repl;//what the fuck does this replacement do?
	            var closing_tag = /^<\//.test(repl);
	            var ret = '\n'+new Array(tab_count+(!closing_tag ? 1 : 0)).join('\t')+repl;
	            if (!/\/>$/.test(repl) && !/^<\//.test(repl)) tab_count++;
	            if (closing_tag) tab_count--;
	            return ret;
	        })
	        .replace(/>\w+\n\s*/g, function(repl) { return repl.replace(/\s/g, ''); })
	        .replace(/^\s+|\s+$/g, '');
	}
	/* --- */

})();