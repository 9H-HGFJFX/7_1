/**
 * API Utility Module
 * Responsible for handling all HTTP communications with the backend server
 */

import { getToken } from './storage.js';

// API Base URL Configuration - Uses global variable or default value in browser environment
// In production environment, ensure API_URL is correctly set during deployment
const API_BASE_URL = window.API_URL || 'https://anti-fake-news-backend.onrender.com/api' || 'http://localhost:3001/api';

// 请求超时设置（毫秒）
const REQUEST_TIMEOUT = 10000;

// 调试日志
console.log('API module loaded at', new Date().toISOString());
// 添加全局函数检测
if (window.getUserInfo) {
    console.error('getUserInfo already exists in window:', window.getUserInfo);
}

/**
 * Create fetch request with timeout
 * @param {string} url - Request URL
 * @param {Object} options - fetch options
 * @param {number} timeout - Timeout duration
 * @returns {Promise} Request Promise
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
 * Handle API response
 * @param {Response} response - fetch response object
 * @returns {Promise<Object>} Processed response data
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
        console.error('Failed to parse response:', error);
        throw new Error('Failed to parse response');
    }
    
    if (!response.ok) {
        // Handle HTTP error
        const errorMessage = data.message || `HTTP error ${response.status}`;
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
 * Build API request options
 * @param {string} method - HTTP method
 * @param {Object|null} body - Request body data
 * @param {Object} additionalHeaders - Additional request headers
 * @param {boolean} requiresAuth - Whether authentication is required
 * @returns {Object} fetch options object
 */
function buildRequestOptions(method, body = null, additionalHeaders = {}, requiresAuth = true) {
    const headers = {
        'Content-Type': 'application/json',
        ...additionalHeaders
    };
    
    // Add authentication token
    if (requiresAuth) {
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const options = {
        method,
        headers,
        credentials: 'include' // Include cookies
    };
    
    // Add request body (if available)
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }
    
    return options;
}

/**
 * Universal API request function
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {Object|null} body - Request body data
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} API response data
 */
async function apiRequest(endpoint, method = 'GET', body = null, options = {}) {
    const { 
        requiresAuth = true, 
        additionalHeaders = {},
        timeout = REQUEST_TIMEOUT,
        useCache = false,
        cacheKey = null
    } = options;
    
    // Build full URL
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Check cache (only for GET requests)
    if (method === 'GET' && useCache && cacheKey) {
        const cachedData = getCache(cacheKey);
        if (cachedData) {
            console.log(`Fetching data from cache: ${cacheKey}`);
            return cachedData;
        }
    }
    
    try {
        // Build request options
        const requestOptions = buildRequestOptions(method, body, additionalHeaders, requiresAuth);
        
        // 发送请求
        console.log(`Sending ${method} request to: ${url}`);
        const response = await fetchWithTimeout(url, requestOptions, timeout);
        
        // Handle response
        const data = await handleResponse(response);
        
        // Cache response (only for GET requests)
        if (method === 'GET' && useCache && cacheKey) {
            setCache(cacheKey, data);
        }
        
        return data;
    } catch (error) {
        console.error(`API request failed (${method} ${endpoint}):`, error);
        throw error;
    }
}

/**
 * Get cached data (simple implementation, real projects might use more complex caching strategies)
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data
 */
