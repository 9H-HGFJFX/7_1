const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { User, ROLES } = require('../../models/User');
const config = require('../../config/config');
const dbService = require('../../services/dbService');

describe('认证API测试', () => {
    // 测试数据
    const testUser = {
        firstName: '测试',
        lastName: '用户',
        email: 'test@example.com',
        password: 'password123'
    };

    let authToken = '';

    // 在所有测试前运行
    beforeAll(async () => {
        try {
            // 确保数据库连接
            await dbService.connect();
            
            // 清理测试数据
            await User.deleteOne({ email: testUser.email });
        } catch (error) {
            console.error('测试前准备失败:', error);
        }
    });

    // 在所有测试后运行
    afterAll(async () => {
        try {
            // 清理测试数据
            await User.deleteOne({ email: testUser.email });
            
            // 断开数据库连接
            await dbService.disconnect();
        } catch (error) {
            console.error('测试后清理失败:', error);
        }
    });

    // 测试注册功能
    describe('用户注册', () => {
        it('应该成功注册新用户并返回201状态码', async () => {
            const response = await request(app)
                .post('/api/users/register')
                .send(testUser)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '用户注册成功');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(testUser.email);
            expect(response.body.user).not.toHaveProperty('password');
        });

        it('应该拒绝重复注册同一邮箱并返回400状态码', async () => {
            const response = await request(app)
                .post('/api/users/register')
                .send(testUser)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
        });

        it('应该拒绝缺少必填字段的注册请求并返回400状态码', async () => {
            const invalidUser = { ...testUser };
            delete invalidUser.email;

            const response = await request(app)
                .post('/api/users/register')
                .send(invalidUser)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // 测试登录功能
    describe('用户登录', () => {
        it('应该成功登录并返回JWT令牌', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            
            // 保存令牌供后续测试使用
            authToken = response.body.token;
        });

        it('应该拒绝使用错误密码的登录请求并返回401状态码', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword'
                })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '邮箱或密码错误');
        });

        it('应该拒绝使用不存在邮箱的登录请求并返回401状态码', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // 测试认证功能
    describe('用户认证', () => {
        it('应该使用有效令牌获取当前用户信息', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(testUser.email);
        });

        it('应该拒绝使用无效令牌的请求并返回401状态码', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', 'Bearer invalidtoken123')
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
        });

        it('应该拒绝缺少认证令牌的请求并返回401状态码', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .expect('Content-Type', /json/)
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // 测试密码重置功能
    describe('密码重置', () => {
        it('应该请求密码重置邮件并返回200状态码', async () => {
            const response = await request(app)
                .post('/api/users/forgot-password')
                .send({ email: testUser.email })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
        });

        // 注意：完整的密码重置流程需要邮件服务，这里只测试API端点
    });
});