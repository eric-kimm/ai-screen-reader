chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed!');
  });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'runScript') {
      const tabId = sender.tab?.id;
  
      if (!tabId) {
        sendResponse({ status: 'error', value: 'Could not determine tab ID.' });
        return true;
      }
  
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',  // bypasses page CSP
        func: (script) => {
          try {
            const fn = new Function(script);
            const result = fn();
  
            if (result === undefined) return { status: 'ok', value: 'Done (no return value)' };
            if (result === null) return { status: 'ok', value: 'null' };
            if (typeof result === 'object') {
              try { return { status: 'ok', value: JSON.stringify(result, null, 2) }; }
              catch (e) { return { status: 'ok', value: result.toString() }; }
            }
            return { status: 'ok', value: String(result) };
          } catch (err) {
            return { status: 'error', value: err.message };
          }
        },
        args: [message.script],
      }).then(results => {
        const res = results?.[0]?.result;
        sendResponse(res ?? { status: 'error', value: 'No result returned.' });
      }).catch(err => {
        sendResponse({ status: 'error', value: err.message });
      });
  
      return true; // keep message channel open for async response
    }
  });
  