// 抓取頁面上的所有圖片，包括各種格式
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  // 檢查當前頁面 URL
  if (tabs[0].url && tabs[0].url.startsWith('chrome://')) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '無法在此頁面執行擴充元件。';
    return; // 停止執行
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tabs[0].id },
      function: () => {
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
    },
    (results) => {
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

        const imageLink = document.createElement('a');
        imageLink.href = imageUrl;
        imageLink.textContent = imageUrl.length > 50 ? imageUrl.substring(0, 50) + "..." : imageUrl;
        imageLink.download = imageUrl.substring(imageUrl.lastIndexOf('/') + 1) || 'image.png';
        imageLink.target = "_blank";
        imageItem.appendChild(imageLink);

        imageList.appendChild(imageItem);

        // 圖片預覽事件
        imagePreview.addEventListener('mouseover', (event) => {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: (url) => {
              const previewContainer = document.createElement('div');
              previewContainer.id = 'preview-container';
              previewContainer.style.position = 'fixed';
              previewContainer.style.backgroundColor = 'white';
              previewContainer.style.border = '1px solid black';
              previewContainer.style.padding = '10px';
              previewContainer.style.zIndex = '1000';

              const previewImage = document.createElement('img');
              previewImage.src = url;
              previewImage.onload = () => {
                let previewWidth = previewImage.naturalWidth;
                let previewHeight = previewImage.naturalHeight;

                if (previewWidth > window.innerWidth * 0.6) {
                  previewWidth = window.innerWidth * 0.6;
                  previewHeight = previewHeight * (previewWidth / previewImage.naturalWidth);
                }

                if (previewHeight > window.innerHeight * 0.8) {
                  previewHeight = window.innerHeight * 0.8;
                  previewWidth = previewWidth * (previewHeight / previewImage.naturalHeight);
                }

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
                document.body.appendChild(previewContainer);
              };
            },
            args: [imageUrl],
          });
        });

        // 離開預覽圖時移除
        imagePreview.addEventListener('mouseleave', () => {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: () => {
              const previewContainer = document.getElementById('preview-container');
              if (previewContainer) {
                document.body.removeChild(previewContainer);
              }
            },
          });
        });
      });
    }
  );
});