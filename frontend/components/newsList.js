import { fetchNews } from '../utils/api.js';
import { formatDate } from '../utils/helpers.js';

// News List Container
let newsListContainer = null;
let loadingIndicator = null;
let errorMessageElement = null;
let emptyStateElement = null;
let paginationElement = null;

// State Management
let currentPage = 1;
let currentPageSize = 10;
let currentFilter = 'all';
let currentSearch = '';
let totalItems = 0;
let totalPages = 1;

/**
 * Initialize News List
 * @param {number} page - Current page number
 * @param {number} pageSize - Items per page
 * @param {string} searchQuery - Search keyword
 * @param {string} filter - Filter condition
 */
export async function initNewsList(page = 1, pageSize = 10, searchQuery = '', filter = 'all') {
    // 更新状态
    currentPage = page;
    currentPageSize = pageSize;
    currentSearch = searchQuery;
    currentFilter = filter;
    
    // 获取DOM元素
    newsListContainer = document.getElementById('news-list');
    loadingIndicator = document.getElementById('loading-indicator');
    errorMessageElement = document.getElementById('error-message');
    emptyStateElement = document.getElementById('empty-state');
    paginationElement = document.getElementById('pagination');
    
    // Validate required elements
    if (!newsListContainer || !loadingIndicator) {
        console.error('News list container or loading indicator not found');
        return;
    }
    
    // 重置UI状态
    showLoading();
    hideError();
    hideEmptyState();
    
    try {
        // 构建查询参数
        const params = {
            page,
            pageSize,
            search: searchQuery,
            status: filter !== 'all' ? filter : undefined
        };
        
        // 调用API获取新闻数据
        const response = await fetchNews(params);
        
        if (response.success && response.data) {
            const { news, total, pageCount } = response.data;
            totalItems = total || 0;
            totalPages = pageCount || 1;
            
            if (news && news.length > 0) {
                // 渲染新闻列表
                renderNewsList(news);
                
                // 更新分页组件
                updatePagination(totalPages, currentPage, currentPageSize, totalItems);
            } else {
                // 显示空状态
                renderEmptyState();
            }
        } else {
            throw new Error(response.message || 'Failed to fetch news list');
        }
    } catch (error) {
        console.error('Error fetching news list:', error);
        renderErrorState(error.message || 'Failed to load, please try again later');
        
        // 加载失败时使用模拟数据
        loadMockData();
    } finally {
        // 隐藏加载状态
        hideLoading();
    }
}

/**
 * Load mock data (used when API call fails)
 */
async function loadMockData() {
    // 模拟异步加载
    return new Promise(resolve => {
        setTimeout(() => {
            const mockNews = getMockNewsData();
            
            // 根据筛选条件过滤数据
            let filteredNews = mockNews;
            if (currentFilter === 'Fake') {
                filteredNews = mockNews.filter(item => item.status === 'Fake');
            } else if (currentFilter === 'Not Fake') {
                filteredNews = mockNews.filter(item => item.status === 'Not Fake');
            }
            
            // 根据搜索关键词过滤
            if (currentSearch) {
                const query = currentSearch.toLowerCase();
                filteredNews = filteredNews.filter(item => 
                    item.title.toLowerCase().includes(query) ||
                    item.content.toLowerCase().includes(query) ||
                    item.authorName.toLowerCase().includes(query)
                );
            }
            
            // 计算分页
            totalItems = filteredNews.length;
            totalPages = Math.ceil(totalItems / currentPageSize);
            
            // 计算当前页数据
            const startIndex = (currentPage - 1) * currentPageSize;
            const currentPageNews = filteredNews.slice(startIndex, startIndex + currentPageSize);
            
            // 显示模拟数据提示
            if (newsListContainer) {
                // 清除错误信息
                hideError();
                
                if (currentPageNews.length > 0) {
                    renderNewsList(currentPageNews);
                    updatePagination(totalPages, currentPage, currentPageSize, totalItems);
                    showMockDataNotice();
                } else {
                    renderEmptyState();
                }
            }
            
            resolve();
        }, 500);
    });
}

/**
 * Get mock news data
 * @returns {Array} Mock news data array
 */
