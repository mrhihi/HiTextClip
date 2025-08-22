/**
 * content.js
 * HiTextClip 內容腳本：偵測選取、插入浮動按鈕、傳送選取內容
 */
function isInFrame() {
  // window: 當前 document 的 window 物件
  // window.top: 最上層的 window 物件
  // 如果當前 window 不是最上層的 window，則表示在 iframe
  return window !== window.top;
}

// 選擇器相關功能
const SelectorUtils = {
  // 建立選擇器
  buildSelector(el) {
    let selector = el.tagName.toLowerCase();
    const validClasses = Array.from(el.classList)
      .filter(c => !c.match(/^(active|selected|hover|focus|show|hide|open|close|ng-|v-)/))
      .map(c => CSS.escape(c));

    if (validClasses.length) {
      selector += '.' + validClasses.join('.');
    }
    return selector;
  },

  // 驗證選擇器
  validateSelector(selector, targetElement, context = window) {
    try {
      const elements = context.document.querySelectorAll(selector);
      return elements.length === 1 && elements[0] === targetElement;
    } catch (e) {
      return false;
    }
  },

  // 取得元素的選擇器
  getNodeSelector(node, context = window) {
    if (!node) return null;

    // 處理文字節點
    let element = node.nodeType === 3 ? node.parentNode : node;
    if (!element || element === context.document.body) return 'body';

    // 嘗試 ID
    if (element.id) {
      const idSelector = `#${CSS.escape(element.id)}`;
      if (this.validateSelector(idSelector, element, context)) {
        return idSelector;
      }
    }

    // iframe 特殊處理
    if (element.tagName.toLowerCase() === 'iframe') {
      let selector = 'iframe';

      const validClasses = Array.from(element.classList)
        .filter(c => !c.match(/^(active|selected|hover|focus|show|hide|open|close|ng-|v-)/))
        .map(c => CSS.escape(c));

      if (validClasses.length) {
        selector += '.' + validClasses.join('.');
        if (this.validateSelector(selector, element, context)) {
          return selector;
        }
      }

      if (element.name && !element.name.match(/^(frame_|\d)/)) {
        const nameSelector = `iframe[name="${CSS.escape(element.name)}"]`;
        if (this.validateSelector(nameSelector, element, context)) {
          return nameSelector;
        }
      }
    }

    // 嘗試元素本身的選擇器
    let selector = this.buildSelector(element);
    if (this.validateSelector(selector, element, context)) {
      return selector;
    }

    // 使用絕對位置路徑
    const path = [];
    let current = element;
    while (current && current !== context.document.body) {
      const parent = current.parentElement;
      if (!parent) break;

      const children = Array.from(parent.children);
      const sameTagSiblings = children.filter(el => el.tagName === current.tagName);

      const elSelector = this.buildSelector(current);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        path.unshift(`${elSelector}:nth-of-type(${index})`);
      } else {
        path.unshift(elSelector);
      }

      current = parent;
    }

    return path.length ? path.join(' > ') : null;
  }
};

// 文字節點處理
const TextNodeUtils = {
  // 尋找文字節點
  findTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          return node.textContent.trim() ?
            NodeFilter.FILTER_ACCEPT :
            NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    return textNodes;
  },

  // 取得第一個文字節點
  getFirstTextNode(node) {
    if (!node) return null;

    if (node.nodeType === 3 && node.textContent.trim()) {
      return node;
    }

    if (node.nodeType === 1) {
      const textNodes = this.findTextNodes(node);
      return textNodes.length > 0 ? textNodes[0] : null;
    }

    return null;
  },

  // 取得最後一個文字節點
  getLastTextNode(node) {
    if (!node) return null;

    if (node.nodeType === 3 && node.textContent.trim()) {
      return node;
    }

    if (node.nodeType === 1) {
      const textNodes = this.findTextNodes(node);
      return textNodes.length > 0 ? textNodes[textNodes.length - 1] : null;
    }

    return null;
  }
};

