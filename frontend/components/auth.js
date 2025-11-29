// 极简版本auth.js - 完全独立，不导入任何模块
console.log('ULTRA MINIMAL AUTH.JS LOADED - NO IMPORTS');

// 只导出一个简单的auth对象
const auth = {
    isAuthenticated: false,
    currentUser: null,
    hello: function() {
        return 'Hello from auth module!';
    }
};

// 只导出这个简单对象
export default auth;