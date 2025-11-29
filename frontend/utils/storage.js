/**
 * 存储工具模块
 * 负责处理本地存储操作，包括token管理、用户数据缓存等
 */

// 调试日志 - 在文件最开始添加
console.log('Storage module loading started at', new Date().toISOString());

// 检查是否已经有getUserInfo函数
if (typeof window.getUserInfo !== 'undefined') {
    console.error('getUserInfo already exists at module load time:', window.getUserInfo);
}

// 存储键名常量
const STORAGE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    USER_INFO: 'user_info',
    THEME_PREFERENCE: 'theme_preference',
    PAGE_SIZE: 'page_size',
    LANGUAGE: 'language'
};

/**
 * 安全地设置localStorage项
 * @param {string} key - 存储键名
 * @param {*} value - 存储值
 */
function setLocalStorageItem(key, value) {
    try {
        const serializedValue = JSON.stringify(value);
        localStorage.setItem(key, serializedValue);
        return true;
    } catch (error) {
        console.error(`Error saving to localStorage (${key}):`, error);
        return false;
    }
}

/**
 * 安全地获取localStorage项
 * @param {string} key - 存储键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 存储的值或默认值
 */
function getLocalStorageItem(key, defaultValue = null) {
    try {
        const serializedValue = localStorage.getItem(key);
        if (serializedValue === null) {
            return defaultValue;
        }
        return JSON.parse(serializedValue);
    } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
}

/**
 * 安全地移除localStorage项
 * @param {string} key - 存储键名
 */
function removeLocalStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
        return false;
    }
}

/**
 * 安全地设置sessionStorage项
 * @param {string} key - 存储键名
 * @param {*} value - 存储值
 */
function setSessionStorageItem(key, value) {
    try {
        const serializedValue = JSON.stringify(value);
        sessionStorage.setItem(key, serializedValue);
        return true;
    } catch (error) {
        console.error(`Error saving to sessionStorage (${key}):`, error);
        return false;
    }
}

/**
 * 安全地获取sessionStorage项
 * @param {string} key - 存储键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 存储的值或默认值
 */
function getSessionStorageItem(key, defaultValue = null) {
    try {
        const serializedValue = sessionStorage.getItem(key);
        if (serializedValue === null) {
            return defaultValue;
        }
        return JSON.parse(serializedValue);
    } catch (error) {
        console.error(`Error reading from sessionStorage (${key}):`, error);
        return defaultValue;
    }
}

/**
 * 安全地移除sessionStorage项
 * @param {string} key - 存储键名
 */
function removeSessionStorageItem(key) {
    try {
        sessionStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from sessionStorage (${key}):`, error);
        return false;
    }
}

/**
 * 设置认证令牌
 * @param {string} token - JWT令牌
 */
export function setToken(token) {
    return setLocalStorageItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

/**
 * 获取认证令牌
 * @returns {string|null} JWT令牌或null
 */
export function getToken() {
    return getLocalStorageItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * 移除认证令牌
 */
export function removeToken() {
    return removeLocalStorageItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * 设置用户信息
 * @param {Object} userInfo - 用户信息对象
 */
export function setUserInfo(userInfo) {
    return setLocalStorageItem(STORAGE_KEYS.USER_INFO, userInfo);
}

/**
 * 从本地存储获取用户信息
 * @returns {Object|null} 用户信息对象或null
 */
export function getLocalUserInfo() {
    return getLocalStorageItem(STORAGE_KEYS.USER_INFO);
}

/**
 * 移除用户信息
 */
export function removeUserInfo() {
    return removeLocalStorageItem(STORAGE_KEYS.USER_INFO);
}

/**
 * 清除所有认证相关数据
 */
export function clearAuthData() {
    removeToken();
    removeUserInfo();
}

/**
 * 设置主题偏好
 * @param {string} theme - 主题名称 ('light' 或 'dark')
 */
export function setThemePreference(theme) {
    return setLocalStorageItem(STORAGE_KEYS.THEME_PREFERENCE, theme);
}

/**
 * 获取主题偏好
 * @returns {string} 主题名称
 */
export function getThemePreference() {
    return getLocalStorageItem(STORAGE_KEYS.THEME_PREFERENCE, 'light');
}

/**
 * 设置默认分页大小
 * @param {number} pageSize - 每页条数
 */
export function setDefaultPageSize(pageSize) {
    return setLocalStorageItem(STORAGE_KEYS.PAGE_SIZE, pageSize);
}

/**
 * 获取默认分页大小
 * @returns {number} 每页条数
 */
export function getDefaultPageSize() {
    return getLocalStorageItem(STORAGE_KEYS.PAGE_SIZE, 10);
}

/**
 * 设置语言偏好
 * @param {string} language - 语言代码
 */
export function setLanguagePreference(language) {
    return setLocalStorageItem(STORAGE_KEYS.LANGUAGE, language);
}

/**
 * 获取语言偏好
 * @returns {string} 语言代码
 */
export function getLanguagePreference() {
    return getLocalStorageItem(STORAGE_KEYS.LANGUAGE, 'zh-CN');
}

/**
 * 将数据缓存到sessionStorage，带过期时间
 * @param {string} key - 缓存键名
 * @param {*} data - 缓存数据
 * @param {number} ttl - 过期时间（毫秒）
 */
export function setCacheWithExpiry(key, data, ttl) {
    const now = new Date();
    const item = {
        data,
        expiry: now.getTime() + ttl
    };
    return setSessionStorageItem(key, item);
}

/**
 * 获取带过期时间的缓存数据
 * @param {string} key - 缓存键名
 * @returns {*} 缓存数据或null（如果过期或不存在）
 */
export function getCacheWithExpiry(key) {
    const itemStr = getSessionStorageItem(key);
    
    // 如果缓存不存在
    if (!itemStr) {
        return null;
    }
    
    const item = itemStr;
    const now = new Date();
    
    // 检查是否过期
    if (now.getTime() > item.expiry) {
        // 过期则删除缓存
        removeSessionStorageItem(key);
        return null;
    }
    
    return item.data;
}

/**
 * 清除所有缓存数据
 */
export function clearCache() {
    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('cache_')) {
            removeSessionStorageItem(key);
        }
    });
}

/**
 * 检查存储是否可用
 * @returns {boolean} 存储是否可用
 */
export function isStorageAvailable() {
    try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 获取存储使用情况
 * @returns {Object} 存储使用情况信息
 */
export function getStorageInfo() {
    let used = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            used += localStorage.getItem(key).length + key.length;
        }
    }
    return {
        used: used,
        usedMB: (used / 1024 / 1024).toFixed(2),
        quotaMB: '约5', // 浏览器通常限制为5MB
        percentageUsed: ((used / (5 * 1024 * 1024)) * 100).toFixed(2)
    };
}

// 导出存储键名常量供其他模块使用
export { STORAGE_KEYS };