// 選取資訊處理
const SelectionManager = {
  // 取得選取資訊
  getSelectionInfo() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;
    const text = selection.toString();
    const range = selection.getRangeAt(0);

    // 生成當前文檔中的選擇器
    const startSelector = SelectorUtils.getNodeSelector(range.startContainer);
    const endSelector = SelectorUtils.getNodeSelector(range.endContainer);

    // 檢查是否在 iframe 中
    const inIframe = isInFrame();
    let frameInfo = null;

    // 在 iframe 中時獲取 frame 資訊
    if (inIframe) {
      const frameSelector = this.getFrameSelector();
      if (frameSelector) {
        frameInfo = {
          frameSelector
        };
      }
    }

    const result = {
      startSelector,
      startOffset: range.startOffset,
      endSelector,
      endOffset: range.endOffset
    };

    // 如果在 iframe 中且有 frame 資訊，加入到結果中
    if (inIframe && frameInfo) {
      Object.assign(result, frameInfo);
    }

    return result;
  },

  // 生成 frame 選擇器
  getFrameSelector() {
    if (!isInFrame()) return null;

    try {
      const frame = window.frameElement;
      if (!frame) return null;

      let frameSelector = SelectorUtils.getNodeSelector(frame, window.parent);
      if (!frameSelector) return null;

      // 驗證選擇器
      try {
        const found = window.parent.document.querySelector(frameSelector);
        return found === frame ? frameSelector : null;
      } catch (e) {
        return null;
      }
    } catch (e) {
      return null;
    }
  }
};

// 高亮功能
const HighlightManager = {
  highlightedElement: null,

  // 初始化樣式
  init() {
    const style = document.createElement('style');
    style.textContent = `
      .hitextclip-highlight {
        outline: 2px solid #1976d2 !important;
        outline-offset: 1px !important;
        background-color: rgba(25, 118, 210, 0.1) !important;
        transition: all 0.15s ease !important;
        border-radius: 2px !important;
        position: relative !important;
        z-index: 2147483646 !important;
      }
      
      .hitextclip-highlight::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: transparent;
        pointer-events: none;
      }`;
    document.head.appendChild(style);
  },

  // 高亮元素
  highlightElement(selector, options = {}) {
    const { scroll = true, temporary = false } = options;
    try {
      if (!selector || selector === 'body') return;

      const el = document.querySelector(selector);
      if (!el || el.offsetParent === null) return;

      if (this.highlightedElement && this.highlightedElement !== el) {
        this.highlightedElement.classList.remove('hitextclip-highlight');
      }

      if (this.highlightedElement === el) return;

      if (scroll) {
        const rect = el.getBoundingClientRect();
        const isInViewport = (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth
        );

        if (!isInViewport) {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }

      el.classList.add('hitextclip-highlight');
      this.highlightedElement = el;

      if (temporary) {
        setTimeout(() => {
          if (this.highlightedElement === el) {
            el.classList.remove('hitextclip-highlight');
            this.highlightedElement = null;
          }
        }, 2000);
      }
    } catch (e) {
      console.warn('[HiTextClip] Failed to highlight element:', e);
    }
  },

  // 移除高亮
  removeHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove('hitextclip-highlight');
      this.highlightedElement = null;
    }
  }
};

// 浮動按鈕管理
const FloatButton = {
  button: null,
  lastMouseX: 0,
  lastMouseY: 0,

  // 建立浮動按鈕
  create() {
    if (this.button && document.body.contains(this.button)) return;

    this.button = document.createElement('button');
    this.button.textContent = '儲存文字範圍';
    this.button.style.position = 'fixed';
    this.button.style.zIndex = '2147483647';
    this.button.style.setProperty('z-index', '2147483647', 'important');
    this.button.style.display = 'none';
    this.button.className = 'hitextclip-float-btn';
    this.button.style.padding = '6px 12px';
    this.button.style.background = 'linear-gradient(90deg, #2196f3 0%, #1565c0 100%)';
    this.button.style.color = '#fff';
    this.button.style.fontWeight = 'bold';
    this.button.style.fontSize = '18px';
    this.button.style.border = '3px solid #40c4ff';
    this.button.style.borderRadius = '8px';
    this.button.style.boxShadow = '0 4px 24px 0 rgba(33,150,243,0.35), 0 0 0 4px #40c4ff55';
    this.button.style.cursor = 'pointer';
    this.button.style.transition = 'transform 0.15s, box-shadow 0.15s';
    this.button.onmouseenter = () => {
      this.button.style.transform = 'scale(1.08)';
      this.button.style.boxShadow = '0 8px 32px 0 rgba(33,150,243,0.45), 0 0 0 6px #40c4ff99';
    };
    this.button.onmouseleave = () => {
      this.button.style.transform = 'scale(1)';
      this.button.style.boxShadow = '0 4px 24px 0 rgba(33,150,243,0.35), 0 0 0 4px #40c4ff55';
    };
    document.body.appendChild(this.button);

    this.button.addEventListener('mousedown', e => e.stopPropagation());
    this.button.addEventListener('click', this.onClick.bind(this));
  },

  // 顯示浮動按鈕
  show(x, y) {
    this.create();

    if (this.button) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const buttonWidth = this.button.offsetWidth || 100;
      const buttonHeight = this.button.offsetHeight || 30;

      let left = x + 20;
      let top = y + 20;

      if (left + buttonWidth > viewportWidth) {
        left = x - buttonWidth - 20;
      }

      if (top + buttonHeight > viewportHeight) {
        top = y - buttonHeight - 20;
      }

      left = Math.max(10, left);
      top = Math.max(10, top);

      this.button.style.left = `${left}px`;
      this.button.style.top = `${top}px`;
      this.button.style.display = 'block';
    }
  },

  // 隱藏浮動按鈕
  hide() {
    if (this.button && document.body.contains(this.button)) {
      this.button.style.display = 'none';
    }
  },

  // 點擊處理
  async onClick(e) {
    e.stopPropagation();
    const info = SelectionManager.getSelectionInfo();
    if (!info) return;

    try {
      if (isInFrame()) {
        // iframe 中的處理
        const saveData = {
          startSelector: info.startSelector,
          startOffset: info.startOffset,
          endSelector: info.endSelector,
          endOffset: info.endOffset,
          url: window.top.location.href,
          frameSelector: info.frameSelector,
          createdAt: Math.floor(Date.now() / 1000)
        };

        window.top.postMessage({
          type: 'frame_save_selected_text',
          data: saveData
        }, '*');
      } else {
        // 主視窗中的處理
        const saveData = {
          startSelector: info.startSelector,
          startOffset: info.startOffset,
          endSelector: info.endSelector,
          endOffset: info.endOffset,
          url: window.location.href,
          createdAt: Math.floor(Date.now() / 1000)
        };

        chrome.runtime.sendMessage({
          type: 'save_selected_text',
          data: saveData
        });
      }
    } catch (e) {
      console.error('[HiTextClip] Error saving selection:', e);
    }

    this.hide();
  }
};

