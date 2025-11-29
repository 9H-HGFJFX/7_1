/**
 * 评论列表管理组件
 * 用于管理员查看和管理评论数据
 */

class CommentManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.containerId - 容器元素ID
     * @param {string} options.apiUrl - 评论API地址
     * @param {Function} options.onAction - 操作回调函数
     * @param {Function} options.onError - 错误处理回调函数
     * @param {Object} options.filters - 初始筛选条件
     * @param {number} options.pageSize - 每页条数
     */
    constructor(options = {}) {
        // 配置项
        this.containerId = options.containerId;
        this.apiUrl = options.apiUrl || '/api/comments/manage';
        this.onAction = options.onAction || function() {};
        this.onError = options.onError || this.defaultErrorHandler;
        this.filters = options.filters || {};
        this.pageSize = options.pageSize || 10;
        
        // 状态
        this.container = null;
        this.data = [];
        this.totalItems = 0;
        this.currentPage = 1;
        this.loading = false;
        this.selectedComments = [];
        this.filters = {
            status: 'all', // all, active, deleted
            newsId: '',
            userId: '',
            searchKeyword: '',
            sortBy: 'createdAt',
            sortOrder: 'desc',
            ...options.filters
        };
        
        // 初始化组件
        this.init();
    }
    
    /**
     * 初始化组件
     */
    init() {
        try {
            // 获取容器元素
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                throw new Error(`容器元素不存在: ${this.containerId}`);
            }
            
            // 设置容器基本样式
            this.container.className = 'comment-manager-container';
            
            // 渲染组件结构
            this.render();
            
            // 绑定事件
            this.bindEvents();
            
            // 添加样式
            this.addStyles();
            
            // 加载数据
            this.loadComments();
        } catch (error) {
            console.error('评论管理组件初始化失败:', error);
            this.onError(error);
        }
    }
    
    /**
     * 渲染组件HTML结构
     */
    render() {
        const html = `
            <div class="comment-manager-wrapper">
                <!-- 工具栏 -->
                <div class="comment-toolbar">
                    <div class="toolbar-left">
                        <h2 class="manager-title">评论管理</h2>
                    </div>
                    <div class="toolbar-actions">
                        <button type="button" class="btn btn-danger btn-batch-delete" disabled>
                            批量删除 (0)
                        </button>
                        <button type="button" class="btn btn-primary btn-refresh">
                            刷新
                        </button>
                    </div>
                </div>
                
                <!-- 筛选区域 -->
                <div class="comment-filters">
                    <div class="filter-row">
                        <div class="filter-group">
                            <label for="filter-status">状态:</label>
                            <select id="filter-status" class="form-control">
                                <option value="all">全部状态</option>
                                <option value="active">正常</option>
                                <option value="deleted">已删除</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-newsId">新闻ID:</label>
                            <input type="text" id="filter-newsId" class="form-control" placeholder="输入新闻ID">
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-userId">用户ID:</label>
                            <input type="text" id="filter-userId" class="form-control" placeholder="输入用户ID">
                        </div>
                        
                        <div class="filter-group search-group">
                            <label for="filter-keyword">搜索:</label>
                            <div class="search-input-wrapper">
                                <input type="text" id="filter-keyword" class="form-control" placeholder="搜索评论内容">
                                <button type="button" class="btn-search">🔍</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <div class="filter-group">
                            <label for="filter-sortBy">排序:</label>
                            <select id="filter-sortBy" class="form-control">
                                <option value="createdAt">创建时间</option>
                                <option value="updatedAt">更新时间</option>
                                <option value="likes">点赞数</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-sortOrder">顺序:</label>
                            <select id="filter-sortOrder" class="form-control">
                                <option value="desc">降序</option>
                                <option value="asc">升序</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-pageSize">每页条数:</label>
                            <select id="filter-pageSize" class="form-control">
                                <option value="10">10条</option>
                                <option value="20">20条</option>
                                <option value="50">50条</option>
                                <option value="100">100条</option>
                            </select>
                        </div>
                        
                        <div class="filter-group filter-actions">
                            <button type="button" class="btn btn-primary btn-apply-filters">
                                应用筛选
                            </button>
                            <button type="button" class="btn btn-secondary btn-reset-filters">
                                重置筛选
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 评论列表 -->
                <div class="comment-list-container">
                    <div class="loading-overlay" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>加载中...</span>
                    </div>
                    
                    <div class="empty-state" style="display: none;">
                        <div class="empty-icon">📝</div>
                        <p class="empty-text">暂无评论数据</p>
                    </div>
                    
                    <table class="comment-table">
                        <thead>
                            <tr>
                                <th class="checkbox-col">
                                    <input type="checkbox" class="select-all-comments">
                                </th>
                                <th>ID</th>
                                <th>评论内容</th>
                                <th>用户</th>
                                <th>新闻</th>
                                <th>状态</th>
                                <th>创建时间</th>
                                <th>更新时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody class="comment-list-body">
                            <!-- 评论数据将在这里动态加载 -->
                        </tbody>
                    </table>
                </div>
                
                <!-- 分页控件 -->
                <div class="comment-pagination">
                    <div class="pagination-info">
                        共 <span class="total-items">0</span> 条记录，第 <span class="current-page">1</span>/<span class="total-pages">0</span> 页
                    </div>
                    <div class="pagination-controls">
                        <button type="button" class="btn-pagination btn-prev" disabled>
                            上一页
                        </button>
                        <div class="page-numbers">
                            <!-- 页码按钮将在这里动态加载 -->
                        </div>
                        <button type="button" class="btn-pagination btn-next" disabled>
                            下一页
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // 获取DOM引用
        this.dom = {
            // 工具栏
            btnBatchDelete: this.container.querySelector('.btn-batch-delete'),
            btnRefresh: this.container.querySelector('.btn-refresh'),
            
            // 筛选器
            filterStatus: this.container.querySelector('#filter-status'),
            filterNewsId: this.container.querySelector('#filter-newsId'),
            filterUserId: this.container.querySelector('#filter-userId'),
            filterKeyword: this.container.querySelector('#filter-keyword'),
            btnSearch: this.container.querySelector('.btn-search'),
            filterSortBy: this.container.querySelector('#filter-sortBy'),
            filterSortOrder: this.container.querySelector('#filter-sortOrder'),
            filterPageSize: this.container.querySelector('#filter-pageSize'),
            btnApplyFilters: this.container.querySelector('.btn-apply-filters'),
            btnResetFilters: this.container.querySelector('.btn-reset-filters'),
            
            // 列表
            loadingOverlay: this.container.querySelector('.loading-overlay'),
            emptyState: this.container.querySelector('.empty-state'),
            commentTableBody: this.container.querySelector('.comment-list-body'),
            selectAllCheckbox: this.container.querySelector('.select-all-comments'),
            
            // 分页
            paginationInfo: this.container.querySelector('.pagination-info'),
            totalItemsEl: this.container.querySelector('.total-items'),
            currentPageEl: this.container.querySelector('.current-page'),
            totalPagesEl: this.container.querySelector('.total-pages'),
            btnPrev: this.container.querySelector('.btn-prev'),
            btnNext: this.container.querySelector('.btn-next'),
            pageNumbersContainer: this.container.querySelector('.page-numbers')
        };
        
        // 设置初始筛选器值
        this.dom.filterStatus.value = this.filters.status || 'all';
        this.dom.filterNewsId.value = this.filters.newsId || '';
        this.dom.filterUserId.value = this.filters.userId || '';
        this.dom.filterKeyword.value = this.filters.searchKeyword || '';
        this.dom.filterSortBy.value = this.filters.sortBy || 'createdAt';
        this.dom.filterSortOrder.value = this.filters.sortOrder || 'desc';
        this.dom.filterPageSize.value = this.pageSize || 10;
    }
    
    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 批量删除按钮
        this.dom.btnBatchDelete.addEventListener('click', () => this.handleBatchDelete());
        
        // 刷新按钮
        this.dom.btnRefresh.addEventListener('click', () => this.loadComments());
        
        // 搜索按钮
        this.dom.btnSearch.addEventListener('click', () => this.handleSearch());
        
        // 回车键搜索
        this.dom.filterKeyword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        
        // 应用筛选
        this.dom.btnApplyFilters.addEventListener('click', () => this.applyFilters());
        
        // 重置筛选
        this.dom.btnResetFilters.addEventListener('click', () => this.resetFilters());
        
        // 全选/取消全选
        this.dom.selectAllCheckbox.addEventListener('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });
        
        // 分页按钮
        this.dom.btnPrev.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.dom.btnNext.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        
        // 每页条数变化
        this.dom.filterPageSize.addEventListener('change', () => {
            this.pageSize = parseInt(this.dom.filterPageSize.value);
            this.currentPage = 1;
            this.loadComments();
        });
    }
    
    /**
     * 加载评论数据
     */
    async loadComments() {
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 构建查询参数
            const params = {
                page: this.currentPage,
                pageSize: this.pageSize,
                status: this.filters.status,
                newsId: this.filters.newsId,
                userId: this.filters.userId,
                keyword: this.filters.searchKeyword,
                sortBy: this.filters.sortBy,
                sortOrder: this.filters.sortOrder
            };
            
            // 构建URL
            const queryString = new URLSearchParams(params).toString();
            const url = `${this.apiUrl}?${queryString}`;
            
            // 模拟API请求
            // const response = await fetch(url, {
            //     method: 'GET',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${this.getAuthToken()}`
            //     }
            // });
            
            // if (!response.ok) {
            //     throw new Error(`获取评论失败: ${response.statusText}`);
            // }
            
            // const result = await response.json();
            
            // 模拟API延迟
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 生成模拟数据
            const mockResult = this.generateMockComments();
            
            // 更新状态
            this.data = mockResult.data;
            this.totalItems = mockResult.total;
            
            // 渲染评论列表
            this.renderComments();
            
            // 渲染分页
            this.renderPagination();
            
            // 更新统计信息
            this.updateStats();
            
        } catch (error) {
            console.error('加载评论失败:', error);
            this.onError(error);
            this.renderError('加载评论失败，请稍后重试');
        } finally {
            // 隐藏加载状态
            this.showLoading(false);
        }
    }
    
    /**
     * 渲染评论列表
     */
    renderComments() {
        const tbody = this.dom.commentTableBody;
        tbody.innerHTML = '';
        
        // 清空选中状态
        this.selectedComments = [];
        
        if (this.data.length === 0) {
            // 显示空状态
            this.dom.emptyState.style.display = 'block';
            return;
        }
        
        // 隐藏空状态
        this.dom.emptyState.style.display = 'none';
        
        // 渲染评论数据
        this.data.forEach(comment => {
            const row = document.createElement('tr');
            row.dataset.id = comment.id;
            row.className = comment.deleted ? 'comment-deleted' : '';
            
            const statusBadge = comment.deleted 
                ? '<span class="status-badge status-deleted">已删除</span>' 
                : '<span class="status-badge status-active">正常</span>';
            
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="comment-checkbox" data-id="${comment.id}">
                </td>
                <td class="id-col">${comment.id}</td>
                <td class="content-col">
                    <div class="comment-content">${this.truncateText(comment.content, 100)}</div>
                    ${comment.images && comment.images.length > 0 ? 
                        `<div class="comment-images">
                            <span class="image-count">含 ${comment.images.length} 张图片</span>
                        </div>` : ''
                    }
                </td>
                <td class="user-col">
                    <div class="user-info">
                        <div class="user-name">${comment.userName}</div>
                        <div class="user-id">ID: ${comment.userId}</div>
                    </div>
                </td>
                <td class="news-col">
                    <div class="news-info">
                        <div class="news-title">${this.truncateText(comment.newsTitle, 30)}</div>
                        <div class="news-id">ID: ${comment.newsId}</div>
                    </div>
                </td>
                <td class="status-col">${statusBadge}</td>
                <td class="date-col">${this.formatDate(comment.createdAt)}</td>
                <td class="date-col">${this.formatDate(comment.updatedAt)}</td>
                <td class="action-col">
                    <div class="action-buttons">
                        <button type="button" class="btn-action btn-view" title="查看详情">
                            查看
                        </button>
                        ${comment.deleted ? 
                            `<button type="button" class="btn-action btn-restore" title="恢复评论">
                                恢复
                            </button>` : 
                            `<button type="button" class="btn-action btn-delete" title="删除评论">
                                删除
                            </button>`
                        }
                    </div>
                </td>
            `;
            
            // 绑定复选框事件
            const checkbox = row.querySelector('.comment-checkbox');
            checkbox.addEventListener('change', (e) => {
                this.handleCommentSelection(comment.id, e.target.checked);
            });
            
            // 绑定查看按钮事件
            const viewButton = row.querySelector('.btn-view');
            viewButton.addEventListener('click', () => {
                this.handleViewComment(comment.id);
            });
            
            // 绑定删除/恢复按钮事件
            const deleteButton = row.querySelector('.btn-delete');
            if (deleteButton) {
                deleteButton.addEventListener('click', () => {
                    this.handleDeleteComment(comment.id);
                });
            }
            
            const restoreButton = row.querySelector('.btn-restore');
            if (restoreButton) {
                restoreButton.addEventListener('click', () => {
                    this.handleRestoreComment(comment.id);
                });
            }
            
            tbody.appendChild(row);
        });
        
        // 更新批量操作按钮状态
        this.updateBatchButtonState();
    }
    
    /**
     * 渲染分页控件
     */
    renderPagination() {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        const container = this.dom.pageNumbersContainer;
        container.innerHTML = '';
        
        // 更新分页信息
        this.dom.totalItemsEl.textContent = this.totalItems;
        this.dom.currentPageEl.textContent = this.currentPage;
        this.dom.totalPagesEl.textContent = totalPages;
        
        // 更新上一页/下一页按钮状态
        this.dom.btnPrev.disabled = this.currentPage <= 1;
        this.dom.btnNext.disabled = this.currentPage >= totalPages;
        
        if (totalPages <= 1) return;
        
        // 计算显示的页码范围
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // 调整起始页码，确保显示完整的范围
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 添加第一页和省略号
        if (startPage > 1) {
            this.addPageButton(container, 1);
            if (startPage > 2) {
                this.addEllipsis(container);
            }
        }
        
        // 添加页码按钮
        for (let i = startPage; i <= endPage; i++) {
            this.addPageButton(container, i);
        }
        
        // 添加最后一页和省略号
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                this.addEllipsis(container);
            }
            this.addPageButton(container, totalPages);
        }
    }
    
    /**
     * 添加页码按钮
     */
    addPageButton(container, pageNum) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn-page-number ${pageNum === this.currentPage ? 'active' : ''}`;
        button.textContent = pageNum;
        
        button.addEventListener('click', () => {
            this.goToPage(pageNum);
        });
        
        container.appendChild(button);
    }
    
    /**
     * 添加省略号
     */
    addEllipsis(container) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        container.appendChild(ellipsis);
    }
    
    /**
     * 跳转到指定页
     */
    goToPage(pageNum) {
        if (pageNum >= 1 && pageNum <= Math.ceil(this.totalItems / this.pageSize)) {
            this.currentPage = pageNum;
            this.loadComments();
        }
    }
    
    /**
     * 应用筛选条件
     */
    applyFilters() {
        this.filters = {
            status: this.dom.filterStatus.value,
            newsId: this.dom.filterNewsId.value.trim(),
            userId: this.dom.filterUserId.value.trim(),
            searchKeyword: this.dom.filterKeyword.value.trim(),
            sortBy: this.dom.filterSortBy.value,
            sortOrder: this.dom.filterSortOrder.value
        };
        
        this.currentPage = 1;
        this.loadComments();
    }
    
    /**
     * 重置筛选条件
     */
    resetFilters() {
        this.filters = {
            status: 'all',
            newsId: '',
            userId: '',
            searchKeyword: '',
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        // 重置表单值
        this.dom.filterStatus.value = 'all';
        this.dom.filterNewsId.value = '';
        this.dom.filterUserId.value = '';
        this.dom.filterKeyword.value = '';
        this.dom.filterSortBy.value = 'createdAt';
        this.dom.filterSortOrder.value = 'desc';
        
        this.currentPage = 1;
        this.loadComments();
    }
    
    /**
     * 处理搜索
     */
    handleSearch() {
        this.filters.searchKeyword = this.dom.filterKeyword.value.trim();
        this.currentPage = 1;
        this.loadComments();
    }
    
    /**
     * 处理全选
     */
    handleSelectAll(checked) {
        const checkboxes = this.container.querySelectorAll('.comment-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
        
        this.selectedComments = checked 
            ? this.data.map(comment => comment.id) 
            : [];
        
        this.updateBatchButtonState();
    }
    
    /**
     * 处理单个评论选择
     */
    handleCommentSelection(commentId, checked) {
        if (checked) {
            if (!this.selectedComments.includes(commentId)) {
                this.selectedComments.push(commentId);
            }
        } else {
            this.selectedComments = this.selectedComments.filter(id => id !== commentId);
        }
        
        // 更新全选复选框状态
        const totalCheckboxes = this.container.querySelectorAll('.comment-checkbox').length;
        const checkedCheckboxes = this.container.querySelectorAll('.comment-checkbox:checked').length;
        
        this.dom.selectAllCheckbox.checked = 
            totalCheckboxes > 0 && checkedCheckboxes === totalCheckboxes;
        
        // 半选中状态
        this.dom.selectAllCheckbox.indeterminate = 
            checkedCheckboxes > 0 && checkedCheckboxes < totalCheckboxes;
        
        this.updateBatchButtonState();
    }
    
    /**
     * 处理查看评论
     */
    handleViewComment(commentId) {
        const comment = this.data.find(c => c.id === commentId);
        if (comment) {
            this.showCommentDetail(comment);
            this.onAction('view', comment);
        }
    }
    
    /**
     * 处理删除评论
     */
    async handleDeleteComment(commentId) {
        if (confirm('确定要删除这条评论吗？')) {
            try {
                await this.deleteComment(commentId);
                this.loadComments(); // 重新加载数据
                this.onAction('delete', { id: commentId });
            } catch (error) {
                this.onError(error);
            }
        }
    }
    
    /**
     * 处理恢复评论
     */
    async handleRestoreComment(commentId) {
        if (confirm('确定要恢复这条评论吗？')) {
            try {
                await this.restoreComment(commentId);
                this.loadComments(); // 重新加载数据
                this.onAction('restore', { id: commentId });
            } catch (error) {
                this.onError(error);
            }
        }
    }
    
    /**
     * 处理批量删除
     */
    async handleBatchDelete() {
        if (this.selectedComments.length === 0) return;
        
        if (confirm(`确定要删除选中的 ${this.selectedComments.length} 条评论吗？`)) {
            try {
                await this.batchDeleteComments();
                this.loadComments(); // 重新加载数据
                this.onAction('batchDelete', { ids: this.selectedComments });
            } catch (error) {
                this.onError(error);
            }
        }
    }
    
    /**
     * 删除单个评论
     */
    async deleteComment(commentId) {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('删除评论:', commentId);
        
        // 实际项目中的API调用
        // const response = await fetch(`${this.apiUrl}/${commentId}/delete`, {
        //     method: 'PUT',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${this.getAuthToken()}`
        //     }
        // });
        // 
        // if (!response.ok) {
        //     throw new Error(`删除评论失败: ${response.statusText}`);
        // }
    }
    
    /**
     * 恢复评论
     */
    async restoreComment(commentId) {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('恢复评论:', commentId);
        
        // 实际项目中的API调用
        // const response = await fetch(`${this.apiUrl}/${commentId}/restore`, {
        //     method: 'PUT',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${this.getAuthToken()}`
        //     }
        // });
        // 
        // if (!response.ok) {
        //     throw new Error(`恢复评论失败: ${response.statusText}`);
        // }
    }
    
    /**
     * 批量删除评论
     */
    async batchDeleteComments() {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log('批量删除评论:', this.selectedComments);
        
        // 实际项目中的API调用
        // const response = await fetch(`${this.apiUrl}/batch-delete`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${this.getAuthToken()}`
        //     },
        //     body: JSON.stringify({ ids: this.selectedComments })
        // });
        // 
        // if (!response.ok) {
        //     throw new Error(`批量删除失败: ${response.statusText}`);
        // }
    }
    
    /**
     * 显示评论详情
     */
    showCommentDetail(comment) {
        // 创建详情弹窗
        const modal = document.createElement('div');
        modal.className = 'comment-detail-modal';
        
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>评论详情</h3>
                        <button type="button" class="btn-close">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-row">
                            <label>评论ID:</label>
                            <span>${comment.id}</span>
                        </div>
                        <div class="detail-row">
                            <label>评论内容:</label>
                            <div class="detail-content">${comment.content}</div>
                        </div>
                        ${comment.images && comment.images.length > 0 ? 
                            `<div class="detail-row">
                                <label>图片:</label>
                                <div class="detail-images">
                                    ${comment.images.map(img => 
                                        `<img src="${img}" alt="评论图片" class="comment-image-thumb">`
                                    ).join('')}
                                </div>
                            </div>` : ''
                        }
                        <div class="detail-row">
                            <label>用户信息:</label>
                            <div>
                                <div>用户名: ${comment.userName}</div>
                                <div>用户ID: ${comment.userId}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <label>新闻信息:</label>
                            <div>
                                <div>新闻标题: ${comment.newsTitle}</div>
                                <div>新闻ID: ${comment.newsId}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <label>状态:</label>
                            <span>${comment.deleted ? '已删除' : '正常'}</span>
                        </div>
                        <div class="detail-row">
                            <label>创建时间:</label>
                            <span>${this.formatDateTime(comment.createdAt)}</span>
                        </div>
                        <div class="detail-row">
                            <label>更新时间:</label>
                            <span>${this.formatDateTime(comment.updatedAt)}</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary btn-close-modal">关闭</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定关闭事件
        const closeButtons = modal.querySelectorAll('.btn-close, .btn-close-modal');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });
        
        // 点击遮罩层关闭
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) {
                document.body.removeChild(modal);
            }
        });
    }
    
    /**
     * 更新批量操作按钮状态
     */
    updateBatchButtonState() {
        const count = this.selectedComments.length;
        this.dom.btnBatchDelete.disabled = count === 0;
        this.dom.btnBatchDelete.textContent = `批量删除 (${count})`;
    }
    
    /**
     * 更新统计信息
     */
    updateStats() {
        // 这里可以添加更多统计信息的更新逻辑
    }
    
    /**
     * 显示加载状态
     */
    showLoading(show) {
        this.loading = show;
        this.dom.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    /**
     * 渲染错误信息
     */
    renderError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        this.dom.commentTableBody.innerHTML = '';
        this.dom.commentTableBody.appendChild(errorElement);
    }
    
    /**
     * 格式化日期（简短）
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    /**
     * 格式化日期时间（详细）
     */
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    
    /**
     * 截断文本
     */
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * 获取认证令牌
     */
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
    
    /**
     * 默认错误处理
     */
    defaultErrorHandler(error) {
        console.error('评论管理错误:', error);
        alert(`错误: ${error.message || '操作失败'}`);
    }
    
    /**
     * 生成模拟评论数据
     */
    generateMockComments() {
        const total = 128; // 模拟总数据量
        const page = this.currentPage;
        const pageSize = this.pageSize;
        
        const startIdx = (page - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, total);
        
        const comments = [];
        
        for (let i = startIdx; i < endIdx; i++) {
            const id = `comment_${i + 1}`;
            const isDeleted = Math.random() > 0.8; // 20% 的概率已删除
            const hasImages = Math.random() > 0.7; // 30% 的概率有图片
            
            comments.push({
                id,
                content: `这是一条测试评论内容，用于展示评论管理功能。评论ID: ${id}。这里包含了一些随机生成的文本内容，用于测试显示效果和截断功能。`,
                userId: `user_${Math.floor(Math.random() * 10) + 1}`,
                userName: `用户${Math.floor(Math.random() * 10) + 1}`,
                newsId: `news_${Math.floor(Math.random() * 50) + 1}`,
                newsTitle: `新闻标题 ${Math.floor(Math.random() * 50) + 1}`,
                images: hasImages ? [
                    'https://via.placeholder.com/100',
                    'https://via.placeholder.com/100'
                ] : [],
                likes: Math.floor(Math.random() * 100),
                deleted: isDeleted,
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        // 应用筛选
        let filteredComments = [...comments];
        
        if (this.filters.status === 'active') {
            filteredComments = filteredComments.filter(c => !c.deleted);
        } else if (this.filters.status === 'deleted') {
            filteredComments = filteredComments.filter(c => c.deleted);
        }
        
        if (this.filters.newsId) {
            filteredComments = filteredComments.filter(c => c.newsId.includes(this.filters.newsId));
        }
        
        if (this.filters.userId) {
            filteredComments = filteredComments.filter(c => c.userId.includes(this.filters.userId));
        }
        
        if (this.filters.searchKeyword) {
            const keyword = this.filters.searchKeyword.toLowerCase();
            filteredComments = filteredComments.filter(c => 
                c.content.toLowerCase().includes(keyword) ||
                c.userName.toLowerCase().includes(keyword) ||
                c.newsTitle.toLowerCase().includes(keyword)
            );
        }
        
        // 应用排序
        filteredComments.sort((a, b) => {
            let compareValue = 0;
            
            switch (this.filters.sortBy) {
                case 'createdAt':
                    compareValue = new Date(a.createdAt) - new Date(b.createdAt);
                    break;
                case 'updatedAt':
                    compareValue = new Date(a.updatedAt) - new Date(b.updatedAt);
                    break;
                case 'likes':
                    compareValue = a.likes - b.likes;
                    break;
            }
            
            return this.filters.sortOrder === 'desc' ? -compareValue : compareValue;
        });
        
        return {
            data: filteredComments,
            total: this.filters.searchKeyword || this.filters.newsId || this.filters.userId ? filteredComments.length : total,
            page,
            pageSize
        };
    }
    
    /**
     * 添加CSS样式
     */
    addStyles() {
        // 检查样式是否已添加
        if (document.getElementById('comment-manager-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'comment-manager-styles';
        style.textContent = `
            .comment-manager-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .comment-manager-wrapper {
                width: 100%;
            }
            
            .comment-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e9ecef;
            }
            
            .manager-title {
                font-size: 20px;
                font-weight: 600;
                color: #333;
                margin: 0;
            }
            
            .toolbar-actions {
                display: flex;
                gap: 10px;
            }
            
            .comment-filters {
                background-color: white;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            
            .filter-row {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
                align-items: end;
            }
            
            .filter-row:last-child {
                margin-bottom: 0;
            }
            
            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .filter-group label {
                font-size: 14px;
                font-weight: 500;
                color: #495057;
            }
            
            .filter-group .form-control {
                padding: 8px 12px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 14px;
                min-width: 120px;
            }
            
            .filter-group .form-control:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
            }
            
            .search-group {
                flex-grow: 1;
            }
            
            .search-input-wrapper {
                position: relative;
                display: flex;
            }
            
            .search-input-wrapper .form-control {
                flex-grow: 1;
                padding-right: 40px;
            }
            
            .btn-search {
                position: absolute;
                right: 0;
                top: 0;
                bottom: 0;
                width: 40px;
                border: none;
                background-color: transparent;
                cursor: pointer;
                font-size: 16px;
                color: #6c757d;
            }
            
            .btn-search:hover {
                color: #007bff;
            }
            
            .filter-actions {
                display: flex;
                gap: 10px;
            }
            
            .comment-list-container {
                background-color: white;
                border-radius: 6px;
                margin-bottom: 20px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                position: relative;
            }
            
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255, 255, 255, 0.8);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 10px;
                z-index: 10;
            }
            
            .loading-spinner {
                width: 30px;
                height: 30px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .empty-state {
                padding: 60px 20px;
                text-align: center;
                color: #6c757d;
            }
            
            .empty-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            
            .empty-text {
                font-size: 16px;
                margin: 0;
            }
            
            .error-message {
                padding: 20px;
                text-align: center;
                color: #dc3545;
                font-weight: 500;
            }
            
            .comment-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .comment-table th,
            .comment-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e9ecef;
            }
            
            .comment-table th {
                background-color: #f8f9fa;
                font-weight: 600;
                color: #495057;
                position: sticky;
                top: 0;
                z-index: 5;
            }
            
            .comment-table tbody tr:hover {
                background-color: #f8f9fa;
            }
            
            .comment-table tbody tr.comment-deleted {
                background-color: #fff3f3;
                color: #6c757d;
            }
            
            .comment-table tbody tr.comment-deleted td {
                text-decoration: line-through;
            }
            
            .checkbox-col {
                width: 40px;
            }
            
            .id-col {
                width: 100px;
                font-family: monospace;
            }
            
            .content-col {
                min-width: 250px;
            }
            
            .comment-content {
                line-height: 1.4;
                margin-bottom: 5px;
            }
            
            .comment-images {
                font-size: 12px;
                color: #6c757d;
            }
            
            .user-col,
            .news-col {
                min-width: 150px;
            }
            
            .user-info,
            .news-info {
                font-size: 14px;
            }
            
            .user-name,
            .news-title {
                font-weight: 500;
                margin-bottom: 3px;
            }
            
            .user-id,
            .news-id {
                font-size: 12px;
                color: #6c757d;
                font-family: monospace;
            }
            
            .status-col {
                width: 100px;
            }
            
            .date-col {
                width: 150px;
                font-size: 13px;
                color: #6c757d;
            }
            
            .action-col {
                width: 120px;
            }
            
            .action-buttons {
                display: flex;
                gap: 5px;
            }
            
            .status-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .status-active {
                background-color: #d4edda;
                color: #155724;
            }
            
            .status-deleted {
                background-color: #f8d7da;
                color: #721c24;
            }
            
            .btn-action {
                padding: 4px 8px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .btn-view {
                background-color: #007bff;
                color: white;
            }
            
            .btn-view:hover {
                background-color: #0056b3;
            }
            
            .btn-delete {
                background-color: #dc3545;
                color: white;
            }
            
            .btn-delete:hover {
                background-color: #c82333;
            }
            
            .btn-restore {
                background-color: #28a745;
                color: white;
            }
            
            .btn-restore:hover {
                background-color: #218838;
            }
            
            .comment-pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                background-color: white;
                border-radius: 6px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            
            .pagination-info {
                font-size: 14px;
                color: #6c757d;
            }
            
            .pagination-controls {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .btn-pagination {
                padding: 6px 12px;
                border: 1px solid #dee2e6;
                background-color: white;
                color: #495057;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .btn-pagination:hover:not(:disabled) {
                background-color: #f8f9fa;
                border-color: #007bff;
                color: #007bff;
            }
            
            .btn-pagination:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .page-numbers {
                display: flex;
                gap: 5px;
            }
            
            .btn-page-number {
                width: 36px;
                height: 36px;
                border: 1px solid #dee2e6;
                background-color: white;
                color: #495057;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .btn-page-number:hover {
                background-color: #f8f9fa;
                border-color: #007bff;
                color: #007bff;
            }
            
            .btn-page-number.active {
                background-color: #007bff;
                border-color: #007bff;
                color: white;
            }
            
            .page-ellipsis {
                display: flex;
                align-items: center;
                padding: 0 10px;
                color: #6c757d;
            }
            
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
            }
            
            .btn-primary {
                background-color: #007bff;
                color: white;
            }
            
            .btn-primary:hover {
                background-color: #0056b3;
            }
            
            .btn-secondary {
                background-color: #6c757d;
                color: white;
            }
            
            .btn-secondary:hover {
                background-color: #545b62;
            }
            
            .btn-danger {
                background-color: #dc3545;
                color: white;
            }
            
            .btn-danger:hover {
                background-color: #c82333;
            }
            
            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* 评论详情弹窗样式 */
            .comment-detail-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-content {
                background-color: white;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }
            
            .btn-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #6c757d;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .btn-close:hover {
                background-color: #f8f9fa;
                color: #333;
            }
            
            .modal-body {
                padding: 20px;
                overflow-y: auto;
                flex-grow: 1;
            }
            
            .detail-row {
                margin-bottom: 20px;
                display: flex;
                gap: 20px;
            }
            
            .detail-row:last-child {
                margin-bottom: 0;
            }
            
            .detail-row label {
                font-weight: 600;
                color: #495057;
                width: 100px;
                flex-shrink: 0;
            }
            
            .detail-row span {
                color: #333;
            }
            
            .detail-content {
                flex-grow: 1;
                line-height: 1.5;
                white-space: pre-wrap;
            }
            
            .detail-images {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .comment-image-thumb {
                width: 80px;
                height: 80px;
                object-fit: cover;
                border-radius: 4px;
                border: 1px solid #dee2e6;
            }
            
            .modal-footer {
                padding: 15px 20px;
                border-top: 1px solid #e9ecef;
                display: flex;
                justify-content: flex-end;
            }
            
            /* 响应式设计 */
            @media (max-width: 1200px) {
                .filter-row {
                    flex-wrap: wrap;
                }
                
                .filter-group {
                    flex: 1;
                    min-width: 150px;
                }
                
                .comment-table {
                    font-size: 14px;
                }
                
                .comment-table th,
                .comment-table td {
                    padding: 8px 6px;
                }
            }
            
            @media (max-width: 768px) {
                .comment-manager-container {
                    padding: 15px;
                }
                
                .comment-toolbar {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 15px;
                }
                
                .toolbar-actions {
                    justify-content: center;
                }
                
                .filter-row {
                    flex-direction: column;
                }
                
                .filter-group {
                    width: 100%;
                }
                
                .filter-actions {
                    flex-direction: column;
                }
                
                .comment-pagination {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .comment-table {
                    display: block;
                    overflow-x: auto;
                }
                
                .modal-content {
                    width: 95%;
                    max-height: 90vh;
                }
                
                .detail-row {
                    flex-direction: column;
                    gap: 5px;
                }
                
                .detail-row label {
                    width: auto;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        // 清理DOM引用
        this.container = null;
        this.dom = {};
        
        // 清理数据
        this.data = [];
        this.selectedComments = [];
        
        console.log('评论管理组件已销毁');
    }
}

// 导出组件
export default CommentManager;