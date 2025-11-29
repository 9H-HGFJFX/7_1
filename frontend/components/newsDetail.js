/**
 * 新闻详情组件
 * 负责展示新闻完整内容，包括标题、内容、作者信息、状态等
 */
class NewsDetail {
    constructor() {
        this.detailContainer = document.getElementById('news-detail');
        this.newsId = null;
        this.currentUser = null;
        this.backButton = document.getElementById('back-to-list');
        
        // 添加返回按钮事件监听
        if (this.backButton) {
            this.backButton.addEventListener('click', this.handleBackToList.bind(this));
        }
    }
    
    /**
     * 初始化新闻详情
     * @param {string} newsId - 新闻ID
     */
    async init(newsId) {
        this.newsId = newsId;
        
        try {
            // 显示加载状态
            this.showLoading();
            
            // 获取当前用户信息
            const auth = new Auth();
            this.currentUser = auth.getCurrentUser();
            
            // 获取新闻详情
            const news = await this.fetchNewsDetail(newsId);
            
            // 渲染新闻详情
            this.renderNewsDetail(news);
            
            // 初始化相关组件
            await this.initRelatedComponents(news);
        } catch (error) {
            this.handleError(error);
        }
    }
    
    /**
     * 获取新闻详情数据
     * @param {string} newsId - 新闻ID
     * @returns {Promise<Object>} 新闻详情数据
     */
    async fetchNewsDetail(newsId) {
        const response = await fetch(`/api/news/${newsId}`);
        
        if (!response.ok) {
            throw new Error(`获取新闻详情失败: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    /**
     * 渲染新闻详情
     * @param {Object} news - 新闻数据
     */
    renderNewsDetail(news) {
        if (!this.detailContainer) return;
        
        // 构建状态标签样式
        const statusConfig = {
            'PENDING': { text: '待验证', className: 'status-pending' },
            'FAKE': { text: '假新闻', className: 'status-fake' },
            'NOT_FAKE': { text: '真实新闻', className: 'status-not-fake' }
        };
        
        const statusInfo = statusConfig[news.status] || { text: '未知', className: 'status-unknown' };
        
        // 构建HTML
        const html = `
            <div class="news-header">
                <h1 class="news-title">${this.escapeHtml(news.title)}</h1>
                <div class="news-meta">
                    <span class="news-status ${statusInfo.className}">${statusInfo.text}</span>
                    <span class="news-author">by ${this.escapeHtml(news.author?.firstName || '')} ${this.escapeHtml(news.author?.lastName || '')}</span>
                    <span class="news-time">${this.formatDate(news.createdAt)}</span>
                </div>
            </div>
            
            ${news.imageUrl ? `
            <div class="news-image-container">
                <img src="${news.imageUrl}" alt="新闻图片" class="news-image">
            </div>` : ''}
            
            <div class="news-content">
                ${this.formatContent(news.content)}
            </div>
            
            <div class="news-stats">
                <div class="vote-stats">
                    <span class="stat-label">投票统计:</span>
                    <span class="stat-item fake-count">假新闻: ${news.voteStats?.fakeCount || 0}</span>
                    <span class="stat-item not-fake-count">真实新闻: ${news.voteStats?.notFakeCount || 0}</span>
                </div>
                <div class="comment-count">
                    <span class="stat-label">评论数:</span>
                    <span class="stat-item">${news.commentCount || 0}</span>
                </div>
            </div>
            
            <div class="news-actions">
                ${this.renderActionButtons(news)}
            </div>
            
            <!-- 投票区域 -->
            <div id="vote-container" class="vote-section">
                <!-- 将由投票组件填充 -->
            </div>
            
            <!-- 评论区域 -->
            <div id="comments-container" class="comments-section">
                <h3>评论 (${news.commentCount || 0})</h3>
                <!-- 将由评论组件填充 -->
            </div>
        `;
        
        this.detailContainer.innerHTML = html;
        
        // 显示详情容器
        this.detailContainer.classList.remove('hidden');
    }
    
    /**
     * 渲染操作按钮
     * @param {Object} news - 新闻数据
     * @returns {string} 按钮HTML
     */
    renderActionButtons(news) {
        let buttons = '';
        const auth = new Auth();
        
        // 检查是否为新闻作者或管理员
        const isAuthor = this.currentUser && this.currentUser.id === news.author?._id;
        const isAdmin = auth.hasRole('ADMINISTRATOR');
        
        // 编辑按钮（作者）
        if (isAuthor) {
            buttons += `<button id="edit-news-btn" class="btn btn-primary">编辑新闻</button>`;
        }
        
        // 删除按钮（作者或管理员）
        if (isAuthor || isAdmin) {
            buttons += `<button id="delete-news-btn" class="btn btn-danger">删除新闻</button>`;
        }
        
        // 状态管理按钮（管理员）
        if (isAdmin) {
            buttons += `
                <div class="admin-actions">
                    <select id="status-select" class="status-select">
                        <option value="PENDING" ${news.status === 'PENDING' ? 'selected' : ''}>待验证</option>
                        <option value="FAKE" ${news.status === 'FAKE' ? 'selected' : ''}>标记为假新闻</option>
                        <option value="NOT_FAKE" ${news.status === 'NOT_FAKE' ? 'selected' : ''}>标记为真实新闻</option>
                    </select>
                    <button id="update-status-btn" class="btn btn-secondary">更新状态</button>
                    <button id="recalculate-votes-btn" class="btn btn-warning">重新计算投票</button>
                </div>
            `;
        }
        
        return buttons;
    }
    
    /**
     * 初始化相关组件
     * @param {Object} news - 新闻数据
     */
    async initRelatedComponents(news) {
        // 初始化投票组件
        if (this.currentUser) {
            const voteContainer = document.getElementById('vote-container');
            if (voteContainer) {
                // 动态导入投票组件
                const VoteComponent = await import('./vote.js').then(module => module.default);
                const voteComponent = new VoteComponent();
                await voteComponent.init(news._id, voteContainer);
            }
        }
        
        // 初始化评论组件
        const commentsContainer = document.getElementById('comments-container');
        if (commentsContainer) {
            // 动态导入评论组件
            const CommentComponent = await import('./comments.js').then(module => module.default);
            const commentComponent = new CommentComponent();
            await commentComponent.init(news._id, commentsContainer);
        }
        
        // 添加事件监听器
        this.addEventListeners();
    }
    
    /**
     * 添加事件监听器
     */
    addEventListeners() {
        // 编辑按钮
        const editBtn = document.getElementById('edit-news-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.handleEditNews());
        }
        
        // 删除按钮
        const deleteBtn = document.getElementById('delete-news-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeleteNews());
        }
        
        // 更新状态按钮
        const updateStatusBtn = document.getElementById('update-status-btn');
        if (updateStatusBtn) {
            updateStatusBtn.addEventListener('click', () => this.handleUpdateStatus());
        }
        
        // 重新计算投票按钮
        const recalculateBtn = document.getElementById('recalculate-votes-btn');
        if (recalculateBtn) {
            recalculateBtn.addEventListener('click', () => this.handleRecalculateVotes());
        }
    }
    
    /**
     * 处理返回列表
     */
    handleBackToList() {
        // 隐藏详情页，显示列表页
        if (this.detailContainer) {
            this.detailContainer.classList.add('hidden');
        }
        
        // 触发列表页面的显示事件
        window.dispatchEvent(new CustomEvent('showNewsList'));
    }
    
    /**
     * 处理编辑新闻
     */
    handleEditNews() {
        // 跳转到编辑页面或打开编辑模态框
        window.location.hash = `#edit-news/${this.newsId}`;
    }
    
    /**
     * 处理删除新闻
     */
    async handleDeleteNews() {
        if (!confirm('确定要删除这条新闻吗？此操作不可撤销。')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/news/${this.newsId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('删除失败');
            }
            
            alert('新闻删除成功');
            this.handleBackToList();
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }
    
    /**
     * 处理更新状态
     */
    async handleUpdateStatus() {
        const statusSelect = document.getElementById('status-select');
        if (!statusSelect) return;
        
        const newStatus = statusSelect.value;
        
        try {
            const response = await fetch(`/api/news/${this.newsId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) {
                throw new Error('更新状态失败');
            }
            
            alert('状态更新成功');
            // 重新加载新闻详情
            this.init(this.newsId);
        } catch (error) {
            alert('更新状态失败: ' + error.message);
        }
    }
    
    /**
     * 处理重新计算投票
     */
    async handleRecalculateVotes() {
        try {
            const response = await fetch(`/api/news/${this.newsId}/recalculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('重新计算投票失败');
            }
            
            alert('投票重新计算成功');
            // 重新加载新闻详情
            this.init(this.newsId);
        } catch (error) {
            alert('重新计算投票失败: ' + error.message);
        }
    }
    
    /**
     * 显示加载状态
     */
    showLoading() {
        if (this.detailContainer) {
            this.detailContainer.innerHTML = '<div class="loading">加载中...</div>';
        }
    }
    
    /**
     * 处理错误
     * @param {Error} error - 错误对象
     */
    handleError(error) {
        if (this.detailContainer) {
            this.detailContainer.innerHTML = `
                <div class="error-message">
                    <h3>加载失败</h3>
                    <p>${error.message || '无法加载新闻详情'}</p>
                    <button id="retry-btn" class="btn btn-primary">重试</button>
                </div>
            `;
            
            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.init(this.newsId));
            }
        }
    }
    
    /**
     * HTML转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 格式化日期
     * @param {string} dateString - 日期字符串
     * @returns {string} 格式化后的日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    /**
     * 格式化内容（将换行符转换为<br>标签）
     * @param {string} content - 原始内容
     * @returns {string} 格式化后的内容
     */
    formatContent(content) {
        return this.escapeHtml(content).replace(/\n/g, '<br>');
    }
}

// 导出组件
module.exports = NewsDetail;