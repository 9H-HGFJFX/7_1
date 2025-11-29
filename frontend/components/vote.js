/**
 * 投票组件
 * 实现用户对新闻的投票功能，包括选择"假新闻"或"非假新闻"
 */

import { submitVote, getUserVoteForNews, getNewsVoteStats } from '../utils/api.js';
import { getToken } from '../utils/storage.js';
import auth from './auth.js';

class VoteComponent {
    /**
     * 构造函数
     * @param {Object} options - 组件配置
     * @param {string} options.containerId - 容器元素ID
     * @param {string} options.newsId - 新闻ID
     * @param {Function} options.onVoteSuccess - 投票成功回调
     * @param {Function} options.onVoteError - 投票错误回调
     */
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.newsId = options.newsId;
        this.onVoteSuccess = options.onVoteSuccess || function() {};
        this.onVoteError = options.onVoteError || function() {};
        
        this.container = null;
        this.fakeVoteButton = null;
        this.notFakeVoteButton = null;
        this.voteStatsElement = null;
        this.messageElement = null;
        
        this.userVote = null; // 存储用户当前投票
        this.voteStats = null; // 存储投票统计
        this.isVoting = false; // 防止重复投票
        
        this.init();
    }
    
    /**
     * 初始化组件
     */
    async init() {
        try {
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                console.error(`投票组件容器未找到: ${this.containerId}`);
                return;
            }
            
            this.render();
            await this.loadData();
            this.bindEvents();
        } catch (error) {
            console.error('投票组件初始化失败:', error);
            this.showError('投票组件初始化失败');
        }
    }
    
    /**
     * 渲染投票组件UI
     */
    render() {
        this.container.innerHTML = `
            <div class="vote-component">
                <h3 class="vote-title">你认为这是假新闻吗？</h3>
                
                <div class="vote-buttons">
                    <button id="vote-fake-${this.newsId}" class="vote-btn vote-fake">
                        <span class="vote-icon">❌</span>
                        <span class="vote-text">假新闻</span>
                    </button>
                    <button id="vote-not-fake-${this.newsId}" class="vote-btn vote-not-fake">
                        <span class="vote-icon">✅</span>
                        <span class="vote-text">非假新闻</span>
                    </button>
                </div>
                
                <div id="vote-stats-${this.newsId}" class="vote-stats">
                    <div class="loading-stats">加载投票统计中...</div>
                </div>
                
                <div id="vote-message-${this.newsId}" class="vote-message"></div>
            </div>
        `;
        
        // 保存DOM引用
        this.fakeVoteButton = document.getElementById(`vote-fake-${this.newsId}`);
        this.notFakeVoteButton = document.getElementById(`vote-not-fake-${this.newsId}`);
        this.voteStatsElement = document.getElementById(`vote-stats-${this.newsId}`);
        this.messageElement = document.getElementById(`vote-message-${this.newsId}`);
        
        // 添加基本样式
        this.addStyles();
    }
    
    /**
     * 添加组件样式
     */
    addStyles() {
        const styleId = 'vote-component-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .vote-component {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .vote-title {
                margin-top: 0;
                margin-bottom: 15px;
                font-size: 18px;
                color: #343a40;
            }
            
            .vote-buttons {
                display: flex;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .vote-btn {
                flex: 1;
                padding: 12px 20px;
                border: 2px solid #6c757d;
                border-radius: 6px;
                background-color: #ffffff;
                color: #495057;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .vote-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            
            .vote-btn:disabled {
                cursor: not-allowed;
                opacity: 0.6;
                transform: none;
                box-shadow: none;
            }
            
            .vote-fake:hover:not(:disabled) {
                border-color: #dc3545;
                color: #dc3545;
            }
            
            .vote-not-fake:hover:not(:disabled) {
                border-color: #28a745;
                color: #28a745;
            }
            
            .vote-btn.voted {
                font-weight: 600;
            }
            
            .vote-fake.voted {
                background-color: #dc3545;
                color: white;
                border-color: #dc3545;
            }
            
            .vote-not-fake.voted {
                background-color: #28a745;
                color: white;
                border-color: #28a745;
            }
            
            .vote-icon {
                font-size: 20px;
            }
            
            .vote-stats {
                background-color: #ffffff;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 15px;
            }
            
            .vote-stats-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #f1f3f5;
            }
            
            .vote-stats-item:last-child {
                border-bottom: none;
            }
            
            .vote-stats-label {
                font-weight: 500;
                color: #495057;
            }
            
            .vote-stats-value {
                font-weight: 600;
                color: #212529;
            }
            
            .vote-stats-progress {
                width: 100%;
                height: 8px;
                background-color: #e9ecef;
                border-radius: 4px;
                overflow: hidden;
                margin-top: 8px;
            }
            
            .vote-stats-progress-bar {
                height: 100%;
                border-radius: 4px;
                transition: width 0.5s ease;
            }
            
            .vote-stats-progress-fake {
                background-color: #dc3545;
            }
            
            .vote-stats-progress-not-fake {
                background-color: #28a745;
                margin-left: auto;
            }
            
            .vote-message {
                padding: 10px;
                border-radius: 4px;
                text-align: center;
                font-size: 14px;
                margin-top: 10px;
            }
            
            .vote-message.success {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .vote-message.error {
                background-color: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            
            .vote-message.info {
                background-color: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }
            
            .loading-stats {
                text-align: center;
                color: #6c757d;
                font-style: italic;
            }
            
            .vote-status {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 16px;
                font-size: 14px;
                font-weight: 500;
                margin-top: 10px;
            }
            
            .vote-status.fake {
                background-color: #fee;
                color: #dc3545;
            }
            
            .vote-status.not-fake {
                background-color: #e8f5e9;
                color: #28a745;
            }
            
            .vote-status.pending {
                background-color: #fff3cd;
                color: #856404;
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .vote-buttons {
                    flex-direction: column;
                }
                
                .vote-btn {
                    padding: 10px 15px;
                    font-size: 14px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        if (this.fakeVoteButton) {
            this.fakeVoteButton.addEventListener('click', () => this.handleVote('Fake'));
        }
        
        if (this.notFakeVoteButton) {
            this.notFakeVoteButton.addEventListener('click', () => this.handleVote('Not Fake'));
        }
    }
    
    /**
     * 加载投票数据
     */
    async loadData() {
        try {
            // 并行加载用户投票和投票统计
            const [userVoteData, statsData] = await Promise.all([
                this.loadUserVote(),
                this.loadVoteStats()
            ]);
            
            this.userVote = userVoteData;
            this.voteStats = statsData;
            
            this.updateUI();
        } catch (error) {
            console.error('加载投票数据失败:', error);
            this.showError('加载投票数据失败，请刷新页面重试');
        }
    }
    
    /**
     * 加载用户对当前新闻的投票
     */
    async loadUserVote() {
        try {
            // 检查用户是否登录
            if (!getToken()) {
                return null;
            }
            
            const vote = await getUserVoteForNews(this.newsId);
            return vote;
        } catch (error) {
            console.error('加载用户投票失败:', error);
            return null; // 用户未投票时返回null
        }
    }
    
    /**
     * 加载新闻投票统计
     */
    async loadVoteStats() {
        try {
            const stats = await getNewsVoteStats(this.newsId);
            return stats;
        } catch (error) {
            console.error('加载投票统计失败:', error);
            // 返回默认统计数据
            return {
                fakeVotes: 0,
                notFakeVotes: 0,
                totalVotes: 0,
                fakePercentage: 0,
                notFakePercentage: 0
            };
        }
    }
    
    /**
     * 处理投票事件
     * @param {string} voteResult - 投票结果 ('Fake' 或 'Not Fake')
     */
    async handleVote(voteResult) {
        // 检查用户是否已登录
        if (!auth.isLoggedIn()) {
            this.showInfo('请先登录后再投票');
            return;
        }
        
        // 防止重复提交
        if (this.isVoting) return;
        
        // 检查用户是否已经投过票
        if (this.userVote && this.userVote.voteResult === voteResult) {
            this.showInfo('您已经投过这个选项了');
            return;
        }
        
        try {
            this.isVoting = true;
            this.showInfo('提交投票中...');
            
            // 提交投票
            const result = await submitVote({
                newsId: this.newsId,
                voteResult: voteResult
            });
            
            this.userVote = result;
            await this.loadVoteStats(); // 重新加载投票统计
            this.updateUI();
            this.showSuccess('投票成功！');
            
            // 调用成功回调
            this.onVoteSuccess(result);
        } catch (error) {
            console.error('投票失败:', error);
            this.showError(error.message || '投票失败，请稍后重试');
            
            // 调用错误回调
            this.onVoteError(error);
        } finally {
            this.isVoting = false;
        }
    }
    
    /**
     * 更新UI显示
     */
    updateUI() {
        // 更新投票按钮状态
        this.updateVoteButtons();
        
        // 更新投票统计
        this.updateVoteStats();
    }
    
    /**
     * 更新投票按钮状态
     */
    updateVoteButtons() {
        // 如果用户已登录
        if (auth.isLoggedIn()) {
            // 如果用户已投票
            if (this.userVote) {
                this.fakeVoteButton.disabled = true;
                this.notFakeVoteButton.disabled = true;
                
                if (this.userVote.voteResult === 'Fake') {
                    this.fakeVoteButton.classList.add('voted');
                } else if (this.userVote.voteResult === 'Not Fake') {
                    this.notFakeVoteButton.classList.add('voted');
                }
                
                this.showInfo('您已经投过票了');
            } else {
                // 用户未投票，启用按钮
                this.fakeVoteButton.disabled = false;
                this.notFakeVoteButton.disabled = false;
            }
        } else {
            // 用户未登录，禁用按钮
            this.fakeVoteButton.disabled = true;
            this.notFakeVoteButton.disabled = true;
        }
    }
    
    /**
     * 更新投票统计显示
     */
    updateVoteStats() {
        if (!this.voteStatsElement || !this.voteStats) return;
        
        const { fakeVotes, notFakeVotes, totalVotes, fakePercentage, notFakePercentage } = this.voteStats;
        
        this.voteStatsElement.innerHTML = `
            <div class="vote-stats-item">
                <span class="vote-stats-label">假新闻投票</span>
                <span class="vote-stats-value">${fakeVotes}票 (${fakePercentage.toFixed(1)}%)</span>
            </div>
            <div class="vote-stats-progress">
                <div 
                    class="vote-stats-progress-bar vote-stats-progress-fake" 
                    style="width: ${fakePercentage}%"
                ></div>
            </div>
            
            <div class="vote-stats-item">
                <span class="vote-stats-label">非假新闻投票</span>
                <span class="vote-stats-value">${notFakeVotes}票 (${notFakePercentage.toFixed(1)}%)</span>
            </div>
            <div class="vote-stats-progress">
                <div 
                    class="vote-stats-progress-bar vote-stats-progress-not-fake" 
                    style="width: ${notFakePercentage}%"
                ></div>
            </div>
            
            <div class="vote-stats-item">
                <span class="vote-stats-label">总投票数</span>
                <span class="vote-stats-value">${totalVotes}票</span>
            </div>
        `;
        
        // 添加新闻状态标签
        if (totalVotes > 0) {
            let statusClass = 'pending';
            let statusText = '待确认';
            
            if (fakePercentage > 70) {
                statusClass = 'fake';
                statusText = '假新闻';
            } else if (notFakePercentage > 70) {
                statusClass = 'not-fake';
                statusText = '非假新闻';
            }
            
            const statusElement = document.createElement('div');
            statusElement.className = `vote-status ${statusClass}`;
            statusElement.textContent = `当前判定: ${statusText}`;
            this.voteStatsElement.appendChild(statusElement);
        }
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
        this.messageElement.className = `vote-message ${type}`;
        
        // 自动隐藏非错误消息
        if (type !== 'error') {
            setTimeout(() => {
                if (this.messageElement) {
                    this.messageElement.textContent = '';
                    this.messageElement.className = 'vote-message';
                }
            }, 3000);
        }
    }
    
    /**
     * 刷新数据
     */
    async refresh() {
        await this.loadData();
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        // 移除事件监听器
        if (this.fakeVoteButton) {
            this.fakeVoteButton.removeEventListener('click', () => this.handleVote('Fake'));
        }
        
        if (this.notFakeVoteButton) {
            this.notFakeVoteButton.removeEventListener('click', () => this.handleVote('Not Fake'));
        }
        
        // 清空容器
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // 重置状态
        this.container = null;
        this.fakeVoteButton = null;
        this.notFakeVoteButton = null;
        this.voteStatsElement = null;
        this.messageElement = null;
        this.userVote = null;
        this.voteStats = null;
    }
}

// 导出组件
export default VoteComponent;