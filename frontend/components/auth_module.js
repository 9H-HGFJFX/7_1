// 全新的认证模块 - 使用不同的文件名
console.log('AUTH_MODULE.JS LOADED - NEW FILE NAME');

// 简单的认证对象
const authModule = {
    isAuthenticated: false,
    currentUser: null,
    hello: function() {
        return 'Hello from auth_module!';
    }
};

export default authModule;