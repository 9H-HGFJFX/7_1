/**
 * 新闻提交组件
 * 负责成员提交新闻的表单和处理逻辑
 */
class NewsSubmit {
    constructor() {
        this.formContainer = document.getElementById('news-submit-form');
        this.submitModal = document.getElementById('news-submit-modal');
        this.openModalBtn = document.getElementById('open-submit-modal');
        this.closeModalBtn = document.querySelector('#news-submit-modal .close-btn');
        this.submitBtn = document.getElementById('submit-news-btn');
        this.imageUpload = document.getElementById('news-image');
        this.imagePreview = document.getElementById('image-preview');
        
        this.initialize();
    }
    
    /**
     * 初始化组件
     */
    initialize() {
        // 检查用户权限
        this.checkUserPermission();
        
        // 添加事件监听器
        this.addEventListeners();
    }
    
    /**
     * 检查用户权限，只有成员和管理员可以看到提交按钮
     */
    checkUserPermission() {
        const auth = new Auth();
        
        if (!auth.hasRole(['MEMBER', 'ADMINISTRATOR'])) {
            // 隐藏提交按钮
            if (this.openModalBtn) {
                this.openModalBtn.classList.add('hidden');
            }
            
            // 显示权限提示
            const notification = document.createElement('div');
            notification.className = 'permission-notice';
            notification.textContent = '您需要成为成员才能提交新闻';
            
            if (this.openModalBtn && this.openModalBtn.parentNode) {
                this.openModalBtn.parentNode.appendChild(notification);
            }
        }
    }
    
    /**
     * 添加事件监听器
     */
    addEventListeners() {
        // 打开模态框
        if (this.openModalBtn) {
            this.openModalBtn.addEventListener('click', this.openModal.bind(this));
        }
        
        // 关闭模态框
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', this.closeModal.bind(this));
        }
        
        // 点击模态框外部关闭
        if (this.submitModal) {
            this.submitModal.addEventListener('click', (e) => {
                if (e.target === this.submitModal) {
                    this.closeModal();
                }
            });
        }
        
        // 提交表单
        if (this.submitBtn) {
            this.submitBtn.addEventListener('click', this.handleSubmit.bind(this));
        }
        
