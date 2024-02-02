import $ from 'jquery';
import lists from '../core/lists';
import key from '../core/key';
import range from '../core/range';

const defaultScheme = 'http://';
const linkPattern = /^([A-Za-z][A-Za-z0-9+-.]*\:[\/]{2}|tel:|mailto:[A-Z0-9._%+-]+@|xmpp:[A-Z0-9._%+-]+@)?(www\.)?(.+)$/i;

export default class AutoLink {
  constructor(context) {
    this.context = context;
    this.options = context.options;
    this.$editable = context.layoutInfo.editable;
    this.events = {
      'summernote.keyup': (we, event) => {
        if (!event.isDefaultPrevented()) {
          this.handleKeyup(event);
        }
      }, 'summernote.keydown': (we, event) => {
        this.handleKeydown(event);
      }, 'summernote.paste': (we, event) => {
        this.onPaste(event.originalEvent);
      },
    };
  }

  initialize() {
    this.lastWordRange = null;
  }

  destroy() {
    this.lastWordRange = null;
  }

  onPaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('Text');

    // Regex to find URL in the text
    const urlRegex = /https?:\/\/\S+\b/gi;
    let match = urlRegex.exec(pastedData);

    if (match) {
      e.preventDefault();

      let lastIndex = 0;
      let fragment = document.createDocumentFragment();
      // Process all matches and surrounding text
      do {
        // Append text before URL
        fragment.appendChild(document.createTextNode(pastedData.substring(lastIndex, match.index)));

        // Create and append the anchor element for the URL
        const url = match[0];
        const $anchor = $('<a>')
          .attr('href', url)
          .text(url);

        if (this.options.linkAddNoOpener || this.options.linkAddNoReferrer) {
          $anchor.attr('rel', [this.options.linkAddNoOpener && 'noopener', this.options.linkAddNoReferrer && 'noreferrer'].filter(Boolean).join(' '));
        }

        if (this.context.options.linkTargetBlank) {
          $anchor.attr('target', '_blank');
        }

        fragment.appendChild($anchor[0]);

        lastIndex = urlRegex.lastIndex;
      } while ((match = urlRegex.exec(pastedData)) !== null);

      // Append any remaining text after the last URL
      fragment.appendChild(document.createTextNode(pastedData.substring(lastIndex)));

      const marker = document.createElement('span');
      fragment.appendChild(marker);

      // Insert the processed content
      const range = this.context.invoke('editor.createRange');
      range.insertNode(fragment);

      const selectionRange = document.createRange();
      selectionRange.setStartAfter(marker);
      selectionRange.collapse(true); // true to collapse the range to its start point

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRange);
    }
  }

  replace() {
    if (!this.lastWordRange) {
      return;
    }

    const keyword = this.lastWordRange.toString();
    const match = keyword.match(linkPattern);

    if (match && (match[1] || match[2])) {
      const link = match[1] ? keyword : defaultScheme + keyword;
      const urlText = this.options.showDomainOnlyForAutolink ? keyword.replace(/^(?:https?:\/\/)?(?:tel?:?)?(?:mailto?:?)?(?:xmpp?:?)?(?:www\.)?/i, '').split('/')[0] : keyword;

      const $node = $('<a></a>')
        .html(urlText)
        .attr('href', link);

      if (this.options.linkAddNoOpener || this.options.linkAddNoReferrer) {
        $node.attr('rel', [this.options.linkAddNoOpener && 'noopener', this.options.linkAddNoReferrer && 'noreferrer'].filter(Boolean).join(' '));
      }

      if (this.context.options.linkTargetBlank) {
        $node.attr('target', '_blank');
      }

      this.lastWordRange.insertNode($node[0]);
      this.lastWordRange = null;

      this.context.invoke('editor.focus');
      this.context.triggerEvent('change', this.$editable.html(), this.$editable);
    }
  }

  handleKeydown(event) {
    if (lists.contains([key.code.ENTER, key.code.SPACE], event.keyCode)) {
      const wordRange = this.context.invoke('editor.createRange').getWordRange();
      this.lastWordRange = wordRange;
    }
  }

  handleKeyup(event) {
    if (key.code.SPACE === event.keyCode || (key.code.ENTER === event.keyCode && !event.shiftKey)) {
      this.replace();
    }
  }
}