// 全域設定
let globalCopyHtmlContent = false;

// 訊息處理器
const MessageHandler = {
  // 處理來自 popup 的訊息
  handlePopupMessage(msg, sender, sendResponse) {
    // listen 的 message 會因為有 frame 的關系，進來多次，這邊會看 frameSelector 決定要處理哪一種訊息
    if (msg.frameSelector && !isInFrame()) return;
    if (!msg.frameSelector && isInFrame()) return;
    switch (msg.type) {
      case 'highlight_selector':
        this.handleHighlight(msg);
        break;
      case 'remove_highlight':
        this.handleRemoveHighlight(msg);
        break;
      case 'select_content':
        this.handleSelectContent(msg, sendResponse);
        break;
      case 'get_selected_text':
        this.handleGetSelectedText(msg, sendResponse);
        break;
      case 'check_frame_status': // 暫不使用
        this.handleFrameStatus(sendResponse);
        break;
    }
    return true;
  },

  // 處理 frame 狀態檢查
  handleFrameStatus(sendResponse) {
    try {
      if (!isInFrame()) {
        sendResponse(false);
      } else {
        sendResponse(!!window.frameElement);
      }
    } catch (e) {
      sendResponse(false);
    }
  },

  // 處理高亮請求
  handleHighlight(msg) {
    if (!msg.selector) {
      console.warn('[HiTextClip] No selector provided for highlight.');
      return;
    }
    HighlightManager.highlightElement(msg.selector, { temporary: false });
  },

  // 處理移除高亮
  handleRemoveHighlight(msg) {
    HighlightManager.removeHighlight();
  },

  // 處理取得文字內容
  handleGetSelectedText(msg, sendResponse) {
    const selection = this.handleSelectContent(msg);
    if (selection) {
       // 使用 convertSelectionToContent 轉換選取內容
       const text = this.convertSelectionToContent(selection).trim();
       console.log('[HiTextClip] Selected text:', text.substring(0, 10) + '...');
       selection.removeAllRanges(); // 清除選取範圍
       sendResponse({ text });
     } else {
       // 如果沒有選取內容，有可能是因為接收到訊息是 window.top 但現在是在 iframe 裡面，所以不要處理，不然會把應該要複製到的文字清掉
     }
  },

  // 選取內容
  handleSelectContent(msg, sendResponse = null) {
    try {
      console.log('[HiTextClip] handleSelectContent', isInFrame());
      if (msg.startSelector && msg.endSelector) {
        const startNode = document.querySelector(msg.startSelector);
        const endNode = document.querySelector(msg.endSelector);

        if (!startNode || !endNode) return null;

        const startTextNodes = TextNodeUtils.findTextNodes(startNode);
        const endTextNodes = TextNodeUtils.findTextNodes(endNode);

        const range = document.createRange();
        const startTextNode = startTextNodes.length ? startTextNodes[0] : startNode;
        const endTextNode = endTextNodes.length ? endTextNodes[endTextNodes.length - 1] : endNode;

        range.setStart(startTextNode, msg.startOffset || 0);
        range.setEnd(endTextNode, msg.endOffset || 0);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        return selection;
      }
    } catch (e) {
      console.log('[HiTextClip] Error selecting content:', e);
      console.warn('[HiTextClip] Selection failed:', e);
    }
    return null;
  },

  // 將選取範圍內容轉換為文字或 HTML
   convertSelectionToContent(selection) {
     if (!selection || selection.rangeCount === 0) return '';

     const range = selection.getRangeAt(0);
     const container = document.createElement('div');
     container.appendChild(range.cloneContents());

     if (globalCopyHtmlContent) {
       // 複製 HTML 內容
       return container.innerHTML;
     } else {
       // 複製純文字（markdown 格式）
       // 遞迴處理節點，轉換 a 和 img 標籤為 markdown
       function nodeToMarkdown(node) {
         if (node.nodeType === Node.TEXT_NODE) {
           return node.textContent;
         } else if (node.nodeType === Node.ELEMENT_NODE) {
           if (node.tagName.toLowerCase() === 'a') {
             const href = node.getAttribute('href') || '';
             const text = Array.from(node.childNodes).map(child => nodeToMarkdown(child)).join('');
             return `[${text}](${href})`;
           } else if (node.tagName.toLowerCase() === 'img') {
             const alt = node.getAttribute('alt') || 'image';
             const src = node.getAttribute('src') || '';
             return `![${alt}](${src})`;
           } else {
             // 處理子節點
             return Array.from(node.childNodes).map(child => nodeToMarkdown(child)).join('');
           }
         }
         return '';
       }

       let markdown = nodeToMarkdown(container);

       // 處理每行開頭空白 trim，合併多行空白行為一行
       const lines = markdown.split('\n');
       const processedLines = [];
       let lastLineEmpty = false;
       for (let line of lines) {
         const trimmedLine = line.trim();
         const isEmpty = trimmedLine === '' || /^[ \t]+$/.test(trimmedLine);
         if (isEmpty) {
           if (!lastLineEmpty) {
             processedLines.push('');
             lastLineEmpty = true;
           }
         } else {
           processedLines.push(trimmedLine);
           lastLineEmpty = false;
         }
       }

       return processedLines.join('\n');
     }
   }
};

