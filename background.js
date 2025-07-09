// background.js
// HiTextClip 背景服務：負責資料儲存、訊息協調與跨頁同步


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'save_selected_text') {
    console.log('[HiTextClip][background] 收到 save_selected_text:', message.data);
    EventHandler.handleSaveSelectedText(message, sender, sendResponse);
    return true; // 表示會使用 sendResponse
  }
});

const EventHandler = {
  handleSaveSelectedText(message, sender, sendResponse) {
    const {
      startSelector,
      startOffset,
      endSelector,
      endOffset,
      text,
      url,
      frameSelector,
      createdAt
    } = message.data;
    const id = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + Math.random()).toString(36);

    // 統一 url 格式（去除 #、?、結尾斜線）
    let baseUrl = url ? url.split('#')[0].split('?')[0].replace(/\/$/, '') : '';
    if (!baseUrl) baseUrl = url;

    chrome.storage.local.get(['clips'], (result) => {
      const clips = result.clips || {};
      if (!clips[baseUrl]) clips[baseUrl] = [];

      const clipData = {
        id,
        startSelector,
        startOffset,
        endSelector,
        endOffset,
        text,
        createdAt
      };

      // 如果是來自 iframe 的選取，加入 iframe 相關資訊
      if (frameSelector) {
        clipData.frameSelector = frameSelector;
      }

      clips[baseUrl].push(clipData);
      console.log('[HiTextClip][background] clips 儲存前:', JSON.stringify(clips[baseUrl]));
      chrome.storage.local.set({ clips }, () => {
        console.log('[HiTextClip][background] clips 已儲存:', JSON.stringify(clips[baseUrl]));
        sendResponse({ success: true });
      });
    });
  }
}