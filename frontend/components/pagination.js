/**
 * 分页组件
 * 可复用在新闻列表和评论列表等多个场景
 */

// 状态管理
let totalPages = 1;
let currentPage = 1;
let pageSize = 10;
let totalItems = 0;
let pageChangeCallback = null;
let pageSizeOptions = [5, 10, 20, 50];

/**
 * 初始化分页组件
 * @param {Function} callback - 页码变更回调函数
 * @param {Object} options - 配置选项
 * @param {Array} options.pageSizeOptions - 可选的每页数量选项
 */
export function initPagination(callback = null, options = {}) {
    // 存储回调函数
    pageChangeCallback = callback;
    
    // 合并配置选项
    if (options.pageSizeOptions) {
        pageSizeOptions = options.pageSizeOptions;
    }
    
    // 渲染初始分页
    renderPagination();
    
    // 添加键盘导航支持
    addKeyboardNavigation();
}

/**
 * 更新分页状态
 * @param {number} total - 总页数
 * @param {number} current - 当前页码
 * @param {number} size - 每页条数
 * @param {number} items - 总条数
 */
export function updatePaginationState(total, current, size, items) {
    totalPages = total || 1;
    currentPage = current || 1;
    pageSize = size || 10;
    totalItems = items || 0;
    
    // 重新渲染分页
    renderPagination();
}

/**
 * 渲染分页组件
 */
function renderPagination() {
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) return;
    
    // 设置容器样式
    paginationElement.className = 'pagination-container';
    
    // 创建分页包装器
    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';
    
    // 添加统计信息区域
    const statsContainer = document.createElement('div');
    statsContainer.className = 'pagination-info';
    const statsInfo = createStatsInfo();
    statsContainer.appendChild(statsInfo);
    wrapper.appendChild(statsContainer);
    
    // 添加分页控制区域
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'pagination-controls';
    
    // 创建分页列表容器
    const paginationList = document.createElement('div');
    paginationList.className = 'pagination-list';
    
    // 添加首页按钮
    const firstPageButton = createPaginationButton('首页', currentPage > 1, () => {
        goToPage(1);
    });
    paginationList.appendChild(firstPageButton);
    
    // 添加上一页按钮
    const prevButton = createPaginationButton('<', currentPage > 1, () => {
        goToPage(currentPage - 1);
    });
    prevButton.title = '上一页';
    paginationList.appendChild(prevButton);
    
    // 计算页码显示范围
    const { startPage, endPage } = calculatePageRange();
    
    // 添加页码按钮
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = createPaginationButton(i.toString(), true, () => {
            goToPage(i);
        }, i === currentPage);
        paginationList.appendChild(pageButton);
    }
    
    // 添加下一页按钮
    const nextButton = createPaginationButton('>', currentPage < totalPages, () => {
        goToPage(currentPage + 1);
    });
    nextButton.title = '下一页';
    paginationList.appendChild(nextButton);
    
    // 添加末页按钮
    const lastPageButton = createPaginationButton('末页', currentPage < totalPages, () => {
        goToPage(totalPages);
    });
    paginationList.appendChild(lastPageButton);
    
    // 添加分页列表到控制区域
    controlsContainer.appendChild(paginationList);
    
    // 添加每页条数选择器
    const pageSizeSelector = createPageSizeSelector();
    controlsContainer.appendChild(pageSizeSelector);
    
    // 添加控制区域到包装器
    wrapper.appendChild(controlsContainer);
    
    // 清空现有内容并添加新内容
    paginationElement.innerHTML = '';
    paginationElement.appendChild(wrapper);
    
    // 添加样式
    addPaginationStyles();
}

/**
 * 创建分页按钮
 * @param {string} text - 按钮文本
 * @param {boolean} enabled - 是否可用
 * @param {Function} onClick - 点击事件处理函数
 * @param {boolean} isActive - 是否为当前页
 * @returns {HTMLButtonElement} 按钮元素
 */
function createPaginationButton(text, enabled, onClick, isActive = false) {
    const button = document.createElement('button');
    button.className = `pagination-btn ${isActive ? 'active' : ''} ${!enabled ? 'disabled' : ''}`;
    button.innerHTML = text; // 使用innerHTML以支持特殊字符
    button.disabled = !enabled;
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', isActive ? `当前页 ${text}` : `跳转到第 ${text} 页`);
    
    if (enabled) {
        button.addEventListener('click', onClick);
        // 添加键盘焦点样式支持
        button.addEventListener('focus', () => {
            button.classList.add('focus');
        });
        button.addEventListener('blur', () => {
            button.classList.remove('focus');
        });
    }
    
    return button;
}

/**
 * 创建每页条数选择器
 * @returns {HTMLDivElement} 选择器容器
 */
function createPageSizeSelector() {
    const container = document.createElement('div');
    container.className = 'page-size-selector';
    
    // 构建选项HTML
    let optionsHtml = '';
    pageSizeOptions.forEach(size => {
        optionsHtml += `<option value="${size}" ${pageSize === size ? 'selected' : ''}>${size}</option>`;
    });
    
    container.innerHTML = `
        <label for="page-size">每页显示:</label>
        <select id="page-size" aria-label="每页显示条数">
            ${optionsHtml}
        </select>
        <span class="page-size-text">条</span>
    `;
    
    // 绑定变更事件
    const selectElement = container.querySelector('#page-size');
    selectElement.addEventListener('change', (e) => {
        const newPageSize = parseInt(e.target.value, 10);
        handlePageSizeChange(newPageSize);
    });
    
    // 添加键盘事件支持
    selectElement.addEventListener('focus', () => {
        selectElement.classList.add('focus');
    });
    selectElement.addEventListener('blur', () => {
        selectElement.classList.remove('focus');
    });
    
    return container;
}

