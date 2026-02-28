chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed!');
  });
  
  // Listen for messages from content scripts or popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received:', message);
    sendResponse({ status: 'ok' });
  });