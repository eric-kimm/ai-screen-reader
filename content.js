const VOICE_COMMAND_MAX_CONTEXT_CHARS = 10000;
const VOICE_COMMAND_CHUNK_SEPARATOR = '\n\n=== CHUNK BREAK ===\n\n';

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

function runScriptFromInput() {
  const script = document.getElementById('a11y-script-input').value.trim();

  if (!script) {
    showConsoleResult('No script provided.', 'error');
    return;
  }

  document.getElementById('a11y-status').textContent = 'Running script...';

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
  document.getElementById('a11y-run-btn').addEventListener('click', runScriptFromInput);

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
  const context = extractInteractiveContext(document.documentElement.outerHTML, window.location.href);
  const formattedContext = formatContextForModel(context, { includeLinks: false });
  const chunks = chunkText(formattedContext, VOICE_COMMAND_MAX_CONTEXT_CHARS);
  const joinedContext = chunks.join(VOICE_COMMAND_CHUNK_SEPARATOR).slice(0, VOICE_COMMAND_MAX_CONTEXT_CHARS);
  status.textContent = '💬 "' + userInput + '"';
  status.textContent = '⏳ Processing voice command...';

  console.log('Sending voice command request', {
    userInput,
    chunkCount: chunks.length,
    contextChars: joinedContext.length,
  });
  fetch('http://127.0.0.1:8000/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: userInput,
      html: joinedContext,
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
        console.log(scriptInput.value)
        if (script) {
          showConsoleResult(confirmation, 'ok');
          runScriptFromInput();
        } else {
          status.textContent = confirmation;
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
      // Include up to 3 classes in the selector path for specificity
      const classes = [...current.classList].slice(0, 3);
      if (classes.length > 0) {
        segment += '.' + classes.join('.');
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
    // aria-label is highest priority
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    // aria-labelledby points to another element's text
    if (el.getAttribute('aria-labelledby')) {
      const labelEl = doc.getElementById(el.getAttribute('aria-labelledby'));
      if (labelEl) return labelEl.textContent.trim();
    }
    // aria-describedby as fallback description
    if (el.getAttribute('aria-describedby')) {
      const descEl = doc.getElementById(el.getAttribute('aria-describedby'));
      if (descEl) return descEl.textContent.trim();
    }
    if (el.getAttribute('placeholder')) return el.getAttribute('placeholder');
    if (el.getAttribute('title')) return el.getAttribute('title');
    if (el.getAttribute('alt')) return el.getAttribute('alt');
    // Explicit label element
    if (el.id) {
      const label = doc.querySelector('label[for="' + el.id + '"]');
      if (label) return label.textContent.trim();
    }
    // Wrapping label
    if (el.closest('label')) return el.closest('label').textContent.trim();
    // For links and buttons, check for img alt or aria child
    if (el.tagName === 'A' || el.tagName === 'BUTTON') {
      const img = el.querySelector('img[alt]');
      if (img) return img.getAttribute('alt');
      const ariaChild = el.querySelector('[aria-label]');
      if (ariaChild) return ariaChild.getAttribute('aria-label');
    }
    // data-testid and similar are useful for identification even if not visible labels
    if (el.getAttribute('data-testid')) return el.getAttribute('data-testid');
    if (el.getAttribute('data-id')) return el.getAttribute('data-id');
    if (el.getAttribute('data-name')) return el.getAttribute('data-name');
    // Text content
    const text = el.innerText?.trim() || el.textContent?.trim();
    if (text) return text.slice(0, 120);
    if (el.getAttribute('value')) return el.getAttribute('value');
    if (el.getAttribute('name')) return el.getAttribute('name');
    return null;
  }

  // Collect every attribute that could help identify or interact with an element
  function getAllAttributes(el) {
    const attrs = {};
    for (const attr of el.attributes) {
      // Skip style and event handlers (too noisy), keep everything else
      if (attr.name === 'style') continue;
      if (attr.name.startsWith('on')) continue;
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  function resolveUrl(href) {
    if (!href) return null;
    try { return new URL(href, url).href; }
    catch (e) { return href; }
  }

  function extractAllContent(node, depth) {
    if (!node) return '';
    depth = depth || 0;

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.id === 'a11y-assistant-panel') return '';
      if (node.closest && node.closest('#a11y-assistant-panel')) return '';
      const style = node.getAttribute('style') || '';
      if (style.includes('display:none') || style.includes('display: none') ||
        style.includes('visibility:hidden') || style.includes('visibility: hidden')) {
        return '';
      }
      if (node.getAttribute('aria-hidden') === 'true') return '';
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return text || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const skipTags = ['script', 'style', 'noscript', 'svg', 'head'];
    if (skipTags.includes(tag)) return '';

    const children = [...node.childNodes]
      .map(n => extractAllContent(n, depth + 1))
      .filter(Boolean);

    const childText = children.join(' ').replace(/\s+/g, ' ').trim();
    if (!childText) return '';

    switch (tag) {
      case 'h1': return '\n# ' + childText + '\n';
      case 'h2': return '\n## ' + childText + '\n';
      case 'h3': return '\n### ' + childText + '\n';
      case 'h4': case 'h5': case 'h6': return '\n#### ' + childText + '\n';
      case 'p': return '\n' + childText + '\n';
      case 'br': return '\n';
      case 'li': return '\n- ' + childText;
      case 'ul': case 'ol': return '\n' + childText + '\n';
      case 'strong': case 'b': return '**' + childText + '**';
      case 'em': case 'i': return '_' + childText + '_';
      case 'code': return '`' + childText + '`';
      case 'pre': return '\n```\n' + childText + '\n```\n';
      case 'blockquote': return '\n> ' + childText + '\n';
      case 'th': return '[' + childText + ']';
      case 'td': return childText;
      case 'tr': {
        const cells = [...node.children].map(td => td.textContent.trim()).filter(Boolean);
        return '\n| ' + cells.join(' | ') + ' |';
      }
      case 'table': {
        const rows = [...node.querySelectorAll('tr')].map(tr => {
          const cells = [...tr.children].map(td => td.textContent.trim()).filter(Boolean);
          return '| ' + cells.join(' | ') + ' |';
        });
        return '\n' + rows.join('\n') + '\n';
      }
      case 'dt': return '\n**' + childText + '**';
      case 'dd': return '\n  ' + childText;
      case 'dl': return '\n' + childText + '\n';
      case 'label': return '\n[Label: ' + childText + ']';
      case 'caption': return '\n[Caption: ' + childText + ']';
      case 'figcaption': return '\n[Fig: ' + childText + ']';
      case 'time': return childText;
      case 'abbr': return childText + (node.getAttribute('title') ? ' (' + node.getAttribute('title') + ')' : '');
      case 'input': {
        const type = node.getAttribute('type') || 'text';
        if (type === 'hidden') return '';
        const val = node.getAttribute('value') || '';
        const labelText = getLabel(node) || type;
        if (type === 'checkbox' || type === 'radio') {
          const checked = node.hasAttribute('checked') ? '✓' : '○';
          return ' ' + checked + ' ' + labelText;
        }
        return '[Input: ' + labelText + (val ? ' = "' + val + '"' : '') + ']';
      }
      case 'textarea': return '[Textarea: ' + (getLabel(node) || 'textarea') + ']';
      case 'select': {
        const opts = [...node.options].map(o => o.text).join(', ');
        return '[Select: ' + (getLabel(node) || 'select') + ' (' + opts + ')]';
      }
      case 'button': return '[Button: ' + childText + ']';
      case 'a': {
        const href = resolveUrl(node.getAttribute('href'));
        return childText + (href && !href.endsWith('#') ? ' (' + href + ')' : '');
      }
      default: return childText;
    }
  }

  const context = {
    url,
    title: doc.title,
    pageContent: '',
    sections: [],
    interactive: [],
    forms: [],
    inlineLinks: [],
  };

  context.pageContent = extractAllContent(doc.body)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/  +/g, ' ')
    .trim();

  // Sections
  doc.querySelectorAll('h1, h2, h3, h4, main, article, section, header, nav, footer, aside').forEach(el => {
    if (el.closest('#a11y-assistant-panel')) return;
    const text = el.textContent.trim().slice(0, 120);
    if (text) {
      context.sections.push({
        tag: el.tagName.toLowerCase(),
        text,
        selector: getSelector(el),
        id: el.id || null,
        classes: [...el.classList].join(' ') || null,
        role: el.getAttribute('role') || null,
      });
    }
  });

  // Inline links — expanded to all contexts
  doc.querySelectorAll('a[href]').forEach(el => {
    if (el.closest('#a11y-assistant-panel')) return;
    const href = el.getAttribute('href');
    const linkText = el.innerText?.trim() || el.textContent?.trim();
    const resolvedHref = resolveUrl(href);
    const parent = el.parentElement;
    const surroundingText = parent?.innerText?.trim().slice(0, 200) || '';

    if (linkText && href) {
      context.inlineLinks.push({
        text: linkText.slice(0, 120),
        href: resolvedHref,
        selector: getSelector(el),
        id: el.id || null,
        classes: [...el.classList].join(' ') || null,
        allAttributes: getAllAttributes(el),
        surroundingText,
      });
    }
  });

  // Interactive elements — comprehensive selector list
  const interactiveSelectors = [
    'button',
    'a[href]',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="searchbox"]',
    '[role="link"]',
    '[role="treeitem"]',
    '[role="gridcell"]',
    '[role="rowheader"]',
    '[role="columnheader"]',
    '[onclick]',
    '[tabindex]',
    '[contenteditable="true"]',
  ];

  doc.querySelectorAll(interactiveSelectors.join(',')).forEach(el => {
    if (el.closest('#a11y-assistant-panel')) return;

    const label = getLabel(el);
    if (!label) return;

    const allAttrs = getAllAttributes(el);

    const item = {
      tag: el.tagName.toLowerCase(),
      label,
      selector: getSelector(el),
      // Identity attributes
      id: el.id || null,
      name: el.getAttribute('name') || null,
      classes: [...el.classList].join(' ') || null,
      type: el.getAttribute('type') || null,
      role: el.getAttribute('role') || null,
      // All raw attributes for full context
      allAttributes: allAttrs,
    };

    // Tag-specific extras
    if (el.tagName === 'A') {
      item.href = resolveUrl(el.getAttribute('href'));
      item.target = el.getAttribute('target') || null;
      item.rel = el.getAttribute('rel') || null;
      item.download = el.getAttribute('download') || null;
    }

    if (el.tagName === 'INPUT') {
      item.inputType = el.getAttribute('type') || 'text';
      item.placeholder = el.getAttribute('placeholder') || null;
      item.currentValue = el.value || el.getAttribute('value') || null;
      item.checked = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : null;
      item.required = el.hasAttribute('required');
      item.disabled = el.hasAttribute('disabled');
      item.readonly = el.hasAttribute('readonly');
      item.min = el.getAttribute('min') || null;
      item.max = el.getAttribute('max') || null;
      item.step = el.getAttribute('step') || null;
      item.pattern = el.getAttribute('pattern') || null;
      item.maxlength = el.getAttribute('maxlength') || null;
      item.autocomplete = el.getAttribute('autocomplete') || null;
    }

    if (el.tagName === 'TEXTAREA') {
      item.placeholder = el.getAttribute('placeholder') || null;
      item.currentValue = el.value || null;
      item.required = el.hasAttribute('required');
      item.disabled = el.hasAttribute('disabled');
      item.readonly = el.hasAttribute('readonly');
      item.maxlength = el.getAttribute('maxlength') || null;
      item.rows = el.getAttribute('rows') || null;
      item.cols = el.getAttribute('cols') || null;
    }

    if (el.tagName === 'SELECT') {
      item.currentValue = el.value || null;
      item.multiple = el.hasAttribute('multiple');
      item.required = el.hasAttribute('required');
      item.disabled = el.hasAttribute('disabled');
      item.options = [...el.options].map(o => ({
        value: o.value,
        text: o.text.trim(),
        selected: o.selected,
        disabled: o.disabled,
      }));
    }

    if (el.tagName === 'BUTTON') {
      item.buttonType = el.getAttribute('type') || 'button';
      item.disabled = el.hasAttribute('disabled');
      item.form = el.getAttribute('form') || null;
    }

    // Full ARIA state
    item.aria = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('aria-')) {
        item.aria[attr.name] = attr.value;
      }
    }

    // Data attributes
    item.data = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) {
        item.data[attr.name] = attr.value;
      }
    }

    context.interactive.push(item);
  });

  // Forms
  doc.querySelectorAll('form').forEach(form => {
    if (form.closest('#a11y-assistant-panel')) return;
    const fields = [];
    form.querySelectorAll('input, textarea, select, button').forEach(el => {
      if (el.getAttribute('type') === 'hidden') return;
      fields.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || null,
        name: el.getAttribute('name') || null,
        id: el.id || null,
        classes: [...el.classList].join(' ') || null,
        label: getLabel(el),
        selector: getSelector(el),
        placeholder: el.getAttribute('placeholder') || null,
        currentValue: el.value || el.getAttribute('value') || null,
        required: el.hasAttribute('required'),
        disabled: el.hasAttribute('disabled'),
        allAttributes: getAllAttributes(el),
      });
    });

    context.forms.push({
      selector: getSelector(form),
      id: form.id || null,
      name: form.getAttribute('name') || null,
      classes: [...form.classList].join(' ') || null,
      action: form.getAttribute('action') || null,
      method: form.getAttribute('method') || 'get',
      allAttributes: getAllAttributes(form),
      fields,
    });
  });

  return context;
}