        // 图片预览
        if (this.imageUpload) {
            this.imageUpload.addEventListener('change', this.handleImagePreview.bind(this));
        }
        
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.submitModal && !this.submitModal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }
    
    /**
     * 打开提交模态框
     */
    openModal() {
        // 重置表单
        this.resetForm();
        
        // 显示模态框
        if (this.submitModal) {
            this.submitModal.classList.remove('hidden');
            // 添加动画类
            setTimeout(() => {
                this.submitModal.classList.add('modal-active');
            }, 10);
        }
        
        // 阻止页面滚动
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * 关闭提交模态框
     */
    closeModal() {
        if (this.submitModal) {
            // 移除动画类
            this.submitModal.classList.remove('modal-active');
            
            // 延迟隐藏，等待动画完成
            setTimeout(() => {
                this.submitModal.classList.add('hidden');
            }, 300);
        }
        
        // 恢复页面滚动
        document.body.style.overflow = '';
    }
    
    /**
     * 重置表单
     */
    resetForm() {
        if (this.formContainer) {
            this.formContainer.reset();
        }
        
        // 清除图片预览
        if (this.imagePreview) {
            this.imagePreview.innerHTML = '';
            this.imagePreview.classList.add('hidden');
        }
        
        // 清除错误提示
        this.clearErrors();
    }
    
    /**
     * 处理图片预览
     * @param {Event} e - 文件选择事件
     */
    handleImagePreview(e) {
        const file = e.target.files[0];
        
        if (!file) {
            // 清除预览
            if (this.imagePreview) {
                this.imagePreview.innerHTML = '';
                this.imagePreview.classList.add('hidden');
            }
            return;
        }
        
        // 验证文件类型
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('请上传有效的图片文件（JPG、PNG、GIF、WebP）');
            e.target.value = '';
            return;
        }
        
        // 验证文件大小（最大5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('图片大小不能超过5MB');
            e.target.value = '';
            return;
        }
        
        // 显示预览
        const reader = new FileReader();
        reader.onload = (event) => {
            if (this.imagePreview) {
                this.imagePreview.innerHTML = `
                    <img src="${event.target.result}" alt="预览图片" class="preview-img">
                    <button type="button" id="remove-image" class="remove-image-btn">移除</button>
                `;
                this.imagePreview.classList.remove('hidden');
                
                // 添加移除图片按钮事件
                const removeBtn = document.getElementById('remove-image');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        if (this.imageUpload) {
                            this.imageUpload.value = '';
                        }
                        this.imagePreview.innerHTML = '';
                        this.imagePreview.classList.add('hidden');
                    });
                }
            }
        };
        reader.readAsDataURL(file);
    }
    
    /**
     * 处理表单提交
     * @param {Event} e - 提交事件
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        // 清除之前的错误
        this.clearErrors();
        
        // 验证表单
        const formData = this.validateForm();
        if (!formData) {
            return;
        }
        
        try {
            // 显示加载状态
            this.showLoading();
            
            // 上传图片（如果有）
            let imageUrl = null;
            if (this.imageUpload && this.imageUpload.files[0]) {
                imageUrl = await this.uploadImage(this.imageUpload.files[0]);
            }
            
            // 提交新闻数据
            const newsData = {
                title: formData.title,
                content: formData.content,
                imageUrl
            };
            
            const result = await this.submitNews(newsData);
            
            // 显示成功消息
            this.showSuccess(result);
            
        } catch (error) {
            this.showError(error);
        } finally {
            // 隐藏加载状态
            this.hideLoading();
        }
    }
    
    /**
     * 验证表单
     * @returns {Object|null} 验证通过的数据或null
     */
    validateForm() {
        const titleInput = document.getElementById('news-title');
        const contentInput = document.getElementById('news-content');
        
        let isValid = true;
        const formData = {};
        
        // 验证标题
        if (!titleInput || !titleInput.value.trim()) {
            this.showErrorForField(titleInput, '请输入新闻标题');
            isValid = false;
        } else if (titleInput.value.length > 200) {
            this.showErrorForField(titleInput, '标题不能超过200个字符');
            isValid = false;
        } else {
            formData.title = titleInput.value.trim();
        }
        
        // 验证内容
        if (!contentInput || !contentInput.value.trim()) {
            this.showErrorForField(contentInput, '请输入新闻内容');
            isValid = false;
        } else if (contentInput.value.length < 10) {
            this.showErrorForField(contentInput, '内容至少需要10个字符');
            isValid = false;
        } else if (contentInput.value.length > 5000) {
            this.showErrorForField(contentInput, '内容不能超过5000个字符');
            isValid = false;
        } else {
            formData.content = contentInput.value.trim();
        }
        
        return isValid ? formData : null;
    }
    
    /**
     * 显示字段错误
     * @param {HTMLElement} field - 输入字段
     * @param {string} message - 错误消息
     */
    showErrorForField(field, message) {
        if (!field) return;
        
        // 标记字段错误
        field.classList.add('error');
        
        // 查找或创建错误消息元素
        let errorElement = field.nextElementSibling;
        if (!errorElement || !errorElement.classList.contains('error-message')) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            field.parentNode.insertBefore(errorElement, field.nextSibling);
        }
        
        errorElement.textContent = message;
    }
    
    /**
     * 清除所有错误
     */
    clearErrors() {
        // 清除所有字段错误样式
        const errorFields = document.querySelectorAll('.form-group input.error, .form-group textarea.error');
        errorFields.forEach(field => field.classList.remove('error'));
        
        // 清除所有错误消息
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(msg => msg.remove());
    }
    
    /**
     * 上传图片
     * @param {File} file - 图片文件
     * @returns {Promise<string>} 图片URL
     */
    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch('/api/upload/image', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('图片上传失败');
        }
        
        const data = await response.json();
        return data.imageUrl;
    }
    
    /**
     * 提交新闻
     * @param {Object} newsData - 新闻数据
     * @returns {Promise<Object>} 提交结果
     */
    async submitNews(newsData) {
        const response = await fetch('/api/news', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(newsData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || '提交新闻失败');
        }
        
        return await response.json();
    }
    
    /**
     * 显示加载状态
     */
    showLoading() {
        if (this.submitBtn) {
            this.submitBtn.disabled = true;
            this.submitBtn.innerHTML = '<span class="loading-spinner"></span> 提交中...';
        }
    }
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (this.submitBtn) {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = '提交新闻';
        }
    }
    
    /**
     * 显示成功消息
     * @param {Object} result - 提交结果
     */
    showSuccess(result) {
        // 显示成功提示
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.innerHTML = `
            <div class="success-icon">✓</div>
            <h3>提交成功！</h3>
            <p>您的新闻已成功提交，正在等待验证。</p>
            <div class="success-actions">
                <button id="view-news-btn" class="btn btn-primary">查看新闻</button>
                <button id="submit-another-btn" class="btn btn-secondary">继续提交</button>
            </div>
        `;
        
        // 替换表单内容
        if (this.formContainer) {
            this.formContainer.innerHTML = '';
            this.formContainer.appendChild(successMessage);
        }
        
        // 添加按钮事件
        document.getElementById('view-news-btn').addEventListener('click', () => {
            this.closeModal();
            // 跳转到新闻详情页
            window.location.hash = `#news/${result._id}`;
        });
        
        document.getElementById('submit-another-btn').addEventListener('click', () => {
            this.resetForm();
        });
    }
    
    /**
     * 显示错误消息
     * @param {Error} error - 错误对象
     */
    showError(error) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'form-error';
        errorMessage.textContent = error.message || '提交失败，请稍后重试';
        
        // 插入到表单顶部
        if (this.formContainer && this.formContainer.firstChild) {
            this.formContainer.insertBefore(errorMessage, this.formContainer.firstChild);
        }
    }
    
    /**
     * 获取模拟数据（用于演示）
     * @returns {Object} 模拟的新闻数据
     */
    getMockData() {
        return {
            title: '示例新闻标题',
            content: '这是一条示例新闻内容，用于演示新闻提交功能。\n\n您可以输入详细的新闻描述，包括事件的时间、地点、人物等信息。',
            imageUrl: null
        };
    }
    
    /**
     * 填充模拟数据（用于演示）
     */
    fillWithMockData() {
        const mockData = this.getMockData();
        
        const titleInput = document.getElementById('news-title');
        const contentInput = document.getElementById('news-content');
        
        if (titleInput) titleInput.value = mockData.title;
        if (contentInput) contentInput.value = mockData.content;
    }
}

// 导出组件
module.exports = NewsSubmit;