/**
 * 创建统计信息
 * @returns {HTMLSpanElement} 统计信息元素
 */
function createStatsInfo() {
    const stats = document.createElement('span');
    stats.className = 'pagination-stats';
    
    // 计算显示范围
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    
    stats.textContent = `显示 ${startItem}-${endItem} 条，共 ${totalItems} 条`;
    stats.setAttribute('aria-live', 'polite'); // 辅助功能支持
    
    return stats;
}

/**
 * 计算页码显示范围
 * @returns {Object} 开始页码和结束页码
 */
function calculatePageRange() {
    // 最多显示5个页码
    const maxVisiblePages = 5;
    let startPage = 1;
    let endPage = Math.min(totalPages, maxVisiblePages);
    
    // 如果当前页靠近末尾，调整显示范围
    if (totalPages > maxVisiblePages && currentPage > Math.floor(maxVisiblePages / 2)) {
        startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // 如果末尾不足，向前调整
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = endPage - maxVisiblePages + 1;
        }
    }
    
    return { startPage, endPage };
}

/**
 * 跳转到指定页码
 * @param {number} page - 目标页码
 */
function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    
    // 触发回调
    if (pageChangeCallback) {
        pageChangeCallback(page, pageSize);
    } else {
        // 如果没有回调，默认刷新新闻列表
        if (window.refreshNewsList) {
            window.refreshNewsList(page, pageSize);
        }
    }
    
    // 重新渲染分页
    renderPagination();
}

/**
 * 处理每页条数变更
 * @param {number} newSize - 新的每页条数
 */
function handlePageSizeChange(newSize) {
    pageSize = newSize;
    currentPage = 1; // 重置到第一页
    
    // 触发回调
    if (pageChangeCallback) {
        pageChangeCallback(currentPage, pageSize);
    } else {
        // 如果没有回调，默认刷新新闻列表
        if (window.refreshNewsList) {
            window.refreshNewsList(currentPage, pageSize);
        }
    }
    
    // 重新渲染分页
    renderPagination();
}

// 将更新状态函数暴露到全局，供新闻列表组件调用
window.updatePaginationState = updatePaginationState;

/**
 * 添加分页样式
 */
function addPaginationStyles() {
    // 检查样式是否已添加
    if (document.getElementById('pagination-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'pagination-styles';
    style.textContent = `
        .pagination-container {
            padding: 15px 0;
        }
        
        .pagination-wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 15px;
            background-color: #fff;
            border-radius: 8px;
            padding: 10px 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .pagination-info {
            font-size: 14px;
            color: #6c757d;
        }
        
        .pagination-stats {
            font-weight: 500;
        }
        
        .pagination-controls {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .pagination-list {
            display: flex;
            align-items: center;
            gap: 6px;
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .pagination-btn {
            min-width: 38px;
            height: 38px;
            padding: 8px 12px;
            border: 1px solid #dee2e6;
            background-color: #fff;
            color: #495057;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: inherit;
            outline: none;
        }
        
        .pagination-btn:hover:not(.disabled) {
            background-color: #f8f9fa;
            border-color: #adb5bd;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .pagination-btn.active {
            background-color: #007bff;
            color: #fff;
            border-color: #007bff;
            font-weight: 600;
        }
        
        .pagination-btn.active:hover {
            background-color: #0056b3;
            border-color: #0056b3;
        }
        
        .pagination-btn.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background-color: #f8f9fa;
        }
        
        .pagination-btn.disabled:hover {
            transform: none;
            box-shadow: none;
        }
        
        .pagination-btn.focus {
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }
        
        .page-size-selector {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #6c757d;
        }
        
        #page-size {
            padding: 6px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            background-color: #fff;
            font-size: 14px;
            color: #495057;
            cursor: pointer;
            outline: none;
            transition: border-color 0.2s ease;
            min-width: 80px;
        }
        
        #page-size:hover {
            border-color: #adb5bd;
        }
        
        #page-size:focus {
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }
        
        .page-size-text {
            font-size: 14px;
            color: #6c757d;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .pagination-wrapper {
                flex-direction: column;
                align-items: center;
                gap: 12px;
                padding: 15px;
            }
            
            .pagination-info {
                order: 2;
                font-size: 13px;
            }
            
            .pagination-controls {
                order: 1;
                flex-direction: column;
                gap: 10px;
            }
            
            .pagination-list {
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .pagination-btn {
                min-width: 34px;
                height: 34px;
                padding: 6px 8px;
                font-size: 13px;
            }
        }
        
        @media (max-width: 480px) {
            .pagination-wrapper {
                padding: 10px;
            }
            
            .pagination-btn {
                min-width: 30px;
                height: 30px;
                font-size: 12px;
            }
            
            .page-size-selector {
                font-size: 13px;
            }
            
            #page-size {
                min-width: 70px;
                padding: 4px 8px;
                font-size: 13px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * 添加键盘导航支持
 */
function addKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // 检查是否在输入框或文本区域中
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                if (currentPage > 1) {
                    e.preventDefault();
                    goToPage(currentPage - 1);
                }
                break;
            case 'ArrowRight':
                if (currentPage < totalPages) {
                    e.preventDefault();
                    goToPage(currentPage + 1);
                }
                break;
            case 'Home':
                e.preventDefault();
                goToPage(1);
                break;
            case 'End':
                e.preventDefault();
                goToPage(totalPages);
                break;
        }
    });
}

/**
 * 重置分页组件
 */
export function resetPagination() {
    totalPages = 1;
    currentPage = 1;
    pageSize = 10;
    totalItems = 0;
    renderPagination();
}

// 导出获取当前状态方法
export function getCurrentPaginationState() {
    return {
        currentPage,
        pageSize,
        totalPages,
        totalItems
    };
}