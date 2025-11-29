const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../server');
const { User } = require('../../models/User');
const { News } = require('../../models/News');
const { Comment } = require('../../models/Comment');
const { Vote } = require('../../models/Vote');
const dbService = require('../../services/dbService');

/**
 * 测试工具类，提供测试中常用的辅助方法
 */
class TestUtils {
    /**
     * 初始化测试环境
     */
    static async initializeTestEnvironment() {
        try {
            // 确保数据库连接
            await dbService.connect();
            
            // 开始事务或保存点（如果需要）
            // MongoDB不原生支持事务回滚，所以我们使用清理方法
        } catch (error) {
            console.error('测试环境初始化失败:', error);
            throw error;
        }
    }

    /**
     * 清理测试环境
     * @param {Array} collections - 需要清理的集合列表
     */
    static async cleanTestEnvironment(collections = []) {
        try {
            // 清理指定的集合
            const collectionMap = {
                users: User,
                news: News,
                comments: Comment,
                votes: Vote
            };

            for (const collection of collections) {
                const model = collectionMap[collection];
                if (model) {
                    await model.deleteMany({});
                }
            }
        } catch (error) {
            console.error('测试环境清理失败:', error);
        }
    }

    /**
     * 创建测试用户并登录
     * @param {Object} userData - 用户数据
     * @returns {Object} 包含用户信息和token的对象
     */
    static async createAndLoginTestUser(userData = null) {
        const defaultUserData = {
            firstName: '测试',
            lastName: '用户',
            email: `test_${Date.now()}@example.com`,
            password: 'password123'
        };

        const user = userData || defaultUserData;
        
        // 清理可能存在的用户
        await User.deleteOne({ email: user.email });
        
        // 注册用户
        await request(app).post('/api/users/register').send(user);
        
        // 登录用户
        const loginResponse = await request(app)
            .post('/api/users/login')
            .send({
                email: user.email,
                password: user.password
            });
        
        return {
            user: loginResponse.body.user,
            token: loginResponse.body.token,
            email: user.email,
            password: user.password
        };
    }

    /**
     * 创建测试新闻
     * @param {String} token - 认证token
     * @param {Object} newsData - 新闻数据
     * @returns {Object} 新闻对象
     */
    static async createTestNews(token, newsData = null) {
        const defaultNewsData = {
            title: `测试新闻 ${Date.now()}`,
            content: '这是一条用于测试的新闻内容，包含足够的文字来满足最小长度要求。这条新闻用于API测试，内容丰富且符合格式要求。',
            images: []
        };

        const news = newsData || defaultNewsData;
        
        const response = await request(app)
            .post('/api/news')
            .set('Authorization', `Bearer ${token}`)
            .send(news);
        
        return response.body.news;
    }

    /**
     * 创建测试评论
     * @param {String} token - 认证token
     * @param {String} newsId - 新闻ID
     * @param {Object} commentData - 评论数据
     * @returns {Object} 评论对象
     */
    static async createTestComment(token, newsId, commentData = null) {
        const defaultCommentData = {
            content: `测试评论 ${Date.now()}，这是一条用于验证API功能的评论。`
        };

        const comment = commentData || defaultCommentData;
        
        const response = await request(app)
            .post(`/api/news/${newsId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send(comment);
        
        return response.body.comment;
    }

    /**
     * 创建测试投票
     * @param {String} token - 认证token
     * @param {String} newsId - 新闻ID
     * @param {String} voteResult - 投票结果
     * @returns {Object} 投票对象
     */
    static async createTestVote(token, newsId, voteResult) {
        const voteData = {
            voteResult: voteResult
        };
        
        const response = await request(app)
            .post(`/api/news/${newsId}/votes`)
            .set('Authorization', `Bearer ${token}`)
            .send(voteData);
        
        return response.body.vote;
    }

    /**
     * 生成唯一的测试ID
     * @returns {String} 唯一ID
     */
    static generateUniqueId() {
        return mongoose.Types.ObjectId().toString();
    }

    /**
     * 验证API响应格式
     * @param {Object} response - API响应对象
     * @param {Boolean} success - 期望的成功状态
     * @param {Number} statusCode - 期望的状态码
     */
    static validateApiResponse(response, success = true, statusCode = 200) {
        expect(response.status).toBe(statusCode);
        expect(response.body).toHaveProperty('success', success);
    }

    /**
     * 测试未认证访问API
     * @param {String} method - HTTP方法
     * @param {String} endpoint - API端点
     * @param {Object} data - 请求数据
     */
    static async testUnauthorizedAccess(method, endpoint, data = {}) {
        let requestMethod;
        
        switch (method.toLowerCase()) {
            case 'get':
                requestMethod = request(app).get(endpoint);
                break;
            case 'post':
                requestMethod = request(app).post(endpoint).send(data);
                break;
            case 'put':
                requestMethod = request(app).put(endpoint).send(data);
                break;
            case 'delete':
                requestMethod = request(app).delete(endpoint);
                break;
            default:
                throw new Error(`不支持的HTTP方法: ${method}`);
        }
        
        const response = await requestMethod
            .expect('Content-Type', /json/)
            .expect(401);
        
        expect(response.body).toHaveProperty('success', false);
    }

    /**
     * 测试无效ID访问API
     * @param {String} token - 认证token
     * @param {String} method - HTTP方法
     * @param {String} endpointTemplate - 端点模板，使用{id}作为占位符
     * @param {Object} data - 请求数据
     * @param {Number} expectedStatusCode - 期望的状态码，默认404
     */
    static async testInvalidIdAccess(token, method, endpointTemplate, data = {}, expectedStatusCode = 404) {
        const invalidId = this.generateUniqueId();
        const endpoint = endpointTemplate.replace('{id}', invalidId);
        
        let requestMethod;
        
        switch (method.toLowerCase()) {
            case 'get':
                requestMethod = request(app).get(endpoint);
                break;
            case 'post':
                requestMethod = request(app).post(endpoint).send(data);
                break;
            case 'put':
                requestMethod = request(app).put(endpoint).send(data);
                break;
            case 'delete':
                requestMethod = request(app).delete(endpoint);
                break;
            default:
                throw new Error(`不支持的HTTP方法: ${method}`);
        }
        
        if (token) {
            requestMethod = requestMethod.set('Authorization', `Bearer ${token}`);
        }
        
        const response = await requestMethod
            .expect('Content-Type', /json/)
            .expect(expectedStatusCode);
        
        expect(response.body).toHaveProperty('success', false);
    }
}

module.exports = TestUtils;