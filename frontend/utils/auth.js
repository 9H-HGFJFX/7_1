/**
 * 权限验证组件
 * 统一处理用户认证和角色权限检查
 */

// 角色常量
export const ROLES = {
    READER: 'Reader',
    MEMBER: 'Member',
    ADMINISTRATOR: 'Administrator'
};

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
export function isLoggedIn() {
    const token = localStorage.getItem('token');
    return !!token;
}

/**
 * 获取当前登录用户信息
 * @returns {Object|null} 用户信息对象或null
 */
export function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('解析用户信息失败:', error);
        return null;
    }
}

/**
 * 获取用户角色
 * @returns {string} 用户角色
 */
export function getUserRole() {
    const user = getCurrentUser();
    return user?.role || ROLES.READER;
}

/**
 * 检查用户角色权限
 * @param {string} requiredRole - 所需角色
 * @returns {boolean} 是否有权限
 */
export function checkRole(requiredRole) {
    const userRole = getUserRole();
    
    // 定义角色权限层级
    const roleHierarchy = {
        [ROLES.READER]: 1,
        [ROLES.MEMBER]: 2,
        [ROLES.ADMINISTRATOR]: 3
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * 检查用户是否为成员或管理员
 * @returns {boolean} 是否有权限
 */
export function isMemberOrAdmin() {
    return checkRole(ROLES.MEMBER);
}

/**
 * 检查用户是否为管理员
 * @returns {boolean} 是否为管理员
 */
export function isAdmin() {
    return checkRole(ROLES.ADMINISTRATOR);
}

/**
 * 更新UI以反映当前认证状态
 */
export async function updateUIForAuth() {
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    const profileMenu = document.getElementById('profile-menu');
    const submitNewsLink = document.getElementById('submit-news-link');
    const userMenu = document.getElementById('user-menu');
    
    // 检查是否已登录
    const loggedIn = isLoggedIn();
    const user = getCurrentUser();
    
    // 更新登录/注册链接
    if (loginLink) loginLink.style.display = loggedIn ? 'none' : 'inline';
    if (registerLink) registerLink.style.display = loggedIn ? 'none' : 'inline';
    if (profileMenu) profileMenu.style.display = loggedIn ? 'block' : 'none';
    
    // 更新提交新闻链接（仅成员及以上可访问）
    if (submitNewsLink) {
        const canSubmitNews = loggedIn && isMemberOrAdmin();
        submitNewsLink.style.display = canSubmitNews ? 'inline' : 'none';
    }
    
    // 如果已登录，显示用户名
    if (loggedIn && user && userMenu) {
        const usernameElement = document.getElementById('current-username');
        if (!usernameElement) {
            const usernameSpan = document.createElement('span');
            usernameSpan.id = 'current-username';
            usernameSpan.textContent = `${user.firstName} ${user.lastName}`;
            usernameSpan.style.marginRight = '1rem';
            usernameSpan.style.color = '#3498db';
            usernameSpan.style.fontWeight = '500';
            
            // 插入到profile-menu前面
            userMenu.insertBefore(usernameSpan, profileMenu);
        } else {
            usernameElement.textContent = `${user.firstName} ${user.lastName}`;
        }
    }
}

/**
 * 保存认证信息到本地存储
 * @param {string} token - JWT令牌
 * @param {Object} user - 用户信息
 */
export function saveAuthInfo(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

/**
 * 清除认证信息
 */
export function clearAuthInfo() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

/**
 * 获取认证头
 * @returns {Object} 请求头对象
 */
export function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * 重定向到登录页
 * @param {string} returnUrl - 登录后返回的URL
 */
export function redirectToLogin(returnUrl = window.location.href) {
    // 保存当前URL，以便登录后返回
    localStorage.setItem('returnUrl', returnUrl);
    window.location.href = 'login.html';
}

/**
 * 从登录页返回
 */
export function returnFromLogin() {
    const returnUrl = localStorage.getItem('returnUrl');
    if (returnUrl) {
        localStorage.removeItem('returnUrl');
        window.location.href = returnUrl;
    } else {
        window.location.href = 'index.html';
    }
}

/**
 * 检查权限并执行操作，如果没有权限则提示或重定向
 * @param {string} requiredRole - 所需角色
 * @param {Function} action - 有权限时执行的操作
 * @param {boolean} redirect - 无权限时是否重定向到登录页
 * @returns {boolean} 是否执行了操作
 */
export function checkPermissionAndDo(requiredRole, action, redirect = true) {
    if (checkRole(requiredRole)) {
        action();
        return true;
    } else {
        if (!isLoggedIn()) {
            if (redirect) {
                redirectToLogin();
            } else {
                alert('请先登录');
            }
        } else {
            alert('您没有权限执行此操作');
        }
        return false;
    }
}

/**
 * 初始化页面权限检查
 * 可以在需要权限的页面调用此函数进行权限验证
 * @param {string} requiredRole - 页面所需最低角色
 */
export function initPagePermission(requiredRole = ROLES.READER) {
    // 如果用户未登录且需要登录才能访问
    if (!isLoggedIn()) {
        // Reader角色不需要登录也能访问部分内容（如新闻列表查看）
        if (requiredRole !== ROLES.READER) {
            redirectToLogin();
        }
    } else {
        // 如果用户已登录但角色权限不足
        if (!checkRole(requiredRole)) {
            alert('您没有权限访问此页面');
            window.history.back();
        }
    }
}