function getCache(key) {
    try {
        const cached = localStorage.getItem(`api_cache_${key}`);
        if (!cached) return null;
        
        const { data, timestamp, ttl } = JSON.parse(cached);
        const now = Date.now();
        
        // Check if expired (default 5 minutes)
        if (now - timestamp > (ttl || 5 * 60 * 1000)) {
            localStorage.removeItem(`api_cache_${key}`);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Failed to get cache:', error);
        return null;
    }
}

/**
 * Set cached data
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
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
        console.error('Failed to set cache:', error);
    }
}

/**
 * Clear API cache
 * @param {string|null} key - Optional specific cache key
 */
export function clearApiCache(key = null) {
    if (key) {
        localStorage.removeItem(`api_cache_${key}`);
    } else {
        // Clear all API caches
        Object.keys(localStorage).forEach(item => {
            if (item.startsWith('api_cache_')) {
                localStorage.removeItem(item);
            }
        });
    }
}

// ===== User-Related API =====

/**
 * User login
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - Email
 * @param {string} credentials.password - Password
 * @returns {Promise<Object>} Login response
 */
export async function login(credentials) {
    return apiRequest('/users/login', 'POST', credentials, { requiresAuth: false });
}

/**
 * User registration
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Registration response
 */
export async function register(userData) {
    return apiRequest('/users/register', 'POST', userData, { requiresAuth: false });
}

// 临时注释掉fetchUserInfo函数以测试
// /**
//  * Get current user information
//  * @returns {Promise<Object>} User information
//  */
// export async function fetchUserInfo() {
//     return apiRequest('/users/profile');
// }

/**
 * Update user information
 * @param {Object} userData - Updated user data
 * @returns {Promise<Object>} Updated user information
 */
export async function updateUserProfile(userData) {
    return apiRequest('/users/profile', 'PUT', userData);
}

/**
 * Update user password
 * @param {Object} passwordData - Password data
 * @param {string} passwordData.currentPassword - Current password
 * @param {string} passwordData.newPassword - New password
 * @returns {Promise<Object>} Update result
 */
export async function updatePassword(passwordData) {
    return apiRequest('/users/password', 'PUT', passwordData);
}

/**
 * Get user list (Admin)
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} User list
 */
export async function getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * Get single user details (Admin)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User details
 */
export async function getUserById(userId) {
    return apiRequest(`/users/${userId}`);
}

/**
 * Set user role (Admin)
 * @param {string} userId - User ID
 * @param {Object} roleData - Role data
 * @param {string} roleData.role - New role
 * @returns {Promise<Object>} Update result
 */
export async function setUserRole(userId, roleData) {
    return apiRequest(`/users/${userId}/role`, 'PUT', roleData);
}

// ===== News-Related API =====

/**
 * Get news list
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} News list and pagination info
 */
export async function fetchNews(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/news${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint, 'GET', null, { useCache: params.page === 1 && !params.search });
}

/**
 * Get news details
 * @param {string} newsId - News ID
 * @returns {Promise<Object>} News details
 */
export async function getNewsById(newsId) {
    return apiRequest(`/news/${newsId}`, 'GET', null, { useCache: true });
}

/**
 * Submit news
 * @param {Object} newsData - News data
 * @returns {Promise<Object>} Created news
 */
export async function submitNews(newsData) {
    return apiRequest('/news', 'POST', newsData);
}

/**
 * Update news
 * @param {string} newsId - News ID
 * @param {Object} newsData - Updated news data
 * @returns {Promise<Object>} Updated news
 */
export async function updateNews(newsId, newsData) {
    return apiRequest(`/news/${newsId}`, 'PUT', newsData);
}

/**
 * Delete news (Admin)
 * @param {string} newsId - News ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteNews(newsId) {
    return apiRequest(`/news/${newsId}`, 'DELETE');
}

/**
 * Update news status (Admin)
 * @param {string} newsId - News ID
 * @param {Object} statusData - Status data
 * @param {string} statusData.status - New status
 * @returns {Promise<Object>} Update result
 */
export async function updateNewsStatus(newsId, statusData) {
    return apiRequest(`/news/${newsId}/status`, 'PUT', statusData);
}

/**
 * Recalculate news vote scores (Admin)
 * @param {string} newsId - News ID
 * @returns {Promise<Object>} Calculation result
 */
export async function recalculateNewsVotes(newsId) {
    return apiRequest(`/news/${newsId}/recalculate-votes`, 'POST');
}

// ===== Voting-Related API =====

/**
 * Submit vote
 * @param {Object} voteData - Vote data
 * @param {string} voteData.newsId - News ID
 * @param {string} voteData.voteResult - Vote result ('Fake' or 'Not Fake')
 * @returns {Promise<Object>} Vote result
 */
export async function submitVote(voteData) {
    return apiRequest('/votes', 'POST', voteData);
}

/**
 * Get user vote for specific news
 * @param {string} newsId - News ID
 * @returns {Promise<Object|null>} Vote info or null
 */
export async function getUserVoteForNews(newsId) {
    return apiRequest(`/votes/user/${newsId}`);
}

/**
 * Get news vote statistics
 * @param {string} newsId - News ID
 * @returns {Promise<Object>} Vote statistics data
 */
export async function getNewsVoteStats(newsId) {
    return apiRequest(`/votes/stats/${newsId}`, 'GET', null, { useCache: true });
}

/**
 * Get all vote records for news (Admin)
 * @param {string} newsId - News ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Vote records list
 */
export async function getNewsVotes(newsId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/votes/news/${newsId}${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * Mark vote as invalid (Admin)
 * @param {string} voteId - Vote ID
 * @returns {Promise<Object>} Update result
 */
export async function invalidateVote(voteId) {
    return apiRequest(`/votes/${voteId}/invalidate`, 'PUT');
}

/**
 * Get user vote history
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Vote history list
 */
export async function getUserVotes(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/votes/history${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

// ===== Comment-Related API =====

/**
 * Get news comments list
 * @param {string} newsId - News ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Comments list and pagination info
 */
export async function getNewsComments(newsId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/comments/news/${newsId}${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * Submit comment
 * @param {Object} commentData - Comment data
 * @param {string} commentData.newsId - News ID
 * @param {string} commentData.content - Comment content
 * @param {string} [commentData.imageUrl] - Image URL (optional)
 * @returns {Promise<Object>} Created comment
 */
export async function submitComment(commentData) {
    return apiRequest('/comments', 'POST', commentData);
}

/**
 * Delete comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteComment(commentId) {
    return apiRequest(`/comments/${commentId}`, 'DELETE');
}

/**
 * Update comment
 * @param {string} commentId - Comment ID
 * @param {Object} commentData - Updated comment data
 * @returns {Promise<Object>} Updated comment
 */
export async function updateComment(commentId, commentData) {
    return apiRequest(`/comments/${commentId}`, 'PUT', commentData);
}

/**
 * Get comment details
 * @param {string} commentId - Comment ID
 * @returns {Promise<Object>} Comment details
 */
export async function getCommentById(commentId) {
    return apiRequest(`/comments/${commentId}`);
}

/**
 * Get all comments (Admin)
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Comments list
 */
export async function getAllComments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/comments${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

/**
 * Get current user's comments list
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Comments list
 */
export async function getUserComments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/comments/user${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
}

// Export API base configuration
export const apiConfig = {
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT
};

// Default export universal request function
export default apiRequest;