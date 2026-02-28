// essential inforamation only
function cleanHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
  
    // Remove useless elements entirely
    const noiseSelectors = [
      'script', 'style', 'noscript', 'iframe',
      'svg', 'canvas', 'video', 'audio',
      'link', 'meta', 'head',
      '[aria-hidden="true"]',
    ];
    noiseSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });
  
    // keep only important interactables
    const keepAttrs = ['href', 'src', 'alt', 'title', 'aria-label', 'type', 'name', 'id', 'role'];
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (!keepAttrs.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }
    });
  
    return doc.body.innerHTML
      .replace(/\s+/g, ' ')        // no whitespace
      .replace(/>\s+</g, '><')     // no whitespace between tags
      .trim();
  }
  
  // get useful text and information from page
  function extractSemantic(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
  
    
    ['script', 'style', 'noscript', 'nav', 'footer', 'iframe', 'svg'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });
  
    
    function walk(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        return text ? text + ' ' : '';
      }
  
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
  
      const tag = node.tagName.toLowerCase();
      const meaningfulTags = {
        h1: '# ', h2: '## ', h3: '### ', h4: '#### ',
        p: '\n', li: '- ', a: '', button: '[BTN] ',
        label: '[LABEL] ', input: '[INPUT] ', textarea: '[TEXTAREA] ',
        th: '[TH] ', td: '[TD] ', caption: '[CAPTION] ',
        blockquote: '> ', code: '`', pre: '```\n',
      };
  
      const prefix = meaningfulTags[tag] ?? '';
      const children = [...node.childNodes].map(n => walk(n, depth + 1)).join('');
      const href = tag === 'a' ? ` (${node.getAttribute('href')})` : '';
      const alt = node.getAttribute('alt') ? ` [${node.getAttribute('alt')}]` : '';
  
      return prefix + children + href + alt;
    }
  
    return walk(doc.body)
      .replace(/\n{3,}/g, '\n\n')  // 
      .replace(/  +/g, ' ')        // 
      .trim();
  }
  
  // chunking
  function chunkText(text, maxChars = 12000) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      //break at a newline
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
  
 
  
  