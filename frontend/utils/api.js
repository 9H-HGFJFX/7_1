/**
 * API工具模块
 * 负责处理与后端服务器的所有HTTP通信
 */

import { getToken } from './storage.js';

// API基础URL配置 - 支持从环境变量读取
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// 请求超时设置（毫秒）
const REQUEST_TIMEOUT = 10000;

// 调试日志
console.log('API module loaded at', new Date().toISOString());
// 添加全局函数检测
if (window.getUserInfo) {
    console.error('getUserInfo already exists in window:', window.getUserInfo);
}

/**
 * 创建带超时的fetch请求
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间
 * @returns {Promise} 请求Promise
 */
function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
}

/**
 * 处理API响应
 * @param {Response} response - fetch响应对象
 * @returns {Promise<Object>} 处理后的响应数据
 */
async function handleResponse(response) {
    const contentType = response.headers.get('content-type');
    let data;
    
    try {
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
    } catch (error) {
        console.error('解析响应失败:', error);
        throw new Error('解析响应失败');
    }
    
    if (!response.ok) {
        // 处理HTTP错误
        const errorMessage = data.message || `HTTP错误 ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        
        // 处理401未授权错误，自动登出
        if (response.status === 401) {
            auth.logout();
            window.location.href = '/login.html?sessionExpired=true';
        }
        
        throw error;
    }
    
    return data;
}

/**
 * 构建API请求选项
 * @param {string} method - HTTP方法
 * @param {Object|null} body - 请求体数据
 * @param {Object} additionalHeaders - 额外的请求头
 * @param {boolean} requiresAuth - 是否需要认证
 * @returns {Object} fetch选项对象
 */
function buildRequestOptions(method, body = null, additionalHeaders = {}, requiresAuth = true) {
    const headers = {
        'Content-Type': 'application/json',
        ...additionalHeaders
    };
    
    // 添加认证令牌
    if (requiresAuth) {
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const options = {
        method,
        headers,
        credentials: 'include' // 包含cookies
    };
    
    // 添加请求体（如果有）
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }
    
    return options;
}

/**
 * 通用API请求函数
 * @param {string} endpoint - API端点
 * @param {string} method - HTTP方法
 * @param {Object|null} body - 请求体数据
 * @param {Object} options - 额外选项
 * @returns {Promise<Object>} API响应数据
 */
async function apiRequest(endpoint, method = 'GET', body = null, options = {}) {
    const { 
        requiresAuth = true, 
        additionalHeaders = {},
        timeout = REQUEST_TIMEOUT,
        useCache = false,
        cacheKey = null
    } = options;
    
    // 构建完整URL
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 检查缓存（仅适用于GET请求）
    if (method === 'GET' && useCache && cacheKey) {
        const cachedData = getCache(cacheKey);
        if (cachedData) {
            console.log(`从缓存获取数据: ${cacheKey}`);
            return cachedData;
        }
    }
    
    try {
        // 构建请求选项
        const requestOptions = buildRequestOptions(method, body, additionalHeaders, requiresAuth);
        
        // 发送请求
        console.log(`发送${method}请求到: ${url}`);
        const response = await fetchWithTimeout(url, requestOptions, timeout);
        
        // 处理响应
        const data = await handleResponse(response);
        
        // 缓存响应（仅适用于GET请求）
        if (method === 'GET' && useCache && cacheKey) {
            setCache(cacheKey, data);
        }
        
        return data;
    } catch (error) {
        console.error(`API请求失败 (${method} ${endpoint}):`, error);
        throw error;
    }
}

/**
 * 获取缓存数据（简单实现，实际项目可能使用更复杂的缓存策略）
 * @param {string} key - 缓存键
 * @returns {Object|null} 缓存数据
 */
function getCache(key) {
    try {
        const cached = localStorage.getItem(`api_cache_${key}`);
        if (!cached) return null;
        
        const { data, timestamp, ttl } = JSON.parse(cached);
        const now = Date.now();
        
        // 检查是否过期（默认5分钟）
        if (now - timestamp > (ttl || 5 * 60 * 1000)) {
            localStorage.removeItem(`api_cache_${key}`);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('获取缓存失败:', error);
        return null;
    }
}

/**
 * 设置缓存数据
 * @param {string} key - 缓存键
 * @param {Object} data - 要缓存的数据
 * @param {number} ttl - 过期时间（毫秒）
 */
function setCache(key, data, ttl) {
    try {
        const cacheItem = {
            data,
            timestamp: Date.now(),
            ttl
        };
        localStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
        console.error('设置缓存失败:', error);
    }
}

/**
 * 清除API缓存
 * @param {string|null} key - 可选的特定缓存键
 */
export function clearApiCache(key = null) {
    if (key) {
        localStorage.removeItem(`api_cache_${key}`);
    } else {
        // 清除所有API缓存
        Object.keys(localStorage).forEach(item => {
            if (item.startsWith('api_cache_')) {
                localStorage.removeItem(item);
            }
        });
    }
}

// ===== 用户相关API =====

/**
 * 用户登录
 * @param {Object} credentials - 登录凭证
 * @param {string} credentials.email - 邮箱
 * @param {string} credentials.password - 密码
 * @returns {Promise<Object>} 登录响应
 */
export async function login(credentials) {
    return apiRequest('/users/login', 'POST', credentials, { requiresAuth: false });
}

/**
 * 用户注册
 * @param {Object} userData - 用户数据
 * @returns {Promise<Object>} 注册响应
 */
export async function register(userData) {
    return apiRequest('/users/register', 'POST', userData, { requiresAuth: false });
}

// 临时注释掉fetchUserInfo函数以测试
// /**
//  * 获取当前用户信息
//  * @returns {Promise<Object>} 用户信息
//  */
// export async function fetchUserInfo() {
//     return apiRequest('/users/profile');
// }

/**
 * 更新用户信息
 * @param {Object} userData - 更新的用户数据
 * @returns {Promise<Object>} 更新后的用户信息
 */
export async function updateUserProfile(userData) {
    return apiRequest('/users/profile', 'PUT', userData);
}

/**
 * 更新用户密码
 * @param {Object} passwordData - 密码数据
 * @param {string} passwordData.currentPassword - 当前密码
 * @param {string} passwordData.newPassword - 新密码
 * @returns {Promise<Object>} 更新结果
 */
export async function updatePassword(passwordData) {
    return apiRequest('/users/password', 'PUT', passwordData);
}

/**
 * 获取用户列表（管理员）
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 用户列表
 */
export async function getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * 获取单个用户详情（管理员）
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 用户详情
 */
export async function getUserById(userId) {
    return apiRequest(`/users/${userId}`);
}

/**
 * 设置用户角色（管理员）
 * @param {string} userId - 用户ID
 * @param {Object} roleData - 角色数据
 * @param {string} roleData.role - 新角色
 * @returns {Promise<Object>} 更新结果
 */
export async function setUserRole(userId, roleData) {
    return apiRequest(`/users/${userId}/role`, 'PUT', roleData);
}

// ===== 新闻相关API =====

/**
 * 获取新闻列表
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 新闻列表和分页信息
 */
export async function fetchNews(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/news${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint, 'GET', null, { useCache: params.page === 1 && !params.search });
}

/**
 * 获取新闻详情
 * @param {string} newsId - 新闻ID
 * @returns {Promise<Object>} 新闻详情
 */
export async function getNewsById(newsId) {
    return apiRequest(`/news/${newsId}`, 'GET', null, { useCache: true });
}

/**
 * 提交新闻
 * @param {Object} newsData - 新闻数据
 * @returns {Promise<Object>} 创建的新闻
 */
export async function submitNews(newsData) {
    return apiRequest('/news', 'POST', newsData);
}

/**
 * 更新新闻
 * @param {string} newsId - 新闻ID
 * @param {Object} newsData - 更新的新闻数据
 * @returns {Promise<Object>} 更新后的新闻
 */
export async function updateNews(newsId, newsData) {
    return apiRequest(`/news/${newsId}`, 'PUT', newsData);
}

/**
 * 删除新闻（管理员）
 * @param {string} newsId - 新闻ID
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteNews(newsId) {
    return apiRequest(`/news/${newsId}`, 'DELETE');
}

/**
 * 更新新闻状态（管理员）
 * @param {string} newsId - 新闻ID
 * @param {Object} statusData - 状态数据
 * @param {string} statusData.status - 新状态
 * @returns {Promise<Object>} 更新结果
 */
export async function updateNewsStatus(newsId, statusData) {
    return apiRequest(`/news/${newsId}/status`, 'PUT', statusData);
}

/**
 * 重新计算新闻投票分数（管理员）
 * @param {string} newsId - 新闻ID
 * @returns {Promise<Object>} 计算结果
 */
export async function recalculateNewsVotes(newsId) {
    return apiRequest(`/news/${newsId}/recalculate-votes`, 'POST');
}

// ===== 投票相关API =====

/**
 * 提交投票
 * @param {Object} voteData - 投票数据
 * @param {string} voteData.newsId - 新闻ID
 * @param {string} voteData.voteResult - 投票结果 ('Fake' 或 'Not Fake')
 * @returns {Promise<Object>} 投票结果
 */
export async function submitVote(voteData) {
    return apiRequest('/votes', 'POST', voteData);
}

/**
 * 获取用户对特定新闻的投票
 * @param {string} newsId - 新闻ID
 * @returns {Promise<Object|null>} 投票信息或null
 */
export async function getUserVoteForNews(newsId) {
    return apiRequest(`/votes/user/${newsId}`);
}

/**
 * 获取新闻投票统计
 * @param {string} newsId - 新闻ID
 * @returns {Promise<Object>} 投票统计数据
 */
export async function getNewsVoteStats(newsId) {
    return apiRequest(`/votes/stats/${newsId}`, 'GET', null, { useCache: true });
}

/**
 * 获取新闻所有投票记录（管理员）
 * @param {string} newsId - 新闻ID
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 投票记录列表
 */
export async function getNewsVotes(newsId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/votes/news/${newsId}${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * 标记投票为无效（管理员）
 * @param {string} voteId - 投票ID
 * @returns {Promise<Object>} 更新结果
 */
export async function invalidateVote(voteId) {
    return apiRequest(`/votes/${voteId}/invalidate`, 'PUT');
}

/**
 * 获取用户投票历史
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 投票历史列表
 */
export async function getUserVotes(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/votes/history${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

// ===== 评论相关API =====

/**
 * 获取新闻评论列表
 * @param {string} newsId - 新闻ID
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 评论列表和分页信息
 */
export async function getNewsComments(newsId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/comments/news/${newsId}${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * 提交评论
 * @param {Object} commentData - 评论数据
 * @param {string} commentData.newsId - 新闻ID
 * @param {string} commentData.content - 评论内容
 * @param {string} [commentData.imageUrl] - 图片URL（可选）
 * @returns {Promise<Object>} 创建的评论
 */
export async function submitComment(commentData) {
    return apiRequest('/comments', 'POST', commentData);
}

/**
 * 删除评论
 * @param {string} commentId - 评论ID
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteComment(commentId) {
    return apiRequest(`/comments/${commentId}`, 'DELETE');
}

/**
 * 更新评论
 * @param {string} commentId - 评论ID
 * @param {Object} commentData - 更新的评论数据
 * @returns {Promise<Object>} 更新后的评论
 */
export async function updateComment(commentId, commentData) {
    return apiRequest(`/comments/${commentId}`, 'PUT', commentData);
}

/**
 * 获取评论详情
 * @param {string} commentId - 评论ID
 * @returns {Promise<Object>} 评论详情
 */
export async function getCommentById(commentId) {
    return apiRequest(`/comments/${commentId}`);
}

/**
 * 获取所有评论（管理员）
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 评论列表
 */
export async function getAllComments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/comments${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * 获取当前用户的评论列表
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 评论列表
 */
export async function getUserComments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/comments/user${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

// 导出API基础配置
export const apiConfig = {
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT
};

// 默认导出通用请求函数
export default apiRequest;