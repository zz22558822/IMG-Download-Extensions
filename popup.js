// 判斷當前環境
function getBrowserType() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes("Chrome")) {
    return "Chrome";
  } else if (userAgent.includes("Firefox")) {
    return "Firefox";
  } else if (userAgent.includes("Safari")) {
    return "Safari";
  } else if (userAgent.includes("Edge")) {
    return "Edge";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    return "Opera";
  } else if (userAgent.includes("IE") || userAgent.includes("Trident")) {
    return "Internet Explorer";
  } else {
    return "Other"; // 無法明確判斷的瀏覽器
  }
}
const browserType = getBrowserType();
console.log("使用者瀏覽器:", browserType);

// 調用的 API
const browserApi = typeof browser !== "undefined" ? browser : chrome;
const executeFunctionName = typeof browser !== "undefined" ? "func" : "function";


// ------------------ 快速下載開關 ------------------
const quickDownloadCheckbox = document.getElementById('quick-download-checkbox');
// 讀取 localStorage 設定，如果不存在，則預設為 true
let isQuickDownloadEnabled = localStorage.getItem('quickDownload');
if (isQuickDownloadEnabled === null) {
  isQuickDownloadEnabled = true; // 預設為 true
  localStorage.setItem('quickDownload', 'true'); // 保存預設值
} else {
  isQuickDownloadEnabled = isQuickDownloadEnabled === 'true';
}
quickDownloadCheckbox.checked = isQuickDownloadEnabled;
// 監聽 checkbox 狀態變更
quickDownloadCheckbox.addEventListener('change', (event) => {
  localStorage.setItem('quickDownload', event.target.checked);
});

// ------------------ 轉為PNG開關 ------------------
const pngSwitchCheckbox = document.getElementById('PNG-switch-checkbox');
// 讀取 localStorage 設定，如果不存在，則預設為 false
let IsPngSwitchEnabled = localStorage.getItem('pngSwitch');
if (IsPngSwitchEnabled === null) {
  IsPngSwitchEnabled = true; // 預設為 false
  localStorage.setItem('pngSwitch', 'false'); // 保存預設值
} else {
  IsPngSwitchEnabled = IsPngSwitchEnabled === 'true';
}
pngSwitchCheckbox.checked = IsPngSwitchEnabled;
// 監聽 checkbox 狀態變更
pngSwitchCheckbox.addEventListener('change', (event) => {
  localStorage.setItem('pngSwitch', event.target.checked);
});


// ------------------ 黑暗模式 ------------------
document.addEventListener("DOMContentLoaded", () => {
  // 檢查本地儲存中是否有使用者的主題設定
  let currentTheme = localStorage.getItem("theme");
  if (currentTheme === null) {
      // 如果本地儲存沒有主題設定，檢查設備的首選主題
      const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      // 根據設備偏好設定主題
      currentTheme = prefersDarkScheme ? "dark" : "light";
      // 儲存設定的主題到本地儲存
      localStorage.setItem("theme", currentTheme);
  }
  // 根據當前的主題設置頁面
  document.documentElement.setAttribute("data-bs-theme", currentTheme);
  // 處理主題切換邏輯
  const themeToggleButton = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  // 設定初始圖標
  themeIcon.classList.toggle("fa-sun", currentTheme !== "dark");
  themeIcon.classList.toggle("fa-moon", currentTheme === "dark");
  // 監聽按鈕點擊事件來切換主題
  themeToggleButton.addEventListener("click", () => {
      // 切換主題
      const newTheme = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-bs-theme", newTheme);
      // 切換圖標
      themeIcon.classList.toggle("fa-sun", newTheme !== "dark");
      themeIcon.classList.toggle("fa-moon", newTheme === "dark");
      // 儲存用戶的選擇
      localStorage.setItem("theme", newTheme);
  });
});

