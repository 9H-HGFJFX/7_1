import { fetchNews } from '../utils/api.js';
import { formatDate } from '../utils/helpers.js';

// 新闻列表容器
let newsListContainer = null;
let loadingIndicator = null;
let errorMessageElement = null;
let emptyStateElement = null;
let paginationElement = null;

// 状态管理
let currentPage = 1;
let currentPageSize = 10;
let currentFilter = 'all';
let currentSearch = '';
let totalItems = 0;
let totalPages = 1;

/**
 * 初始化新闻列表
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页条数
 * @param {string} searchQuery - 搜索关键词
 * @param {string} filter - 筛选条件
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
    
    // 验证必要元素
    if (!newsListContainer || !loadingIndicator) {
        console.error('新闻列表容器或加载指示器未找到');
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
            throw new Error(response.message || '获取新闻列表失败');
        }
    } catch (error) {
        console.error('获取新闻列表出错:', error);
        renderErrorState(error.message || '加载失败，请稍后重试');
        
        // 加载失败时使用模拟数据
        loadMockData();
    } finally {
        // 隐藏加载状态
        hideLoading();
    }
}

/**
 * 加载模拟数据（当API调用失败时使用）
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
 * 获取模拟新闻数据
 * @returns {Array} 模拟新闻数据数组
 */
function getMockNewsData() {
    return [
        {
            _id: '1',
            title: '人工智能技术在医疗诊断领域取得重大突破',
            content: '最新研究表明，人工智能技术在医疗诊断领域取得重大突破，能够以95%以上的准确率识别早期癌症迹象。这一技术有望大幅提高癌症早期诊断率，为患者争取更多治疗时间。研究团队负责人表示，这项技术目前已经在三家医院进行临床试验，效果显著。',
            status: 'Pending',
            authorName: '张三',
            createdAt: new Date().toISOString(),
            fakeVoteCount: 8,
            notFakeVoteCount: 15
        },
        {
            _id: '2',
            title: '全球气候变化最新报告发布',
            content: '联合国气候变化专门委员会最新报告显示，全球平均气温持续上升，如果不采取紧急措施，到本世纪末气温将升高超过2摄氏度。报告强调了减少碳排放的紧迫性，并提出了一系列应对气候变化的政策建议。多国领导人对此表示关注，承诺加强国际合作。',
            status: 'Not Fake',
            authorName: '李四',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 12,
            notFakeVoteCount: 45,
            imageUrl: 'https://via.placeholder.com/400x300?text=Climate+Change'
        },
        {
            _id: '3',
            title: '虚假信息示例',
            content: '这条新闻包含虚假信息，仅用于演示假新闻识别功能。请不要相信此类未经证实的内容。',
            status: 'Fake',
            authorName: '王五',
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 67,
            notFakeVoteCount: 5
        },
        {
            _id: '4',
            title: '经济发展新动向',
            content: '经济学家预测，今年下半年经济将呈现稳步回升态势。多项经济指标显示，制造业PMI连续三个月回升，消费市场逐渐恢复活力。专家建议，应继续加大对实体经济的支持力度，推动高质量发展。',
            status: 'Pending',
            authorName: '赵六',
            createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 11,
            notFakeVoteCount: 23
        },
        {
            _id: '5',
            title: '教育改革新政策',
            content: '教育部发布新政策，将进一步推动素质教育改革，减轻学生课业负担。政策明确提出，学校不得随意增加课程难度，要保证学生有足够的体育锻炼时间。家长和教育工作者对此表示欢迎，认为这有利于学生的全面发展。',
            status: 'Not Fake',
            authorName: '孙七',
            createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
            fakeVoteCount: 8,
            notFakeVoteCount: 67,
            imageUrl: 'https://via.placeholder.com/400x300?text=Education+Reform'
        }
    ];
}

/**
 * 渲染新闻列表
 * @param {Array} news - 新闻数据数组
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
                    <span>提交人: ${escapeHtml(item.authorName || '未知')}</span>
                    <span>提交时间: ${formatDate(item.createdAt)}</span>
                    <span>投票: ${item.fakeVoteCount || 0}假 / ${item.notFakeVoteCount || 0}真</span>
                </div>
                <a href="detail.html?id=${item._id}" class="read-more">阅读详情 →</a>
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
 * 渲染空状态
 */
