// 合并后的脚本，包含网络检查、签名检查、更新检查和公告功能，所有弹窗使用 CSS 模态框，网络检查弹窗简化

// 常量定义
const TRUSTED_SIGNATURE = "8AA48238D992B5C9CC35CD08D7E077EF";
const UPDATE_URL = "https://tfgjx.lanzoui.com/b03r523lc";
const PRIMARY_API_ANNOUNCEMENT = "https://api.kuleu.com/api/qqcollection?url=https://sharechain.qq.com/731f08793c54450e62e2d8f30655570c";
const BACKUP_API_1_ANNOUNCEMENT = "https://api.suyanw.cn/api/qq/qqsc.php?url=https://sharechain.qq.com/731f08793c54450e62e2d8f30655570c";
const BACKUP_API_2_ANNOUNCEMENT = "https://api.pearktrue.cn/api/qq/qqsc.php?url=https://sharechain.qq.com/731f08793c54450e62e2d8f30655570c";
const BACKUP_API_3_ANNOUNCEMENT = "https://api.kuleu.com/api/qqcollection?url=https://sharechain.qq.com/731f08793c54450e62e2d8f30655570c";
const PRIMARY_API_UPDATE = "https://api.kuleu.com/api/qqcollection?url=https://sharechain.qq.com/fba50ba12dc84bc3aca0ae519eac8da1";
const BACKUP_API_1_UPDATE = "https://api.suyanw.cn/api/qq/qqsc.php?url=https://sharechain.qq.com/fba50ba12dc84bc3aca0ae519eac8da1";
const BACKUP_API_2_UPDATE = "https://api.kuleu.com/api/qqcollection?url=https://sharechain.qq.com/fba50ba12dc84bc3aca0ae519eac8da1";
const BACKUP_API_3_UPDATE = "https://api.pearktrue.cn/api/qq/qqsc.php?url=https://sharechain.qq.com/fba50ba12dc84bc3aca0ae519eac8da1";
const SIMULATE_PRIMARY_FAILURE = false; // 测试开关：模拟主接口失败