// ------------------ 圖片嗅探 ------------------
// 抓取頁面上的所有圖片，包括各種格式
// chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) { // Chrome版
// browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { // Firefox版
browserApi.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { // 判斷通用版
  // 檢查當前頁面 URL
  if (browserType == 'Chrome') {
    browserFile = 'chrome://'
  } else if (browserType == 'Firefox') {
    browserFile = 'about:'
  } else if (browserType == 'Edge') {
    browserFile = 'edge://'
  }
  // if (tabs[0].url && tabs[0].url.startsWith('chrome://')) { // Chrome版
  // if (tabs[0].url && tabs[0].url.startsWith('about:')) { // Firefox版
  if (tabs[0].url && tabs[0].url.startsWith(browserFile)) { // 判斷通用版
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '無法在此頁面執行';
    return; // 停止執行
  }

  // chrome.scripting.executeScript( // Chrome版
  // browser.scripting.executeScript( // Firefox版
  let browserApi = typeof browser !== "undefined" ? browser : chrome;
  browserApi.scripting.executeScript( // 判斷通用版
    {
      // 圖片嗅探
      target: { tabId: tabs[0].id },
      // function: () => { // Chrome版
      // func: () => { // Firefox版
      [executeFunctionName] : () => { // 判斷通用版
        const imageUrls = [];
        const validUrlRegex = /^(https?:\/\/|data:|\/)/i; // 驗證網址格式

        // 抓取 <img> 標籤的圖片
        const images = Array.from(document.querySelectorAll('img'));
        images.forEach((img) => {
          if (img.src && validUrlRegex.test(img.src)) {
            imageUrls.push(img.src);
          }
        });

        // 抓取背景圖片
        const elements = Array.from(document.querySelectorAll('*'));
        elements.forEach((element) => {
          const style = window.getComputedStyle(element);
          const backgroundImage = style.backgroundImage;
          if (backgroundImage && backgroundImage.startsWith('url')) {
            const url = backgroundImage.replace(/^url\(['"](.+)['"]\)$/, '$1');
            if (validUrlRegex.test(url)) {
              imageUrls.push(url);
            }
          }
        });

        // 抓取 CSS content 屬性的圖片
        elements.forEach((element) => {
          const style = window.getComputedStyle(element, '::before');
          const content = style.content;
          if (content && content.startsWith('url')) {
            const url = content.replace(/^url\(['"](.+)['"]\)$/, '$1');
            if (validUrlRegex.test(url)) {
              imageUrls.push(url);
            }
          }
          const styleAfter = window.getComputedStyle(element, '::after');
          const contentAfter = styleAfter.content;
          if(contentAfter && contentAfter.startsWith('url')){
            const url = contentAfter.replace(/^url\(['"](.+)['"]\)$/, '$1');
            if (validUrlRegex.test(url)) {
              imageUrls.push(url);
            }
          }
        });

        // 抓取 <canvas> 元素的圖片
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
          try {
            const imageUrl = canvas.toDataURL('image/png');
            if (validUrlRegex.test(imageUrl)) {
              imageUrls.push(imageUrl);
            }
          } catch (error) {
            console.error('無法從 canvas 取得圖片:', error);
          }
        });

        // 抓取 <svg> 元素的圖片 (簡易版)
        const svgs = document.querySelectorAll('svg image');
        svgs.forEach((image) => {
          const imageUrl = image.getAttribute('xlink:href') || image.getAttribute('href');
          if (imageUrl && validUrlRegex.test(imageUrl)) {
            imageUrls.push(imageUrl);
          }
        });

        // 抓取 data: URL
        elements.forEach((element) => {
          const style = window.getComputedStyle(element);
          const backgroundImage = style.backgroundImage;
          if (backgroundImage && backgroundImage.startsWith('data:') && validUrlRegex.test(backgroundImage)) {
            imageUrls.push(backgroundImage);
          }
        });
        images.forEach((image) => {
          if (image.src && image.src.startsWith('data:') && validUrlRegex.test(image.src)) {
            imageUrls.push(image.src);
          }
        });

        return imageUrls;
      },
    
    // }, (results) => { // Chrome版
    }).then((results) => { // Firefox版
      if (!results || !results[0] || !results[0].result) {
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = '無法抓取圖片，請檢查網頁是否有圖片。';
        return;
      }

      const imageUrls = results[0].result;
      const imageList = document.getElementById('image-list');

      // 顯示圖片清單
      imageUrls.forEach((imageUrl) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';

        const imagePreview = document.createElement('img');
        imagePreview.src = imageUrl;
        imageItem.appendChild(imagePreview);

        // // 產生圖片連結
        // const imageLink = document.createElement('a');
        // imageLink.href = imageUrl;
        // imageLink.textContent = imageUrl.length > 50 ? imageUrl.substring(0, 50) + "..." : imageUrl;
        // imageLink.download = imageUrl.substring(imageUrl.lastIndexOf('/') + 1) || 'image.png';
        // imageLink.target = "_blank";
        // imageItem.appendChild(imageLink);

        imageList.appendChild(imageItem);

        // 圖片預覽事件
        imagePreview.addEventListener('mouseover', (event) => {
          // chrome.scripting.executeScript({ // Chrome版
          // browser.scripting.executeScript({ // Firefox版
          let browserApi = typeof browser !== "undefined" ? browser : chrome;
          browserApi.scripting.executeScript({ // 判斷通用版
            target: { tabId: tabs[0].id },
            // function: (url) => { // Chrome版
            // func: (url) => { // Firefox版
            [executeFunctionName]: (url) => { // 判斷通用版
            
              // 檢查並移除已存在的 preview-container
              const existingPreviewContainer = document.getElementById('preview-container');
              if (existingPreviewContainer) {
                existingPreviewContainer.remove(); // 刪除前一個預覽圖片
              }

              // 顯示預覽圖的設定
              const previewContainer = document.createElement('div');
              previewContainer.id = 'preview-container';
              previewContainer.style.position = 'fixed';
              previewContainer.style.border = '5px solid transparent'; // 先設定透明邊框
              previewContainer.style.borderImage = 'linear-gradient(to right, #e387eb, #87ceeb)'; // 設定漸層邊框
              previewContainer.style.borderImageSlice = '1'; // 確保完整顯示漸層
              previewContainer.style.borderRadius = '15px'; // 因為使用漸層導致無法正確 可留著
              previewContainer.style.padding = '10px';
              previewContainer.style.zIndex = '1000';
              previewContainer.style.transition = 'all 0.1s';

              // 從擴充元件取得主題設定
              // chrome.runtime.sendMessage({ action: "getTheme" }, (response) => { // Chrome版
              // browser.runtime.sendMessage({ action: "getTheme" }).then((response) => { // Firefox版
              let browserApi = typeof browser !== "undefined" ? browser : chrome;
              browserApi.runtime.sendMessage({ action: "getTheme" }).then((response) => { // 判斷通用版
                const currentTheme = response.theme;
                  // 根據當前的主題設置頁面
                if (currentTheme == 'dark') {
                  previewContainer.style.backgroundColor = '#333';
                } else {
                  previewContainer.style.backgroundColor = 'white';
                }
              });

              // 關閉按鈕
              const closeButton = document.createElement('div');
              closeButton.classList.add('close-button');
              closeButton.textContent = '×';
              closeButton.style.position = 'absolute';
              closeButton.style.display = 'flex'
              closeButton.style.justifyContent = 'center';
              closeButton.style.alignItems = 'center';
              closeButton.style.height = '30px';
              closeButton.style.top = '-25px';
              closeButton.style.right = '-25px';
              closeButton.style.fontSize = '30px';
              closeButton.style.cursor = 'pointer';
              closeButton.style.color = 'red';
              closeButton.style.fontWeight = 'bold';
              closeButton.style.padding = '0 5px';
              closeButton.style.lineHeight = 'normal';
              closeButton.style.zIndex = '1001';
              closeButton.style.transition = 'all 0.3s';
              closeButton.addEventListener('mouseover', () => {
                closeButton.style.background = 'red';
                closeButton.style.color = 'aliceblue';
              });
              closeButton.addEventListener('mouseout', () => {
                closeButton.style.background = '';
                closeButton.style.color = 'red';
              });

              // 大小顯示
              const sizeDiv = document.createElement('div');
              sizeDiv.classList.add('size-info');
              sizeDiv.style.position = 'absolute';
              sizeDiv.style.left = '50%';
              sizeDiv.style.transform = 'translateX(-50%)';
              sizeDiv.style.bottom = '-80px';
              sizeDiv.style.display = 'flex'
              sizeDiv.style.justifyContent = 'center';
              sizeDiv.style.alignItems = 'center';
              sizeDiv.style.flexWrap = 'wrap';
              sizeDiv.style.width = '180px';
              sizeDiv.style.textAlign = 'center';
              sizeDiv.style.fontSize = '20px';
              sizeDiv.style.fontFamily = 'Noto Sans CJK TC, sans-serif';
              sizeDiv.style.lineHeight = 'normal';
              sizeDiv.style.borderRadius = '5px';
              sizeDiv.style.padding = '5px 15px';
              sizeDiv.style.color = '#FFF';
              sizeDiv.style.background = '#00000098';
              sizeDiv.style.zIndex = '1002';

              // 當點擊關閉按鈕時，移除預覽圖
              closeButton.addEventListener('click', () => {
                previewContainer.remove();
              });

              // 預覽圖片
              const previewImage = document.createElement('img');
              previewImage.src = url;
              previewImage.onload = () => {
                let previewWidth = previewImage.naturalWidth;
                let previewHeight = previewImage.naturalHeight;

                // 設定最大寬度和高度
                const maxWidth = 700;
                const maxHeight = 550;

                // 調整圖片符合大小寬高
                if (previewWidth > window.innerWidth * 0.6) {
                  previewWidth = window.innerWidth * 0.6;
                  // 基於原始高度計算，並取整
                  previewHeight = Math.round(previewImage.naturalHeight * (previewWidth / previewImage.naturalWidth));
                } else if (previewHeight > window.innerHeight * 0.8) {
                  // 高度超出視窗時，基於原始寬度計算，並取整
                  previewHeight = window.innerHeight * 0.8;
                  previewWidth = Math.round(previewImage.naturalWidth * (previewHeight / previewImage.naturalHeight));
                }

                // 應用最大尺寸限制
                if (previewWidth > maxWidth || previewHeight > maxHeight) {
                  if (previewWidth / previewHeight > maxWidth / maxHeight) {
                    previewWidth = maxWidth;
                    previewHeight = Math.round(previewImage.naturalHeight * (previewWidth / previewImage.naturalWidth));
                  } else {
                    previewHeight = maxHeight;
                    previewWidth = Math.round(previewImage.naturalWidth * (previewHeight / previewImage.naturalHeight));
                  }
                }
                // 限制高度不超過原始高度
                previewHeight = Math.min(previewHeight, previewImage.naturalHeight);
        
                previewContainer.style.width = `${previewWidth}px`;
                previewContainer.style.height = `${previewHeight}px`;

                // 計算預覽視窗的中心位置
                let previewX = (window.innerWidth - previewWidth) / 2;
                let previewY = (window.innerHeight - previewHeight) / 2;
        
                previewContainer.style.left = `${previewX}px`;
                previewContainer.style.top = `${previewY}px`;
        
                previewImage.style.maxWidth = '100%';
                previewImage.style.maxHeight = '100%';
                previewImage.style.objectFit = 'contain'; // 保持圖片比例不變形
        
                previewImage.style.display = 'block'; // 讓圖片成為塊級元素
                previewImage.style.margin = '0 auto'; // 設定左右外距為 auto，使其水平置中
        
                previewContainer.appendChild(previewImage);
                previewContainer.appendChild(closeButton);
                previewContainer.appendChild(sizeDiv);
                // 因為載入順序問題 故須在 previewImage.onload 加載後才能顯示 寬高
                sizeDiv.innerHTML = `<span style="display: inline-block;">寬度: ${previewImage.naturalWidth}px</span><span style="display: inline-block;">高度: ${previewImage.naturalHeight}px</span>`;
                document.body.appendChild(previewContainer);
              };
            },
            args: [imageUrl],
          });
        });

        // // 點擊圖片開啟新標籤頁
        // imagePreview.addEventListener('click', () => {
        //   window.open(imageUrl, '_blank'); // 在新標籤頁中開啟圖片
        // })
        // // 點擊圖片下載
        // imagePreview.addEventListener('click', () => {
        //   // 提取不帶參數的 URL
        //   const urlWithoutParams = imageUrl.split('?')[0];
        //   // 獲取正確的檔案名稱
        //   const filename = urlWithoutParams.substring(urlWithoutParams.lastIndexOf('/') + 1) || 'image.png';
        //   chrome.downloads.download({
        //     url: imageUrl, // 使用原始 URL 進行下載，以確保參數正確
        //     filename: filename,
        //   });
        // });

        // 圖片轉為 PNG Blob
        async function convertImageToPNGBlob(imageUrl) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // 避免 CORS 問題
            img.src = imageUrl;

            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                resolve(blob);
              }, 'image/png');
            };

            img.onerror = (e) => {
              reject(new Error('圖片載入失敗，可能是跨域限制'));
            };
          });
        }

        // 點擊圖片事件
        imagePreview.addEventListener('click', async () => {
          // 讀取 localStorage 設定
          const isQuickDownloadEnabled = localStorage.getItem('quickDownload') === 'true';
          const IsPngSwitchEnabled = localStorage.getItem('pngSwitch') === 'true';

          if (isQuickDownloadEnabled) {
            try {
              const urlObj = new URL(imageUrl);
              let pathname = urlObj.pathname;
              let filename = pathname.substring(pathname.lastIndexOf('/') + 1) || 'image.png';
            
              // 檢查檔名是否包含副檔名，若無，則加上 .png
              if (!filename.includes('.')) {
                filename += '.png';
              }

              // 檢查是否啟用 PNG 強制轉檔
              if (IsPngSwitchEnabled) {
                filename = filename.replace(/\.[^/.]+$/, '') + '.png'; // 統一副檔名為 .png

                // 真正將圖片轉為 PNG Blob
                const pngBlob = await convertImageToPNGBlob(imageUrl);
                const objectUrl = URL.createObjectURL(pngBlob);

                // chrome.downloads.download({ // Chrome版
                // browser.downloads.download({ // Firefox版
                let browserApi = typeof browser !== "undefined" ? browser : chrome;
                browserApi.downloads.download({ // 判斷通用版
                  url: objectUrl,
                  filename: filename
                // }, () => { // Chrome版
                }).then(() => { // Firefox版
                  // 用完後釋放記憶體
                  URL.revokeObjectURL(objectUrl);
                // }); // Chrome版
                }).catch(error => console.error("下載錯誤:", error)); // Firefox版

              } else {
                // 不轉 PNG，直接下載原圖
                if (!filename.includes('.')) {
                // 檢查檔名是否包含副檔名，若無，則加上 .png
                  filename += '.png';
                }

                // chrome.downloads.download({ // Chrome版
                // browser.downloads.download({ // Firefox版
                let browserApi = typeof browser !== "undefined" ? browser : chrome;
                browserApi.downloads.download({ // 判斷通用版
                  url: imageUrl, // 使用原始 URL 進行下載，以確保參數正確
                  filename: filename,
                // }); // Chrome版
                }).catch(error => console.error("下載錯誤:", error)); // Firefox版
              }

            } catch (error) {
              console.error('處理圖片下載錯誤：', error);
              // 如果 URL 解析失敗，可以使用備用方法或顯示錯誤訊息
              // chrome.downloads.download({ // Chrome版
              // browser.downloads.download({ // Firefox版
              let browserApi = typeof browser !== "undefined" ? browser : chrome;
              browserApi.downloads.download({ // 判斷通用版
                url: imageUrl,
                filename: 'image.png',
              // }); // Chrome版
              }).catch(error => console.error("下載錯誤:", error)); // Firefox版
            }
          } else {
            // 在新分頁中開啟圖片
            window.open(imageUrl, '_blank');
          }
        });

        // 離開預覽圖時移除 mouseout
        imagePreview.addEventListener('mouseout', () => {
          // chrome.scripting.executeScript({ // Chrome版
          // browser.scripting.executeScript({ // Firefox版
          let browserApi = typeof browser !== "undefined" ? browser : chrome;
          browserApi.scripting.executeScript({ // 判斷通用版
            target: { tabId: tabs[0].id },
            // function: () => { // Chrome版
            // func: () => { // Firefox版
            [executeFunctionName]: () => { // 判斷通用版
              const previewContainer = document.getElementById('preview-container');
              if (previewContainer) {
                previewContainer.remove();
              }
            },
          });
        });
      });
    // }); // Chrome版
  }).catch(error => console.error("執行腳本錯誤:", error)); // Firefox版
});

// 監聽來自頁面的訊息 用於主題取取得localStorage
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { // Chrome版
// browser.runtime.onMessage.addListener((request, sender, sendResponse) => { // Firefox版
browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => { // 判斷通用版
  if (request.action === "getTheme") {
    // 從擴充元件的 localStorage 中取得主題設定
    const theme = localStorage.getItem("theme");
    sendResponse({ theme: theme });
  }
});