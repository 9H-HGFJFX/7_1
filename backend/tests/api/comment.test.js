const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { User } = require('../../models/User');
const { News } = require('../../models/News');
const { Comment } = require('../../models/Comment');
const dbService = require('../../services/dbService');

describe('评论API测试', () => {
    // 测试数据
    let authToken = '';
    let testUserId = null;
    let testNewsId = null;
    let testCommentId = null;

    const testUser = {
        firstName: '评论',
        lastName: '测试用户',
        email: 'comment_test@example.com',
        password: 'password123'
    };

    const testNews = {
        title: '评论测试新闻标题',
        content: '这是一条用于测试评论功能的新闻内容，包含足够的文字来满足最小长度要求。',
        images: []
    };

    const testComment = {
        content: '这是一条测试评论，用于验证评论API的功能。'
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
            
            // 清理测试评论
            await Comment.deleteOne({ content: testComment.content });
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
            if (testCommentId) {
                await Comment.deleteOne({ _id: testCommentId });
            }
            
            // 断开数据库连接
            await dbService.disconnect();
        } catch (error) {
            console.error('测试后清理失败:', error);
        }
    });

    // 测试添加评论功能
    describe('添加评论', () => {
        it('应该成功添加评论并返回201状态码', async () => {
            const response = await request(app)
                .post(`/api/news/${testNewsId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(testComment)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('comment');
            expect(response.body.comment.content).toBe(testComment.content);
            expect(response.body.comment.userId.toString()).toBe(testUserId);
            expect(response.body.comment.newsId.toString()).toBe(testNewsId);
            
            // 保存评论ID供后续测试使用
            testCommentId = response.body.comment._id;
        });

        it('应该拒绝缺少内容的评论请求并返回400状态码', async () => {
            const invalidComment = { ...testComment };
            delete invalidComment.content;

            const response = await request(app)
                .post(`/api/news/${testNewsId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidComment)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝未认证的评论请求并返回401状态码', async () => {
            const response = await request(app)
                .post(`/api/news/${testNewsId}/comments`)
                .send(testComment)
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝向不存在的新闻添加评论并返回404状态码', async () => {
            const invalidNewsId = mongoose.Types.ObjectId();
            const response = await request(app)
                .post(`/api/news/${invalidNewsId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(testComment)
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // 测试获取评论列表功能
    describe('获取评论列表', () => {
        it('应该成功获取新闻的评论列表并返回200状态码', async () => {
            const response = await request(app)
                .get(`/api/news/${testNewsId}/comments`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('comments');
            expect(Array.isArray(response.body.comments)).toBe(true);
            expect(response.body.comments.length).toBeGreaterThan(0);
            
            // 验证评论属于正确的新闻
            const allForCorrectNews = response.body.comments.every(
                comment => comment.newsId.toString() === testNewsId
            );
            expect(allForCorrectNews).toBe(true);
        });

        it('应该为不存在的新闻返回空评论列表', async () => {
            const invalidNewsId = mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/news/${invalidNewsId}/comments`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('comments');
            expect(Array.isArray(response.body.comments)).toBe(true);
            expect(response.body.comments.length).toBe(0);
        });
    });

    // 测试删除评论功能
    describe('删除评论', () => {
        it('应该成功删除自己的评论并返回200状态码', async () => {
            const response = await request(app)
                .delete(`/api/comments/${testCommentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '评论删除成功');
            
            // 验证评论确实已被删除
            const getCommentResponse = await request(app)
                .get(`/api/news/${testNewsId}/comments`)
                .expect(200);
            
            const commentExists = getCommentResponse.body.comments.some(
                comment => comment._id === testCommentId
            );
            expect(commentExists).toBe(false);
        });

        it('应该拒绝未认证的删除请求并返回401状态码', async () => {
            const response = await request(app)
                .delete(`/api/comments/${testCommentId}`) // 即使评论已删除，也应验证未认证状态
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });

        it('应该拒绝删除不存在的评论并返回404状态码', async () => {
            const invalidCommentId = mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/api/comments/${invalidCommentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // 测试获取用户评论历史
    describe('获取用户评论历史', () => {
        it('应该成功获取用户的评论历史并返回200状态码', async () => {
            // 先创建一个新评论供测试
            const newComment = {
                content: '这是用于用户评论历史测试的评论。'
            };
            
            const createResponse = await request(app)
                .post(`/api/news/${testNewsId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(newComment);
            
            const commentId = createResponse.body.comment._id;
            
            // 获取用户评论历史
            const response = await request(app)
                .get(`/api/users/${testUserId}/comments`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('comments');
            expect(Array.isArray(response.body.comments)).toBe(true);
            
            // 验证评论属于正确的用户
            const allByCorrectUser = response.body.comments.every(
                comment => comment.userId.toString() === testUserId
            );
            expect(allByCorrectUser).toBe(true);
            
            // 清理创建的评论
            await Comment.deleteOne({ _id: commentId });
        });
    });
});