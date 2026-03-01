const micPermissionButton = document.getElementById('mic-permission-btn');
const micStatus = document.getElementById('mic-status');
const targetTabStatus = document.getElementById('target-tab-status');

async function getTargetTab() {
  const response = await chrome.runtime.sendMessage({ action: 'getTargetTab' });
  if (!response || response.status !== 'ok' || !response.tab) {
    throw new Error(response?.value || 'No supported browser tab is currently available.');
  }
  return response.tab;
}

async function refreshTargetTabStatus() {
  if (!targetTabStatus) return;

  try {
    const tab = await getTargetTab();
    targetTabStatus.textContent = 'Connected to: ' + (tab.title || tab.url || 'Current tab');
  } catch (error) {
    targetTabStatus.textContent = error.message;
  }
}

if (micPermissionButton && micStatus) {
  micPermissionButton.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      micStatus.textContent = 'Microphone permission granted in extension context.';
    } catch (error) {
      micStatus.textContent = 'Microphone permission failed: ' + error.message;
    }
  });
}

refreshTargetTabStatus();

document.getElementById('action-btn').addEventListener('click', async () => {
    const tab = await getTargetTab();
    const output = document.getElementById('output');
    const status = document.getElementById('status');
  
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      status.textContent = 'Cannot access this page type.';
      return;
    }
  
    let rawHTML = null;
    let source = null;
  
    // Content script (live DOM)
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'getPageSource' }, (res) => {
          if (chrome.runtime.lastError || !res) reject(chrome.runtime.lastError);
          else resolve(res);
        });
      });
  
      // If page isn't fully loaded yet, wait and retry once
      if (response.readyState !== 'complete') {
        status.textContent = '⏳ Page still loading, retrying...';
        await new Promise(r => setTimeout(r, 2000));
        const retry = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, { action: 'getPageSource' }, (res) => {
            if (chrome.runtime.lastError || !res) reject(chrome.runtime.lastError);
            else resolve(res);
          });
        });
        rawHTML = retry.html;
      } else {
        rawHTML = response.html;
      }
  
      source = 'content script (live DOM)';
    } catch (e) {
      status.textContent = 'Content script unavailable, trying injection...';
    }
  
    // Programmatic injection (live DOM
    if (!rawHTML) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => ({
            html: document.documentElement.outerHTML,
            readyState: document.readyState,
          }),
        });
  
        const data = results?.[0]?.result;
        if (data) {
          //full load if needed
          if (data.readyState !== 'complete') {
            status.textContent = '⏳ Page still loading, retrying...';
            await new Promise(r => setTimeout(r, 2000));
            const retry = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => document.documentElement.outerHTML,
            });
            rawHTML = retry?.[0]?.result;
          } else {
            rawHTML = data.html;
          }
          source = 'script injection (live DOM)';
        }
      } catch (e) {
        status.textContent = 'Injection failed, trying fetch...';
      }
    }
  
    // Fetch 
    if (!rawHTML) {
      try {
        const res = await fetch(tab.url);
        rawHTML = await res.text();
        source = 'fetch (⚠️ static HTML only — JS-rendered content may be missing)';
      } catch (e) {
        status.textContent = 'All methods failed.';
        output.textContent = 'Could not access: ' + tab.url + '\n' + e.message;
        return;
      }
    }
  
    // --- Detect frameset and process accordingly ---
    const parsedDoc = new DOMParser().parseFromString(rawHTML, 'text/html');
    const frames = parsedDoc.querySelectorAll('frame, frameset');
  
    let context;
    if (frames.length > 0) {
      status.textContent += ' | Frameset detected, fetching frames...';
      const frameText = await extractFromFrames(frames, tab.url);
      context = {
        url: tab.url,
        title: parsedDoc.title,
        sections: [],
        interactive: [],
        forms: [],
        frameText,
      };
    } else {
      context = extractInteractiveContext(rawHTML, tab.url);
    }
  
    const formatted = formatContextForModel(context);
    const chunks = chunkText(formatted, 12000);
  
    status.textContent = 'Got source via ' + source + ' | ' + formatted.length + ' chars | ' + chunks.length + ' chunk(s)';
    output.textContent = formatted;
  });
  
  
  
  async function extractFromFrames(frames, baseUrl) {
    const results = [];
    const seen = new Set();
  
    for (const frame of frames) {
      if (frame.tagName.toLowerCase() === 'frameset') continue;
  
      const src = frame.getAttribute('src');
      if (!src || src.startsWith('javascript:')) continue;
  
      try {
        const url = new URL(src, baseUrl).href;
        if (seen.has(url)) continue;
        seen.add(url);
  
        const res = await fetch(url);
        const html = await res.text();
  
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
  
        const nestedFrames = doc.querySelectorAll('frame, frameset');
        if (nestedFrames.length > 0) {
          const nested = await extractFromFrames(nestedFrames, url);
          results.push('=== FRAME: ' + src + ' (nested) ===\n' + nested);
          continue;
        }
  
        ['script', 'style', 'noscript', 'nav', 'footer', 'iframe', 'svg'].forEach(tag => {
          doc.querySelectorAll(tag).forEach(el => el.remove());
        });
  
        const text = doc.body?.innerText?.replace(/\s+/g, ' ').trim();
        if (text) results.push('=== FRAME: ' + src + ' ===\n' + text);
  
      } catch (e) {
        results.push('=== FRAME: ' + src + ' === (could not fetch: ' + e.message + ')');
      }
    }
  
    return results.join('\n\n') || 'No frame content could be retrieved.';
  }
  
  // 
  
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
  
    // 
    function resolveUrl(href) {
      if (!href) return null;
      try {
        return new URL(href, url).href;
      } catch (e) {
        return href;
      }
    }
  
    const context = {
      url,
      title: doc.title,
      sections: [],
      interactive: [],
      forms: [],
      inlineLinks: [],  
    };
  
    // Page sections
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
  
    // Inline link extraction DOESNT FULLY WORK
    doc.querySelectorAll('a[href]').forEach(el => {
      const parent = el.parentElement;
      if (!parent) return;
  
      const tag = parent.tagName.toLowerCase();
      const isInlineContext = ['p', 'li', 'td', 'th', 'span', 'div', 'article', 
                               'section', 'blockquote', 'dd', 'dt'].includes(tag);
  
      const href = el.getAttribute('href');
      const linkText = el.innerText?.trim() || el.textContent?.trim();
      const resolvedHref = resolveUrl(href);
  
      // Get surrounding text for context
      const surroundingText = parent.innerText?.trim().slice(0, 150) || 
                              parent.textContent?.trim().slice(0, 150);
  
      if (isInlineContext && linkText && href) {
        context.inlineLinks.push({
          text: linkText.slice(0, 80),
          href: resolvedHref,
          selector: getSelector(el),
          context: surroundingText,  // the text its found in
        });
      }
    });
  
    // Interactive elements
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[onclick]',
      '[tabindex]',
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
  
  // Format for model use
  function formatContextForModel(context) {
    if (context.frameText) {
      return (
        'PAGE CONTEXT\n' +
        '============\n' +
        'URL: ' + context.url + '\n' +
        'Title: ' + context.title + '\n\n' +
        'FRAME CONTENT\n' +
        '-------------\n' +
        context.frameText
      );
    }
  
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
  
    //inline links FIX THIS
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
      '-------------\n' +
      sections + '\n\n' +
      'INTERACTIVE ELEMENTS\n' +
      '--------------------\n' +
      interactive + '\n\n' +
      'INLINE LINKS\n' +
      '------------\n' +
      inlineLinks + '\n\n' +
      'FORMS\n' +
      '-----\n' +
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

  //  Console script tester
  // need to implement this to be automated
  document.getElementById('run-btn').addEventListener('click', async () => {
    const scriptInput = document.getElementById('script-input').value.trim();
  
    if (!scriptInput) {
      showResult('No script provided.', 'error');
      return;
    }

    try {
      const tab = await getTargetTab();
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        showResult('Cannot run scripts on this page type.', 'error');
        return;
      }

      const res = await chrome.runtime.sendMessage({
        action: 'runScript',
        script: scriptInput,
        tabId: tab.id,
      });

      if (!res) {
        showResult('No result returned.', 'error');
        return;
      }
  
      showResult(
        res.status === 'ok'
          ? '' + res.value
          : ' Error: ' + res.value,
        res.status
      );
  
    } catch (e) {
      showResult('' + e.message, 'error');
    }
  });
