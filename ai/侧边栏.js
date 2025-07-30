window.addEventListener('load', function() {
    let sidebar = document.getElementById('sidebar');
    let overlay = document.createElement('div');
    overlay.id = 'overlay';
    document.body.appendChild(overlay);

    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', function(event) {
        touchStartX = event.changedTouches[0].screenX;
        touchStartY = event.changedTouches[0].screenY;
    }, false);

    document.addEventListener('touchend', function(event) {
        touchEndX = event.changedTouches[0].screenX;
        touchEndY = event.changedTouches[0].screenY;
        handleSwipeGesture();
    }, false);

    overlay.addEventListener('click', function() {
        hideSidebar();
    });

    let openSidebarBtn = document.getElementById('openSidebarBtn');
    openSidebarBtn.addEventListener('click', function() {
        showSidebar();
    });

    function handleSwipeGesture() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // 计算滑动的角度
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

        // 设定一个阈值，只有在水平滑动的情况下才会显示侧边栏
        const horizontalThreshold = 30; // 水平滑动的阈值
        const verticalThreshold = 20; // 垂直滑动的阈值

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > horizontalThreshold) {
            if (deltaX > 50) {
                showSidebar(); // 右滑显示侧边栏
            } else if (deltaX < -50) {
                hideSidebar(); // 左滑隐藏侧边栏
            }
        }
    }

    function showSidebar() {
        sidebar.style.left = '0'; // 显示侧边栏
        overlay.style.display = 'block'; // 显示遮罩层
        openSidebarBtn.style.display = 'none'; // 隐藏打开侧边栏按钮
    }

    function hideSidebar() {
        sidebar.style.left = '-250px'; // 隐藏侧边栏
        overlay.style.display = 'none'; // 隐藏遮罩层
        openSidebarBtn.style.display = 'block'; // 显示打开侧边栏按钮
    }
});