/**
 * 评论组件
 * 实现新闻评论的展示、提交、删除和分页功能
 */

import { getNewsComments, submitComment, deleteComment, updateComment } from '../utils/api.js';
import { getToken } from '../utils/storage.js';
import auth from './auth.js';
import PaginationComponent from './pagination.js';

class CommentComponent {
    /**
     * 构造函数
     * @param {Object} options - 组件配置
     * @param {string} options.containerId - 容器元素ID
     * @param {string} options.newsId - 新闻ID
     * @param {number} options.pageSize - 每页评论数量
     * @param {Function} options.onCommentAdd - 添加评论成功回调
     * @param {Function} options.onCommentDelete - 删除评论成功回调
     */
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.newsId = options.newsId;
        this.pageSize = options.pageSize || 10;
        this.onCommentAdd = options.onCommentAdd || function() {};
        this.onCommentDelete = options.onCommentDelete || function() {};
        
        this.container = null;
        this.commentListElement = null;
        this.commentFormElement = null;
        this.loadingElement = null;
        this.messageElement = null;
        this.noCommentsElement = null;
        
        this.comments = [];
        this.currentPage = 1;
        this.totalComments = 0;
        this.totalPages = 0;
        this.isLoading = false;
        this.pagination = null;
        
        this.init();
    }
    
    /**
     * 初始化组件
     */
    async init() {
        try {
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                console.error(`评论组件容器未找到: ${this.containerId}`);
                return;
            }
            
            this.render();
            this.bindEvents();
            await this.loadComments();
        } catch (error) {
            console.error('评论组件初始化失败:', error);
            this.showError('评论组件初始化失败');
        }
    }
    
    /**
     * 渲染评论组件UI
     */
    render() {
        this.container.innerHTML = `
            <div class="comment-component">
                <!-- 评论标题 -->
                <h3 class="comment-title">评论区</h3>
                
                <!-- 评论表单 -->
                <div id="comment-form-${this.newsId}" class="comment-form-container">
                    <form id="comment-submit-form">
                        <div class="form-group">
                            <textarea 
                                id="comment-content" 
                                class="comment-textarea" 
                                placeholder="写下您的评论..."
                                rows="4"
                                required
                            ></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="comment-image" class="comment-image-label">
                                <span class="image-icon">📷</span>
                                添加图片佐证（可选）
                            </label>
                            <input 
                                type="file" 
                                id="comment-image" 
                                class="comment-image-input"
                                accept="image/*"
                            />
                            <div id="comment-image-preview" class="comment-image-preview"></div>
                        </div>
                        
                        <div class="form-actions">
                            <button 
                                type="submit" 
                                id="submit-comment-btn" 
                                class="comment-submit-btn"
                            >
                                发表评论
                            </button>
                        </div>
                    </form>
                </div>
                
                <!-- 评论列表 -->
                <div class="comment-list-container">
                    <div id="comment-loading" class="comment-loading">加载评论中...</div>
                    <div id="comment-list" class="comment-list"></div>
                    <div id="no-comments" class="no-comments">暂无评论，快来发表第一条评论吧！</div>
                </div>
                
                <!-- 分页组件容器 -->
                <div id="comment-pagination" class="comment-pagination"></div>
                
                <!-- 消息提示 -->
                <div id="comment-message" class="comment-message"></div>
            </div>
        `;
        
        // 保存DOM引用
        this.commentListElement = document.getElementById('comment-list');
        this.commentFormElement = document.getElementById('comment-submit-form');
        this.loadingElement = document.getElementById('comment-loading');
        this.messageElement = document.getElementById('comment-message');
        this.noCommentsElement = document.getElementById('no-comments');
        
        // 隐藏非登录用户的评论表单
        if (!auth.isLoggedIn()) {
            document.getElementById(`comment-form-${this.newsId}`).innerHTML = `
                <div class="login-required">
                    <p>请先<a href="/login.html">登录</a>后再发表评论</p>
                </div>
            `;
        }
        
        // 添加基本样式
        this.addStyles();
    }
    
    /**
     * 添加组件样式
     */
    addStyles() {
        const styleId = 'comment-component-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .comment-component {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .comment-title {
                margin-top: 0;
                margin-bottom: 20px;
                font-size: 20px;
                color: #343a40;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 10px;
            }
            
            /* 评论表单样式 */
            .comment-form-container {
                background-color: #ffffff;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .comment-textarea {
                width: 100%;
                min-height: 100px;
                padding: 12px;
                border: 1px solid #ced4da;
                border-radius: 6px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                transition: border-color 0.3s ease;
                box-sizing: border-box;
            }
            
            .comment-textarea:focus {
                outline: none;
                border-color: #80bdff;
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
            }
            
            .comment-image-label {
                display: inline-block;
                padding: 8px 16px;
                background-color: #e9ecef;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                color: #495057;
                transition: background-color 0.3s ease;
            }
            
            .comment-image-label:hover {
                background-color: #dee2e6;
            }
            
            .image-icon {
                margin-right: 5px;
            }
            
            .comment-image-input {
                display: none;
            }
            
            .comment-image-preview {
                margin-top: 10px;
                max-width: 100%;
                height: auto;
            }
            
            .comment-image-preview img {
                max-width: 200px;
                max-height: 200px;
                border-radius: 6px;
                border: 1px solid #dee2e6;
            }
            
            .form-actions {
                text-align: right;
            }
            
            .comment-submit-btn {
                padding: 10px 20px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            
            .comment-submit-btn:hover {
                background-color: #0056b3;
            }
            
            .comment-submit-btn:disabled {
                background-color: #6c757d;
                cursor: not-allowed;
            }
            
            .login-required {
                text-align: center;
                padding: 20px;
                color: #6c757d;
                font-style: italic;
            }
            
            .login-required a {
                color: #007bff;
                text-decoration: none;
            }
            
            .login-required a:hover {
                text-decoration: underline;
            }
            
            /* 评论列表样式 */
            .comment-list-container {
                margin-bottom: 20px;
            }
            
            .comment-loading {
                text-align: center;
                padding: 20px;
                color: #6c757d;
                font-style: italic;
            }
            
            .comment-list {
                display: none;
            }
            
            .comment-item {
                background-color: #ffffff;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .comment-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .comment-author-info {
                display: flex;
                align-items: center;
            }
            
            .comment-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background-color: #007bff;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                margin-right: 10px;
            }
            
            .comment-author-name {
                font-weight: 600;
                color: #343a40;
                margin-right: 10px;
            }
            
            .comment-time {
                font-size: 12px;
                color: #6c757d;
            }
            
            .comment-content {
                color: #212529;
                line-height: 1.6;
                margin-bottom: 10px;
                word-wrap: break-word;
            }
            
            .comment-image {
                max-width: 100%;
                max-height: 300px;
                border-radius: 6px;
                margin-top: 10px;
            }
            
            .comment-actions {
                display: flex;
                gap: 10px;
                margin-top: 10px;
            }
            
            .comment-action-btn {
                padding: 5px 12px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            
            .comment-delete-btn {
                background-color: #fee;
                color: #dc3545;
            }
            
            .comment-delete-btn:hover {
                background-color: #f8d7da;
            }
            
            .comment-edit-btn {
                background-color: #e9ecef;
                color: #495057;
            }
            
            .comment-edit-btn:hover {
                background-color: #dee2e6;
            }
            
            .comment-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 500;
                margin-left: 5px;
            }
            
            .comment-badge.admin {
                background-color: #d1ecf1;
                color: #0c5460;
            }
            
            .comment-badge.author {
                background-color: #e8f5e9;
                color: #28a745;
            }
            
            .no-comments {
                text-align: center;
                padding: 40px;
                color: #6c757d;
                font-style: italic;
                display: none;
            }
            
            /* 分页样式 */
            .comment-pagination {
                margin-top: 20px;
            }
            
            /* 消息提示样式 */
            .comment-message {
                padding: 10px;
                border-radius: 4px;
                text-align: center;
                font-size: 14px;
                margin-top: 10px;
            }
            
            .comment-message.success {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .comment-message.error {
                background-color: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            
            .comment-message.info {
                background-color: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }
            
            /* 编辑表单样式 */
            .comment-edit-form {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #e9ecef;
            }
            
            .comment-edit-textarea {
                width: 100%;
                min-height: 80px;
                padding: 8px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                margin-bottom: 10px;
                box-sizing: border-box;
            }
            
            .comment-edit-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .comment-edit-save-btn {
                padding: 6px 12px;
                background-color: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
            }
            
            .comment-edit-cancel-btn {
                padding: 6px 12px;
                background-color: #6c757d;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .comment-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 5px;
                }
                
                .comment-actions {
                    align-self: flex-end;
                    margin-top: -25px;
                }
                
                .comment-content {
                    padding-right: 80px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 表单提交事件
        if (this.commentFormElement) {
            this.commentFormElement.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmitComment();
            });
        }
        
        // 图片预览事件
        const imageInput = document.getElementById('comment-image');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                this.handleImagePreview(e.target.files[0]);
            });
        }
    }
    
    /**
     * 处理图片预览
     * @param {File} file - 选中的图片文件
     */
    handleImagePreview(file) {
        if (!file) return;
        
        const previewContainer = document.getElementById('comment-image-preview');
        if (!previewContainer) return;
        
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            this.showError('请选择有效的图片文件');
            return;
        }
        
        // 检查文件大小（限制为5MB）
        if (file.size > 5 * 1024 * 1024) {
            this.showError('图片大小不能超过5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.innerHTML = `<img src="${e.target.result}" alt="预览图片">`;
        };
        reader.readAsDataURL(file);
    }
    
    /**
     * 加载评论列表
     * @param {number} page - 页码
     */
    async loadComments(page = 1) {
        try {
            this.isLoading = true;
            this.currentPage = page;
            
            // 显示加载状态
            this.loadingElement.style.display = 'block';
            this.commentListElement.style.display = 'none';
            this.noCommentsElement.style.display = 'none';
            
            // 加载评论数据
            const response = await getNewsComments(this.newsId, {
                page: this.currentPage,
                pageSize: this.pageSize
            });
            
            this.comments = response.comments || [];
            this.totalComments = response.totalItems || 0;
            this.totalPages = response.totalPages || 1;
            
            // 渲染评论列表
            this.renderComments();
            
            // 初始化或更新分页组件
            this.initPagination();
        } catch (error) {
            console.error('加载评论失败:', error);
            this.showError('加载评论失败，请刷新页面重试');
        } finally {
            this.isLoading = false;
            this.loadingElement.style.display = 'none';
        }
    }
    
    /**
     * 渲染评论列表
     */
    renderComments() {
        if (!this.commentListElement) return;
        
        if (this.comments.length === 0) {
            this.commentListElement.style.display = 'none';
            this.noCommentsElement.style.display = 'block';
            return;
        }
        
        this.commentListElement.style.display = 'block';
        this.noCommentsElement.style.display = 'none';
        
        // 清空列表
        this.commentListElement.innerHTML = '';
        
        // 渲染每个评论
        this.comments.forEach(comment => {
            const commentItem = this.createCommentElement(comment);
            this.commentListElement.appendChild(commentItem);
        });
    }
    
    /**
     * 创建单个评论元素
     * @param {Object} comment - 评论数据
     * @returns {HTMLElement} 评论DOM元素
     */
    createCommentElement(comment) {
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        
        // 获取当前用户信息
        const currentUser = auth.getCurrentUser();
        const isCurrentUserComment = currentUser && currentUser._id === comment.userId;
        const isAdmin = auth.hasRole('Administrator');
        
        // 生成用户头像首字母
        const avatarText = comment.userName ? comment.userName.charAt(0).toUpperCase() : '?';
        
        // 构建评论HTML
        commentItem.innerHTML = `
            <div class="comment-header">
                <div class="comment-author-info">
                    <div class="comment-avatar">${avatarText}</div>
                    <div>
                        <span class="comment-author-name">${comment.userName || '匿名用户'}</span>
                        ${comment.userRole === 'Administrator' ? '<span class="comment-badge admin">管理员</span>' : ''}
                        ${isCurrentUserComment ? '<span class="comment-badge author">我</span>' : ''}
                        <span class="comment-time">${this.formatDate(comment.createdAt)}</span>
                    </div>
                </div>
                
                <div class="comment-actions">
                    ${(isCurrentUserComment || isAdmin) ? `
                        <button class="comment-action-btn comment-edit-btn" data-id="${comment._id}">编辑</button>
                        <button class="comment-action-btn comment-delete-btn" data-id="${comment._id}">删除</button>
                    ` : ''}
                </div>
            </div>
            
            <div class="comment-content">${comment.content}</div>
            
            ${comment.imageUrl ? `<img src="${comment.imageUrl}" alt="评论图片" class="comment-image">` : ''}
        `;
        
        // 绑定删除按钮事件
        const deleteBtn = commentItem.querySelector('.comment-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeleteComment(comment._id));
        }
        
        // 绑定编辑按钮事件
        const editBtn = commentItem.querySelector('.comment-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.handleEditComment(commentItem, comment));
        }
        
        return commentItem;
    }
    
    /**
     * 处理提交评论
     */
    async handleSubmitComment() {
        if (!auth.isLoggedIn()) {
            this.showError('请先登录后再发表评论');
            return;
        }
        
        const content = document.getElementById('comment-content').value.trim();
        if (!content) {
            this.showError('评论内容不能为空');
            return;
        }
        
        try {
            this.showInfo('正在提交评论...');
            
            // 构建评论数据
            const commentData = {
                newsId: this.newsId,
                content: content
            };
            
            // 检查是否有图片（这里简化处理，实际项目中可能需要上传图片到服务器）
            const previewImage = document.querySelector('.comment-image-preview img');
            if (previewImage) {
                // 在实际应用中，这里应该上传图片到服务器并获取URL
                // 这里为了演示，直接使用base64（仅用于小图片）
                commentData.imageUrl = previewImage.src;
            }
            
            // 提交评论
            const newComment = await submitComment(commentData);
            
            // 重置表单
            document.getElementById('comment-submit-form').reset();
            document.getElementById('comment-image-preview').innerHTML = '';
            
            this.showSuccess('评论发表成功！');
            
            // 重新加载评论列表（回到第一页）
            await this.loadComments(1);
            
            // 调用成功回调
            this.onCommentAdd(newComment);
        } catch (error) {
            console.error('提交评论失败:', error);
            this.showError(error.message || '提交评论失败，请稍后重试');
        }
    }
    
    /**
     * 处理删除评论
     * @param {string} commentId - 评论ID
     */
    async handleDeleteComment(commentId) {
        if (!confirm('确定要删除这条评论吗？')) return;
        
        try {
            this.showInfo('正在删除评论...');
            
            // 删除评论
            await deleteComment(commentId);
            
            this.showSuccess('评论删除成功！');
            
            // 重新加载当前页的评论
            await this.loadComments(this.currentPage);
            
            // 调用删除回调
            this.onCommentDelete(commentId);
        } catch (error) {
            console.error('删除评论失败:', error);
            this.showError(error.message || '删除评论失败，请稍后重试');
        }
    }
    
    /**
     * 处理编辑评论
     * @param {HTMLElement} commentElement - 评论DOM元素
     * @param {Object} comment - 评论数据
     */
    handleEditComment(commentElement, comment) {
        const contentElement = commentElement.querySelector('.comment-content');
        const originalContent = comment.content;
        
        // 替换为编辑表单
        contentElement.innerHTML = `
            <div class="comment-edit-form">
                <textarea class="comment-edit-textarea">${originalContent}</textarea>
                <div class="comment-edit-actions">
                    <button class="comment-edit-save-btn">保存</button>
                    <button class="comment-edit-cancel-btn">取消</button>
                </div>
            </div>
        `;
        
        // 绑定保存按钮事件
        const saveBtn = contentElement.querySelector('.comment-edit-save-btn');
        saveBtn.addEventListener('click', async () => {
            const newContent = contentElement.querySelector('.comment-edit-textarea').value.trim();
            
            if (!newContent) {
                this.showError('评论内容不能为空');
                return;
            }
            
            try {
                this.showInfo('正在保存评论...');
                
                // 更新评论
                await updateComment(comment._id, { content: newContent });
                
                this.showSuccess('评论更新成功！');
                
                // 重新加载当前页的评论
                await this.loadComments(this.currentPage);
            } catch (error) {
                console.error('更新评论失败:', error);
                this.showError(error.message || '更新评论失败，请稍后重试');
            }
        });
        
        // 绑定取消按钮事件
        const cancelBtn = contentElement.querySelector('.comment-edit-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            contentElement.textContent = originalContent;
        });
    }
    
    /**
     * 初始化分页组件
     */
    initPagination() {
        if (this.totalPages <= 1) {
            document.getElementById('comment-pagination').innerHTML = '';
            return;
        }
        
        // 如果已存在分页组件，先销毁
        if (this.pagination) {
            this.pagination.destroy();
        }
        
        // 创建新的分页组件
        this.pagination = new PaginationComponent({
            containerId: 'comment-pagination',
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            pageSize: this.pageSize,
            totalItems: this.totalComments,
            onPageChange: (page) => this.loadComments(page)
        });
    }
    
    /**
     * 格式化日期时间
     * @param {string|Date} dateTime - 日期时间
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(dateTime) {
        const date = new Date(dateTime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    
    /**
     * 显示成功消息
     * @param {string} message - 消息内容
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    /**
     * 显示错误消息
     * @param {string} message - 消息内容
     */
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    /**
     * 显示信息消息
     * @param {string} message - 消息内容
     */
    showInfo(message) {
        this.showMessage(message, 'info');
    }
    
    /**
     * 显示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success/error/info)
     */
    showMessage(message, type = 'info') {
        if (!this.messageElement) return;
        
        this.messageElement.textContent = message;
        this.messageElement.className = `comment-message ${type}`;
        
        // 自动隐藏非错误消息
        if (type !== 'error') {
            setTimeout(() => {
                if (this.messageElement) {
                    this.messageElement.textContent = '';
                    this.messageElement.className = 'comment-message';
                }
            }, 3000);
        }
    }
    
    /**
     * 刷新评论列表
     */
    async refresh() {
        await this.loadComments(this.currentPage);
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        // 销毁分页组件
        if (this.pagination) {
            this.pagination.destroy();
        }
        
        // 清空容器
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // 重置状态
        this.container = null;
        this.commentListElement = null;
        this.commentFormElement = null;
        this.loadingElement = null;
        this.messageElement = null;
        this.noCommentsElement = null;
        this.comments = [];
        this.pagination = null;
    }
}

export default CommentComponent;