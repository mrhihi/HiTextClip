// options.js
// HiTextClip options 腳本：負責全域管理與設定

document.addEventListener('DOMContentLoaded', () => {
  const urlSections = document.getElementById('urlSections');
  const newUrl = document.getElementById('newUrl');
  const addNewBtn = document.getElementById('addNewBtn');
  const newStartSelector = document.getElementById('newStartSelector');
  const newEndSelector = document.getElementById('newEndSelector');
  const newFrameSelector = document.getElementById('newFrameSelector');
  const newStartOffset = document.getElementById('newStartOffset');
  const newEndOffset = document.getElementById('newEndOffset');
  const toggleNewBlockBtn = document.getElementById('toggleNewBlockBtn');
  const newBlockForm = document.querySelector('.new-block-form');

  if (toggleNewBlockBtn && newBlockForm) {
    toggleNewBlockBtn.onclick = () => {
      const formRows = Array.from(newBlockForm.children).filter(
        el => !el.querySelector || !el.querySelector('.new-block-title')
      ).filter(el => el.tagName !== 'DIV' || !el.innerHTML.includes('toggleNewBlockBtn'));
      // 除標題外的所有內容收合
      if (toggleNewBlockBtn.textContent === '▼') {
        for (const row of formRows) row.style.display = 'none';
        toggleNewBlockBtn.textContent = '►';
      } else {
        for (const row of formRows) row.style.display = '';
        toggleNewBlockBtn.textContent = '▼';
      }
    };
  }

  // 處理貼上功能
  const pasteClipBtn = document.getElementById('pasteClipBtn');
  if (pasteClipBtn) {
    pasteClipBtn.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        if (data.baseUrl !== undefined) {
          newUrl.value = data.baseUrl;
          newUrl.dataset.baseUrl = data.baseUrl;
        }
        if (data.startSelector !== undefined) newStartSelector.value = data.startSelector;
        if (data.endSelector !== undefined) newEndSelector.value = data.endSelector;
        if (data.frameSelector !== undefined) newFrameSelector.value = data.frameSelector;
        if (data.startOffset !== undefined) newStartOffset.value = data.startOffset;
        if (data.endOffset !== undefined) newEndOffset.value = data.endOffset;
      } catch (e) {
        alert('剪貼簿內容格式錯誤或非 JSON');
      }
    };
  }

  // 處理匯入功能
  const importClipBtn = document.getElementById('importClipBtn');
  const importClipFile = document.getElementById('importClipFile');
  if (importClipBtn && importClipFile) {
    importClipBtn.onclick = () => importClipFile.click();
    importClipFile.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // 支援單一 clip 或多個 clips
        if (Array.isArray(data.clips) && data.url) {
          // 多個 clips
          chrome.storage.local.get(['clips'], (result) => {
            const clips = result.clips || {};
            if (!clips[data.url]) clips[data.url] = [];
            for (const clip of data.clips) {
              // 避免重複 id
              if (!clips[data.url].some(c => c.id === clip.id)) {
                clips[data.url].push(clip);
              }
            }
            chrome.storage.local.set({ clips }, () => location.reload());
          });
        } else if (data.baseUrl) {
          // 單一 clip
          chrome.storage.local.get(['clips'], (result) => {
            const clips = result.clips || {};
            if (!clips[data.baseUrl]) clips[data.baseUrl] = [];
            // 避免重複 id
            if (!clips[data.baseUrl].some(c => c.id === data.id)) {
              clips[data.baseUrl].push(data);
            }
            chrome.storage.local.set({ clips }, () => location.reload());
          });
        } else {
          alert('匯入格式錯誤');
        }
      } catch (err) {
        alert('匯入失敗：' + err.message);
      }
      importClipFile.value = '';
    };
  }

  // 處理新增功能
  addNewBtn.onclick = () => {
    // 若 baseUrl 欄位有值則優先用，否則用輸入框
    const url = newUrl.dataset.baseUrl ? newUrl.dataset.baseUrl : newUrl.value.trim();
    const startSelector = newStartSelector.value.trim();
    const endSelector = newEndSelector.value.trim();
    const frameSelector = newFrameSelector ? newFrameSelector.value.trim() : '';
    const startOffset = Number(newStartOffset.value) || 0;
    const endOffset = Number(newEndOffset.value) || 0;
    // 貼上後清除 dataset
    newUrl.dataset.baseUrl = '';

    // 基本驗證
    if (!url || !startSelector || !endSelector) {
      alert('請填寫網址和選擇器');
      return;
    }
    if (startSelector === endSelector) {
      if (!confirm('起始與結束 Selector 相同，可能導致選取範圍不完整。確定要繼續嗎？')) {
        return;
      }
    }

    try {
      new URL(url);  // 驗證URL格式
    } catch (e) {
      alert('請輸入有效的網址');
      return;
    }

    // 去除URL中的查詢參數和錨點
    const baseUrl = url.split('#')[0].split('?')[0];

    // 產生唯一ID
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // 儲存新區塊
    chrome.storage.local.get(['clips'], (result) => {
      const clips = result.clips || {};
      if (!clips[baseUrl]) {
        clips[baseUrl] = [];
      }

      const newClip = {
        id,
        startSelector,
        endSelector,
        startOffset,
        endOffset,
        createdAt: Date.now()
      };
      if (frameSelector) {
        newClip.frameSelector = frameSelector;
      }

      clips[baseUrl].push(newClip);
      chrome.storage.local.set({ clips }, () => {
        // 重新載入頁面以顯示新增的項目
        location.reload();
      });
    });
  };

  chrome.storage.local.get(['clips'], (result) => {
    const clips = result.clips || {};
    const urls = Object.keys(clips);
    if (!urls.length) {
      urlSections.innerHTML = '<div>尚無任何儲存區塊</div>';
      const guide = document.getElementById('firstUseGuide');
      if (guide) guide.style.display = '';
      return;
    }
    urlSections.innerHTML = '';
    const guide = document.getElementById('firstUseGuide');
    if (guide) guide.style.display = 'none';
    urls.forEach(url => {
      const section = document.createElement('div');
      section.className = 'url-section';

      // 標題與批次刪除
      const title = document.createElement('div');
      title.style.display = 'flex';
      title.style.alignItems = 'center';

      // 收合按鈕
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = '▼';
      toggleBtn.style.marginRight = '6px';
      toggleBtn.onclick = () => {
        if (ul.style.display === 'none') {
          ul.style.display = '';
          toggleBtn.textContent = '▼';
        } else {
          ul.style.display = 'none';
          toggleBtn.textContent = '►';
        }
      };
      title.appendChild(toggleBtn);

      // 匯出按鈕
      const exportBtn = document.createElement('button');
      exportBtn.textContent = '匯出';
      exportBtn.className = 'toggle-btn';
      exportBtn.onclick = () => {
        const exportData = {
          url,
          clips: clips[url]
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `HiTextClip_${encodeURIComponent(url)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      title.appendChild(exportBtn);

      const delAllBtn = document.createElement('button');
      delAllBtn.textContent = '刪除此網址全部';
      delAllBtn.onclick = () => {
        chrome.storage.local.get(['clips'], (res) => {
          const all = res.clips || {};
          delete all[url];
          chrome.storage.local.set({ clips: all }, () => {
            section.remove();
            if (!Object.keys(all).length) urlSections.innerHTML = '<div>尚無任何儲存區塊</div>';
          });
        });
      };
      const urlText = document.createElement('strong');
      urlText.textContent = ` - ${url}`;
      title.appendChild(delAllBtn);
      title.appendChild(urlText);
      section.appendChild(title);

      // 區塊列表
      const ul = document.createElement('ul');
      ul.className = 'clip-list';
      clips[url].forEach(item => {
        const li = document.createElement('li');
        li.className = 'clip-item';

        // 所有可編輯欄位區域
        const fieldsDiv = document.createElement('div');
        fieldsDiv.style.fontSize = '12px';
        fieldsDiv.style.color = '#888';
        fieldsDiv.style.marginTop = '8px';
        fieldsDiv.style.marginBottom = '8px';

        // 主要選擇器
        fieldsDiv.innerHTML = `
          <div><strong>Start Selector:</strong> ${item.startSelector}</div>
          <div><strong>Start Offset:</strong> ${item.startOffset}</div>
          <div><strong>End Selector:</strong> ${item.endSelector}</div>
          <div><strong>End Offset:</strong> ${item.endOffset}</div>
        `;

        // Frame資訊（如果有的話）
        if (item.frameSelector) {
          fieldsDiv.innerHTML += `<div><strong>Frame Selector:</strong> ${item.frameSelector}</div>`;
        }

        li.appendChild(fieldsDiv);

        // 操作按鈕

        // 操作按鈕
        const actions = document.createElement('div');
        actions.className = 'actions';

        // 複製按鈕
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '複製';
        copyBtn.onclick = () => {
          // 複製所有欄位（JSON 格式，含 baseUrl）
          const clipData = {
            baseUrl: url,
            startSelector: item.startSelector,
            startOffset: item.startOffset,
            endSelector: item.endSelector,
            endOffset: item.endOffset,
            frameSelector: item.frameSelector || ''
          };
          navigator.clipboard.writeText(JSON.stringify(clipData, null, 2));
        };

        // 編輯按鈕
        const editBtn = document.createElement('button');
        editBtn.textContent = '編輯';
        editBtn.onclick = () => {
          fieldsDiv.innerHTML = `
            <div style="margin-bottom:8px">
              <label><strong>Start Selector:</strong></label>
              <input type="text" id="edit-start-selector" style="width:100%" value="${item.startSelector}">
            </div>
            <div style="margin-bottom:8px">
              <label><strong>Start Offset:</strong></label>
              <input type="number" id="edit-start-offset" style="width:100%" value="${item.startOffset}">
            </div>
            <div style="margin-bottom:8px">
              <label><strong>End Selector:</strong></label>
              <input type="text" id="edit-end-selector" style="width:100%" value="${item.endSelector}">
            </div>
            <div style="margin-bottom:8px">
              <label><strong>End Offset:</strong></label>
              <input type="number" id="edit-end-offset" style="width:100%" value="${item.endOffset}">
            </div>
            <div style="margin-bottom:8px">
              <label><strong>Frame Selector:</strong></label>
              <input type="text" id="edit-frame-selector" style="width:100%" value="${item.frameSelector ? item.frameSelector : ''}">
            </div>
          `;

          const saveBtn = document.createElement('button');
          saveBtn.textContent = '儲存';
          saveBtn.onclick = () => {
            const updates = {
              startSelector: document.getElementById('edit-start-selector').value.trim(),
              startOffset: parseInt(document.getElementById('edit-start-offset').value) || 0,
              endSelector: document.getElementById('edit-end-selector').value.trim(),
              endOffset: parseInt(document.getElementById('edit-end-offset').value) || 0
            };

            updates.frameSelector = document.getElementById('edit-frame-selector').value.trim();

            if (!updates.startSelector || !updates.endSelector) {
              alert('選擇器欄位不能為空');
              return;
            }

            chrome.storage.local.get(['clips'], (res) => {
              const all = res.clips || {};
              const arr = all[url] || [];
              const idx = arr.findIndex(c => c.id === item.id);
              if (idx !== -1) {
                arr[idx] = { ...arr[idx], ...updates };
                all[url] = arr;
                chrome.storage.local.set({ clips: all }, () => {
                  location.reload();  // 重新載入以顯示更新
                });
              }
            });
          };
          fieldsDiv.appendChild(saveBtn);

          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = '取消';
          cancelBtn.style.marginLeft = '8px';
          cancelBtn.onclick = () => location.reload();
          fieldsDiv.appendChild(cancelBtn);
        };

        // 刪除按鈕
        const delBtn = document.createElement('button');
        delBtn.textContent = '刪除';
        delBtn.onclick = () => {
          chrome.storage.local.get(['clips'], (res) => {
            const all = res.clips || {};
            all[url] = (all[url] || []).filter(c => c.id !== item.id);
            if (!all[url].length) delete all[url];
            chrome.storage.local.set({ clips: all }, () => {
              li.remove();
              if (!all[url]) section.remove();
              if (!Object.keys(all).length) urlSections.innerHTML = '<div>尚無任何儲存區塊</div>';
            });
          });
        };

        actions.appendChild(copyBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        li.appendChild(actions);
        ul.appendChild(li);
      });
      section.appendChild(ul);
      urlSections.appendChild(section);
    });
  });
});