// 初始化
(function init() {
 // 初始化高亮樣式
 HighlightManager.init();

 // 浮動按鈕啟用狀態
 let enableFloatingBtn = true;
 // HTML 複製設定
 let copyHtmlContent = false;

 // 讀取啟用狀態
 chrome.storage.local.get(['enableFloatingBtn', 'copyHtmlContent'], (result) => {
   enableFloatingBtn = result.enableFloatingBtn !== false;
   globalCopyHtmlContent = result.copyHtmlContent === true;
 });

  // 監聽 popup 狀態變更
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'update_enable_floating_btn') {
      enableFloatingBtn = !!msg.enabled;
      if (!enableFloatingBtn) FloatButton.hide();
    } else if (msg.type === 'update_copy_html_content') {
      globalCopyHtmlContent = !!msg.enabled;
    }
    // 保持原有訊息處理
    MessageHandler.handlePopupMessage(msg, sender, sendResponse);
  });

  // 監聽滑鼠移動
  document.addEventListener('mousemove', (e) => {
    FloatButton.lastMouseX = e.clientX;
    FloatButton.lastMouseY = e.clientY;
  });

  // 監聽選取變化
  document.addEventListener('selectionchange', () => {
    if (!enableFloatingBtn) {
      FloatButton.hide();
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      FloatButton.hide();
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      FloatButton.show(FloatButton.lastMouseX, FloatButton.lastMouseY);
    } else {
      FloatButton.hide();
    }
  });

  // 監聽點擊事件
  document.addEventListener('mousedown', (e) => {
    if (FloatButton.button && !FloatButton.button.contains(e.target)) {
      FloatButton.hide();
    }
  });

  // 如果是頂層視窗，監聽來自 iframe 的訊息
  if (!isInFrame()) {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'frame_save_selected_text') {
        chrome.runtime.sendMessage({
          type: 'save_selected_text',
          data: {
            ...event.data.data,
            url: window.location.href
          }
        });
      }
    });
  }
})();
