// config/server-mode.node.js (Node.js后端专用)
const USE_MOCK_SERVER = false; // 改为 false 使用真实服务器
const LOCAL_SERVER_URL = 'http://localhost:8080';
// 部署服务器配置：使用环境变量或默认端口
const DEPLOY_PORT = process.env.PORT || 8081; // 部署端口，可通过环境变量覆盖（改为8081）
const REAL_SERVER_URL = `http://124.222.21.147:${DEPLOY_PORT}`; // 部署服务器地址
const REAL_SERVER_PORT = DEPLOY_PORT; // 部署服务器端口
// 后端服务器配置（真正的后端服务器地址）
const BACKEND_SERVER_URL = 'http://124.222.21.147:8000'; // 后端服务器地址
// 是否优先使用后端服务器（设为 true 时，所有 API 请求会优先代理到后端服务器）
// 注意：后台管理系统通过中间层代理访问后端服务器
// 🔧 强制使用真实服务器：设为 true，所有 API 请求直接代理到后端服务器，不使用本地mock数据
const PRIORITIZE_BACKEND_SERVER = true; // 设为 true 优先使用后端服务器，false 优先使用本地路由
const REAL_WECHAT_CONFIG = {
    appid: 'wx94289b0d2ca7a802',
    secret: '10409c1193a326a7b328f675b1776195'
};
const getLocalIP = () => '192.168.31.189';
const MOCK_SERVER_CONFIG = {
    host: getLocalIP(),
    port: 8080,
    url: `http://${getLocalIP()}:8080`
};
const getCurrentServerConfig = () => {
    if (USE_MOCK_SERVER) {
        return {
            mode: 'mock',
            url: MOCK_SERVER_CONFIG.url,
            host: MOCK_SERVER_CONFIG.host,
            port: MOCK_SERVER_CONFIG.port,
            wechat: {
                useMock: true,
                appid: 'wx94289b0d2ca7a802',
                secret: '10409c1193a326a7b328f675b1776195'
            }
        };
    } else {
        // 使用真实服务器，部署模式
        return {
            mode: 'real',
            url: REAL_SERVER_URL,
            port: DEPLOY_PORT,  // 使用部署端口（8082）
            wechat: {
                useMock: false,
                appid: REAL_WECHAT_CONFIG.appid,
                secret: REAL_WECHAT_CONFIG.secret
            }
        };
    }
};
const printConfig = () => {
    const config = getCurrentServerConfig();
    console.log('═══════════════════════════════════════');
    console.log('📋 服务器配置信息');
    console.log('═══════════════════════════════════════');
    console.log(`模式: ${config.mode === 'mock' ? '🧪 模拟服务器' : '🌐 真实服务器'}`);
    console.log(`地址: ${config.url}`);
    if (config.mode === 'mock') {
        console.log(`本地访问: http://localhost:${config.port}`);
        console.log(`局域网访问: ${config.url}`);
    }
    console.log(`微信登录: ${config.wechat.useMock ? '模拟模式' : '真实模式'}`);
    if (!config.wechat.useMock) {
        console.log(`微信 AppID: ${config.wechat.appid}`);
        console.log(`微信 Secret: ${config.wechat.secret ? config.wechat.secret.substring(0, 8) + '...' : '未设置'}`);
    }
    console.log('═══════════════════════════════════════');
};
module.exports = {
	USE_MOCK_SERVER,
	MOCK_SERVER_CONFIG,
	REAL_SERVER_URL,
	REAL_SERVER_PORT,
	REAL_WECHAT_CONFIG,
	BACKEND_SERVER_URL,
	PRIORITIZE_BACKEND_SERVER,
	getCurrentServerConfig,
	printConfig,
	LOCAL_SERVER_URL,
};
