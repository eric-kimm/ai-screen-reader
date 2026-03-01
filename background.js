chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed!');
});

let assistantWindowId = null;
let lastSiteTabId = null;

function isSupportedPage(tab) {
  return Boolean(
    tab?.id &&
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://')
  );
}

async function rememberSiteTab(tabId) {
  if (!tabId) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (isSupportedPage(tab)) {
      lastSiteTabId = tab.id;
    }
  } catch (error) {
    console.warn('Could not track active site tab:', error.message);
  }
}

async function getTargetTab() {
  if (lastSiteTabId) {
    try {
      const tab = await chrome.tabs.get(lastSiteTabId);
      if (isSupportedPage(tab)) {
        return tab;
      }
    } catch (error) {
      lastSiteTabId = null;
    }
  }

  const tabs = await chrome.tabs.query({ active: true });
  const tab = tabs.find(isSupportedPage) || null;
  if (tab?.id) {
    lastSiteTabId = tab.id;
  }
  return tab;
}

async function openAssistantWindow() {
  const appUrl = chrome.runtime.getURL('popup.html');

  if (assistantWindowId !== null) {
    try {
      await chrome.windows.update(assistantWindowId, { focused: true });
      return;
    } catch (error) {
      assistantWindowId = null;
    }
  }

  const windowInfo = await chrome.windows.create({
    url: appUrl,
    type: 'popup',
    width: 640,
    height: 760,
  });

  assistantWindowId = windowInfo.id ?? null;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (isSupportedPage(tab)) {
    lastSiteTabId = tab.id;
  }
  await openAssistantWindow();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await rememberSiteTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === 'complete' || changeInfo.url)) {
    await rememberSiteTab(tabId);
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === assistantWindowId) {
    assistantWindowId = null;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openAssistantWindow') {
    openAssistantWindow()
      .then(() => sendResponse({ status: 'ok' }))
      .catch((error) => sendResponse({ status: 'error', value: error.message }));
    return true;
  }

  if (message.action === 'getTargetTab') {
    getTargetTab()
      .then((tab) => {
        if (!tab) {
          sendResponse({ status: 'error', value: 'No supported browser tab is currently available.' });
          return;
        }

        sendResponse({
          status: 'ok',
          tab: {
            id: tab.id,
            title: tab.title ?? '',
            url: tab.url ?? '',
          },
        });
      })
      .catch((error) => sendResponse({ status: 'error', value: error.message }));
    return true;
  }

  if (message.action === 'runScript') {
    const tabId = message.tabId ?? sender.tab?.id;

    if (!tabId) {
      sendResponse({ status: 'error', value: 'Could not determine tab ID.' });
      return true;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (script) => {
        try {
          const fn = new Function(script);
          const result = await Promise.resolve(fn());

          if (result === undefined) return { status: 'ok', value: 'Done (no return value)' };
          if (result === null) return { status: 'ok', value: 'null' };
          if (typeof result === 'object') {
            try {
              return { status: 'ok', value: JSON.stringify(result, null, 2) };
            } catch (e) {
              return { status: 'ok', value: result.toString() };
            }
          }
          return { status: 'ok', value: String(result) };
        } catch (err) {
          return { status: 'error', value: err.message };
        }
      },
      args: [message.script],
    }).then((results) => {
      const res = results?.[0]?.result;
      sendResponse(res ?? { status: 'error', value: 'No result returned.' });
    }).catch((err) => {
      sendResponse({ status: 'error', value: err.message });
    });

    return true;
  }
});
  
