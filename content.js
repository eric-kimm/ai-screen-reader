//  Panel UI 

function createPanel() {
    if (document.getElementById('a11y-assistant-panel')) return;
  
    const panel = document.createElement('div');
    panel.id = 'a11y-assistant-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Accessibility Assistant');
    panel.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 420px;
      background: white;
      border: 2px solid #1a73e8;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: sans-serif;
      font-size: 13px;
      display: none;
    `;
  
    panel.innerHTML = `
      <div style="padding: 12px 16px; background: #1a73e8; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: white; font-weight: bold;">♿ Accessibility Assistant</span>
        <button id="a11y-close-btn" aria-label="Close panel" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer;">✕</button>
      </div>
  
      <div style="padding: 12px 16px;">
  
        <!-- Status bar -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div id="a11y-status" style="font-size: 11px; color: #555; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            Ready.
          </div>
          
        </div>
  
        <!-- Extract button -->
        <button id="a11y-extract-btn" style="width: 100%; padding: 9px; background: #1a73e8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; margin-bottom: 10px;">
          🔍 Extract Page Context
        </button>
  
        <!-- Extracted output -->
        <div id="a11y-output" style="
          display: none;
          white-space: pre-wrap;
          word-break: break-all;
          font-size: 11px;
          font-family: monospace;
          background: #f4f4f4;
          border: 1px solid #ddd;
          padding: 8px;
          height: 180px;
          overflow-y: auto;
          border-radius: 4px;
          margin-bottom: 10px;
        "></div>
  
        <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;" />
  
        <!-- Script tester -->
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">Console Script Tester</div>
        <div style="position: relative;">
          <textarea
            id="a11y-script-input"
            aria-label="Enter script to run"
            placeholder="// Paste or type a script&#10;document.querySelector('#search').value = 'hello';"
            style="
              width: 100%;
              height: 90px;
              font-family: monospace;
              font-size: 11px;
              padding: 8px;
              padding-right: 40px;
              border: 1px solid #ccc;
              border-radius: 4px;
              resize: vertical;
              box-sizing: border-box;
              background: #1e1e1e;
              color: #d4d4d4;
            "
          ></textarea>
        </div>
  
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="a11y-run-btn" style="flex: 1; padding: 8px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">▶ Run Script</button>
          <button id="a11y-clear-btn" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9; cursor: pointer;">✕ Clear</button>
          
        </div>
  
        <div id="a11y-console-result" style="
          display: none;
          margin-top: 8px;
          font-size: 11px;
          font-family: monospace;
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 8px;
          border-radius: 4px;
          white-space: pre-wrap;
          word-break: break-all;
        "></div>
  
      </div>
    `;
  
    document.body.appendChild(panel);
    attachPanelListeners();
    return panel;
  }
  
  //  Panel listeners 
  
  function attachPanelListeners() {
  
    
  

  
    // Extract button
    document.getElementById('a11y-extract-btn').addEventListener('click', () => {
      const status = document.getElementById('a11y-status');
      const output = document.getElementById('a11y-output');
  
      status.textContent = 'Extracting page context...';
  
      try {
        const rawHTML = document.documentElement.outerHTML;
        const context = extractInteractiveContext(rawHTML, window.location.href);
        const formatted = formatContextForModel(context);
        const chunks = chunkText(formatted, 12000);
  
        status.textContent = ' Extracted | ' + formatted.length + ' chars | ' + chunks.length + ' chunk(s)';
        output.style.display = 'block';
        output.textContent = formatted;
      } catch (e) {
        status.textContent = ' Extraction failed: ' + e.message;
      }
    });
  
    // Run script — sends to background to bypass CSP
    document.getElementById('a11y-run-btn').addEventListener('click', () => {
      const script = document.getElementById('a11y-script-input').value.trim();
  
      if (!script) {
        showConsoleResult('No script provided.', 'error');
        return;
      }
  
      document.getElementById('a11y-status').textContent = '⏳ Running script...';
  
      chrome.runtime.sendMessage({ action: 'runScript', script }, (response) => {
        if (chrome.runtime.lastError) {
          showConsoleResult(' ' + chrome.runtime.lastError.message, 'error');
          document.getElementById('a11y-status').textContent = ' Script failed.';
          return;
        }
        if (!response) {
          showConsoleResult(' No response from background.', 'error');
          document.getElementById('a11y-status').textContent = ' No response.';
          return;
        }
        document.getElementById('a11y-status').textContent = response.status === 'ok' ? ' Script ran.' : ' Script error.';
        showConsoleResult(
          response.status === 'ok' ? ' ' + response.value : ' ' + response.value,
          response.status
        );
      });
    });
  
    // Clear
    document.getElementById('a11y-clear-btn').addEventListener('click', () => {
      document.getElementById('a11y-script-input').value = '';
      const resultBox = document.getElementById('a11y-console-result');
      resultBox.style.display = 'none';
      resultBox.textContent = '';
    });
  
    
  
    // Enter to run script
    document.getElementById('a11y-script-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('a11y-run-btn').click();
      }
    });
  
  


  
    
  }
  
  
  
  
  
  function showConsoleResult(message, type) {
    const resultBox = document.getElementById('a11y-console-result');
    if (!resultBox) return;
    resultBox.textContent = message;
    resultBox.style.display = 'block';
    resultBox.style.borderLeft = type === 'ok' ? '3px solid #4caf50' : '3px solid #f44336';
    resultBox.style.color = type === 'ok' ? '#d4d4d4' : '#ff6b6b';
  
    
  }
  
  //  Extraction 
  
  function extractInteractiveContext(html, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
  
    ['script', 'style', 'noscript', 'svg'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });
  
    function getSelector(el) {
      if (el.id) return '#' + el.id;
      if (el.getAttribute('name')) return '[name="' + el.getAttribute('name') + '"]';
      const path = [];
      let current = el;
      while (current && current !== doc.body) {
        let segment = current.tagName.toLowerCase();
        if (current.id) {
          path.unshift('#' + current.id);
          break;
        }
        const siblings = [...(current.parentNode?.children ?? [])].filter(
          s => s.tagName === current.tagName
        );
        if (siblings.length > 1) {
          segment += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
        path.unshift(segment);
        current = current.parentNode;
      }
      return path.join(' > ');
    }
  
    function getLabel(el) {
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
      if (el.getAttribute('placeholder')) return el.getAttribute('placeholder');
      if (el.getAttribute('title')) return el.getAttribute('title');
      if (el.id) {
        const label = doc.querySelector('label[for="' + el.id + '"]');
        if (label) return label.textContent.trim();
      }
      if (el.closest('label')) return el.closest('label').textContent.trim();
      if (el.tagName === 'A') {
        const text = el.innerText?.trim() || el.textContent?.trim();
        if (text) return text.slice(0, 80);
        const img = el.querySelector('img');
        if (img?.getAttribute('alt')) return img.getAttribute('alt');
        const href = el.getAttribute('href');
        if (href) return href.slice(0, 80);
      }
      if (el.textContent.trim()) return el.textContent.trim().slice(0, 80);
      if (el.getAttribute('value')) return el.getAttribute('value');
      return null;
    }
  
    function resolveUrl(href) {
      if (!href) return null;
      try { return new URL(href, url).href; }
      catch (e) { return href; }
    }
  
    const context = {
      url,
      title: doc.title,
      sections: [],
      interactive: [],
      forms: [],
      inlineLinks: [],
    };
  
    doc.querySelectorAll('h1, h2, h3, h4, main, article, section, header').forEach(el => {
      const text = el.textContent.trim().slice(0, 120);
      if (text) {
        context.sections.push({
          tag: el.tagName.toLowerCase(),
          text,
          selector: getSelector(el),
        });
      }
    });
  
    doc.querySelectorAll('a[href]').forEach(el => {
      const parent = el.parentElement;
      if (!parent) return;
      const tag = parent.tagName.toLowerCase();
      const isInlineContext = ['p', 'li', 'td', 'th', 'span', 'div', 'article',
                               'section', 'blockquote', 'dd', 'dt'].includes(tag);
      const href = el.getAttribute('href');
      const linkText = el.innerText?.trim() || el.textContent?.trim();
      const resolvedHref = resolveUrl(href);
      const surroundingText = parent.innerText?.trim().slice(0, 150) ||
                              parent.textContent?.trim().slice(0, 150);
      if (isInlineContext && linkText && href) {
        context.inlineLinks.push({
          text: linkText.slice(0, 80),
          href: resolvedHref,
          selector: getSelector(el),
          context: surroundingText,
        });
      }
    });
  
    const interactiveSelectors = [
      'button', 'a[href]', 'input', 'textarea', 'select',
      '[role="button"]', '[role="tab"]', '[role="menuitem"]',
      '[role="checkbox"]', '[role="switch"]', '[onclick]', '[tabindex]',
    ];
  
    doc.querySelectorAll(interactiveSelectors.join(',')).forEach(el => {
      const label = getLabel(el);
      if (!label) return;
      const item = {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') ?? el.getAttribute('role') ?? null,
        label,
        selector: getSelector(el),
      };
      if (el.tagName === 'SELECT') {
        item.options = [...el.options].map(o => ({ value: o.value, text: o.text }));
      }
      if (el.tagName === 'INPUT') {
        item.inputType = el.getAttribute('type') ?? 'text';
        if (el.getAttribute('value')) item.currentValue = el.getAttribute('value');
      }
      if (el.tagName === 'A') {
        item.href = resolveUrl(el.getAttribute('href'));
      }
      context.interactive.push(item);
    });
  
    doc.querySelectorAll('form').forEach(form => {
      const fields = [];
      form.querySelectorAll('input, textarea, select, button').forEach(el => {
        fields.push({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') ?? null,
          name: el.getAttribute('name') ?? null,
          label: getLabel(el),
          selector: getSelector(el),
          required: el.hasAttribute('required'),
        });
      });
      context.forms.push({
        selector: getSelector(form),
        action: form.getAttribute('action') ?? null,
        method: form.getAttribute('method') ?? 'get',
        fields,
      });
    });
  
    return context;
  }
  
  function formatContextForModel(context) {
    const sections = context.sections
      .map(s => '[' + s.tag + '] "' + s.text + '" → ' + s.selector)
      .join('\n');
  
    const interactive = context.interactive
      .map(el => {
        const type = el.type ? '[' + el.type + ']' : '';
        let line = '[' + el.tag + type + '] "' + el.label + '" → ' + el.selector;
        if (el.options) line += '\n  options: ' + el.options.map(o => '"' + o.text + '" (' + o.value + ')').join(', ');
        if (el.href) line += ' (href: ' + el.href + ')';
        return line;
      })
      .join('\n');
  
    const inlineLinks = context.inlineLinks
      .map(link => {
        return '"' + link.text + '" → ' + link.href + '\n' +
               '  selector: ' + link.selector + '\n' +
               '  context: "' + link.context + '"';
      })
      .join('\n\n');
  
    const forms = context.forms
      .map(f => {
        const fields = f.fields
          .map(field => {
            const type = field.type ? '[' + field.type + ']' : '';
            const label = field.label ?? field.name ?? 'unlabeled';
            const req = field.required ? ' (required)' : '';
            return '  [' + field.tag + type + '] "' + label + '" → ' + field.selector + req;
          })
          .join('\n');
        return 'Form → ' + f.selector + ' (action: ' + f.action + ', method: ' + f.method + ')\n' + fields;
      })
      .join('\n\n');
  
    return (
      'PAGE CONTEXT\n' +
      '============\n' +
      'URL: ' + context.url + '\n' +
      'Title: ' + context.title + '\n\n' +
      'PAGE SECTIONS\n' +
      '-\n' +
      sections + '\n\n' +
      'INTERACTIVE ELEMENTS\n' +
      '\n' +
      interactive + '\n\n' +
      'INLINE LINKS\n' +
      '\n' +
      inlineLinks + '\n\n' +
      'FORMS\n' +
      '-\n' +
      forms
    );
  }
  
  function chunkText(text, maxChars = 12000) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      let end = i + maxChars;
      if (end < text.length) {
        const breakPoint = text.lastIndexOf('\n', end);
        if (breakPoint > i) end = breakPoint;
      }
      chunks.push(text.slice(i, end).trim());
      i = end;
    }
    return chunks;
  }
  
  // Keyboard shortcut 
  
  document.addEventListener('keydown', (e) => {
    if ( e.shiftKey && e.key === ' ') {
      const existing = document.getElementById('a11y-assistant-panel');
      const panel = existing || createPanel();
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        setTimeout(() => document.getElementById('a11y-extract-btn')?.focus(), 50);
      }
    }
  });
  
  // Auto-inject on page load 
  
  window.addEventListener('load', () => {
    createPanel();
    const panel = document.getElementById('a11y-assistant-panel');
    if (panel) panel.style.display = 'block';
    setTimeout(() => document.getElementById('a11y-extract-btn')?.focus(), 50);
  });