function renderEmptyState() {
    if (!newsListContainer) return;
    
    // 准备空状态消息
    let emptyMessage = '暂无相关新闻';
    let subMessage = '';
    
    if (currentSearch) {
        emptyMessage = `未找到与"${escapeHtml(currentSearch)}"相关的新闻`;
        subMessage = '尝试其他搜索关键词';
    } else if (currentFilter !== 'all') {
        emptyMessage = currentFilter === 'Fake' ? '暂无标记为假新闻的数据' : '暂无标记为非假新闻的数据';
        subMessage = '尝试切换筛选条件';
    }
    
    newsListContainer.innerHTML = `
        <div class="empty-state-container">
            <p class="empty-state-title">${emptyMessage}</p>
            ${subMessage ? `<p class="empty-state-subtitle">${subMessage}</p>` : ''}
            ${(currentSearch || currentFilter !== 'all') ? 
                `<button id="reset-filters-btn" class="reset-filters-btn">重置筛选条件</button>` : ''
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
 * 渲染错误状态
 * @param {string} errorMessage - 错误信息
 */
function renderErrorState(errorMessage) {
    if (!newsListContainer) return;
    
    newsListContainer.innerHTML = `
        <div class="error-state-container">
            <p class="error-state-message">${escapeHtml(errorMessage)}</p>
            <button id="retry-btn" class="retry-btn">重试</button>
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
 * 更新分页组件
 * @param {number} pageCount - 总页数
 * @param {number} currentPageNum - 当前页码
 * @param {number} pageSize - 每页条数
 * @param {number} total - 总条数
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
            共 ${total} 条记录，第 ${currentPageNum} / ${pageCount} 页
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn prev-btn ${currentPageNum === 1 ? 'disabled' : ''}" 
                    data-page="${currentPageNum - 1}">上一页</button>
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
                    data-page="${currentPageNum + 1}">下一页</button>
        </div>
    `;
    
    // 设置每页条数选择器
    paginationHTML += `
        <div class="pagination-size">
            每页显示：
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
 * 绑定分页事件
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
 * 重置筛选条件
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
 * 设置筛选条件并重新加载数据
 * @param {string} filter - 筛选条件
 */
export function setFilter(filter) {
    currentFilter = filter;
    currentPage = 1; // 重置到第一页
    initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
}

/**
 * 设置搜索关键词并重新加载数据
 * @param {string} searchQuery - 搜索关键词
 */
export function setSearchQuery(searchQuery) {
    currentSearch = searchQuery;
    currentPage = 1; // 重置到第一页
    initNewsList(currentPage, currentPageSize, currentSearch, currentFilter);
}

/**
 * 获取状态样式类
 * @param {string} status - 新闻状态
 * @returns {string} 样式类名
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
 * 获取状态显示文本
 * @param {string} status - 新闻状态
 * @returns {string} 显示文本
 */
function getStatusText(status) {
    switch (status) {
        case 'Fake': return '假新闻';
        case 'Not Fake': return '非假新闻';
        case 'Pending': return '待验证';
        default: return status;
    }
}

/**
 * HTML转义，防止XSS攻击
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 显示加载状态
 */
function showLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * 显示错误信息
 */
function showError() {
    if (errorMessageElement) {
        errorMessageElement.style.display = 'block';
    }
}

/**
 * 隐藏错误信息
 */
function hideError() {
    if (errorMessageElement) {
        errorMessageElement.style.display = 'none';
    }
}

/**
 * 显示空状态
 */
function showEmptyState() {
    if (emptyStateElement) {
        emptyStateElement.style.display = 'block';
    }
}

/**
 * 隐藏空状态
 */
function hideEmptyState() {
    if (emptyStateElement) {
        emptyStateElement.style.display = 'none';
    }
}

/**
 * 显示模拟数据提示
 */
function showMockDataNotice() {
    let noticeElement = document.getElementById('mock-data-notice');
    
    if (!noticeElement) {
        noticeElement = document.createElement('div');
        noticeElement.id = 'mock-data-notice';
        noticeElement.className = 'mock-data-notice';
        noticeElement.textContent = '当前显示的是模拟数据，用于演示功能';
        
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