function getMockNewsData() {
    return [
        {
            _id: '1',
            title: 'Major Breakthrough in AI Medical Diagnosis Technology',
            content: 'Recent research shows that AI technology has made significant breakthroughs in medical diagnosis, capable of identifying early cancer signs with over 95% accuracy. This technology is expected to greatly improve early cancer diagnosis rates and buy more treatment time for patients. The head of the research team stated that this technology is currently undergoing clinical trials in three hospitals with remarkable results.',
            status: 'Pending',
            authorName: 'Zhang San',
            createdAt: new Date().toISOString(),
            fakeVoteCount: 8,
            notFakeVoteCount: 15
        },
        {
            _id: '2',
            title: 'New Global Climate Change Report Released',
            content: 'The latest report from the IPCC shows that global average temperatures continue to rise, and without urgent measures, temperatures will increase by more than 2 degrees Celsius by the end of the century. The report emphasizes the urgency of reducing carbon emissions and proposes a series of policy recommendations to address climate change. Leaders from multiple countries have expressed concern and promised to strengthen international cooperation.',
            status: 'Not Fake',
            authorName: 'Li Si',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 12,
            notFakeVoteCount: 45,
            imageUrl: 'https://via.placeholder.com/400x300?text=Climate+Change'
        },
        {
            _id: '3',
            title: 'Fake Information Example',
            content: 'This news contains false information and is only used to demonstrate the fake news identification feature. Please do not believe such unconfirmed content.',
            status: 'Fake',
            authorName: 'Wang Wu',
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 67,
            notFakeVoteCount: 5
        },
        {
            _id: '4',
            title: 'New Trends in Economic Development',
            content: 'Economists predict that the economy will show a steady recovery in the second half of this year. Multiple economic indicators show that the manufacturing PMI has risen for three consecutive months, and the consumer market is gradually regaining vitality. Experts suggest that we should continue to increase support for the real economy and promote high-quality development.',
            status: 'Pending',
            authorName: 'Zhao Liu',
            createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 11,
            notFakeVoteCount: 23
        },
        {
            _id: '5',
            title: 'New Education Reform Policy',
            content: 'The Ministry of Education has released a new policy that will further promote quality education reform and reduce students\' academic burden. The policy clearly states that schools must not arbitrarily increase course difficulty and must ensure that students have sufficient time for physical exercise. Parents and educators have welcomed this policy, believing it benefits students\' comprehensive development.',
            status: 'Not Fake',
            authorName: 'Sun Qi',
            createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 8,
            notFakeVoteCount: 67,
            imageUrl: 'https://via.placeholder.com/400x300?text=Education+Reform'
        }
    ];
}

/**
 * Render news list
 * @param {Array} news - News data array
 */
function renderNewsList(news) {
    if (!newsListContainer) return;
    
    newsListContainer.innerHTML = '';
    
    news.forEach(item => {
        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        
        // 截取摘要
        const excerpt = item.content.length > 150 
            ? item.content.substring(0, 150) + '...' 
            : item.content;
        
        // 获取状态样式类
        const statusClass = getStatusClass(item.status);
        const statusText = getStatusText(item.status);
        
        // 构建新闻项HTML
        newsItem.innerHTML = `
            <div class="news-header">
                <h3 class="news-title">${escapeHtml(item.title)}</h3>
                <span class="news-status ${statusClass}">${statusText}</span>
            </div>
            ${item.imageUrl ? `
                <div class="news-image">
                    <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}">
                </div>
            ` : ''}
            <p class="news-content">${escapeHtml(excerpt)}</p>
            <div class="news-footer">
                <div class="news-meta">
                    <span>Author: ${escapeHtml(item.authorName || 'Unknown')}</span>
                    <span>Submitted: ${formatDate(item.createdAt)}</span>
                    <span>Votes: ${item.fakeVoteCount || 0} Fake / ${item.notFakeVoteCount || 0} Real</span>
                </div>
                <a href="detail.html?id=${item._id}" class="read-more">Read More →</a>
            </div>
        `;
        
        // 添加点击事件
        newsItem.addEventListener('click', (e) => {
            // 如果点击的不是链接元素，则导航到详情页
            if (!e.target.closest('.read-more')) {
                window.location.href = `detail.html?id=${item._id}`;
            }
        });
        
        newsListContainer.appendChild(newsItem);
    });
}

