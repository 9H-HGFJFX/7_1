/**
 * 图片上传组件
 * 用于新闻提交和评论提交时的图片上传功能
 */

class ImageUploadComponent {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.containerId - 容器元素ID
     * @param {Function} options.onUpload - 上传成功回调函数
     * @param {Function} options.onError - 错误处理回调函数
     * @param {Function} options.onPreview - 预览回调函数
     * @param {string} options.uploadUrl - 上传接口URL
     * @param {string} options.accept - 接受的图片格式
     * @param {number} options.maxSize - 最大文件大小(MB)
     * @param {number} options.maxFiles - 最大文件数量
     * @param {boolean} options.multiple - 是否支持多文件上传
     */
    constructor(options = {}) {
        // 配置项
        this.containerId = options.containerId;
        this.onUpload = options.onUpload || function() {};
        this.onError = options.onError || this.defaultErrorHandler;
        this.onPreview = options.onPreview || function() {};
        this.uploadUrl = options.uploadUrl || '/api/upload/image';
        this.accept = options.accept || 'image/*';
        this.maxSize = options.maxSize || 5; // 默认5MB
        this.maxFiles = options.maxFiles || 5;
        this.multiple = options.multiple || false;
        
        // 状态
        this.container = null;
        this.fileInput = null;
        this.uploadButton = null;
        this.previewContainer = null;
        this.dropZone = null;
        this.uploadedFiles = [];
        this.isDragging = false;
        
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
            this.container.className = 'image-upload-container';
            
            // 渲染组件结构
            this.render();
            
            // 绑定事件
            this.bindEvents();
            
            // 添加样式
            this.addStyles();
        } catch (error) {
            console.error('图片上传组件初始化失败:', error);
            this.onError(error);
        }
    }
    
    /**
     * 渲染组件HTML结构
     */
    render() {
        const isMultiple = this.multiple ? 'multiple' : '';
        const multipleText = this.multiple ? '(可上传多个)' : '(单张)';
        
        const html = `
            <div class="upload-wrapper">
                <!-- 拖拽上传区域 -->
                <div class="drop-zone">
                    <input 
                        type="file" 
                        accept="${this.accept}" 
                        ${isMultiple} 
                        class="file-input"
                        id="file-input-${this.containerId}"
                    />
                    <label for="file-input-${this.containerId}" class="upload-label">
                        <div class="upload-icon">📁</div>
                        <div class="upload-text">
                            <p class="upload-title">点击或拖拽图片到此处上传 ${multipleText}</p>
                            <p class="upload-hint">支持JPG、PNG、GIF格式，单张不超过${this.maxSize}MB</p>
                            <p class="upload-count-hint">已选择 0/${this.maxFiles} 张图片</p>
                        </div>
                    </label>
                </div>
                
                <!-- 上传按钮 -->
                <div class="upload-actions">
                    <button type="button" class="upload-button" disabled>
                        上传图片
                    </button>
                    <button type="button" class="clear-button" disabled>
                        清除选择
                    </button>
                </div>
                
                <!-- 预览区域 -->
                <div class="preview-container">
                    <h4 class="preview-title">图片预览</h4>
                    <div class="preview-grid"></div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // 获取DOM引用
        this.fileInput = document.getElementById(`file-input-${this.containerId}`);
        this.uploadButton = this.container.querySelector('.upload-button');
        this.clearButton = this.container.querySelector('.clear-button');
        this.previewContainer = this.container.querySelector('.preview-grid');
        this.dropZone = this.container.querySelector('.drop-zone');
        this.countHint = this.container.querySelector('.upload-count-hint');
    }
    
    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 文件选择事件
        this.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileSelection(files);
        });
        
        // 上传按钮点击事件
        this.uploadButton.addEventListener('click', () => {
            this.uploadFiles();
        });
        
        // 清除按钮点击事件
        this.clearButton.addEventListener('click', () => {
            this.clearSelection();
        });
        
        // 拖拽事件
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.isDragging = true;
            this.dropZone.classList.add('drag-over');
        });
        
        this.dropZone.addEventListener('dragleave', () => {
            this.isDragging = false;
            this.dropZone.classList.remove('drag-over');
        });
        
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.isDragging = false;
            this.dropZone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });
        
        // 点击标签时清空file input值，允许选择相同文件
        this.container.querySelector('.upload-label').addEventListener('click', () => {
            this.fileInput.value = '';
        });
    }
    
    /**
     * 处理文件选择
     * @param {Array} files - 选择的文件数组
     */
    handleFileSelection(files) {
        // 检查文件数量
        const remainingSlots = this.maxFiles - this.uploadedFiles.length;
        if (files.length > remainingSlots) {
            this.onError(new Error(`最多只能选择${this.maxFiles}个文件，还可以选择${remainingSlots}个文件`));
            files = files.slice(0, remainingSlots);
        }
        
        // 验证并处理文件
        let validFiles = [];
        
        for (const file of files) {
            // 验证文件类型
            if (!this.isValidFileType(file)) {
                this.onError(new Error(`不支持的文件类型: ${file.type}`));
                continue;
            }
            
            // 验证文件大小
            if (!this.isValidFileSize(file)) {
                this.onError(new Error(`文件大小超过限制: ${file.name} (最大${this.maxSize}MB)`));
                continue;
            }
            
            validFiles.push(file);
        }
        
        // 添加有效文件到已选列表
        this.uploadedFiles = [...this.uploadedFiles, ...validFiles];
        
        // 更新界面
        this.updateInterface();
        
        // 生成预览
        for (const file of validFiles) {
            this.generatePreview(file);
        }
    }
    
    /**
     * 生成文件预览
     * @param {File} file - 文件对象
     */
    generatePreview(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.dataset.index = this.uploadedFiles.indexOf(file);
            
            previewItem.innerHTML = `
                <div class="preview-image-wrapper">
                    <img src="${e.target.result}" alt="预览图" class="preview-image">
                    <button type="button" class="remove-preview" title="删除">✕</button>
                </div>
                <div class="preview-info">
                    <span class="preview-filename">${this.truncateFilename(file.name)}</span>
                    <span class="preview-size">${this.formatFileSize(file.size)}</span>
                </div>
            `;
            
            // 绑定删除按钮事件
            const removeButton = previewItem.querySelector('.remove-preview');
            removeButton.addEventListener('click', () => {
                const index = this.uploadedFiles.indexOf(file);
                if (index !== -1) {
                    this.removeFile(index);
                }
            });
            
            // 添加到预览容器
            this.previewContainer.appendChild(previewItem);
            
            // 触发预览回调
            this.onPreview(file, e.target.result);
        };
        
        reader.onerror = () => {
            this.onError(new Error(`无法生成预览: ${file.name}`));
        };
        
        reader.readAsDataURL(file);
    }
    
    /**
     * 上传文件
     */
    async uploadFiles() {
        if (this.uploadedFiles.length === 0) {
            this.onError(new Error('请先选择要上传的图片'));
            return;
        }
        
        try {
            // 创建FormData
            const formData = new FormData();
            this.uploadedFiles.forEach((file, index) => {
                formData.append('images', file);
            });
            
            // 添加CSRF令牌（如果需要）
            const csrfToken = document.querySelector('meta[name="csrf-token"]');
            if (csrfToken) {
                formData.append('csrf_token', csrfToken.getAttribute('content'));
            }
            
            // 显示上传中状态
            this.uploadButton.disabled = true;
            this.uploadButton.innerHTML = '<span class="uploading-spinner"></span> 上传中...';
            
            // 模拟上传（实际项目中应替换为真实的fetch请求）
            // const response = await fetch(this.uploadUrl, {
            //     method: 'POST',
            //     body: formData,
            //     headers: {
            //         // 注意：不要设置Content-Type，让浏览器自动处理
            //     }
            // });
            
            // if (!response.ok) {
            //     throw new Error(`上传失败: ${response.statusText}`);
            // }
            
            // const result = await response.json();
            
            // 模拟上传延迟
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 模拟成功响应
            const mockResult = {
                success: true,
                data: this.uploadedFiles.map(file => ({
                    filename: file.name,
                    url: URL.createObjectURL(file), // 模拟URL
                    size: file.size,
                    type: file.type
                }))
            };
            
            // 触发上传成功回调
            this.onUpload(mockResult);
            
            // 重置上传状态
            this.resetUpload();
            
        } catch (error) {
            console.error('上传失败:', error);
            this.onError(error);
            
            // 恢复按钮状态
            this.uploadButton.innerHTML = '上传图片';
        }
    }
    
    /**
     * 移除指定文件
     * @param {number} index - 文件索引
     */
    removeFile(index) {
        if (index >= 0 && index < this.uploadedFiles.length) {
            // 从数组中移除
            this.uploadedFiles.splice(index, 1);
            
            // 更新界面
            this.updateInterface();
            
            // 移除预览元素
            const previewItems = this.previewContainer.querySelectorAll('.preview-item');
            if (previewItems[index]) {
                previewItems[index].remove();
            }
            
            // 重新索引预览元素
            this.updatePreviewIndices();
        }
    }
    
    /**
     * 清除所有选择
     */
    clearSelection() {
        // 清空文件数组
        this.uploadedFiles = [];
        
        // 清空文件输入
        this.fileInput.value = '';
        
        // 清空预览容器
        this.previewContainer.innerHTML = '';
        
        // 更新界面
        this.updateInterface();
    }
    
    /**
     * 重置上传状态
     */
    resetUpload() {
        this.uploadButton.innerHTML = '上传图片';
        this.clearSelection();
    }
    
    /**
     * 更新预览元素的索引
     */
    updatePreviewIndices() {
        const previewItems = this.previewContainer.querySelectorAll('.preview-item');
        previewItems.forEach((item, index) => {
            item.dataset.index = index;
        });
    }
    
    /**
     * 更新界面状态
     */
    updateInterface() {
        const hasFiles = this.uploadedFiles.length > 0;
        const isMaxReached = this.uploadedFiles.length >= this.maxFiles;
        
        // 更新按钮状态
        this.uploadButton.disabled = !hasFiles;
        this.clearButton.disabled = !hasFiles;
        
        // 更新提示文本
        this.countHint.textContent = `已选择 ${this.uploadedFiles.length}/${this.maxFiles} 张图片`;
        
        // 禁用文件选择（如果已达上限）
        this.fileInput.disabled = isMaxReached;
        
        // 更新拖拽区域样式
        if (isMaxReached) {
            this.dropZone.classList.add('max-reached');
        } else {
            this.dropZone.classList.remove('max-reached');
        }
    }
    
    /**
     * 验证文件类型
     * @param {File} file - 文件对象
     * @returns {boolean} 是否有效
     */
    isValidFileType(file) {
        // 检查MIME类型是否以image/开头
        return file.type.startsWith('image/');
    }
    
    /**
     * 验证文件大小
     * @param {File} file - 文件对象
     * @returns {boolean} 是否有效
     */
    isValidFileSize(file) {
        // 转换MB为字节
        const maxSizeBytes = this.maxSize * 1024 * 1024;
        return file.size <= maxSizeBytes;
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 截断文件名
     * @param {string} filename - 原始文件名
     * @param {number} maxLength - 最大长度
     * @returns {string} 截断后的文件名
     */
    truncateFilename(filename, maxLength = 15) {
        if (filename.length <= maxLength) return filename;
        
        const extensionIndex = filename.lastIndexOf('.');
        if (extensionIndex === -1) {
            return filename.substring(0, maxLength) + '...';
        }
        
        const extension = filename.substring(extensionIndex);
        const nameWithoutExt = filename.substring(0, extensionIndex);
        
        if (nameWithoutExt.length <= maxLength) {
            return filename;
        }
        
        return nameWithoutExt.substring(0, maxLength - extension.length - 3) + '...' + extension;
    }
    
    /**
     * 默认错误处理函数
     * @param {Error} error - 错误对象
     */
    defaultErrorHandler(error) {
        console.error('图片上传错误:', error);
        alert(`图片上传错误: ${error.message}`);
    }
    
    /**
     * 添加样式
     */
    addStyles() {
        // 检查样式是否已添加
        if (document.getElementById('image-upload-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'image-upload-styles';
        style.textContent = `
            .image-upload-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            }
            
            .upload-wrapper {
                width: 100%;
            }
            
            .drop-zone {
                border: 2px dashed #ccc;
                border-radius: 8px;
                padding: 30px;
                text-align: center;
                transition: all 0.3s ease;
                background-color: #fafafa;
                cursor: pointer;
            }
            
            .drop-zone:hover:not(.max-reached) {
                border-color: #007bff;
                background-color: #f0f7ff;
            }
            
            .drop-zone.drag-over {
                border-color: #007bff;
                background-color: #e6f0ff;
                transform: scale(1.02);
            }
            
            .drop-zone.max-reached {
                border-color: #6c757d;
                background-color: #f8f9fa;
                cursor: not-allowed;
                opacity: 0.6;
            }
            
            .upload-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .upload-text {
                max-width: 500px;
                margin: 0 auto;
            }
            
            .upload-title {
                font-size: 18px;
                font-weight: 500;
                color: #333;
                margin: 0 0 8px 0;
            }
            
            .upload-hint,
            .upload-count-hint {
                font-size: 14px;
                color: #6c757d;
                margin: 4px 0;
            }
            
            .upload-count-hint {
                font-weight: 500;
            }
            
            .file-input {
                display: none;
            }
            
            .upload-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            
            .upload-button,
            .clear-button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .upload-button {
                background-color: #007bff;
                color: white;
            }
            
            .upload-button:hover:not(:disabled) {
                background-color: #0056b3;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
            }
            
            .clear-button {
                background-color: #6c757d;
                color: white;
            }
            
            .clear-button:hover:not(:disabled) {
                background-color: #545b62;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(108, 117, 125, 0.3);
            }
            
            .upload-button:disabled,
            .clear-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            
            .preview-container {
                margin-top: 30px;
            }
            
            .preview-title {
                font-size: 16px;
                font-weight: 500;
                color: #333;
                margin-bottom: 15px;
            }
            
            .preview-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
            }
            
            .preview-item {
                border: 1px solid #dee2e6;
                border-radius: 6px;
                overflow: hidden;
                transition: all 0.2s ease;
                background-color: #fff;
            }
            
            .preview-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            
            .preview-image-wrapper {
                position: relative;
                width: 100%;
                padding-top: 75%; /* 4:3 比例 */
                overflow: hidden;
                background-color: #f8f9fa;
            }
            
            .preview-image {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .preview-item:hover .preview-image {
                transform: scale(1.05);
            }
            
            .remove-preview {
                position: absolute;
                top: 5px;
                right: 5px;
                width: 24px;
                height: 24px;
                border: none;
                border-radius: 50%;
                background-color: rgba(0, 0, 0, 0.6);
                color: white;
                font-size: 14px;
                line-height: 1;
                cursor: pointer;
                opacity: 0;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .preview-item:hover .remove-preview {
                opacity: 1;
            }
            
            .remove-preview:hover {
                background-color: #dc3545;
            }
            
            .preview-info {
                padding: 8px;
                font-size: 12px;
            }
            
            .preview-filename {
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #495057;
                margin-bottom: 2px;
            }
            
            .preview-size {
                display: block;
                color: #6c757d;
                font-size: 11px;
            }
            
            /* 上传中动画 */
            .uploading-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 0.8s linear infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .drop-zone {
                    padding: 20px;
                }
                
                .upload-icon {
                    font-size: 36px;
                    margin-bottom: 12px;
                }
                
                .upload-title {
                    font-size: 16px;
                }
                
                .upload-hint,
                .upload-count-hint {
                    font-size: 13px;
                }
                
                .upload-actions {
                    flex-direction: column;
                }
                
                .preview-grid {
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 10px;
                }
            }
            
            @media (max-width: 480px) {
                .drop-zone {
                    padding: 15px;
                }
                
                .upload-icon {
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                
                .upload-title {
                    font-size: 14px;
                }
                
                .preview-grid {
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 获取当前选中的文件
     * @returns {Array} 文件数组
     */
    getSelectedFiles() {
        return [...this.uploadedFiles];
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        // 清理事件监听器
        this.fileInput.removeEventListener('change', this.handleFileSelection.bind(this));
        
        // 清空容器
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // 清空状态
        this.uploadedFiles = [];
        this.container = null;
        this.fileInput = null;
        this.uploadButton = null;
        this.clearButton = null;
        this.previewContainer = null;
        this.dropZone = null;
    }
}

// 导出图片上传组件
export default ImageUploadComponent;