// popup.js
// HiTextClip popup 腳本：負責顯示與管理當前網址下的區塊

document.addEventListener('DOMContentLoaded', () => {
  // 處理浮動按鈕啟用 checkbox
  const enableCheckbox = document.getElementById('enableFloatingBtn');
  if (enableCheckbox) {
    chrome.storage.local.get(['enableFloatingBtn'], (result) => {
      enableCheckbox.checked = result.enableFloatingBtn !== false; // 預設啟用
    });
    enableCheckbox.addEventListener('change', () => {
      chrome.storage.local.set({ enableFloatingBtn: enableCheckbox.checked });
      // 通知 content script 狀態變更
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'update_enable_floating_btn',
            enabled: enableCheckbox.checked
          });
        }
      });
    });
  }

  const clipList = document.getElementById('clipList');
  const emptyMsg = document.getElementById('emptyMsg');
  const guide = document.getElementById('firstUseGuide');

  // 共用：建立按鈕
  function createButton(text, onClick, style = {}) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, style);
    btn.onclick = onClick;
    return btn;
  }

  // 共用：建立欄位輸入
  function createField(labelText, value, type = 'text') {
    const label = document.createElement('label');
    label.textContent = labelText + '：';
    label.style.display = 'block';
    label.style.marginTop = '4px';
    const input = document.createElement('input');
    input.type = type;
    input.value = value !== undefined ? value : '';
    input.style.width = '90%';
    label.appendChild(input);
    return { label, input };
  }

  // 共用：發送訊息到 content script
  function sendTabMessage(tabId, message, callback) {
    chrome.tabs.sendMessage(tabId, message, callback);
  }

  // 共用：取得文字內容
  function getSelectedText(tabId, item, callback) {
    const message = {
      type: 'get_selected_text',
      startSelector: item.startSelector,
      startOffset: item.startOffset,
      endSelector: item.endSelector,
      endOffset: item.endOffset
    };
    if (item.frameSelector) {
      message.frameSelector = item.frameSelector;
      sendTabMessage(tabId, message, callback);
    } else {
      sendTabMessage(tabId, message, callback);
    }
  }

  // 依儲存的 selector 選取文字
  function selectContent(tabId, item) {
    const msg = {
      type: 'select_content',
      startSelector: item.startSelector,
      startOffset: item.startOffset,
      endSelector: item.endSelector,
      endOffset: item.endOffset,
      frameSelector: item.frameSelector
    };
    if (item.frameSelector) msg.frameSelector = item.frameSelector;
    sendTabMessage(tabId, msg);
  }

  // 共用：高亮 selector
  function highlightSelector(tabId, selector, frameSelector) {
    const msg = { type: 'highlight_selector', selector };
    if (frameSelector) msg.frameSelector = frameSelector;
    sendTabMessage(tabId, msg);
  }

  // 共用：移除高亮
  function removeHighlight(tabId, frameSelector) {
    const msg = { type: 'remove_highlight' };
    if (frameSelector) msg.frameSelector = frameSelector;
    sendTabMessage(tabId, msg);
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    const url = tabs[0]?.url?.split('#')[0]?.split('?')[0];
    if (!url) {
      emptyMsg.style.display = '';
      return;
    }

    chrome.storage.local.get(['clips'], (result) => {
      const clips = result.clips || {};
      const items = clips[url] || [];
      clipList.innerHTML = '';
      if (!items.length) {
        emptyMsg.style.display = '';
        if (guide) guide.style.display = '';
        return;
      }
      emptyMsg.style.display = 'none';
      if (guide) guide.style.display = 'none';

      items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'clip-item';

        // 文字內容區域
        const textContainer = document.createElement('div');
        textContainer.style.position = 'relative';

        // 文字顯示區
        const textDiv = document.createElement('div');
        Object.assign(textDiv.style, {
          fontSize: '13px',
          color: '#333',
          maxHeight: '85px',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-out',
          position: 'relative',
          paddingBottom: '4px'
        });
        textDiv.textContent = '載入中...';

        // 展開/收合按鈕
        const toggleBtn = createButton('展開全文', () => {
          isExpanded = !isExpanded;
          if (isExpanded) {
            textDiv.style.maxHeight = textDiv.scrollHeight + 'px';
            toggleBtn.textContent = '收合';
            gradient.style.opacity = '0';
          } else {
            textDiv.style.maxHeight = '85px';
            toggleBtn.textContent = '展開全文';
            gradient.style.opacity = '1';
          }
        }, {
          fontSize: '12px',
          padding: '2px 8px',
          marginTop: '4px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: '#fff',
          cursor: 'pointer',
          color: '#1976d2',
          display: 'none'
        });

        // 漸層遮罩
        const gradient = document.createElement('div');
        Object.assign(gradient.style, {
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '20px',
          background: 'linear-gradient(transparent, white)',
          display: 'none',
          transition: 'opacity 0.3s'
        });
        textDiv.appendChild(gradient);

        let isExpanded = false;

        // 取得內容
        getSelectedText(tabId, item, (resp) => {
          if (resp && resp.text) {
            textDiv.textContent = resp.text;
            textDiv.style.color = '#333';
            const multiLine = resp.text.split('\n').length > 5;
            toggleBtn.style.display = multiLine ? 'inline-block' : 'none';
            gradient.style.display = multiLine ? 'block' : 'none';
          } else {
            textDiv.textContent = '[無法取得內容]';
            textDiv.style.color = '#d32f2f';
            toggleBtn.style.display = 'none';
            gradient.style.display = 'none';
          }
        });
///////////////
          textContainer.appendChild(textDiv);
          textContainer.appendChild(toggleBtn);
          li.appendChild(textContainer);

          // selector 欄位
          const selectorDiv = document.createElement('div');
          selectorDiv.style.fontSize = '12px';
          selectorDiv.style.color = item.frameSelector ? '#1976d2' : '#888';
          selectorDiv.style.height = '20px';
          selectorDiv.style.overflow = 'auto';
          let selectorText = (item.startSelector || '') +
            (item.endSelector && item.endSelector !== item.startSelector ?
              ' ... ' + item.endSelector : '');
          if (item.frameSelector) {
            selectorText = `[iframe]: ${item.frameSelector}\n${selectorText}`;
          }
          selectorDiv.textContent = selectorText;
          selectorDiv.title = 'CSS Selector 範圍';
          li.appendChild(selectorDiv);

          // 操作按鈕區
          const actions = document.createElement('div');
          actions.className = 'actions';

          // 複製
          const copyBtn = createButton('複製', () => {
            getSelectedText(tabId, item, (resp) => {
              if (resp && resp.text) {
                navigator.clipboard.writeText(resp.text);
              }
            });
          });

          // 選取
          const selectBtn = createButton('選取', () => {
            selectContent(tabId, item);
          });

          // 編輯
          const editBtn = createButton('編輯', () => {
            selectorDiv.innerHTML = '';
            selectorDiv.style.height = 'auto';
            selectorDiv.style.overflow = 'visible';
            const fields = [
              { key: 'startSelector', label: 'Start Selector', type: 'text' },
              { key: 'startOffset', label: 'Start Offset', type: 'number' },
              { key: 'endSelector', label: 'End Selector', type: 'text' },
              { key: 'endOffset', label: 'End Offset', type: 'number' },
              { key: 'frameSelector', label: 'Frame Selector', type: 'text' }
            ];
            const inputs = {};
            fields.forEach(f => {
              const { label, input } = createField(f.label, item[f.key], f.type);
              inputs[f.key] = input;

              // 高亮 selector
              if (f.key === 'startSelector' || f.key === 'endSelector') {
                let isFocused = false;
                let lastSelector = '';
                input.addEventListener('focus', () => {
                  isFocused = true;
                  lastSelector = input.value;
                  if (lastSelector) highlightSelector(tabId, lastSelector, item.frameSelector);
                });
                input.addEventListener('blur', () => {
                  isFocused = false;
                  const otherInput = f.key === 'startSelector' ? inputs['endSelector'] : inputs['startSelector'];
                  if (otherInput && document.activeElement === otherInput) return;
                  removeHighlight(tabId, item.frameSelector);
                });
                input.addEventListener('input', () => {
                  if (!isFocused) return;
                  lastSelector = input.value;
                  highlightSelector(tabId, lastSelector, item.frameSelector);
                });
              }

              selectorDiv.appendChild(label);
            });

            // 儲存/取消按鈕
            const row = document.createElement('div');
            row.style.marginTop = '12px';
            row.style.display = 'flex';
            row.style.gap = '8px';

            const saveBtn = createButton('儲存', () => {
              removeHighlight(tabId, item.frameSelector);
              chrome.storage.local.get(['clips'], (res) => {
                const all = res.clips || {};
                const arr = all[url] || [];
                const idx = arr.findIndex(c => c.id === item.id);
                if (idx !== -1) {
                  fields.forEach(f => {
                    let val = inputs[f.key].value;
                    if (f.type === 'number') val = Number(val);
                    arr[idx][f.key] = val;
                  });
                  all[url] = arr;
                  chrome.storage.local.set({ clips: all }, () => {
                    selectorDiv.textContent = inputs['selector'] ? inputs['selector'].value : '';
                  });
                }
              });
            }, { backgroundColor: '#1976d2', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' });

            const cancelBtn = createButton('取消', () => {
              removeHighlight(tabId, item.frameSelector);
              location.reload();
            }, { padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' });

            row.appendChild(saveBtn);
            row.appendChild(cancelBtn);
            selectorDiv.appendChild(document.createElement('br'));
            selectorDiv.appendChild(row);
            selectorDiv.appendChild(document.createElement('hr')).style.margin = '12px 0';
          });

          // 刪除
          const delBtn = createButton('刪除', () => {
            chrome.storage.local.get(['clips'], (res) => {
              const all = res.clips || {};
              all[url] = (all[url] || []).filter(c => c.id !== item.id);
              chrome.storage.local.set({ clips: all }, () => {
                li.remove();
                if (!all[url].length) emptyMsg.style.display = '';
              });
            });
          });

          actions.appendChild(copyBtn);
          actions.appendChild(selectBtn);
          actions.appendChild(editBtn);
          actions.appendChild(delBtn);
          li.appendChild(actions);
          clipList.appendChild(li);
///////////////
      });
    });
  });
});