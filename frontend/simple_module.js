// 简单的测试模块 - 不导入任何其他模块
export const testModule = {
    name: 'Test Module',
    version: '1.0.0',
    sayHello: function() {
        return 'Hello from simple module!';
    }
};

// 导出一些基本函数
export function testFunction() {
    return 'Test function called';
}

// 确保不声明任何名为getUserInfo的内容
console.log('Simple module loaded');