/**
 * Render empty state
 */
function renderEmptyState() {
    if (!newsListContainer) return;
    
    // Prepare empty state messages
    let emptyMessage = 'No news available';
    let subMessage = '';
    
    if (currentSearch) {
        emptyMessage = `No news found related to "${escapeHtml(currentSearch)}"`;
        subMessage = 'Try other search keywords';
    } else if (currentFilter !== 'all') {
        emptyMessage = currentFilter === 'Fake' ? 'No fake news data available' : 'No non-fake news data available';
        subMessage = 'Try changing filter';
    }
    
    newsListContainer.innerHTML = `
        <div class="empty-state-container">
            <p class="empty-state-title">${emptyMessage}</p>
            ${subMessage ? `<p class="empty-state-subtitle">${subMessage}</p>` : ''}
            ${(currentSearch || currentFilter !== 'all') ? 
                `<button id="reset-filters-btn" class="reset-filters-btn">Reset Filters</button>` : ''
            }
        </div>
    `;
    
    // 绑定重置按钮事件
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetFilters();
        });
    }
    
    // 显示空状态元素（如果存在）
    if (emptyStateElement) {
        emptyStateElement.style.display = 'block';
    }
}

/**
 * Render error state
 * @param {string} errorMessage - Error message
 */
function renderErrorState(errorMessage) {
    if (!newsListContainer) return;
    
    newsListContainer.innerHTML = `
        <div class="error-state-container">
            <p class="error-state-message">${escapeHtml(errorMessage)}</p>
            <button id="retry-btn" class="retry-btn">Retry</button>
        </div>
    `;
    
    // 显示错误信息元素（如果存在）
    if (errorMessageElement) {
        errorMessageElement.textContent = errorMessage;
        errorMessageElement.style.display = 'block';
    }
    
    // 绑定重试按钮事件
    document.getElementById('retry-btn').addEventListener('click', () => {
        initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
    });
}

/**
 * Update pagination component
 * @param {number} pageCount - Total number of pages
 * @param {number} currentPageNum - Current page number
 * @param {number} pageSize - Items per page
 * @param {number} total - Total number of items
 */
