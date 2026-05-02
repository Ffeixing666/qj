function setDateAndGreeting() {
    var now = new Date();
    var days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
    
    var dateStr = months[now.getMonth()] + now.getDate() + '. ' + days[now.getDay()];
    document.querySelector('.date').textContent = dateStr;
    
    var hours = now.getHours();
    var greeting = '';
    
    if (hours >= 5 && hours < 11) {
        greeting = '早上好';
    } else if (hours >= 11 && hours < 17) {
        greeting = '下午好';
    } else {
        greeting = '晚上好';
        document.body.className = 'night';
    }
    
    document.querySelector('.greeting').textContent = greeting;
}

function navigate(url) {
    if (url === 'clean_cache') {
        showTip('清理完成');
        return;
    }
    window.location.href = url;
}

function shareApp() {
    navigator.clipboard.writeText('我发现了一个宝藏网站--趣加应用，分享给你：https://qujiaweb.top（推荐在浏览器打开）')
    
    if (navigator.share) {
        navigator.share({
            title: '趣加应用分享',
            text: '我发现了一个宝藏网站--趣加应用，分享给你：https://qujiaweb.top（推荐在浏览器打开）',
            url: 'https://qujiaweb.top'
        }).catch(err => {
            console.log('分享失败:', err);
            fallbackShare();
        });
    } else {
        
        fallbackShare();
    }
}
function showTip(msg) {
    const tip = document.getElementById('copy-tip');
    tip.textContent = msg;
    tip.style.display = 'block';
    setTimeout(() => {
        tip.style.display = 'none';
    }, 2000); 
}

function fallbackShare() { 
     showTip('复制成功，去粘贴吧');
}




window.onload = function() {
    setDateAndGreeting(); 

    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
        
        window.location.href = "https://qujiaweb.top/";
    }
};
