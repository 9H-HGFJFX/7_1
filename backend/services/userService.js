const { User, ROLES } = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * 用户服务类
 */
class UserService {
    /**
     * 创建新用户
     * @param {Object} userData - 用户数据
     * @returns {Promise<Object>} 创建的用户对象
     */
    static async createUser(userData) {
        try {
            // 检查邮箱是否已存在
            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                throw new Error('邮箱已被注册');
            }
            
            // 创建用户实例
            const user = new User({
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                password: userData.password, // 会在保存时自动加密
                role: ROLES.READER, // 默认角色为读者
                avatar: userData.avatar || null
            });
            
            // 保存用户
            await user.save();
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`创建用户失败: ${error.message}`);
        }
    }
    
    /**
     * 用户登录
     * @param {string} email - 用户邮箱
     * @param {string} password - 用户密码
     * @returns {Promise<Object>} 包含token和用户信息的对象
     */
    static async login(email, password) {
        try {
            // 查找用户
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('邮箱或密码错误');
            }
            
            // 验证密码
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                throw new Error('邮箱或密码错误');
            }
            
            // 生成JWT令牌
            const token = jwt.sign(
                {
                    id: user._id,
                    email: user.email,
                    role: user.role
                },
                config.jwtSecret,
                {
                    expiresIn: config.jwtExpireTime
                }
            );
            
            // 返回用户信息（不含密码）和token
            const userObj = user.toObject();
            delete userObj.password;
            
            return {
                token,
                user: userObj
            };
        } catch (error) {
            throw new Error(`登录失败: ${error.message}`);
        }
    }
    
    /**
     * 获取用户信息
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 用户信息
     */
    static async getUserById(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`获取用户信息失败: ${error.message}`);
        }
    }
    
    /**
     * 更新用户信息
     * @param {string} userId - 用户ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<Object>} 更新后的用户信息
     */
    static async updateUser(userId, updateData) {
        try {
            // 移除密码字段（密码更新需单独处理）
            const { password, ...safeUpdateData } = updateData;
            
            // 更新用户
            const user = await User.findByIdAndUpdate(
                userId,
                safeUpdateData,
                { new: true, runValidators: true }
            );
            
            if (!user) {
                throw new Error('用户不存在');
            }
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`更新用户信息失败: ${error.message}`);
        }
    }
    
    /**
     * 更新用户密码
     * @param {string} userId - 用户ID
     * @param {string} oldPassword - 旧密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<Object>} 更新结果
     */
    static async updatePassword(userId, oldPassword, newPassword) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }
            
            // 验证旧密码
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                throw new Error('旧密码错误');
            }
            
            // 更新密码
            user.password = newPassword; // 会在保存时自动加密
            await user.save();
            
            return { success: true, message: '密码更新成功' };
        } catch (error) {
            throw new Error(`更新密码失败: ${error.message}`);
        }
    }
    
    /**
     * 更新用户角色（管理员权限）
     * @param {string} userId - 用户ID
     * @param {string} newRole - 新角色
     * @returns {Promise<Object>} 更新后的用户信息
     */
    static async updateUserRole(userId, newRole) {
        try {
            // 验证角色是否有效
            const validRoles = Object.values(ROLES);
            if (!validRoles.includes(newRole)) {
                throw new Error('无效的角色');
            }
            
            // 更新用户角色
            const user = await User.findByIdAndUpdate(
                userId,
                { role: newRole },
                { new: true, runValidators: true }
            );
            
            if (!user) {
                throw new Error('用户不存在');
            }
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`更新用户角色失败: ${error.message}`);
        }
    }
    
    /**
     * 获取用户列表（管理员权限）
     * @param {Object} query - 查询参数
     * @returns {Promise<Array>} 用户列表
     */
    static async getUsers(query = {}) {
        try {
            const { page = 1, limit = 10, role, search } = query;
            
            // 构建查询条件
            const searchQuery = {};
            
            if (role) {
                searchQuery.role = role;
            }
            
            if (search) {
                searchQuery.$or = [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }
            
            // 计算总数
            const total = await User.countDocuments(searchQuery);
            
            // 分页查询
            const users = await User.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 });
            
            // 移除密码字段
            const userList = users.map(user => {
                const userObj = user.toObject();
                delete userObj.password;
                return userObj;
            });
            
            return {
                users: userList,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`获取用户列表失败: ${error.message}`);
        }
    }
    
    /**
     * 删除用户（管理员权限）
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 删除结果
     */
    static async deleteUser(userId) {
        try {
            // 不允许删除管理员用户
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }
            
            if (user.role === ROLES.ADMINISTRATOR) {
                throw new Error('不能删除管理员用户');
            }
            
            await User.findByIdAndDelete(userId);
            
            return { success: true, message: '用户删除成功' };
        } catch (error) {
            throw new Error(`删除用户失败: ${error.message}`);
        }
    }
    
    /**
     * 验证用户权限
     * @param {string} userId - 用户ID
     * @param {string} requiredRole - 所需角色
     * @returns {Promise<boolean>} 权限验证结果
     */
    static async checkUserPermission(userId, requiredRole) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return false;
            }
            
            // 角色权限层级：ADMINISTRATOR > MEMBER > READER
            const roleHierarchy = {
                [ROLES.READER]: 1,
                [ROLES.MEMBER]: 2,
                [ROLES.ADMINISTRATOR]: 3
            };
            
            return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
        } catch (error) {
            console.error('权限验证失败:', error);
            return false;
        }
    }
}

module.exports = UserService;