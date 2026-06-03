/* Version 1.1.0
1. 優化下載策略：多層降級機制（XHR → fetch no-cors → iframe → 新分頁）
2. 優化縮圖顯示：注入頁面取得 Blob 並回傳 dataURL，解決跨域/防盜縮圖問題
3. 優化嗅探機制
4. 修改部分已知錯誤
*/
// 判斷當前環境
function getBrowserType() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes("Edge") || userAgent.includes("Edg")) {
    return "Edge";
  } else if (userAgent.includes("Chrome")) {
    return "Chrome";
  } else if (userAgent.includes("Firefox")) {
    return "Firefox";
  } else if (userAgent.includes("Safari")) {
    return "Safari";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    return "Opera";
  } else {
    return "Other";
  }
}

const browserType = getBrowserType();
console.log("使用者瀏覽器:", browserType);

// 調用的 API
const browserApi = typeof browser !== "undefined" ? browser : chrome;
const executeFunctionName = typeof browser !== "undefined" ? "func" : "function";

// ------------------ 快速下載開關 ------------------
const quickDownloadCheckbox = document.getElementById('quick-download-checkbox');
let isQuickDownloadEnabled = localStorage.getItem('quickDownload');
if (isQuickDownloadEnabled === null) {
  isQuickDownloadEnabled = true;
  localStorage.setItem('quickDownload', 'true');
} else {
  isQuickDownloadEnabled = isQuickDownloadEnabled === 'true';
}
quickDownloadCheckbox.checked = isQuickDownloadEnabled;
quickDownloadCheckbox.addEventListener('change', (event) => {
  localStorage.setItem('quickDownload', event.target.checked);
});

// ------------------ 轉為PNG開關 ------------------
const pngSwitchCheckbox = document.getElementById('PNG-switch-checkbox');
let IsPngSwitchEnabled = localStorage.getItem('pngSwitch');
if (IsPngSwitchEnabled === null) {
  IsPngSwitchEnabled = false;
  localStorage.setItem('pngSwitch', 'false');
} else {
  IsPngSwitchEnabled = IsPngSwitchEnabled === 'true';
}
pngSwitchCheckbox.checked = IsPngSwitchEnabled;
pngSwitchCheckbox.addEventListener('change', (event) => {
  localStorage.setItem('pngSwitch', event.target.checked);
});

// ------------------ 黑暗模式 ------------------
document.addEventListener("DOMContentLoaded", () => {
  let currentTheme = localStorage.getItem("theme");
  if (currentTheme === null) {
      const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      currentTheme = prefersDarkScheme ? "dark" : "light";
      localStorage.setItem("theme", currentTheme);
  }
  document.documentElement.setAttribute("data-bs-theme", currentTheme);
  const themeToggleButton = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  themeIcon.classList.toggle("fa-sun", currentTheme !== "dark");
  themeIcon.classList.toggle("fa-moon", currentTheme === "dark");
  themeToggleButton.addEventListener("click", () => {
      const newTheme = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-bs-theme", newTheme);
      themeIcon.classList.toggle("fa-sun", newTheme !== "dark");
      themeIcon.classList.toggle("fa-moon", newTheme === "dark");
      localStorage.setItem("theme", newTheme);
  });
});

// ------------------ 工具函式：從頁面取得圖片 Blob 並轉為 dataURL ------------------
// popup 縮圖顯示 因為防盜/跨域，直接在 popup 設 src 會失敗
// 把取圖工作注入到目標頁面執行（繼承其 Cookie/Cache），再把 base64 傳回 popup
function fetchImageAsDataUrl(tabId, imageUrl) {
  return new Promise((resolve, reject) => {
    const api = typeof browser !== "undefined" ? browser : chrome;
    const fnKey = typeof browser !== "undefined" ? "func" : "function";

    api.scripting.executeScript({
      target: { tabId },
      [fnKey]: async (url) => {
        try {
          // 優先嘗試 XHR（在嚴格 CSP 下比 fetch 更有效）
          const blob = await new Promise((res, rej) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.onload = () => xhr.status === 200 ? res(xhr.response) : rej(new Error('xhr ' + xhr.status));
            xhr.onerror = () => rej(new Error('xhr error'));
            xhr.send();
          });
          // 讀成 base64
          const dataUrl = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = () => rej(new Error('reader error'));
            reader.readAsDataURL(blob);
          });
          return { ok: true, dataUrl };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      args: [imageUrl],
    }).then(results => {
      const result = results?.[0]?.result;
      if (result?.ok && result.dataUrl) {
        resolve(result.dataUrl);
      } else {
        reject(new Error(result?.error || 'fetch failed'));
      }
    }).catch(reject);
  });
}

