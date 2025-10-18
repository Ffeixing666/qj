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
    
    // 只在有密码时显示密码容器
    const passwordContainer = document.getElementById('password-container');
    if (password && password.trim() !== '') {
        document.getElementById('password-value').innerText = password;
        
        // 复制密码功能
        document.getElementById('copy-button').addEventListener('click', function() {
            navigator.clipboard.writeText(password).then(function() {
                const copyMessage = document.getElementById('copy-message');
                copyMessage.style.display = 'inline';
                setTimeout(function() {
                    copyMessage.style.display = 'none';
                }, 2000);
            }).catch(function(err) {
                console.error('无法复制密码: ', err);
            });
        });
    } else {
        // 如果没有密码，隐藏整个密码容器
        passwordContainer.style.display = 'none';
    }

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
        fetch(`https://api.pearktrue.cn/api/123panparse/?url=${downloadLink}&pwd=${password}&Authorization=1`)
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
