window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const appIcon = urlParams.get('icon');
    const appName = urlParams.get('name');
    const downloadLink = urlParams.get('link');
    const password = urlParams.get('pwd');
    const img1 = urlParams.get('图片一');
    const img2 = urlParams.get('图片二');
    const description = urlParams.get('简介');

    // 设置图标、名称、图片和简介
    document.getElementById('iconImg').src = appIcon;
    document.getElementById('appName').innerText = appName;
    document.getElementById('img1').src = img1;
    document.getElementById('img2').src = img2;
    document.getElementById('description').innerText = description;

    let finalDownloadUrl = downloadLink; // 默认使用传入的下载链接

    // 解析蓝奏云或123盘的下载链接
    if (downloadLink.includes('lan')) {
        fetch(`https://api.pearktrue.cn/api/lanzou/api.php?url=${downloadLink}&pwd=${password}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.data && data.data.downloadurl) {
                    finalDownloadUrl = data.data.downloadurl;
                }
            });
    } else if (downloadLink.includes('123')) {
        fetch(`https://api.pearktrue.cn/api/123panparse/?url=${downloadLink}&pwd=${password}&Authorization=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk1ODY0MTUsImlhdCI6MTc1ODk4MTYxNSwiaWQiOjE4MTQ0MDc2NTAsIm1haWwiOiIiLCJuaWNrbmFtZSI6IjEzODE5NTUzMTUzIiwic3VwcGVyIjpmYWxzZSwidXNlcm5hbWUiOjEzODE5NTUzMTUzLCJ2IjowfQ.e0FhxQHT7UimTWfD1a8ootiebsLnKOcpI6xr1P7N0uQ`)
            .then(response => response.json())
            .then(data => {
                if (data && data.data && data.data.downloadurl) {
                    finalDownloadUrl = data.data.downloadurl;
                }
            });
    }

    // 点击下载按钮时打开链接
    document.getElementById('downloadButton').addEventListener('click', function() {
        window.open(finalDownloadUrl, '_blank'); // 新窗口打开下载链接
    });
};