// ------------------ 圖片嗅探 ------------------
browserApi.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
  const currentUrl = tabs[0]?.url || "";
  if (
    currentUrl.startsWith("chrome://") ||
    currentUrl.startsWith("edge://") ||
    currentUrl.startsWith("about:") ||
    currentUrl.startsWith("chrome-extension://") ||
    currentUrl.startsWith("moz-extension://")
  ) {
    document.getElementById('error-message').textContent = '無法在此頁面執行';
    return;
  }

  let browserApi = typeof browser !== "undefined" ? browser : chrome;
  browserApi.scripting.executeScript({
    target: { tabId: tabs[0].id },
    [executeFunctionName]: () => {
      const imageUrls = new Set();
      const validUrlRegex = /^(https?:\/\/|data:|blob:|\/)/i;
      function addUrl(url) {
        if (url && typeof url === 'string') {
          const trimmed = url.trim();
          if (validUrlRegex.test(trimmed) && !trimmed.startsWith('data:text')) {
            imageUrls.add(trimmed);
          }
        }
      }
      function extractBgUrls(bgValue) {
        if (!bgValue || bgValue === 'none') return;
        const regex = /url\(["']?([^"')]+)["']?\)/g;
        let m;
        while ((m = regex.exec(bgValue)) !== null) addUrl(m[1]);
      }
      function processElement(root) {
        root.querySelectorAll('img').forEach(img => {
          addUrl(img.src);
          addUrl(img.getAttribute('data-src'));
          addUrl(img.getAttribute('data-lazy'));
          addUrl(img.getAttribute('data-original'));
          addUrl(img.getAttribute('data-url'));
          if (img.srcset) img.srcset.split(',').forEach(part => addUrl(part.trim().split(/\s+/)[0]));
          Object.values(img.dataset).forEach(v => addUrl(v));
        });
        root.querySelectorAll('picture source').forEach(src => {
          if (src.srcset) src.srcset.split(',').forEach(p => addUrl(p.trim().split(/\s+/)[0]));
          addUrl(src.getAttribute('data-srcset'));
        });
        root.querySelectorAll('video[poster]').forEach(v => addUrl(v.poster));
        root.querySelectorAll('input[type=image]').forEach(i => addUrl(i.src));
        root.querySelectorAll('object[data]').forEach(o => {
          const type = o.type || '';
          if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(o.data)) addUrl(o.data);
        });
        root.querySelectorAll('embed[src]').forEach(e => {
          if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(e.src)) addUrl(e.src);
        });
        root.querySelectorAll('a[href]').forEach(a => {
          if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(a.href)) addUrl(a.href);
        });
        root.querySelectorAll('link[rel="preload"][as="image"]').forEach(l => addUrl(l.href));
        root.querySelectorAll('*').forEach(el => {
          extractBgUrls(window.getComputedStyle(el).backgroundImage);
          extractBgUrls(window.getComputedStyle(el, '::before').backgroundImage);
          extractBgUrls(window.getComputedStyle(el, '::after').backgroundImage);
          const contentB = window.getComputedStyle(el, '::before').content;
          const contentA = window.getComputedStyle(el, '::after').content;
          if (contentB && contentB.startsWith('url')) extractBgUrls(contentB);
          if (contentA && contentA.startsWith('url')) extractBgUrls(contentA);
          if (el.style && el.style.backgroundImage) extractBgUrls(el.style.backgroundImage);
          Array.from(el.attributes).forEach(attr => {
            if (/^(blob:|object:)/.test(attr.value)) addUrl(attr.value);
          });
          if (el.shadowRoot) processElement(el.shadowRoot);
        });
        root.querySelectorAll('canvas').forEach(canvas => {
          try {
            if (canvas.width > 1 && canvas.height > 1) addUrl(canvas.toDataURL('image/png'));
          } catch (e) {}
        });
        root.querySelectorAll('svg image').forEach(img => {
          addUrl(img.getAttribute('href') || img.getAttribute('xlink:href'));
        });
        try {
          Array.from(document.styleSheets).forEach(sheet => {
            try {
              Array.from(sheet.cssRules || []).forEach(rule => {
                if (rule.style) extractBgUrls(rule.style.backgroundImage);
              });
            } catch (e) {}
          });
        } catch (e) {}
      }
      processElement(document);
      try {
        performance.getEntriesByType('resource').forEach(entry => {
          if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?.*)?$/i.test(entry.name) || entry.initiatorType === 'img') {
            addUrl(entry.name);
          }
        });
      } catch (e) {}
      return Array.from(imageUrls);
    },
  }).then((results) => {
    if (!results || !results[0] || !results[0].result || results[0].result.length === 0) {
      document.getElementById('error-message').textContent = '無法抓取圖片，請檢查網頁是否有圖片。';
      return;
    }
    const imageUrls = results[0].result;
    const imageList = document.getElementById('image-list');

    imageUrls.forEach((imageUrl) => {
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';
      const imagePreview = document.createElement('img');

      // ---- 縮圖顯示優化 直接設 src，如果載入失敗再透過頁面注入取得 dataURL ----
      // 對可能有防盜的圖片加上 loading placeholder，避免破圖
      imagePreview.src = imageUrl;
      imagePreview.dataset.originalUrl = imageUrl; // 保留原始 URL 供下載使用

      // 載入失敗時才觸發注入取圖，不影響可以正常顯示的圖片
      imagePreview.addEventListener('error', () => {
        // 避免重複觸發
        if (imagePreview.dataset.fallbackTried) return;
        imagePreview.dataset.fallbackTried = '1';

        // 顯示灰色 placeholder，讓用戶知道正在嘗試取圖
        imagePreview.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="54"><rect width="80" height="54" fill="%23ccc"/><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="%23666">載入中...</text></svg>';

        fetchImageAsDataUrl(tabs[0].id, imageUrl)
          .then(dataUrl => {
            imagePreview.src = dataUrl;
          })
          .catch(() => {
            // 最終失敗：顯示無法預覽提示
            imagePreview.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="54"><rect width="80" height="54" fill="%23eee"/><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="%23999">無法預覽</text></svg>';
          });
      }, { once: true });

      imageItem.appendChild(imagePreview);
      imageList.appendChild(imageItem);

      // ---- 懸停預覽 ----
      imagePreview.addEventListener('mouseover', () => {
        let browserApi = typeof browser !== "undefined" ? browser : chrome;
        browserApi.scripting.executeScript({
          target: { tabId: tabs[0].id },
          [executeFunctionName]: (url) => {
            const existingPreviewContainer = document.getElementById('preview-container');
            if (existingPreviewContainer) existingPreviewContainer.remove();

            const previewContainer = document.createElement('div');
            previewContainer.id = 'preview-container';
            previewContainer.style.position = 'fixed';
            previewContainer.style.border = '5px solid transparent';
            previewContainer.style.borderImage = 'linear-gradient(to right, #e387eb, #87ceeb)';
            previewContainer.style.borderImageSlice = '1';
            previewContainer.style.borderRadius = '15px';
            previewContainer.style.padding = '10px';
            previewContainer.style.zIndex = '1000';
            previewContainer.style.transition = 'all 0.1s';

            let browserApi = typeof browser !== "undefined" ? browser : chrome;
            browserApi.runtime.sendMessage({ action: "getTheme" }).then((response) => {
              const currentTheme = response.theme;
              previewContainer.style.backgroundColor = currentTheme === 'dark' ? '#333' : 'white';
            });

            const closeButton = document.createElement('div');
            closeButton.classList.add('close-button');
            closeButton.textContent = '×';
            closeButton.style.cssText = 'position:absolute;display:flex;justify-content:center;align-items:center;height:30px;top:-25px;right:-25px;font-size:30px;cursor:pointer;color:red;font-weight:bold;padding:0 5px;line-height:normal;z-index:1001;transition:all 0.3s;';
            closeButton.addEventListener('mouseover', () => { closeButton.style.background = 'red'; closeButton.style.color = 'aliceblue'; });
            closeButton.addEventListener('mouseout', () => { closeButton.style.background = ''; closeButton.style.color = 'red'; });
            closeButton.addEventListener('click', () => previewContainer.remove());

            const sizeDiv = document.createElement('div');
            sizeDiv.classList.add('size-info');
            sizeDiv.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:-80px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;width:180px;text-align:center;font-size:20px;font-family:Noto Sans CJK TC,sans-serif;line-height:normal;border-radius:5px;padding:5px 15px;color:#FFF;background:#00000098;z-index:1002;';

            const previewImage = document.createElement('img');
            previewImage.src = url;
            previewImage.onload = () => {
              let previewWidth = previewImage.naturalWidth;
              let previewHeight = previewImage.naturalHeight;
              const maxWidth = 700;
              const maxHeight = 550;
              if (previewWidth > window.innerWidth * 0.6) {
                previewWidth = window.innerWidth * 0.6;
                previewHeight = Math.round(previewImage.naturalHeight * (previewWidth / previewImage.naturalWidth));
              } else if (previewHeight > window.innerHeight * 0.8) {
                previewHeight = window.innerHeight * 0.8;
                previewWidth = Math.round(previewImage.naturalWidth * (previewHeight / previewImage.naturalHeight));
              }
              if (previewWidth > maxWidth || previewHeight > maxHeight) {
                if (previewWidth / previewHeight > maxWidth / maxHeight) {
                  previewWidth = maxWidth;
                  previewHeight = Math.round(previewImage.naturalHeight * (previewWidth / previewImage.naturalWidth));
                } else {
                  previewHeight = maxHeight;
                  previewWidth = Math.round(previewImage.naturalWidth * (previewHeight / previewImage.naturalHeight));
                }
              }
              previewHeight = Math.min(previewHeight, previewImage.naturalHeight);
              previewContainer.style.width = `${previewWidth}px`;
              previewContainer.style.height = `${previewHeight}px`;
              previewContainer.style.left = `${(window.innerWidth - previewWidth) / 2}px`;
              previewContainer.style.top = `${(window.innerHeight - previewHeight) / 2}px`;
              previewImage.style.maxWidth = '100%';
              previewImage.style.maxHeight = '100%';
              previewImage.style.objectFit = 'contain';
              previewImage.style.display = 'block';
              previewImage.style.margin = '0 auto';
              previewContainer.appendChild(previewImage);
              previewContainer.appendChild(closeButton);
              previewContainer.appendChild(sizeDiv);
              sizeDiv.innerHTML = `<span style="display:inline-block;">寬度: ${previewImage.naturalWidth}px</span><span style="display:inline-block;">高度: ${previewImage.naturalHeight}px</span>`;
              document.body.appendChild(previewContainer);
            };
          },
          args: [imageUrl],
        });
      });

      imagePreview.addEventListener('mouseout', () => {
        let browserApi = typeof browser !== "undefined" ? browser : chrome;
        browserApi.scripting.executeScript({
          target: { tabId: tabs[0].id },
          [executeFunctionName]: () => {
            const previewContainer = document.getElementById('preview-container');
            if (previewContainer) previewContainer.remove();
          },
        });
      });

      // ---- 下載機制 多層降級策略 ----
      imagePreview.addEventListener('click', async () => {
        const isQuickDownloadEnabled = localStorage.getItem('quickDownload') === 'true';
        const IsPngSwitchEnabled = localStorage.getItem('pngSwitch') === 'true';

        if (!isQuickDownloadEnabled) {
          window.open(imageUrl, '_blank');
          return;
        }

        imageItem.style.opacity = '0.4';

        try {
          let filename = 'image.png';
          try {
            const urlObj = new URL(imageUrl);
            let pathname = urlObj.pathname;
            filename = pathname.substring(pathname.lastIndexOf('/') + 1) || 'image.png';
          } catch (e) {}
          if (!filename.includes('.')) filename += '.png';
          if (IsPngSwitchEnabled) filename = filename.replace(/\.[^/.]+$/, '') + '.png';

          let browserApi = typeof browser !== "undefined" ? browser : chrome;

          // 多層降級下載策略，全部在目標頁面內執行（繼承 Cookie/Cache）
          await browserApi.scripting.executeScript({
            target: { tabId: tabs[0].id },
            [executeFunctionName]: async (targetUrl, forcePng, finalFilename) => {

              // 共用工具函式
              function triggerLocalDownload(fileBlob, fname) {
                const blobUrl = URL.createObjectURL(fileBlob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 100);
              }

              async function blobToPng(blob) {
                return new Promise((res, rej) => {
                  const img = new Image();
                  img.crossOrigin = 'anonymous';
                  img.src = URL.createObjectURL(blob);
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob(pngBlob => {
                      URL.revokeObjectURL(img.src);
                      pngBlob ? res(pngBlob) : rej(new Error('toBlob failed'));
                    }, 'image/png');
                  };
                  img.onerror = () => { URL.revokeObjectURL(img.src); rej(new Error('img load failed')); };
                });
              }

              async function downloadBlob(blob, fname, forcePng) {
                if (forcePng) {
                  try { blob = await blobToPng(blob); } catch (e) { /* 轉換失敗保留原始 blob */ }
                }
                triggerLocalDownload(blob, fname);
              }

              // ─ 策略 1：XHR（最穩定，能命中頁面 Cache，繞過部分 Referer 檢查）─
              async function tryXhr() {
                return new Promise((res, rej) => {
                  const xhr = new XMLHttpRequest();
                  xhr.open('GET', targetUrl, true);
                  xhr.responseType = 'blob';
                  // 某些防盜網站會驗 Referer，設為同頁面域名以提高成功率
                  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                  xhr.onload = () => xhr.status === 200 ? res(xhr.response) : rej(new Error('xhr ' + xhr.status));
                  xhr.onerror = () => rej(new Error('xhr error'));
                  xhr.timeout = 15000;
                  xhr.ontimeout = () => rej(new Error('xhr timeout'));
                  xhr.send();
                });
              }

              // ─ 策略 2：fetch with credentials（攜帶 Cookie，應對需登入的防盜圖）─
              async function tryFetchWithCredentials() {
                const resp = await fetch(targetUrl, {
                  method: 'GET',
                  credentials: 'include',  // 攜帶 Cookie
                  cache: 'force-cache',    // 優先命中瀏覽器快取
                });
                if (!resp.ok) throw new Error('fetch ' + resp.status);
                return await resp.blob();
              }

              // ─ 策略 3：fetch no-store（跳過快取強制重新請求，應對快取污染）─
              async function tryFetchNoCache() {
                const resp = await fetch(targetUrl, {
                  method: 'GET',
                  credentials: 'include',
                  cache: 'no-store',
                });
                if (!resp.ok) throw new Error('fetch no-cache ' + resp.status);
                return await resp.blob();
              }

              // ─ 策略 4：隱藏 iframe 暫存載入後擷取（應對部分擋 XHR/fetch 但允許 <img> 的網站）─
              async function tryIframeCapture() {
                return new Promise((res, rej) => {
                  const img = new Image();
                  img.crossOrigin = 'use-credentials'; // 嘗試帶 Cookie
                  img.src = targetUrl + (targetUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
                  img.onload = () => {
                    try {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                      canvas.getContext('2d').drawImage(img, 0, 0);
                      canvas.toBlob(blob => blob ? res(blob) : rej(new Error('canvas empty')), 'image/png');
                    } catch (e) { rej(e); }
                  };
                  img.onerror = () => rej(new Error('img onerror'));
                  setTimeout(() => rej(new Error('iframe timeout')), 10000);
                });
              }

              // ─ 依序嘗試各策略 ─
              const strategies = [
                { name: 'XHR',                   fn: tryXhr },
                { name: 'fetch+credentials',      fn: tryFetchWithCredentials },
                { name: 'fetch+no-cache',         fn: tryFetchNoCache },
                { name: 'canvas capture',         fn: tryIframeCapture },
              ];

              for (const strategy of strategies) {
                try {
                  console.log(`[圖片下載] 嘗試策略: ${strategy.name}`);
                  const blob = await strategy.fn();
                  await downloadBlob(blob, finalFilename, forcePng);
                  console.log(`[圖片下載] 成功: ${strategy.name}`);
                  return; // 成功即停止
                } catch (err) {
                  console.warn(`[圖片下載] 策略失敗 (${strategy.name}):`, err.message);
                }
              }

              // ─ 所有策略均失敗：開新分頁備援 ─
              console.warn('[圖片下載] 所有策略失敗，開新分頁備援:', targetUrl);
              const win = window.open(targetUrl, '_blank');
              if (win) {
                // 嘗試在新分頁右鍵另存（大多數瀏覽器不允許）
                setTimeout(() => { try { win.document.execCommand('SaveAs', true, finalFilename); } catch(e) {} }, 500);
              }
            },
            args: [imageUrl, IsPngSwitchEnabled, filename],
          });

        } catch (error) {
          console.error('處理圖片下載錯誤：', error);
          // 最外層兜底：直接用 downloads API
          const api = typeof browser !== "undefined" ? browser : chrome;
          api.downloads.download({ url: imageUrl, filename: 'image.png' })
            .catch(e => console.error("下載 API 錯誤:", e));
        } finally {
          imageItem.style.opacity = '1';
        }
      });
    });
  }).catch(error => console.error("執行腳本錯誤:", error));
});

// 監聽來自頁面的訊息（用於主題取得 localStorage）
browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTheme") {
    const theme = localStorage.getItem("theme");
    sendResponse({ theme: theme });
    return true;
  }
});