function formatContextForModel(context, options) {
  const includeLinks = options?.includeLinks !== false;
  const cleanedPageContent = (context.pageContent || '')
    // .replace(/(?:\(|&lpar;|\[\s*)?(?:https?:\/\/|href\s*=\s*["']?)[^\s"')\]]+(?:["']?)?(?:\)|&rpar;|\s*\])?/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    // .replace(/\[Button:\s*[^\]]+\]/gi, '')
    .replace(/\[\s*\d+\s*\]/g, '')
    .trim();

  function formatElement(el) {
    const lines = [];
    const tagStr = el.role ? el.tag + '[role=' + el.role + ']' : el.type ? el.tag + '[' + el.type + ']' : el.tag;
    lines.push('[' + tagStr + '] "' + el.label + '"');

    if (el.selector) lines.push('  selector:    ' + el.selector);
    if (el.id) lines.push('  id:          ' + el.id);
    if (el.name) lines.push('  name:        ' + el.name);
    if (el.classes) lines.push('  classes:     ' + el.classes);
    if (includeLinks && el.href) lines.push('  href:        ' + el.href);
    if (includeLinks && el.target) lines.push('  target:      ' + el.target);
    if (includeLinks && el.rel) lines.push('  rel:         ' + el.rel);
    if (includeLinks && el.download) lines.push('  download:    ' + el.download);
    if (el.placeholder) lines.push('  placeholder: ' + el.placeholder);
    if (el.currentValue !== null && el.currentValue !== undefined && el.currentValue !== '') {
      lines.push('  value:       "' + el.currentValue + '"');
    }
    if (el.checked !== null && el.checked !== undefined) {
      lines.push('  checked:     ' + el.checked);
    }
    if (el.required) lines.push('  required:    true');
    if (el.disabled) lines.push('  disabled:    true');
    if (el.readonly) lines.push('  readonly:    true');
    if (el.multiple) lines.push('  multiple:    true');
    if (el.buttonType && el.buttonType !== 'button') lines.push('  button-type: ' + el.buttonType);
    if (el.min || el.max) lines.push('  range:       ' + (el.min || '?') + ' to ' + (el.max || '?'));
    if (el.step) lines.push('  step:        ' + el.step);
    if (el.pattern) lines.push('  pattern:     ' + el.pattern);
    if (el.maxlength) lines.push('  maxlength:   ' + el.maxlength);
    if (el.autocomplete) lines.push('  autocomplete: ' + el.autocomplete);
    if (el.rows) lines.push('  rows:        ' + el.rows);
    if (el.form) lines.push('  form:        ' + el.form);

    // ARIA attributes
    if (el.aria && Object.keys(el.aria).length > 0) {
      lines.push('  aria:        ' + Object.entries(el.aria).map(([k, v]) => k + '="' + v + '"').join(' '));
    }

    // Data attributes
    if (el.data && Object.keys(el.data).length > 0) {
      lines.push('  data:        ' + Object.entries(el.data).map(([k, v]) => k + '="' + v + '"').join(' '));
    }

    // All other attributes not already shown
    if (el.allAttributes) {
      const alreadyShown = new Set([
        'id', 'name', 'class', 'type', 'role', 'href', 'target', 'rel',
        'placeholder', 'value', 'checked', 'required', 'disabled', 'readonly',
        'multiple', 'min', 'max', 'step', 'pattern', 'maxlength', 'autocomplete',
        'rows', 'cols', 'form', 'download', 'tabindex',
      ]);
      const extra = Object.entries(el.allAttributes)
        .filter(([k]) => !alreadyShown.has(k) && !k.startsWith('aria-') && !k.startsWith('data-'))
        .filter(([k]) => includeLinks || !['href', 'target', 'rel', 'download'].includes(k))
        .map(([k, v]) => k + '="' + v + '"')
        .join(' ');
      if (extra) lines.push('  other:       ' + extra);
    }

    // Select options
    if (el.options && el.options.length > 0) {
      const opts = el.options
        .map(o => (o.selected ? '▶ ' : '') + '"' + o.text + '"' + (o.value !== o.text ? ' (' + o.value + ')' : '') + (o.disabled ? ' [disabled]' : ''))
        .join(', ');
      lines.push('  options:     ' + opts);
    }

    return lines.join('\n');
  }

  function formatField(field) {
    const tagStr = field.type ? field.tag + '[' + field.type + ']' : field.tag;
    const lines = ['  [' + tagStr + '] "' + (field.label || field.name || 'unlabeled') + '"'];
    if (field.selector) lines.push('    selector:    ' + field.selector);
    if (field.id) lines.push('    id:          ' + field.id);
    if (field.name) lines.push('    name:        ' + field.name);
    if (field.classes) lines.push('    classes:     ' + field.classes);
    if (field.placeholder) lines.push('    placeholder: ' + field.placeholder);
    if (field.currentValue) lines.push('    value:       "' + field.currentValue + '"');
    if (field.required) lines.push('    required:    true');
    if (field.disabled) lines.push('    disabled:    true');
    if (field.allAttributes) {
      const alreadyShown = new Set(['id', 'name', 'class', 'type', 'placeholder', 'value', 'required', 'disabled']);
      const extra = Object.entries(field.allAttributes)
        .filter(([k]) => !alreadyShown.has(k))
        .map(([k, v]) => k + '="' + v + '"')
        .join(' ');
      if (extra) lines.push('    other:       ' + extra);
    }
    return lines.join('\n');
  }

  const sections = context.sections
    .map(s => {
      let line = '[' + s.tag + '] "' + s.text + '"';
      if (s.selector) line += '\n  selector: ' + s.selector;
      if (s.id) line += '\n  id:       ' + s.id;
      if (s.classes) line += '\n  classes:  ' + s.classes;
      if (s.role) line += '\n  role:     ' + s.role;
      return line;
    })
    .join('\n\n');

  const interactive = context.interactive
    .filter(el => !(el.selector || '').includes('a11y-'))
    .map(formatElement)
    .join('\n\n');

  const inlineLinks = includeLinks
    ? context.inlineLinks
      .filter(link => !(link.selector || '').includes('a11y-'))
      .map(link => {
        const lines = ['"' + link.text + '" → ' + link.href];
        if (link.selector) lines.push('  selector:  ' + link.selector);
        if (link.id) lines.push('  id:        ' + link.id);
        if (link.classes) lines.push('  classes:   ' + link.classes);
        if (link.allAttributes) {
          const alreadyShown = new Set(['id', 'class', 'href']);
          const extra = Object.entries(link.allAttributes)
            .filter(([k]) => !alreadyShown.has(k))
            .map(([k, v]) => k + '="' + v + '"')
            .join(' ');
          if (extra) lines.push('  other:     ' + extra);
        }
        if (link.surroundingText) lines.push('  context:   "' + link.surroundingText.slice(0, 150) + '"');
        return lines.join('\n');
      })
      .join('\n\n')
    : '';

  const forms = context.forms
    .filter(f => !(f.selector || '').includes('a11y-'))
    .map(f => {
      const header = ['[form] "' + (f.name || f.id || f.selector) + '"'];
      if (f.selector) header.push('  selector: ' + f.selector);
      if (f.id) header.push('  id:       ' + f.id);
      if (f.name) header.push('  name:     ' + f.name);
      if (f.classes) header.push('  classes:  ' + f.classes);
      if (includeLinks && f.action) header.push('  action:   ' + f.action);
      header.push('  method:   ' + f.method);
      if (f.allAttributes) {
        const alreadyShown = new Set(['id', 'name', 'class', 'action', 'method']);
        const extra = Object.entries(f.allAttributes)
          .filter(([k]) => !alreadyShown.has(k))
          .filter(([k]) => includeLinks || k !== 'action')
          .map(([k, v]) => k + '="' + v + '"')
          .join(' ');
        if (extra) header.push('  other:    ' + extra);
      }
      const fields = f.fields.map(formatField).join('\n');
      return header.join('\n') + '\n' + fields;
    })
    .join('\n\n');

  const parts = [
    'PAGE CONTEXT\n============',
    'Title: ' + context.title,
  ];

  if (includeLinks) parts.splice(1, 0, 'URL: ' + context.url);

  if (cleanedPageContent) parts.push('\nPAGE CONTENT\n------------\n' + cleanedPageContent);
  if (sections) parts.push('\nPAGE SECTIONS\n-------------\n' + sections);
  if (interactive) parts.push('\nINTERACTIVE ELEMENTS\n--------------------\n' + interactive);
  if (inlineLinks) parts.push('\nINLINE LINKS\n------------\n' + inlineLinks);
  if (forms) parts.push('\nFORMS\n-----\n' + forms);

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

    // console.log('=== PAGE CONTEXT EXTRACTED ===');
    // console.log('Chars:', formatted.length, '| Chunks:', chunks.length);
    // chunks.forEach((chunk, i) => {
    //   console.log('--- Chunk ' + (i + 1) + ' of ' + chunks.length + ' ---');
    //   console.log(chunk);
    // });

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