// 全局 CSS 样式
function injectGlobalStyles() {
    if (document.querySelector('style#global-styles')) return;
    const style = document.createElement('style');
    style.id = 'global-styles';
    style.textContent = `
        .modern-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            transition: opacity 0.3s ease;
        }
        .modern-modal-container {
            background: #FFFFFF;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            animation: modalFadeIn 0.3s ease-out;
        }
        .modern-modal-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: #f8f8f8;
            border-bottom: 1px solid #eee;
        }
        .modern-modal-dots {
            display: flex;
            gap: 6px;
            margin-right: 8px;
        }
        .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .dot.red { background: #FF5F56; }
        .dot.yellow { background: #FFBD2E; }
        .dot.green { background: #27C93F; }
        .modern-modal-title {
            font-size: 14px;
            color: #555;
            font-weight: 500;
        }
        .modern-modal-body {
            padding: 24px 20px;
        }
        .modern-modal-top {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
        }
        .modern-modal-icon {
            width: 48px;
            height: 48px;
            margin-right: 16px;
            flex-shrink: 0;
            border-radius: 10px;
        }
        .modern-modal-version {
            margin: 0;
            color: #333;
            font-size: 16px;
            font-weight: 500;
            line-height: 1.5;
        }
        .modern-modal-updates {
            white-space: pre-wrap;
            font-size: 14px;
            color: #666;
            margin: 0;
            padding: 0;
            max-height: 200px;
            overflow-y: auto;
        }
        .version-badge {
            display: inline-block;
            background: #0098dc;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
        }
        .modern-modal-footer {
            display: flex;
            justify-content: flex-end;
            padding: 12px 16px;
            background: #f8f8f8;
            border-top: 1px solid #eee;
            gap: 8px;
        }
        .modern-modal-btn {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .modern-modal-btn.primary {
            background: #0098dc;
            color: white;
        }
        .modern-modal-btn.primary:hover {
            background: #007bb5;
        }
        .modern-modal-btn.secondary {
            background: transparent;
            color: #666;
        }
        .modern-modal-btn.secondary:hover {
            background: rgba(0, 0, 0, 0.05);
        }
        @media (prefers-color-scheme: dark) {
            .modern-modal-container {
                background: #2a2a2a;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            }
            .modern-modal-header {
                background: #333;
                border-bottom-color: #444;
            }
            .modern-modal-title {
                color: #ccc;
            }
            .modern-modal-version {
                color: #eee;
            }
            .modern-modal-updates {
                color: #aaa;
            }
            .modern-modal-footer {
                background: #333;
                border-top-color: #444;
            }
            .modern-modal-btn.secondary {
                color: #ccc;
            }
            .modern-modal-btn.secondary:hover {
                background: rgba(255, 255, 255, 0.1);
            }
        }
        @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

// 通用模态框显示函数
function showModernModal({ title, content, type, version, isMandatory = false, zIndex = 1000, onConfirm }) {
    // 移除同类型弹窗（避免重复）
    const existingModal = document.querySelector(`.modern-modal-overlay[data-type="${type}"]`);
    if (existingModal) return; // 直接返回，避免重复创建

    const overlay = document.createElement('div');
    overlay.className = 'modern-modal-overlay';
    overlay.dataset.type = type;
    overlay.style.zIndex = zIndex;

    const container = document.createElement('div');
    container.className = 'modern-modal-container';

    const header = document.createElement('div');
    header.className = 'modern-modal-header';
    header.innerHTML = `
        <div class="modern-modal-dots">
            <div class="dot red"></div>
            <div class="dot yellow"></div>
            <div class="dot green"></div>
        </div>
        <div class="modern-modal-title">${title}</div>
    `;

    const body = document.createElement('div');
    body.className = 'modern-modal-body';
    const top = document.createElement('div');
    top.className = 'modern-modal-top';

    if (type === 'update') {
        top.innerHTML = `
            <img src="favicon.png" class="modern-modal-icon" alt="favicon">
            <p class="modern-modal-version">发现新版本 <span class="version-badge">${version}</span></p>
        `;
    } else {
        top.innerHTML = `<p class="modern-modal-version">${title}</p>`;
    }

    const updates = document.createElement('pre');
    updates.className = 'modern-modal-updates';
    updates.textContent = content;

    body.appendChild(top);
    body.appendChild(updates);

    const footer = document.createElement('div');
    footer.className = 'modern-modal-footer';

    if (type === 'tamper') {
        footer.innerHTML = `
            <button class="modern-modal-btn secondary" id="tamperExitBtn">退出</button>
            <button class="modern-modal-btn primary" id="tamperGetOfficialBtn">获取正版</button>
        `;
    } else if (type === 'update') {
        footer.innerHTML = `
            <button class="modern-modal-btn secondary" id="updateCancelBtn">立即退出</button>
            <button class="modern-modal-btn primary" id="updateConfirmBtn">立即更新</button>
        `;
    } else if (type === 'announcement' && !isMandatory) {
        footer.innerHTML = `
            <button class="modern-modal-btn secondary" id="announcementCloseBtn">关闭</button>
            <button class="modern-modal-btn primary" id="announcementConfirmBtn">确定</button>
        `;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    } else if (type === 'announcement' && isMandatory) {
        footer.innerHTML = `<div style="color: #666; font-size: 14px;">正在维护…</div>`;
    } else if (type === 'alert') {
        footer.innerHTML = `<button class="modern-modal-btn primary" id="alertConfirmBtn">退出</button>`;
    }

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(footer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // 绑定事件
    if (type === 'tamper') {
        document.getElementById('tamperGetOfficialBtn').addEventListener('click', () => {
            try {
                webapp.browse(UPDATE_URL);
                console.log("Redirected to official version URL");
            } catch (e) {
                console.error("Failed to browse: ", e);
                webapp.toast("跳转失败，请手动访问正版链接！");
            }
        });
        document.getElementById('tamperExitBtn').addEventListener('click', () => {
            webapp.secede();
            console.log("App exited");
        });
    } else if (type === 'update') {
        document.getElementById('updateConfirmBtn').addEventListener('click', () => {
            webapp.browse(UPDATE_URL);
        });
        document.getElementById('updateCancelBtn').addEventListener('click', () => {
            webapp.secede();
        });
    } else if (type === 'announcement' && !isMandatory) {
        document.getElementById('announcementCloseBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('announcementConfirmBtn').addEventListener('click', () => overlay.remove());
    } else if (type === 'alert') {
        document.getElementById('alertConfirmBtn').addEventListener('click', () => {
            overlay.remove();
            if (onConfirm) onConfirm();
        });
    }
}

// 网络检查（简化，只显示一个弹窗）
function checkNetwork() {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('HEAD', 'https://www.baidu.com/favicon.ico?_=' + Date.now(), true);
        xhr.timeout = 2000;

        xhr.onload = () => resolve(true);

        xhr.onerror = xhr.ontimeout = () => {
            console.error("Network check failed: Error or timeout");
            showModernModal({
                title: "网络错误",
                content: "网络连接失败",
                type: "alert",
                zIndex: 1000,
                onConfirm: () => {
                    webapp.secede();
                    console.log("App exited due to network failure");
                }
            });
            resolve(false);
        };

        try {
            xhr.send();
        } catch (e) {
            console.error("Network check failed: ", e);
            showModernModal({
                title: "网络错误",
                content: "网络连接失败",
                type: "alert",
                zIndex: 1000,
                onConfirm: () => {
                    webapp.secede();
                    console.log("App exited due to network failure");
                }
            });
            resolve(false);
        }
    });
}


}

// 更新检查相关函数
function extractVersion(title) {
    if (typeof title !== "string") {
        title = title.toFixed(1);
    }
    console.log("服务器版本:", title);
    const match = title.match(/^(\d+\.\d+)$/);
    return match ? match[1] : null;
}

function compareVersions(current, latest) {
    const c = current.split('.').map(Number);
    const l = latest.split('.').map(Number);
    return c[0] < l[0] || (c[0] === l[0] && c[1] < l[1]) ? -1 : c[0] > l[0] || c[1] > l[1] ? 1 : 0;
}

async function fetchUpdateData(apiUrl, isAnnouncement = false) {
    if (SIMULATE_PRIMARY_FAILURE && apiUrl === (isAnnouncement ? PRIMARY_API_ANNOUNCEMENT : PRIMARY_API_UPDATE)) {
        throw new Error('模拟主接口失败');
    }
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`接口 ${apiUrl} 请求失败:`, error.message);
        throw error;
    }
}

async function checkForUpdate() {
    try {
        const currentVersion = webapp.getpage();
        console.log("当前版本号:", currentVersion);

        if (!currentVersion || !extractVersion(currentVersion)) {
            throw new Error('无法获取当前版本号或格式错误');
        }

        let data;
        const apis = [PRIMARY_API_UPDATE, BACKUP_API_1_UPDATE, BACKUP_API_2_UPDATE, BACKUP_API_3_UPDATE];
        for (let i = 0; i < apis.length; i++) {
            try {
                data = await fetchUpdateData(apis[i]);
                const successCode = (i === 1) ? 1 : 200;
                if (data.code !== successCode) throw new Error(`接口返回错误代码: ${data.code}`);
                console.log(`成功获取更新数据来自接口 ${i + 1}:`, data);
                break;
            } catch (error) {
                console.warn(`更新接口 ${i + 1} 失败:`, error.message);
                if (i === apis.length - 1) {
                    console.error("所有更新接口获取失败，直接放行");
                    return;
                }
            }
        }

        const latestVersion = extractVersion(data.data.summary.title);
        if (!latestVersion) throw new Error('服务器版本格式错误');

        const updateDetails = data.data.summary.brief.replace(/(\d+\.\s*)/g, '\n$1').trim();
        const comparison = compareVersions(currentVersion, latestVersion);

        if (comparison === -1) {
            showModernModal({
                title: "更新提示",
                content: updateDetails,
                type: "update",
                version: latestVersion,
                zIndex: 1000
            });
        } else if (comparison === 1) {
            showModernModal({
                title: "版本异常",
                content: "高于官方版本",
                type: "alert",
                zIndex: 1000,
                onConfirm: () => {
                    webapp.secede();
                    console.log("App exited due to higher version");
                }
            });
        } else {
            console.log('当前版本是最新的，无需更新');
        }
    } catch (error) {
        console.error('检查更新失败:', error.message);
        console.log('所有接口失效，直接放行');
    }
}

// 公告相关函数
async function fetchAnnouncement() {
    const lastPopupTimeKey = "lastPopupTime";
    const lastContentKey = "lastAnnouncementContent";

    let result;
    const apis = [PRIMARY_API_ANNOUNCEMENT, BACKUP_API_1_ANNOUNCEMENT, BACKUP_API_2_ANNOUNCEMENT, BACKUP_API_3_ANNOUNCEMENT];
    for (let i = 0; i < apis.length; i++) {
        try {
            result = await fetchUpdateData(apis[i], true);
            const successCode = (i === 1) ? 1 : 200;
            if (result.code !== successCode) throw new Error(`接口返回错误代码: ${result.code}`);
            console.log(`成功获取公告数据来自接口 ${i + 1}:`, result);
            break;
        } catch (error) {
            console.warn(`公告接口 ${i + 1} 失败:`, error.message);
            if (i === apis.length - 1) {
                console.error("所有公告接口获取失败");
                return;
            }
        }
    }

    if (!result || !result.data || !result.data.summary) {
        console.error("公告数据结构无效:", result);
        return;
    }

    try {
        const rawTitle = result.data.summary.title?.trim();
        const brief = result.data.summary.brief?.trim() || "";
        const currentContent = `${rawTitle}|${brief}`;

        const lastPopupTime = localStorage.getItem(lastPopupTimeKey);
        const lastContent = localStorage.getItem(lastContentKey) || "";

        const formattedBrief = brief.replace(/(\d+\.\s*)/g, '\n$1').trim();

        if (!rawTitle || rawTitle === "") {
            console.log("公告标题为空，不显示弹窗");
            return;
        }

        if (brief) {
            const isMandatory = rawTitle === "公告1";
            if (isMandatory) {
                showModernModal({
                    title: "公告",
                    content: formattedBrief,
                    type: "announcement",
                    isMandatory: true,
                    zIndex: 1000
                });
            } else if (!lastPopupTime || lastContent !== currentContent) {
                showModernModal({
                    title: "公告",
                    content: formattedBrief,
                    type: "announcement",
                    isMandatory: false,
                    zIndex: 1000
                });
                localStorage.setItem(lastPopupTimeKey, new Date().getTime());
                localStorage.setItem(lastContentKey, currentContent);
            } else {
                console.log("普通公告无需显示：内容未变更");
            }
        } else {
            console.log("公告内容为空，不显示弹窗");
        }
    } catch (error) {
        console.error("处理公告数据失败:", error);
    }
}

// 主逻辑
async function initializeApp() {
    // 注入全局样式
    injectGlobalStyles();

    // 1. 检查网络
    const isNetworkAvailable = await checkNetwork();
    if (!isNetworkAvailable) return;

    // 2. 检查签名
    const isSignatureValid = checkAppTampering();
    // 如果签名不正确，弹窗会持续显示，仍然允许后续检查

    // 3. 检查更新
    if (isSignatureValid) {
        await checkForUpdate();
    }

    // 4. 获取公告
    if (isSignatureValid) {
        await fetchAnnouncement();
    }

    // 页面恢复时重新检查签名
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            checkAppTampering();
        }
    });

    // 禁用返回键和右键（从 update.js）
    webapp.revert("");
    window.oncontextmenu = () => false;
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', initializeApp);