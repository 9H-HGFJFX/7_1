/**
 * 投票分数计算组件
 * 基于有效投票数（删除无效投票后）自动计算新闻真假状态
 */

class VoteScoreCalculator {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Function} options.onStatusChange - 状态变更回调函数
     * @param {Function} options.onScoreUpdate - 分数更新回调函数
     * @param {number} options.threshold - 判定为假新闻的阈值比例 (0-1)
     * @param {number} options.minVotes - 最小投票数阈值
     * @param {string} options.apiUrl - 分数重算API地址
     */
    constructor(options = {}) {
        // 配置项
        this.onStatusChange = options.onStatusChange || function() {};
        this.onScoreUpdate = options.onScoreUpdate || function() {};
        this.threshold = options.threshold || 0.6; // 默认60%的投票认为是假新闻则判定为假新闻
        this.minVotes = options.minVotes || 5; // 默认至少5个投票才进行判定
        this.apiUrl = options.apiUrl || '/api/news/recalculate-score';
        
        // 状态
        this.currentNewsId = null;
        this.voteData = {
            fakeVotes: 0,      // 假新闻投票数
            nonFakeVotes: 0,   // 非假新闻投票数
            totalVotes: 0,     // 总投票数
            invalidVotes: 0,   // 无效投票数
            validVotes: 0      // 有效投票数
        };
        this.scoreData = {
            fakeScore: 0,      // 假新闻得分比例
            confidence: 0,     // 置信度
            status: 'pending'  // 状态: pending, fake, non-fake, insufficient
        };
        
        console.log('投票分数计算组件初始化完成');
    }
    
    /**
     * 更新投票数据
     * @param {string} newsId - 新闻ID
     * @param {Object} data - 投票数据
     */
    updateVoteData(newsId, data) {
        this.currentNewsId = newsId;
        
        // 更新投票数据
        this.voteData = {
            fakeVotes: data.fakeVotes || 0,
            nonFakeVotes: data.nonFakeVotes || 0,
            totalVotes: data.totalVotes || 0,
            invalidVotes: data.invalidVotes || 0,
            validVotes: data.validVotes || (data.fakeVotes || 0) + (data.nonFakeVotes || 0)
        };
        
        // 重新计算分数
        this.calculateScore();
        
        console.log(`投票数据更新完成 - 新闻ID: ${newsId}`, this.voteData);
        
        return this;
    }
    
    /**
     * 计算投票分数和新闻状态
     */
    calculateScore() {
        const { fakeVotes, nonFakeVotes, validVotes } = this.voteData;
        let newStatus = this.scoreData.status;
        
        // 计算假新闻得分比例
        const fakeScore = validVotes > 0 ? fakeVotes / validVotes : 0;
        
        // 计算置信度
        const confidence = this.calculateConfidence(fakeVotes, nonFakeVotes);
        
        // 确定新闻状态
        if (validVotes < this.minVotes) {
            newStatus = 'insufficient'; // 投票数不足
        } else if (fakeScore >= this.threshold) {
            newStatus = 'fake'; // 判定为假新闻
        } else {
            newStatus = 'non-fake'; // 判定为非假新闻
        }
        
        // 更新分数数据
        const oldStatus = this.scoreData.status;
        this.scoreData = {
            fakeScore,
            confidence,
            status: newStatus
        };
        
        // 触发回调
        this.onScoreUpdate(this.scoreData);
        
        // 如果状态发生变化，触发状态变更回调
        if (newStatus !== oldStatus) {
            this.onStatusChange(newStatus, oldStatus);
            console.log(`新闻状态变更: ${oldStatus} -> ${newStatus}`);
        }
        
        return this.scoreData;
    }
    
    /**
     * 计算置信度
     * @param {number} fakeVotes - 假新闻投票数
     * @param {number} nonFakeVotes - 非假新闻投票数
     * @returns {number} 置信度 (0-1)
     */
    calculateConfidence(fakeVotes, nonFakeVotes) {
        const total = fakeVotes + nonFakeVotes;
        
        if (total === 0) return 0;
        
        // 使用比例差异和投票总数计算置信度
        const ratioDifference = Math.abs(fakeVotes - nonFakeVotes) / total;
        const voteCountFactor = Math.min(total / (this.minVotes * 5), 1); // 最高提升5倍阈值的权重
        
        // 置信度计算: 比例差异 * 投票数量因子
        const confidence = ratioDifference * voteCountFactor;
        
        return Math.round(confidence * 100) / 100; // 保留两位小数
    }
    
    /**
     * 手动触发API重新计算分数
     * @param {string} newsId - 新闻ID
     * @returns {Promise} 操作结果
     */
    async recalculateScore(newsId) {
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 调用API重新计算分数
            // 实际项目中应替换为真实的fetch请求
            // const response = await fetch(`${this.apiUrl}/${newsId}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${this.getAuthToken()}`
            //     }
            // });
            
            // if (!response.ok) {
            //     throw new Error(`重新计算失败: ${response.statusText}`);
            // }
            
            // const result = await response.json();
            
            // 模拟API延迟
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 模拟成功响应
            const mockResult = {
                success: true,
                data: {
                    newsId,
                    fakeVotes: this.voteData.fakeVotes + Math.floor(Math.random() * 3),
                    nonFakeVotes: this.voteData.nonFakeVotes + Math.floor(Math.random() * 2),
                    invalidVotes: this.voteData.invalidVotes,
                    status: this.scoreData.status
                }
            };
            
            // 更新本地数据
            this.updateVoteData(newsId, mockResult.data);
            
            console.log(`重新计算分数成功 - 新闻ID: ${newsId}`);
            return mockResult;
        } catch (error) {
            console.error('重新计算分数失败:', error);
            throw error;
        } finally {
            // 隐藏加载状态
            this.showLoading(false);
        }
    }
    
    /**
     * 获取当前分数数据
     * @returns {Object} 分数数据
     */
    getScoreData() {
        return { ...this.scoreData };
    }
    
    /**
     * 获取当前投票数据
     * @returns {Object} 投票数据
     */
    getVoteData() {
        return { ...this.voteData };
    }
    
    /**
     * 获取状态显示文本
     * @param {string} status - 状态代码
     * @returns {string} 状态显示文本
     */
    getStatusText(status = this.scoreData.status) {
        const statusMap = {
            pending: '待判定',
            fake: '假新闻',
            'non-fake': '非假新闻',
            insufficient: '投票不足'
        };
        
        return statusMap[status] || '未知状态';
    }
    
    /**
     * 获取状态样式类
     * @param {string} status - 状态代码
     * @returns {string} CSS类名
     */
    getStatusClass(status = this.scoreData.status) {
        const classMap = {
            pending: 'status-pending',
            fake: 'status-fake',
            'non-fake': 'status-non-fake',
            insufficient: 'status-insufficient'
        };
        
        return classMap[status] || 'status-unknown';
    }
    
    /**
     * 格式化百分比显示
     * @param {number} value - 数值
     * @returns {string} 格式化的百分比
     */
    formatPercentage(value) {
        return `${Math.round(value * 100)}%`;
    }
    
    /**
     * 获取进度条配置
     * @returns {Object} 进度条配置
     */
    getProgressBarConfig() {
        const { fakeScore } = this.scoreData;
        const nonFakeScore = 1 - fakeScore;
        
        return {
            fake: {
                width: this.formatPercentage(fakeScore),
                label: `假新闻 ${this.formatPercentage(fakeScore)}`,
                class: 'progress-fake'
            },
            nonFake: {
                width: this.formatPercentage(nonFakeScore),
                label: `非假新闻 ${this.formatPercentage(nonFakeScore)}`,
                class: 'progress-non-fake'
            }
        };
    }
    
    /**
     * 设置判定阈值
     * @param {number} threshold - 阈值 (0-1)
     */
    setThreshold(threshold) {
        if (threshold >= 0 && threshold <= 1) {
            this.threshold = threshold;
            this.calculateScore(); // 重新计算分数
            console.log(`阈值已更新: ${threshold}`);
        } else {
            console.warn('阈值必须在0到1之间');
        }
        return this;
    }
    
    /**
     * 设置最小投票数阈值
     * @param {number} minVotes - 最小投票数
     */
    setMinVotes(minVotes) {
        if (minVotes >= 0) {
            this.minVotes = minVotes;
            this.calculateScore(); // 重新计算分数
            console.log(`最小投票数已更新: ${minVotes}`);
        } else {
            console.warn('最小投票数必须大于或等于0');
        }
        return this;
    }
    
    /**
     * 生成模拟数据（用于测试）
     * @param {number} totalVotes - 总投票数
     * @param {number} fakeRatio - 假新闻比例 (0-1)
     * @returns {Object} 模拟数据
     */
    generateMockData(totalVotes = 50, fakeRatio = 0.6) {
        const fakeVotes = Math.floor(totalVotes * fakeRatio);
        const nonFakeVotes = totalVotes - fakeVotes;
        const invalidVotes = Math.floor(totalVotes * 0.1); // 10% 无效投票
        
        return {
            fakeVotes,
            nonFakeVotes,
            totalVotes: fakeVotes + nonFakeVotes + invalidVotes,
            invalidVotes,
            validVotes: fakeVotes + nonFakeVotes
        };
    }
    
    /**
     * 显示/隐藏加载状态
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        // 实际项目中可以实现UI加载状态
        console.log(show ? '正在重新计算分数...' : '计算完成');
    }
    
    /**
     * 获取认证令牌（实际项目中实现）
     * @returns {string} 令牌
     */
    getAuthToken() {
        // 实际项目中应从存储中获取令牌
        return localStorage.getItem('auth_token') || '';
    }
    
    /**
     * 添加CSS样式到文档
     */
    addStyles() {
        // 检查样式是否已添加
        if (document.getElementById('vote-score-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'vote-score-styles';
        style.textContent = `
            /* 状态标签样式 */
            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 500;
                text-align: center;
                transition: all 0.3s ease;
            }
            
            .status-pending {
                background-color: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
            }
            
            .status-fake {
                background-color: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            
            .status-non-fake {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .status-insufficient {
                background-color: #e2e3e5;
                color: #6c757d;
                border: 1px solid #d6d8db;
            }
            
            /* 进度条样式 */
            .vote-progress-container {
                width: 100%;
                height: 24px;
                background-color: #f8f9fa;
                border-radius: 12px;
                overflow: hidden;
                position: relative;
                margin: 10px 0;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .vote-progress-bar {
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                padding-right: 8px;
                color: white;
                font-size: 12px;
                font-weight: 500;
                transition: width 0.6s ease;
            }
            
            .progress-fake {
                background-color: #dc3545;
                position: absolute;
                left: 0;
                top: 0;
            }
            
            .progress-non-fake {
                background-color: #28a745;
                position: absolute;
                right: 0;
                top: 0;
            }
            
            /* 投票统计卡片样式 */
            .vote-stats-card {
                background-color: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                margin: 10px 0;
            }
            
            .vote-stats-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e9ecef;
            }
            
            .vote-stats-title {
                font-size: 16px;
                font-weight: 600;
                color: #333;
                margin: 0;
            }
            
            .vote-stats-values {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 15px;
                margin: 15px 0;
            }
            
            .vote-stat-item {
                text-align: center;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 6px;
            }
            
            .vote-stat-value {
                display: block;
                font-size: 24px;
                font-weight: 700;
                color: #495057;
                margin-bottom: 4px;
            }
            
            .vote-stat-label {
                display: block;
                font-size: 12px;
                color: #6c757d;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .confidence-indicator {
                display: flex;
                align-items: center;
                margin-top: 10px;
                font-size: 14px;
                color: #495057;
            }
            
            .confidence-bar {
                flex-grow: 1;
                height: 8px;
                background-color: #e9ecef;
                border-radius: 4px;
                margin: 0 10px;
                overflow: hidden;
            }
            
            .confidence-fill {
                height: 100%;
                background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
                transition: width 0.6s ease;
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .vote-stats-values {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .vote-stat-value {
                    font-size: 20px;
                }
                
                .vote-progress-bar {
                    font-size: 11px;
                    padding-right: 4px;
                }
            }
            
            @media (max-width: 480px) {
                .vote-stats-card {
                    padding: 15px;
                }
                
                .vote-stats-values {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                
                .vote-stats-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 10px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 渲染投票统计UI
     * @param {HTMLElement} container - 容器元素
     */
    render(container) {
        if (!container) {
            console.error('容器元素不存在');
            return;
        }
        
        // 添加样式
        this.addStyles();
        
        const { fakeVotes, nonFakeVotes, validVotes, invalidVotes } = this.voteData;
        const { fakeScore, confidence, status } = this.scoreData;
        const progressConfig = this.getProgressBarConfig();
        
        // 创建HTML结构
        const html = `
            <div class="vote-stats-card">
                <div class="vote-stats-header">
                    <h3 class="vote-stats-title">投票统计</h3>
                    <span class="status-badge ${this.getStatusClass()}">
                        ${this.getStatusText()}
                    </span>
                </div>
                
                <div class="vote-stats-values">
                    <div class="vote-stat-item">
                        <span class="vote-stat-value">${validVotes}</span>
                        <span class="vote-stat-label">有效投票</span>
                    </div>
                    <div class="vote-stat-item">
                        <span class="vote-stat-value">${fakeVotes}</span>
                        <span class="vote-stat-label">假新闻投票</span>
                    </div>
                    <div class="vote-stat-item">
                        <span class="vote-stat-value">${nonFakeVotes}</span>
                        <span class="vote-stat-label">非假新闻投票</span>
                    </div>
                    <div class="vote-stat-item">
                        <span class="vote-stat-value">${invalidVotes}</span>
                        <span class="vote-stat-label">无效投票</span>
                    </div>
                </div>
                
                <div class="vote-progress-container">
                    <div class="vote-progress-bar ${progressConfig.fake.class}" style="width: ${progressConfig.fake.width}">
                        ${validVotes > 0 ? `${progressConfig.fake.label}` : ''}
                    </div>
                    <div class="vote-progress-bar ${progressConfig.nonFake.class}" style="width: ${progressConfig.nonFake.width}">
                        ${validVotes > 0 ? `${progressConfig.nonFake.label}` : ''}
                    </div>
                </div>
                
                <div class="confidence-indicator">
                    <span>置信度:</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${this.formatPercentage(confidence)}"></div>
                    </div>
                    <span>${this.formatPercentage(confidence)}</span>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        return container;
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        // 清理事件监听器和状态
        this.currentNewsId = null;
        this.voteData = {
            fakeVotes: 0,
            nonFakeVotes: 0,
            totalVotes: 0,
            invalidVotes: 0,
            validVotes: 0
        };
        this.scoreData = {
            fakeScore: 0,
            confidence: 0,
            status: 'pending'
        };
        
        console.log('投票分数计算组件已销毁');
    }
}

// 导出组件
export default VoteScoreCalculator;