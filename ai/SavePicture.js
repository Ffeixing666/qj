// 全局长按保存图片功能
if (typeof webapp !== 'undefined') {
    window.webapp.script(`
        window.addEventListener('load', function() {
            window.webapp.lasting("bzyimg"); // 设置长按回调
            window.webapp.hidden(false); // 关闭下载确认弹窗
            window.bzyimg = function(imga, imgb) {
                if (imga == 1 || imga == 2) { // 1: 单纯图片, 2: 链接图片
                    const result = confirm('保存图片?');
                    if (result) {
                        if (imgb.startsWith("http://") || imgb.startsWith("https://")) {
                            // 处理网络图片
                            var link = document.createElement('a');
                            link.href = imgb;
                            link.download = 'image_' + Date.now() + '.png';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } else if (imgb.startsWith("file://") && !imgb.startsWith("file:///android_asset/")) {
                            // 处理普通本地文件（非 assets）
                            var srcPath = imgb.replace("file://", "");
                            var base64Data = window.webapp.gainfile(srcPath);
                            if (base64Data) {
                                var extension = srcPath.split('.').pop().toLowerCase() || 'png';
                                var dataUrl = 'data:image/' + extension + ';base64,' + base64Data;
                                window.webapp.storage('image_' + Date.now() + '.' + extension, dataUrl);
                                alert('图片已保存至 /storage/emulated/0/Download/');
                            } else {
                                alert('无法读取本地图片数据');
                            }
                        } else if (imgb.startsWith("data:image/")) {
                            // 处理 Base64 Data URL
                            var extension = imgb.split(';')[0].split('/')[1] || 'png';
                            window.webapp.storage('image_' + Date.now() + '.' + extension, imgb);
                            alert('图片已保存至 /storage/emulated/0/Download/');
                        } else if (imgb.startsWith("file:///android_asset/")) {
                            // 处理 assets 文件夹图片
                            var assetPath = imgb.replace("file:///android_asset/", "");
                            var base64Data = window.webapp.getfile(assetPath);
                            if (base64Data) {
                                var extension = assetPath.split('.').pop().toLowerCase() || 'png';
                                var dataUrl = 'data:image/' + extension + ';base64,' + base64Data;
                                window.webapp.storage('image_' + Date.now() + '.' + extension, dataUrl);
                                alert('图片已保存至 /storage/emulated/0/Download/');
                            } else {
                                alert('无法从 assets 文件夹读取图片数据');
                            }
                        } else {
                            alert('不支持保存此图片格式: ' + imgb);
                        }
                    }
                }
            };
        });
    `);

    // 确保脚本只加载一次，避免重复刷新
    if (!sessionStorage.getItem('hasReloaded')) {
        sessionStorage.setItem('hasReloaded', 'true');
        location.reload();
    }
}