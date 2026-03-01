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
  
        <!-- Voice input section -->
        <div style="margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            🎤 Voice Command
            <span id="a11y-mic-indicator" style="
              font-size: 11px;
              font-weight: normal;
              color: #aaa;
            ">Press Space to start</span>
          </div>
          <div style="position: relative;">
            <div id="a11y-voice-display" style="
              min-height: 48px;
              background: #f4f4f4;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 8px 36px 8px 8px;
              font-size: 12px;
              color: #333;
              word-break: break-word;
              line-height: 1.5;
            ">Waiting for voice input...</div>
            <div id="a11y-mic-icon" style="
              position: absolute;
              top: 50%;
              right: 8px;
              transform: translateY(-50%);
              font-size: 18px;
              pointer-events: none;
            ">🎤</div>
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
  
    // Close
    document.getElementById('a11y-close-btn').addEventListener('click', () => {
      document.getElementById('a11y-assistant-panel').style.display = 'none';
    });
  
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
  
        status.textContent = 'Extracted | ' + formatted.length + ' chars | ' + chunks.length + ' chunk(s)';
        output.style.display = 'block';
        output.textContent = formatted;
      } catch (e) {
        status.textContent = 'Extraction failed: ' + e.message;
      }
    });
  
    // Run script
    document.getElementById('a11y-run-btn').addEventListener('click', () => {
      const script = document.getElementById('a11y-script-input').value.trim();
  
      if (!script) {
        showConsoleResult('No script provided.', 'error');
        return;
      }
  
      document.getElementById('a11y-status').textContent = '⏳ Running script...';
  
      chrome.runtime.sendMessage({ action: 'runScript', script }, (response) => {
        if (chrome.runtime.lastError) {
          showConsoleResult('' + chrome.runtime.lastError.message, 'error');
          document.getElementById('a11y-status').textContent = 'Script failed.';
          return;
        }
        if (!response) {
          showConsoleResult('No response from background.', 'error');
          document.getElementById('a11y-status').textContent = 'No response.';
          return;
        }
        document.getElementById('a11y-status').textContent = response.status === 'ok' ? 'Script ran.' : 'Script error.';
        showConsoleResult(
          response.status === 'ok' ? '' + response.value : '' + response.value,
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
  
    //  Speech to text 
    setupSpeechToText();
  }
  
  //  Speech to text 
  
  function setupSpeechToText() {
    const voiceDisplay = document.getElementById('a11y-voice-display');
    const micIndicator = document.getElementById('a11y-mic-indicator');
    const micIcon = document.getElementById('a11y-mic-icon');
  
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      micIndicator.textContent = 'Speech recognition not supported';
      return;
    }
  
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
  
    recognition.continuous = true;      // keep listening until we stop it
    recognition.interimResults = true;  // show words as they come in
    recognition.lang = 'en-US';
  
    let isListening = false;
    let finalTranscript = '';
  
    function startListening() {
      isListening = true;
      finalTranscript = '';
      voiceDisplay.textContent = 'Listening...';
      voiceDisplay.style.borderColor = '#f44336';
      voiceDisplay.style.background = '#fff5f5';
      micIndicator.textContent = 'Press Space to stop';
      micIndicator.style.color = '#f44336';
      micIcon.textContent = '🔴';
      document.getElementById('a11y-status').textContent = '🎤 Listening...';
      recognition.start();
    }
  
    function stopListening() {
      isListening = false;
      recognition.stop();
      voiceDisplay.style.borderColor = '#4caf50';
      voiceDisplay.style.background = '#f5fff5';
      micIndicator.textContent = 'Press Space to start';
      micIndicator.style.color = '#aaa';
      micIcon.textContent = '🎤';
      document.getElementById('a11y-status').textContent = ' Voice input captured.';
    }
  
    recognition.onresult = (e) => {
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      // Show interim in grey, final in black
      voiceDisplay.innerHTML =
        '<span style="color:#333">' + finalTranscript + '</span>' +
        '<span style="color:#aaa">' + interim + '</span>';
    };
  
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        micIndicator.textContent = 'Microphone permission denied';
        micIndicator.style.color = '#f44336';
      } else if (e.error !== 'aborted') {
        document.getElementById('a11y-status').textContent = ' Mic error: ' + e.error;
      }
      isListening = false;
      micIcon.textContent = '🎤';
      micIndicator.style.color = '#aaa';
      micIndicator.textContent = 'Press Space to start';
    };
  
    recognition.onend = () => {
      console.log('Speech recognition ended', {
        isListening,
        finalTranscript,
      });

      // If we stopped intentionally, fire the callback with final text
      if (!isListening && finalTranscript.trim()) {
        onVoiceInputComplete(finalTranscript.trim());
      }
    };
  
    // Spacebar toggles listening — but only when not typing in a text field
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'textarea' || tag === 'input' || document.activeElement?.isContentEditable;
  
      if (e.code === 'Space' && !isTyping) {
        e.preventDefault();
        if (isListening) {
          stopListening();
        } else {
          startListening();
        }
      }
    });
  }
  
  //  Voice input callback
  
  function onVoiceInputComplete(userInput) {
    console.log('Voice input received:', userInput);
    const status = document.getElementById('a11y-status');
    const scriptInput = document.getElementById('a11y-script-input');
    status.textContent = '💬 "' + userInput + '"';
    status.textContent = '⏳ Processing voice command...';

    console.log('Sending voice command request', { userInput });
    fetch('http://127.0.0.1:8000/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: userInput,
        html: document.documentElement.outerHTML,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('API request failed with status ' + response.status);
        }
        return response.json(); 
      })
      .then((data) => {
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid API response.');
        }
        console.log("Data Intent:", data.intent)

        if (data.intent === 'question') {
          const answer = data.answer || 'No answer returned.';
          status.textContent = answer;
          showConsoleResult(answer, 'ok');
          scriptInput.value = '';
          return;
        }

        if (data.intent === 'command') {
          const script = data.script || '';
          const confirmation = data.confirmation || 'Command ready.';

          scriptInput.value = script;
          status.textContent = confirmation;

          if (script) {
            showConsoleResult(confirmation, 'ok');
          } else {
            showConsoleResult(confirmation || 'No script returned.', 'error');
          }
          return;
        }

        throw new Error('Unsupported intent.');
      })
      .catch((error) => {
        status.textContent = 'Voice command failed.';
        showConsoleResult(error.message, 'error');
      });
  }
  
  //  Utility functions 
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
  
    // Walk the entire DOM tree and extract all readable text with structure
    function extractAllContent(node, depth) {
      if (!node) return '';
      depth = depth || 0;
  
      // Skip hidden elements
      if (node.nodeType === Node.ELEMENT_NODE) {
        const style = node.getAttribute('style') || '';
        if (style.includes('display:none') || style.includes('display: none') ||
            style.includes('visibility:hidden') || style.includes('visibility: hidden')) {
          return '';
        }
        const ariaHidden = node.getAttribute('aria-hidden');
        if (ariaHidden === 'true') return '';
      }
  
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        return text ? text : '';
      }
  
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
  
      const tag = node.tagName.toLowerCase();
  
      // Skip these entirely
      const skipTags = ['script', 'style', 'noscript', 'svg', 'head'];
      if (skipTags.includes(tag)) return '';
  
      const children = [...node.childNodes]
        .map(n => extractAllContent(n, depth + 1))
        .filter(Boolean);
  
      const childText = children.join(' ').replace(/\s+/g, ' ').trim();
      if (!childText) return '';
  
      // Format based on tag type
      switch (tag) {
        case 'h1': return '\n# ' + childText + '\n';
        case 'h2': return '\n## ' + childText + '\n';
        case 'h3': return '\n### ' + childText + '\n';
        case 'h4':
        case 'h5':
        case 'h6': return '\n#### ' + childText + '\n';
  
        case 'p': return '\n' + childText + '\n';
        case 'br': return '\n';
  
        case 'li': return '\n- ' + childText;
        case 'ul':
        case 'ol': return '\n' + childText + '\n';
  
        case 'strong':
        case 'b': return '**' + childText + '**';
  
        case 'em':
        case 'i': return '_' + childText + '_';
  
        case 'code': return '`' + childText + '`';
        case 'pre': return '\n```\n' + childText + '\n```\n';
  
        case 'blockquote': return '\n> ' + childText + '\n';
  
        // Tables — preserve structure
        case 'th': return '[' + childText + ']';
        case 'td': return childText;
        case 'tr': {
          const cells = [...node.children].map(td => {
            const t = td.textContent.trim();
            return t;
          }).filter(Boolean);
          return '\n| ' + cells.join(' | ') + ' |';
        }
        case 'table': {
          const rows = [...node.querySelectorAll('tr')].map(tr => {
            const cells = [...tr.children].map(td => td.textContent.trim()).filter(Boolean);
            return '| ' + cells.join(' | ') + ' |';
          });
          return '\n' + rows.join('\n') + '\n';
        }
  
        // Spans and divs — pass through but keep text
        case 'span':
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'aside':
        case 'header':
        case 'footer': return childText;
  
        // Definition lists
        case 'dt': return '\n**' + childText + '**';
        case 'dd': return '\n  ' + childText;
        case 'dl': return '\n' + childText + '\n';
  
        // Labels and data elements
        case 'label': return '\n[Label: ' + childText + ']';
        case 'caption': return '\n[Caption: ' + childText + ']';
        case 'figcaption': return '\n[Fig: ' + childText + ']';
        case 'time': return childText;
        case 'abbr': return childText + (node.getAttribute('title') ? ' (' + node.getAttribute('title') + ')' : '');
  
        // Form elements — show their current value/state
        case 'input': {
          const type = node.getAttribute('type') || 'text';
          const val = node.getAttribute('value') || '';
          const placeholder = node.getAttribute('placeholder') || '';
          const labelText = getLabel(node) || placeholder || type;
          if (type === 'hidden') return '';
          if (type === 'checkbox' || type === 'radio') {
            const checked = node.hasAttribute('checked') ? '✓' : '○';
            return ' ' + checked + ' ' + labelText;
          }
          return '[Input: ' + labelText + (val ? ' = "' + val + '"' : '') + ']';
        }
        case 'textarea': {
          const labelText = getLabel(node) || 'textarea';
          return '[Textarea: ' + labelText + ']';
        }
        case 'select': {
          const labelText = getLabel(node) || 'select';
          const opts = [...node.options].map(o => o.text).join(', ');
          return '[Select: ' + labelText + ' (' + opts + ')]';
        }
        case 'button': return '[Button: ' + childText + ']';
        case 'a': {
          const href = resolveUrl(node.getAttribute('href'));
          return childText + (href ? ' (' + href + ')' : '');
        }
  
        default: return childText;
      }
    }
  
    const context = {
      url,
      title: doc.title,
      sections: [],
      interactive: [],
      forms: [],
      inlineLinks: [],
      pageContent: '',   // 👈 new — full readable content
    };
  
    // Full content extraction
    context.pageContent = extractAllContent(doc.body)
      .replace(/\n{3,}/g, '\n\n')
      .replace(/  +/g, ' ')
      .trim();
  
    // Sections
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
  
    // Inline links
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
  
    // Interactive elements
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
  
    // Forms
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

    // Universal noise filters
  
    const isUselessHref = (href) => {
      if (!href) return true;
      if (href.endsWith('#')) return true;
      if (href.includes('grades#')) return true;
      if (href.startsWith('javascript:')) return true;
      return false;
    };
  
    const isUselessElement = (el) => {
      // Skip presentation/decorative elements
      if (el.type === 'presentation') return true;
      // Skip elements whose label is just a number or single character
      if (/^[\d\s]$/.test(el.label?.trim())) return true;
      // Skip span wrappers that aren't real controls
      if (el.tag === 'span' && !['button', 'checkbox', 'radio', 'switch', 'tab'].includes(el.type)) return true;
      // Skip extension's own elements
      if ((el.selector || '').includes('a11y-')) return true;
      return false;
    };
  
    // Deduplicate — if an element appears in both interactive and inlineLinks, keep only interactive
    const interactiveSelectors = new Set(context.interactive.map(el => el.selector));
  
    // Format interactive elements more concisely ---
    const interactive = context.interactive
      .filter(el => !isUselessElement(el))
      .map(el => {
        // Simplify tag display — only show type if it adds information
        const meaningfulTypes = ['checkbox', 'radio', 'submit', 'password', 'email', 'number', 'file', 'tab', 'switch'];
        const showType = el.type && meaningfulTypes.includes(el.type);
        const tagStr = showType ? el.tag + '[' + el.type + ']' : el.tag;
  
        let line = '[' + tagStr + '] "' + el.label + '" → ' + el.selector;
  
        // Only show href if it's meaningful
        if (el.href && !isUselessHref(el.href)) {
          line += ' → ' + el.href;
        }
  
        // Options for selects
        if (el.options && el.options.length > 0) {
          line += '\n  options: ' + el.options.map(o => o.text).join(', ');
        }
  
        // Current value if set
        if (el.currentValue) {
          line += '\n  value: "' + el.currentValue + '"';
        }
  
        return line;
      })
      .join('\n');
  
    // Format inline links concisely, skip duplicates and useless hrefs ---
    const inlineLinks = context.inlineLinks
      .filter(link => !interactiveSelectors.has(link.selector))
      .filter(link => !isUselessHref(link.href))
      .filter(link => link.text && link.text.length > 1)
      .map(link => '"' + link.text + '" → ' + link.href)
      .join('\n');
  
    // Format forms, skip hidden/template ones ---
    const forms = context.forms
      .filter(f => {
        // Skip forms with no visible fields
        const visibleFields = f.fields.filter(field =>
          field.type !== 'hidden' && !isUselessElement(field)
        );
        return visibleFields.length > 0;
      })
      .map(f => {
        const fields = f.fields
          .filter(field => field.type !== 'hidden' && !isUselessElement(field))
          .map(field => {
            const meaningfulTypes = ['checkbox', 'radio', 'submit', 'password', 'email', 'number', 'file'];
            const showType = field.type && meaningfulTypes.includes(field.type);
            const tagStr = showType ? field.tag + '[' + field.type + ']' : field.tag;
            const label = field.label ?? field.name ?? 'unlabeled';
            const req = field.required ? ' *' : '';
            return '  [' + tagStr + '] "' + label + '" → ' + field.selector + req;
          })
          .join('\n');
        const action = f.action ? ' → ' + f.action : '';
        return '[form] ' + f.selector + action + '\n' + fields;
      })
      .join('\n\n');
  
    // Page sections (keep as-is, already clean) ---
    const sections = context.sections
      .map(s => '[' + s.tag + '] "' + s.text + '" → ' + s.selector)
      .join('\n');
  
    // Assemble, skip empty sections ---
    const parts = [
      'PAGE CONTEXT\n============',
      'URL: ' + context.url,
      'Title: ' + context.title,
    ];
  
    if (context.pageContent) {
      parts.push('\nPAGE CONTENT\n------------\n' + context.pageContent);
    }
    if (sections) {
      parts.push('\nPAGE SECTIONS\n-------------\n' + sections);
    }
    if (interactive) {
      parts.push('\nINTERACTIVE ELEMENTS\n--------------------\n' + interactive);
    }
    if (inlineLinks) {
      parts.push('\nINLINE LINKS\n------------\n' + inlineLinks);
    }
    if (forms) {
      parts.push('\nFORMS\n-----\n' + forms);
    }
  
    return parts.join('\n');
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
  
  //  Keyboard shortcut to toggle panel 
  
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'z') {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'textarea' || tag === 'input' || document.activeElement?.isContentEditable;
      if (isTyping) return; // don't toggle panel if typing
  
      const existing = document.getElementById('a11y-assistant-panel');
      const panel = existing || createPanel();
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        setTimeout(() => document.getElementById('a11y-extract-btn')?.focus(), 50);
      }
    }
  });
  
  //  Auto-inject on page load 
  
  window.addEventListener('load', () => {
    createPanel();
  
    const panel = document.getElementById('a11y-assistant-panel');
    if (panel) panel.style.display = 'block';
  
    try {
      const rawHTML = document.documentElement.outerHTML;
      const context = extractInteractiveContext(rawHTML, window.location.href);
      const formatted = formatContextForModel(context);
      const chunks = chunkText(formatted, 12000);
  
      console.log('=== PAGE CONTEXT EXTRACTED ===');
      console.log('Chars:', formatted.length, '| Chunks:', chunks.length);
      chunks.forEach((chunk, i) => {
        console.log('--- Chunk ' + (i + 1) + ' of ' + chunks.length + ' ---');
        console.log(chunk);
      });
  
      const output = document.getElementById('a11y-output');
      const status = document.getElementById('a11y-status');
      if (output) {
        output.style.display = 'block';
        output.textContent = formatted;
      }
      if (status) {
        status.textContent = 'Auto-extracted | ' + formatted.length + ' chars | ' + chunks.length + ' chunk(s)';
      }
  
    } catch (e) {
      console.error('Auto-extraction failed:', e.message);
      const status = document.getElementById('a11y-status');
      if (status) status.textContent = 'Auto-extraction failed: ' + e.message;
    }
  
    setTimeout(() => document.getElementById('a11y-extract-btn')?.focus(), 50);
  });
