const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { User } = require('../../models/User');
const { News } = require('../../models/News');
const { Vote, VOTE_RESULTS } = require('../../models/Vote');
const dbService = require('../../services/dbService');

describe('投票API测试', () => {
    // 测试数据
    let authToken = '';
    let testUserId = null;
    let testNewsId = null;
    let testVoteId = null;

    const testUser = {
        firstName: '投票',
        lastName: '测试用户',
        email: 'vote_test@example.com',
        password: 'password123'
    };

    const testNews = {
        title: '投票测试新闻标题',
        content: '这是一条用于测试投票功能的新闻内容，包含足够的文字来满足最小长度要求。',
        images: []
    };

    // 在所有测试前运行
    beforeAll(async () => {
        try {
            // 确保数据库连接
            await dbService.connect();
            
            // 清理测试数据
            await User.deleteOne({ email: testUser.email });
            
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
            
            // 创建测试新闻
            const newsResponse = await request(app)
                .post('/api/news')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testNews);
            
            testNewsId = newsResponse.body.news._id;
            
            // 清理测试投票
            await Vote.deleteOne({ userId: testUserId, newsId: testNewsId });
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
            if (testVoteId) {
                await Vote.deleteOne({ _id: testVoteId });
            }
            
            // 断开数据库连接
            await dbService.disconnect();
        } catch (error) {
            console.error('测试后清理失败:', error);
        }
    });

    // 测试添加投票功能
    describe('添加投票', () => {
        it('应该成功添加投票并返回201状态码', async () => {
            const voteData = {
                voteResult: VOTE_RESULTS.FAKE
            };

            const response = await request(app)
                .post(`/api/news/${testNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(voteData)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('vote');
            expect(response.body.vote.voteResult).toBe(voteData.voteResult);
            expect(response.body.vote.userId.toString()).toBe(testUserId);
            expect(response.body.vote.newsId.toString()).toBe(testNewsId);
            
            // 保存投票ID供后续测试使用
            testVoteId = response.body.vote._id;
        });

        it('应该拒绝缺少投票结果的请求并返回400状态码', async () => {
            const invalidVote = {}; // 空对象，没有voteResult

            const response = await request(app)
                .post(`/api/news/${testNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidVote)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝未认证的投票请求并返回401状态码', async () => {
            const voteData = {
                voteResult: VOTE_RESULTS.TRUE
            };

            const response = await request(app)
                .post(`/api/news/${testNewsId}/votes`)
                .send(voteData)
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝向不存在的新闻投票并返回404状态码', async () => {
            const invalidNewsId = mongoose.Types.ObjectId();
            const voteData = {
                voteResult: VOTE_RESULTS.FAKE
            };

            const response = await request(app)
                .post(`/api/news/${invalidNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(voteData)
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝重复投票并返回400状态码', async () => {
            const voteData = {
                voteResult: VOTE_RESULTS.FAKE
            };

            const response = await request(app)
                .post(`/api/news/${testNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(voteData)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
        });

        it('应该允许用户修改自己的投票并返回200状态码', async () => {
            const updatedVote = {
                voteResult: VOTE_RESULTS.TRUE
            };

            const response = await request(app)
                .put(`/api/news/${testNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedVote)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('vote');
            expect(response.body.vote.voteResult).toBe(updatedVote.voteResult);
        });
    });

    // 测试获取投票统计功能
    describe('获取投票统计', () => {
        it('应该成功获取新闻的投票统计并返回200状态码', async () => {
            const response = await request(app)
                .get(`/api/news/${testNewsId}/vote-stats`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats).toHaveProperty('totalVotes');
            expect(response.body.stats).toHaveProperty('fakeVotes');
            expect(response.body.stats).toHaveProperty('trueVotes');
            expect(response.body.stats).toHaveProperty('fakePercentage');
            expect(response.body.stats).toHaveProperty('truePercentage');
            
            // 验证至少有一个投票
            expect(response.body.stats.totalVotes).toBeGreaterThan(0);
        });

        it('应该为不存在的新闻返回空统计结果', async () => {
            const invalidNewsId = mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/news/${invalidNewsId}/vote-stats`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats.totalVotes).toBe(0);
            expect(response.body.stats.fakePercentage).toBe(0);
            expect(response.body.stats.truePercentage).toBe(0);
        });
    });

    // 测试获取用户对特定新闻的投票
    describe('获取用户投票', () => {
        it('应该成功获取用户对特定新闻的投票并返回200状态码', async () => {
            const response = await request(app)
                .get(`/api/news/${testNewsId}/my-vote`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('vote');
            expect(response.body.vote.userId.toString()).toBe(testUserId);
            expect(response.body.vote.newsId.toString()).toBe(testNewsId);
            expect([VOTE_RESULTS.FAKE, VOTE_RESULTS.TRUE]).toContain(response.body.vote.voteResult);
        });

        it('应该在用户未投票时返回null并返回200状态码', async () => {
            // 创建一个新的测试新闻
            const newNewsResponse = await request(app)
                .post('/api/news')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: '未投票测试新闻',
                    content: '这是一条用户未投票的测试新闻。'
                });
            
            const newNewsId = newNewsResponse.body.news._id;
            
            const response = await request(app)
                .get(`/api/news/${newNewsId}/my-vote`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.vote).toBeNull();
            
            // 清理创建的新闻
            await News.deleteOne({ _id: newNewsId });
        });
    });

    // 测试删除投票功能
    describe('删除投票', () => {
        it('应该成功删除自己的投票并返回200状态码', async () => {
            const response = await request(app)
                .delete(`/api/news/${testNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '投票已删除');
            
            // 验证投票确实已被删除
            const checkResponse = await request(app)
                .get(`/api/news/${testNewsId}/my-vote`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(checkResponse.body.vote).toBeNull();
        });

        it('应该拒绝未认证的删除请求并返回401状态码', async () => {
            const response = await request(app)
                .delete(`/api/news/${testNewsId}/votes`)
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该允许在投票不存在时返回成功消息', async () => {
            // 测试删除一个已经不存在的投票（我们刚刚删除了它）
            const response = await request(app)
                .delete(`/api/news/${testNewsId}/votes`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200); // 或者可能是404，取决于API的具体实现

            expect(response.body).toHaveProperty('success', true);
        });
    });
});