function updatePagination(pageCount, currentPageNum, pageSize, total) {
    if (!paginationElement) return;
    
    // 如果总页数小于等于1，隐藏分页
    if (pageCount <= 1) {
        paginationElement.innerHTML = '';
        paginationElement.style.display = 'none';
        return;
    }
    
    // 显示分页
    paginationElement.style.display = 'block';
    
    // 构建分页HTML
    let paginationHTML = `
        <div class="pagination-info">
            Total ${total} records, Page ${currentPageNum} / ${pageCount}
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn prev-btn ${currentPageNum === 1 ? 'disabled' : ''}" 
                    data-page="${currentPageNum - 1}">Previous</button>
    `;
    
    // 计算显示的页码范围
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPageNum - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pageCount, startPage + maxVisiblePages - 1);
    
    // 调整起始页码，确保显示完整的页码范围
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // 添加首页按钮（如果需要）
    if (startPage > 1) {
        paginationHTML += `
            <button class="pagination-btn page-btn" data-page="1">1</button>
            ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
        `;
    }
    
    // 添加页码按钮
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn page-btn ${i === currentPageNum ? 'active' : ''}" 
                    data-page="${i}">${i}</button>
        `;
    }
    
    // 添加末页按钮（如果需要）
    if (endPage < pageCount) {
        paginationHTML += `
            ${endPage < pageCount - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
            <button class="pagination-btn page-btn" data-page="${pageCount}">${pageCount}</button>
        `;
    }
    
    // 添加下一页按钮
    paginationHTML += `
            <button class="pagination-btn next-btn ${currentPageNum === pageCount ? 'disabled' : ''}" 
                    data-page="${currentPageNum + 1}">Next</button>
        </div>
    `;
    
    // 设置每页条数选择器
    paginationHTML += `
        <div class="pagination-size">
            Items per page:
            <select id="page-size-select" class="page-size-select">
                <option value="5" ${pageSize === 5 ? 'selected' : ''}>5</option>
                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            </select>
        </div>
    `;
    
    // 更新分页HTML
    paginationElement.innerHTML = paginationHTML;
    
    // 绑定分页事件
    bindPaginationEvents();
}

/**
 * Bind pagination events
 */
function bindPaginationEvents() {
    // 页码按钮点击事件
    document.querySelectorAll('.pagination-btn.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page !== currentPage) {
                currentPage = page;
                initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
            }
        });
    });
    
    // 上一页按钮点击事件
    const prevBtn = document.querySelector('.pagination-btn.prev-btn:not(.disabled)');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
            }
        });
    }
    
    // 下一页按钮点击事件
    const nextBtn = document.querySelector('.pagination-btn.next-btn:not(.disabled)');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
            }
        });
    }
    
    // 每页条数变化事件
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            const newPageSize = parseInt(pageSizeSelect.value);
            if (!isNaN(newPageSize) && newPageSize !== currentPageSize) {
                currentPageSize = newPageSize;
                currentPage = 1; // 重置到第一页
                initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
            }
        });
    }
}

/**
 * Reset filters
 */
export function resetFilters() {
    currentFilter = 'all';
    currentSearch = '';
    currentPage = 1;
    
    // 更新UI元素（如果存在）
    const filterSelect = document.getElementById('news-filter');
    const searchInput = document.getElementById('news-search');
    
    if (filterSelect) filterSelect.value = 'all';
    if (searchInput) searchInput.value = '';
    
    // 重新加载数据
    initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
}

/**
 * Set filter and reload data
 * @param {string} filter - Filter condition
 */
export function setFilter(filter) {
    currentFilter = filter;
    currentPage = 1; // 重置到第一页
    initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
}

/**
 * Set search query and reload data
 * @param {string} searchQuery - Search keyword
 */
export function setSearchQuery(searchQuery) {
    currentSearch = searchQuery;
    currentPage = 1; // 重置到第一页
    initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
}

/**
 * Get status style class
 * @param {string} status - News status
 * @returns {string} Style class name
 */
function getStatusClass(status) {
    switch (status) {
        case 'Fake': return 'status-fake';
        case 'Not Fake': return 'status-not-fake';
        case 'Pending': return 'status-pending';
        default: return '';
    }
}

/**
 * Get status display text
 * @param {string} status - News status
 * @returns {string} Display text
 */
function getStatusText(status) {
    switch (status) {
        case 'Fake': return 'Fake';
        case 'Not Fake': return 'Not Fake';
        case 'Pending': return 'Pending';
        default: return status;
    }
}

/**
 * HTML escape to prevent XSS attacks
 * @param {string} text - Original text
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show loading state
 */
function showLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
}

/**
 * Hide loading state
 */
function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError() {
    if (errorMessageElement) {
        errorMessageElement.style.display = 'block';
    }
}

/**
 * Hide error message
 */
function hideError() {
    if (errorMessageElement) {
        errorMessageElement.style.display = 'none';
    }
}

/**
 * Show empty state
 */
function showEmptyState() {
    if (emptyStateElement) {
        emptyStateElement.style.display = 'block';
    }
}

/**
 * Hide empty state
 */
function hideEmptyState() {
    if (emptyStateElement) {
        emptyStateElement.style.display = 'none';
    }
}

/**
 * Show mock data notice
 */
function showMockDataNotice() {
    let noticeElement = document.getElementById('mock-data-notice');
    
    if (!noticeElement) {
        noticeElement = document.createElement('div');
        noticeElement.id = 'mock-data-notice';
        noticeElement.className = 'mock-data-notice';
        noticeElement.textContent = 'Currently displaying mock data for demonstration purposes';
        
        // 添加到页面中
        if (newsListContainer && newsListContainer.parentNode) {
            newsListContainer.parentNode.insertBefore(noticeElement, newsListContainer);
        }
    }
    
    noticeElement.style.display = 'block';
}

// 导出当前状态函数供其他组件使用
export function getCurrentNewsListState() {
    return {
        page: currentPage,
        pageSize: currentPageSize,
        filter: currentFilter,
        search: currentSearch,
        totalItems: totalItems,
        totalPages: totalPages
    };
}

// 导出刷新函数
export function refreshNewsList() {
    initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
}