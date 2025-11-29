const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { User, ROLES } = require('../../models/User');
const { News, NEWS_STATUS } = require('../../models/News');
const dbService = require('../../services/dbService');

describe('新闻API测试', () => {
    // 测试数据
    let authToken = '';
    let testUserId = null;
    let testNewsId = null;

    const testUser = {
        firstName: '新闻',
        lastName: '测试用户',
        email: 'news_test@example.com',
        password: 'password123'
    };

    const testNews = {
        title: '测试新闻标题',
        content: '这是一条用于测试的新闻内容，包含足够的文字来满足最小长度要求。',
        images: []
    };

    // 在所有测试前运行
    beforeAll(async () => {
        try {
            // 确保数据库连接
            await dbService.connect();
            
            // 清理测试数据
            await User.deleteOne({ email: testUser.email });
            await News.deleteOne({ title: testNews.title });
            
            // 创建测试用户并登录
            await request(app).post('/api/users/register').send(testUser);
            const loginResponse = await request(app)
                .post('/api/users/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
            
            authToken = loginResponse.body.token;
            testUserId = loginResponse.body.user._id;
        } catch (error) {
            console.error('测试前准备失败:', error);
        }
    });

    // 在所有测试后运行
    afterAll(async () => {
        try {
            // 清理测试数据
            await User.deleteOne({ email: testUser.email });
            if (testNewsId) {
                await News.deleteOne({ _id: testNewsId });
            }
            
            // 断开数据库连接
            await dbService.disconnect();
        } catch (error) {
            console.error('测试后清理失败:', error);
        }
    });

    // 测试创建新闻功能
    describe('创建新闻', () => {
        it('应该成功创建新闻并返回201状态码', async () => {
            const response = await request(app)
                .post('/api/news')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testNews)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('news');
            expect(response.body.news.title).toBe(testNews.title);
            expect(response.body.news.content).toBe(testNews.content);
            expect(response.body.news.authorId.toString()).toBe(testUserId);
            
            // 保存新闻ID供后续测试使用
            testNewsId = response.body.news._id;
        });

        it('应该拒绝缺少标题的新闻创建请求并返回400状态码', async () => {
            const invalidNews = { ...testNews };
            delete invalidNews.title;

            const response = await request(app)
                .post('/api/news')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidNews)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝未认证的新闻创建请求并返回401状态码', async () => {
            const response = await request(app)
                .post('/api/news')
                .send(testNews)
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // 测试获取新闻列表功能
    describe('获取新闻列表', () => {
        it('应该成功获取新闻列表并返回200状态码', async () => {
            const response = await request(app)
                .get('/api/news')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('news');
            expect(Array.isArray(response.body.news)).toBe(true);
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('page');
            expect(response.body).toHaveProperty('pageSize');
        });

        it('应该支持分页参数', async () => {
            const response = await request(app)
                .get('/api/news?page=1&pageSize=5')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.pageSize).toBe(5);
            expect(response.body.news.length).toBeLessThanOrEqual(5);
        });

        it('应该支持状态筛选', async () => {
            const response = await request(app)
                .get(`/api/news?status=${NEWS_STATUS.PENDING}`)
                .expect('Content-Type', /json/)
                .expect(200);

            // 验证返回的新闻状态是否都为PENDING
            const allPending = response.body.news.every(news => news.status === NEWS_STATUS.PENDING);
            expect(allPending).toBe(true);
        });
    });

    // 测试获取新闻详情功能
    describe('获取新闻详情', () => {
        it('应该成功获取新闻详情并返回200状态码', async () => {
            const response = await request(app)
                .get(`/api/news/${testNewsId}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('news');
            expect(response.body.news._id).toBe(testNewsId);
        });

        it('应该拒绝获取不存在的新闻并返回404状态码', async () => {
            const invalidId = mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/news/${invalidId}`)
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '新闻不存在');
        });
    });

    // 测试更新新闻功能
    describe('更新新闻', () => {
        it('应该成功更新自己的新闻并返回200状态码', async () => {
            const updatedNews = {
                title: '更新后的测试新闻标题',
                content: '这是更新后的测试内容。'
            };

            const response = await request(app)
                .put(`/api/news/${testNewsId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedNews)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.news.title).toBe(updatedNews.title);
            expect(response.body.news.content).toBe(updatedNews.content);
        });

        it('应该拒绝未认证的新闻更新请求并返回401状态码', async () => {
            const response = await request(app)
                .put(`/api/news/${testNewsId}`)
                .send({ title: '尝试未授权更新' })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });

        // 注意：需要创建另一个用户来测试权限控制
    });

    // 测试删除新闻功能
    describe('删除新闻', () => {
        it('应该拒绝普通用户删除新闻的请求（如果API不允许）', async () => {
            // 假设API不允许普通用户删除新闻
            const response = await request(app)
                .delete(`/api/news/${testNewsId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/);

            // 可能返回403（无权限）或501（未实现）或其他状态码
            expect(response.body).toHaveProperty('success', false);
        });
    });
});