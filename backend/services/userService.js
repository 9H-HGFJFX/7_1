const { User, ROLES } = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * User Service Class
 */
class UserService {
    /**
     * Create new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user object
     */
    static async createUser(userData) {
        try {
            // 检查邮箱是否已存在
            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                throw new Error('Email already registered');
            }
            
            // 创建用户实例
            const user = new User({
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                password: userData.password, // 会在保存时自动加密
                role: ROLES.READER, // Default role is reader
                avatar: userData.avatar || null
            });
            
            // 保存用户
            await user.save();
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }
    
    /**
     * User login
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Object containing token and user info
     */
    static async login(email, password) {
        try {
            // 查找用户
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('Invalid email or password');
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
            throw new Error(`Login failed: ${error.message}`);
        }
    }
    
    /**
     * Get user info
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User information
     */
    static async getUserById(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`Failed to get user info: ${error.message}`);
        }
    }
    
    /**
     * Update user info
     * @param {string} userId - User ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated user info
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
                throw new Error('User not found');
            }
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`Failed to update user info: ${error.message}`);
        }
    }
    
    /**
     * Update user password
     * @param {string} userId - User ID
     * @param {string} oldPassword - Old password
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} Update result
     */
    static async updatePassword(userId, oldPassword, newPassword) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // 验证旧密码
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                throw new Error('Incorrect old password');
            }
            
            // 更新密码
            user.password = newPassword; // 会在保存时自动加密
            await user.save();
            
            return { success: true, message: 'Password updated successfully' };
        } catch (error) {
            throw new Error(`Failed to update password: ${error.message}`);
        }
    }
    
    /**
     * Update user role (admin permission)
     * @param {string} userId - User ID
     * @param {string} newRole - New role
     * @returns {Promise<Object>} Updated user info
     */
    static async updateUserRole(userId, newRole) {
        try {
            // 验证角色是否有效
            const validRoles = Object.values(ROLES);
            if (!validRoles.includes(newRole)) {
                throw new Error('Invalid role');
            }
            
            // 更新用户角色
            const user = await User.findByIdAndUpdate(
                userId,
                { role: newRole },
                { new: true, runValidators: true }
            );
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // 不返回密码
            const userObj = user.toObject();
            delete userObj.password;
            
            return userObj;
        } catch (error) {
            throw new Error(`Failed to update user role: ${error.message}`);
        }
    }
    
    /**
     * Get users list (admin permission)
     * @param {Object} query - Query parameters
     * @returns {Promise<Array>} Users list
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
            throw new Error(`Failed to get users list: ${error.message}`);
        }
    }
    
    /**
     * Delete user (admin permission)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Delete result
     */
    static async deleteUser(userId) {
        try {
            // 不允许删除管理员用户
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (user.role === ROLES.ADMINISTRATOR) {
                throw new Error('Cannot delete administrator user');
            }
            
            await User.findByIdAndDelete(userId);
            
            return { success: true, message: 'User deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }
    
    /**
     * Check user permission
     * @param {string} userId - User ID
     * @param {string} requiredRole - Required role
     * @returns {Promise<boolean>} Permission check result
     */
    static async checkUserPermission(userId, requiredRole) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return false;
            }
            
            // Role permission hierarchy: ADMINISTRATOR > MEMBER > READER
            const roleHierarchy = {
                [ROLES.READER]: 1,
                [ROLES.MEMBER]: 2,
                [ROLES.ADMINISTRATOR]: 3
            };
            
            return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
        } catch (error) {
            console.error('Permission check failed:', error);
            return false;
        }
    }
}

module.exports = UserService;