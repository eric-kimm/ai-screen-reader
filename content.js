chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPageSource') {
      // This is the live DOM, not static HTML
      sendResponse({ 
        html: document.documentElement.outerHTML,
        readyState: document.readyState,
      });
    }
    return true;
  });