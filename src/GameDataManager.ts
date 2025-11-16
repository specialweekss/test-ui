/**
 * 游戏数据管理器
 * 负责用户数据的加载和保存，固定每秒向服务器发送一次数据
 */
export class GameDataManager {
    // API基础地址（根据环境配置，可通过setApiBaseUrl修改）
    private static apiBaseUrl: string = "http://119.29.59.200:8080";
    
    // 用户ID（存储自定义登录态token）
    private static userId: string = "default_user";
    
    // 自定义登录态token
    private static token: string = "";
    
    // Token失效处理相关
    private static isRelogging: boolean = false; // 是否正在重新登录中（防止并发请求时多次重新登录）
    private static reloginCallbacks: Array<() => void> = []; // 重新登录成功后的回调队列
    
    // 定时保存相关
    private static saveTimerHandler: Function = null; // 定时保存处理函数
    private static getCurrentGameData: () => any = null; // 获取当前游戏数据的回调函数
    private static isSaving: boolean = false; // 是否正在保存中（防止重复保存）
    private static autoSaveInterval: number = 1000; // 自动保存间隔（毫秒），默认1秒
    
    /**
     * 设置用户ID
     * @param userId 用户唯一标识
     */
    public static setUserId(userId: string): void {
        this.userId = userId;
        console.log("设置用户ID:", userId);
    }
    
    /**
     * 获取用户ID
     */
    public static getUserId(): string {
        return this.userId;
    }
    
    /**
     * 设置API基础地址
     * @param baseUrl API基础地址
     */
    public static setApiBaseUrl(baseUrl: string): void {
        this.apiBaseUrl = baseUrl;
        console.log("设置API基础地址:", baseUrl);
    }
    
    /**
     * 获取API基础地址
     */
    public static getApiBaseUrl(): string {
        return this.apiBaseUrl;
    }
    
    /**
     * 设置自定义登录态token
     * @param token 自定义登录态token
     */
    public static setToken(token: string): void {
        this.token = token;
        // 同时将token作为userId使用（服务器端会根据token解析出openid）
        this.userId = token;
        console.log("设置自定义登录态token:", token);
        
        // 保存token到本地存储（如果支持）
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('game_token', token);
            }
        } catch (e) {
            console.log("无法保存token到本地存储:", e);
        }
    }
    
    /**
     * 获取自定义登录态token
     */
    public static getToken(): string {
        return this.token;
    }
    
    /**
     * 从本地存储加载token
     */
    public static loadTokenFromStorage(): void {
        try {
            if (typeof localStorage !== 'undefined') {
                const savedToken = localStorage.getItem('game_token');
                if (savedToken) {
                    this.token = savedToken;
                    this.userId = savedToken;
                    console.log("从本地存储加载token:", savedToken);
                }
            }
        } catch (e) {
            console.log("无法从本地存储加载token:", e);
        }
    }
    
    /**
     * 微信登录，获取自定义登录态token（公开方法，供外部调用）
     * @param code 微信登录凭证code（通过wx.login()获取）
     * @param callback 回调函数，成功时返回token，失败时返回null
     */
    public static wxLogin(code: string, callback: (token: string | null) => void): void {
        this.wxLoginInternal(code, callback, true); // 登录接口跳过token验证
    }
    
    /**
     * 微信登录，获取自定义登录态token（内部方法，用于自动重新登录）
     * @param code 微信登录凭证code（通过wx.login()获取）
     * @param callback 回调函数，成功时返回token，失败时返回null
     * @param skipAuth 是否跳过token验证（用于登录接口本身，防止循环）
     */
    private static wxLoginInternal(code: string, callback: (token: string | null) => void, skipAuth: boolean = false): void {
        const url = `${this.apiBaseUrl}/api/game/wx-login`;
        
        // 构建请求数据
        const requestData = {
            code: code
        };
        const postData = JSON.stringify(requestData);
        
        // 打印请求信息
        console.log("========== 微信登录请求 ==========");
        console.log("请求方式: POST");
        console.log("接口地址:", url);
        console.log("请求参数:", JSON.stringify(requestData, null, 2));
        
        const request = new Laya.HttpRequest();
        const httpRequest = (request as any).http;
        
        if (httpRequest) {
            try {
                // 手动 open POST 请求
                httpRequest.open('POST', url, true);
                // 设置请求头为 application/json
                httpRequest.setRequestHeader('Content-Type', 'application/json');
                
                // 打印请求头
                const headers: any = {
                    'Content-Type': 'application/json'
                };
                console.log("请求头:", JSON.stringify(headers, null, 2));
                console.log("==============================");
                
                // 设置超时（10秒）
                httpRequest.timeout = 10000;
                
                // 超时处理
                httpRequest.ontimeout = () => {
                    console.error("========== 登录请求超时 ==========");
                    console.error("请求方式: POST");
                    console.error("接口地址:", url);
                    console.error("失败原因: 请求超时（10秒）");
                    console.error("==============================");
                    callback(null);
                };
                
                // 网络错误处理
                httpRequest.onerror = () => {
                    console.error("========== 登录请求失败 ==========");
                    console.error("请求方式: POST");
                    console.error("接口地址:", url);
                    console.error("失败原因: 网络错误");
                    console.error("==============================");
                    callback(null);
                };
                
                // 手动监听响应
                httpRequest.onreadystatechange = () => {
                    if (httpRequest.readyState === 4) {
                        if (httpRequest.status >= 200 && httpRequest.status < 300) {
                            // 请求成功
                            try {
                                let responseData: any;
                                const responseText = httpRequest.responseText;
                                
                                // 尝试解析 JSON
                                if (typeof responseText === 'string') {
                                    try {
                                        responseData = JSON.parse(responseText);
                                    } catch (e) {
                                        responseData = responseText;
                                    }
                                } else {
                                    responseData = responseText;
                                }
                                
                                // 处理响应数据
                                let result: any;
                                if (typeof responseData === 'string') {
                                    result = JSON.parse(responseData);
                                } else {
                                    result = responseData;
                                }
                                
                                // 打印响应结果
                                console.log("========== 登录请求响应 ==========");
                                console.log("请求方式: POST");
                                console.log("接口地址:", url);
                                console.log("响应状态: 成功");
                                console.log("响应数据:", JSON.stringify(result, null, 2));
                                if (result.code === 200 && result.data && result.data.token) {
                                    console.log("响应结果: 成功");
                                    console.log("Token:", result.data.token);
                                    const token = result.data.token;
                                    // 保存token
                                    this.setToken(token);
                                    // 执行所有等待重新登录的回调
                                    this.executeReloginCallbacks();
                                    callback(token);
                                } else {
                                    console.log("响应结果: 失败");
                                    console.log("错误信息:", result.message || "未返回token");
                                    this.isRelogging = false;
                                    this.reloginCallbacks = [];
                                    callback(null);
                                }
                                console.log("==============================");
                            } catch (error) {
                                console.error("========== 登录请求异常 ==========");
                                console.error("请求方式: POST");
                                console.error("接口地址:", url);
                                console.error("异常类型: 解析响应数据失败");
                                console.error("异常信息:", error);
                                console.error("原始数据:", httpRequest.responseText);
                                console.error("==============================");
                                callback(null);
                            }
                        } else {
                            // 请求失败（HTTP状态码错误）
                            console.error("========== 登录请求失败 ==========");
                            console.error("请求方式: POST");
                            console.error("接口地址:", url);
                            console.error("失败原因: HTTP状态码错误");
                            console.error("状态码:", httpRequest.status);
                            console.error("错误信息:", httpRequest.statusText);
                            console.error("==============================");
                            callback(null);
                        }
                    }
                };
                
                // 发送数据
                httpRequest.send(postData);
            } catch (error) {
                console.error("========== 登录请求异常 ==========");
                console.error("请求方式: POST");
                console.error("接口地址:", url);
                console.error("异常类型: 发送请求时发生异常");
                console.error("异常信息:", error);
                console.error("==============================");
                callback(null);
            }
        } else {
            // 如果无法访问 http 对象，使用默认方式
            console.warn("无法访问 HttpRequest 的 http 属性，使用默认方式发送请求");
            
            // 打印请求头（登录接口只有 Content-Type）
            const headers: any = {
                'Content-Type': 'application/json'
            };
            console.log("请求头:", JSON.stringify(headers, null, 2));
            console.log("==============================");
            
            // 请求成功
            request.once(Laya.Event.COMPLETE, null, (data: any) => {
                try {
                    let result: any;
                    if (typeof data === 'string') {
                        result = JSON.parse(data);
                    } else {
                        result = data;
                    }
                    
                    console.log("========== 登录请求响应 ==========");
                    console.log("请求方式: POST");
                    console.log("接口地址:", url);
                    console.log("响应状态: 成功");
                    console.log("响应数据:", JSON.stringify(result, null, 2));
                    if (result.code === 200 && result.data && result.data.token) {
                        console.log("响应结果: 成功");
                        console.log("Token:", result.data.token);
                        const token = result.data.token;
                        // 保存token
                        this.setToken(token);
                        // 执行所有等待重新登录的回调
                        this.executeReloginCallbacks();
                        callback(token);
                    } else {
                        console.log("响应结果: 失败");
                        console.log("错误信息:", result.message || "未返回token");
                        this.isRelogging = false;
                        this.reloginCallbacks = [];
                        callback(null);
                    }
                    console.log("==============================");
                } catch (error) {
                    console.error("========== 登录请求异常 ==========");
                    console.error("请求方式: POST");
                    console.error("接口地址:", url);
                    console.error("异常类型: 解析响应数据失败");
                    console.error("异常信息:", error);
                    console.error("原始数据:", data);
                    console.error("==============================");
                    callback(null);
                }
            });
            
            // 请求失败
            request.once(Laya.Event.ERROR, null, (error: any) => {
                console.error("========== 登录请求失败 ==========");
                console.error("请求方式: POST");
                console.error("接口地址:", url);
                console.error("失败原因: 网络请求失败");
                console.error("错误信息:", error);
                console.error("==============================");
                callback(null);
            });
            
            request.send(url, postData, 'post', 'json');
        }
    }
    
    /**
     * 统一请求方法（处理401错误，自动重新登录）
     * @param options 请求选项
     * @param callback 回调函数
     */
    private static request(options: {
        url: string;
        method: string;
        data?: any;
        skipAuth?: boolean; // 是否跳过token验证（用于登录接口）
    }, callback: (result: any) => void): void {
        const url = `${this.apiBaseUrl}${options.url}`;
        const method = options.method || 'GET';
        const skipAuth = options.skipAuth || false;
        
        // 检查token是否存在（如果不是登录接口且需要认证）
        if (!skipAuth && !this.token) {
            console.error("========== 请求失败 ==========");
            console.error("请求方式:", method);
            console.error("接口地址:", url);
            console.error("失败原因: Token未设置，请先登录");
            console.error("==============================");
            callback(null);
            return;
        }
        
        // 打印请求信息
        console.log("========== 网络请求 ==========");
        console.log("请求方式:", method);
        console.log("接口地址:", url);
        
        const request = new Laya.HttpRequest();
        const httpRequest = (request as any).http;
        
        // 设置请求头，携带token
        if (httpRequest) {
            try {
                httpRequest.open(method, url, true);
                httpRequest.setRequestHeader('Content-Type', 'application/json');
                
                // 构建请求头对象用于打印
                const headers: any = {
                    'Content-Type': 'application/json'
                };
                if (!skipAuth && this.token) {
                    httpRequest.setRequestHeader('X-Token', this.token);
                    headers['X-Token'] = this.token;
                }
                
                // 打印请求头
                console.log("请求头:", JSON.stringify(headers, null, 2));
                if (options.data) {
                    console.log("请求参数:", JSON.stringify(options.data, null, 2));
                }
                console.log("==============================");
                
                // 设置超时（10秒）
                httpRequest.timeout = 10000;
                
                // 超时处理
                httpRequest.ontimeout = () => {
                    console.error("========== 请求超时 ==========");
                    console.error("请求方式: GET");
                    console.error("接口地址:", url);
                    console.error("失败原因: 请求超时（10秒）");
                    console.error("==============================");
                    callback(null);
                };
                
                // 网络错误处理
                httpRequest.onerror = () => {
                    console.error("========== 请求失败 ==========");
                    console.error("请求方式: GET");
                    console.error("接口地址:", url);
                    console.error("失败原因: 网络错误");
                    console.error("==============================");
                    callback(null);
                };
                
                // 手动监听响应
                httpRequest.onreadystatechange = () => {
                    if (httpRequest.readyState === 4) {
                        if (httpRequest.status >= 200 && httpRequest.status < 300) {
                            try {
                                let responseData: any;
                                const responseText = httpRequest.responseText;
                                
                                if (typeof responseText === 'string') {
                                    try {
                                        responseData = JSON.parse(responseText);
                                    } catch (e) {
                                        responseData = responseText;
                                    }
                                } else {
                                    responseData = responseText;
                                }
                                
                                let result: any;
                                if (typeof responseData === 'string') {
                                    result = JSON.parse(responseData);
                                } else {
                                    result = responseData;
                                }
                                
                                console.log("========== 请求响应 ==========");
                                console.log("请求方式:", method);
                                console.log("接口地址:", url);
                                console.log("响应状态: 成功");
                                console.log("响应数据:", JSON.stringify(result, null, 2));
                                
                                // 处理401错误 - token失效，自动重新登录
                                if (result.code === 401 && !skipAuth) {
                                    console.warn("Token失效，尝试自动重新登录...");
                                    this.handleTokenExpired(() => {
                                        // 重新发送原请求
                                        console.log("重新发送请求:", options.url);
                                        this.request(options, callback);
                                    });
                                } else if (result.code === 200) {
                                    console.log("响应结果: 成功");
                                    console.log("返回数据:", JSON.stringify(result.data, null, 2));
                                    callback(result.data);
                                } else {
                                    console.log("响应结果: 失败");
                                    console.log("错误信息:", result.message);
                                    callback(null);
                                }
                                console.log("==============================");
                            } catch (error) {
                                console.error("========== 请求异常 ==========");
                                console.error("请求方式: GET");
                                console.error("接口地址:", url);
                                console.error("异常类型: 解析响应数据失败");
                                console.error("异常信息:", error);
                                console.error("原始数据:", httpRequest.responseText);
                                console.error("==============================");
                                callback(null);
                            }
                        } else {
                            // HTTP状态码错误，尝试解析响应体
                            try {
                                const responseText = httpRequest.responseText;
                                let result: any;
                                if (typeof responseText === 'string' && responseText) {
                                    try {
                                        result = JSON.parse(responseText);
                                    } catch (e) {
                                        result = { code: httpRequest.status, message: httpRequest.statusText };
                                    }
                                } else {
                                    result = { code: httpRequest.status, message: httpRequest.statusText };
                                }
                                
                                // 处理401错误（检查HTTP状态码或响应体中的code）
                                if ((httpRequest.status === 401 || result.code === 401) && !skipAuth) {
                                    console.warn("Token失效（HTTP 401），尝试自动重新登录...");
                                    this.handleTokenExpired(() => {
                                        // 重新发送原请求
                                        console.log("重新发送请求:", options.url);
                                        this.request(options, callback);
                                    });
                                } else {
                                    console.error("========== 请求失败 ==========");
                                    console.error("请求方式:", method);
                                    console.error("接口地址:", url);
                                    console.error("失败原因: HTTP状态码错误");
                                    console.error("状态码:", httpRequest.status);
                                    console.error("错误信息:", httpRequest.statusText);
                                    console.error("==============================");
                                    callback(null);
                                }
                            } catch (error) {
                                // 解析响应体失败，但如果是401状态码，也要处理
                                if (httpRequest.status === 401 && !skipAuth) {
                                    console.warn("Token失效（HTTP 401，响应体解析失败），尝试自动重新登录...");
                                    this.handleTokenExpired(() => {
                                        // 重新发送原请求
                                        console.log("重新发送请求:", options.url);
                                        this.request(options, callback);
                                    });
                                } else {
                                    console.error("========== 请求失败 ==========");
                                    console.error("请求方式:", method);
                                    console.error("接口地址:", url);
                                    console.error("失败原因: HTTP状态码错误");
                                    console.error("状态码:", httpRequest.status);
                                    console.error("错误信息:", httpRequest.statusText);
                                    console.error("==============================");
                                    callback(null);
                                }
                            }
                        }
                    }
                };
                
                // 发送请求
                if (method === 'POST' && options.data) {
                    httpRequest.send(JSON.stringify(options.data));
                } else {
                    httpRequest.send();
                }
                return;
            } catch (error) {
                console.error("========== 请求异常 ==========");
                console.error("请求方式:", method);
                console.error("接口地址:", url);
                console.error("异常类型: 发送请求时发生异常");
                console.error("异常信息:", error);
                console.error("==============================");
                callback(null);
                return;
            }
        }
        
        // 如果无法访问 http 对象，使用默认方式
        console.warn("无法访问 HttpRequest 的 http 属性，使用默认方式发送请求");
        
        // 准备请求头（LayaAir 的 send 方法支持通过 headers 参数传递）
        const headers: any = {
            'Content-Type': 'application/json'
        };
        if (!skipAuth && this.token) {
            headers['X-Token'] = this.token;
        }
        
        // 打印请求头
        console.log("请求头:", JSON.stringify(headers, null, 2));
        if (options.data) {
            console.log("请求参数:", JSON.stringify(options.data, null, 2));
        }
        console.log("==============================");
        
        // 请求成功
        request.once(Laya.Event.COMPLETE, this, (data: any) => {
            try {
                // LayaAir 的 HttpRequest 在响应类型为 'json' 时会自动解析，data 已经是对象
                // 如果是字符串，则需要手动解析
                let result: any;
                if (typeof data === 'string') {
                    result = JSON.parse(data);
                } else {
                    result = data;
                }
                
                // 打印响应结果
                console.log("========== 请求响应 ==========");
                console.log("请求方式:", method);
                console.log("接口地址:", url);
                console.log("响应状态: 成功");
                console.log("响应数据:", JSON.stringify(result, null, 2));
                
                // 处理401错误 - token失效，自动重新登录
                if (result.code === 401 && !skipAuth) {
                    console.warn("Token失效，尝试自动重新登录...");
                    this.handleTokenExpired(() => {
                        // 重新发送原请求
                        console.log("重新发送请求:", options.url);
                        this.request(options, callback);
                    });
                } else if (result.code === 200) {
                    console.log("响应结果: 成功");
                    console.log("返回数据:", JSON.stringify(result.data, null, 2));
                    callback(result.data);
                } else {
                    console.log("响应结果: 失败");
                    console.log("错误信息:", result.message);
                    callback(null);
                }
                console.log("==============================");
            } catch (error) {
                console.error("========== 请求异常 ==========");
                console.error("请求方式:", method);
                console.error("接口地址:", url);
                console.error("异常类型: 解析响应数据失败");
                console.error("异常信息:", error);
                console.error("原始数据:", data);
                console.error("==============================");
                callback(null);
            }
        });
        
        // 请求失败
        request.once(Laya.Event.ERROR, this, (error: any) => {
            console.error("========== 请求失败 ==========");
            console.error("请求方式:", method);
            console.error("接口地址:", url);
            console.error("失败原因: 网络请求失败");
            console.error("错误信息:", error);
            console.error("==============================");
            callback(null);
        });
        
        // 发送请求（LayaAir 的 send 方法签名：send(url, data, method, responseType, headers)）
        if (method === 'POST' && options.data) {
            request.send(url, JSON.stringify(options.data), 'post', 'json', headers);
        } else {
            request.send(url, null, 'get', 'json', headers);
        }
    }
    
    /**
     * 处理Token过期，自动重新登录
     * @param retryCallback 重新登录成功后的重试回调
     */
    private static handleTokenExpired(retryCallback: () => void): void {
        // 如果正在重新登录，将回调加入队列
        if (this.isRelogging) {
            console.log("正在重新登录中，将请求加入重试队列");
            this.reloginCallbacks.push(retryCallback);
            return;
        }
        
        // 标记为正在重新登录
        this.isRelogging = true;
        this.reloginCallbacks.push(retryCallback);
        
        // 清除旧token
        this.clearToken();
        
        // 检查是否在微信小游戏环境中
        const wx = (window as any).wx;
        if (!wx) {
            console.error("不在微信小游戏环境中，无法自动重新登录");
            this.isRelogging = false;
            this.reloginCallbacks = [];
            return;
        }
        
        // 调用微信登录
        console.log("开始自动重新登录...");
        wx.login({
            success: (res: any) => {
                if (res.code) {
                    console.log("获取登录凭证code成功:", res.code);
                    // 调用登录接口（跳过token验证）
                    this.wxLoginInternal(res.code, (token: string | null) => {
                        if (token) {
                            console.log("自动重新登录成功, token:", token);
                            // 执行所有等待的回调（在wxLoginInternal中已执行）
                        } else {
                            console.error("自动重新登录失败");
                            this.isRelogging = false;
                            this.reloginCallbacks = [];
                        }
                    }, true); // 登录接口跳过token验证
                } else {
                    console.error("获取登录凭证code失败:", res.errMsg);
                    this.isRelogging = false;
                    this.reloginCallbacks = [];
                }
            },
            fail: (err: any) => {
                console.error("微信登录失败:", err);
                this.isRelogging = false;
                this.reloginCallbacks = [];
            }
        });
    }
    
    /**
     * 执行所有等待重新登录的回调
     */
    private static executeReloginCallbacks(): void {
        console.log("执行重新登录成功后的回调，共", this.reloginCallbacks.length, "个请求");
        const callbacks = [...this.reloginCallbacks];
        this.reloginCallbacks = [];
        this.isRelogging = false;
        
        // 执行所有回调
        callbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error("执行重试回调失败:", error);
            }
        });
    }
    
    /**
     * 清除token
     */
    private static clearToken(): void {
        this.token = "";
        this.userId = "default_user";
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('game_token');
            }
        } catch (e) {
            console.log("无法清除本地存储的token:", e);
        }
    }
    
    /**
     * 获取用户游戏数据
     * @param callback 回调函数，成功时返回数据，失败时返回null
     */
    public static loadUserData(callback: (data: any) => void): void {
        this.request({
            url: '/api/game/user-data',
            method: 'GET'
        }, callback);
    }
    
    /**
     * 启动定时保存
     * @param getCurrentGameData 获取当前游戏数据的回调函数
     */
    public static startAutoSave(getCurrentGameData: () => any): void {
        if (this.saveTimerHandler) {
            console.log("定时保存已启动，无需重复启动");
            return;
        }
        
        this.getCurrentGameData = getCurrentGameData;
        const intervalSeconds = this.autoSaveInterval / 1000;
        console.log("启动定时保存，保存间隔:", intervalSeconds, "秒");
        
        // 按设置的间隔执行保存
        this.saveTimerHandler = () => {
            this.performSave();
        };
        Laya.timer.loop(this.autoSaveInterval, null, this.saveTimerHandler);
    }
    
    /**
     * 停止定时保存
     */
    public static stopAutoSave(): void {
        if (this.saveTimerHandler) {
            Laya.timer.clear(null, this.saveTimerHandler);
            this.saveTimerHandler = null;
            this.getCurrentGameData = null;
            console.log("停止定时保存");
        }
    }
    
    /**
     * 执行保存操作（定时器调用）
     */
    private static performSave(): void {
        // 如果正在保存中，跳过本次保存
        if (this.isSaving) {
            console.log("上次保存尚未完成，跳过本次保存");
            return;
        }
        
        // 如果没有获取数据的回调函数，跳过
        if (!this.getCurrentGameData) {
            return;
        }
        
        // 获取当前游戏数据
        const gameData = this.getCurrentGameData();
        if (!gameData) {
            console.log("获取游戏数据失败，跳过保存");
            return;
        }
        
        // 执行保存
        this.doSaveUserData(gameData);
    }
    
    /**
     * 手动保存用户游戏数据（立即保存，不受定时器影响）
     * @param gameData 游戏数据对象
     * @param callback 回调函数，成功时返回true，失败时返回false
     */
    public static saveUserData(gameData: any, callback?: (success: boolean) => void): void {
        this.doSaveUserData(gameData, callback);
    }
    
    /**
     * 执行保存用户游戏数据
     * @param gameData 游戏数据对象
     * @param callback 回调函数
     */
    private static doSaveUserData(gameData: any, callback?: (success: boolean) => void): void {
        // 如果正在保存中，跳过（防止重复保存）
        if (this.isSaving) {
            console.log("正在保存中，跳过本次保存");
            if (callback) {
                callback(false);
            }
            return;
        }
        
        const url = `${this.apiBaseUrl}/api/game/user-data`;
        
        // 构建请求数据（不需要包含userId，服务器会根据token解析）
        const requestData = {
            ...gameData
        };
        const postData = JSON.stringify(requestData);
        
        // 打印请求信息
        console.log("========== 网络请求 ==========");
        console.log("请求方式: POST");
        console.log("接口地址:", url);
        console.log("请求参数:", JSON.stringify(requestData, null, 2));
        
        // 标记为正在保存
        this.isSaving = true;
        
        // 辅助函数：重置保存状态（确保在所有情况下都能重置）
        const resetSavingState = () => {
            if (this.isSaving) {
                this.isSaving = false;
            }
        };
        
        // 发送POST请求
        // LayaAir 的 HttpRequest 需要通过 http 属性访问底层的 XMLHttpRequest 来设置请求头
        // 但 setRequestHeader 必须在 open 之后调用，而 LayaAir 的 send 会自动 open
        // 所以我们需要先手动 open，然后设置请求头，最后 send
        
        const request = new Laya.HttpRequest();
        const httpRequest = (request as any).http;
        
        if (httpRequest) {
            try {
                // 手动 open POST 请求
                httpRequest.open('POST', url, true);
                // 设置请求头为 application/json
                httpRequest.setRequestHeader('Content-Type', 'application/json');
                
                // 构建请求头对象用于打印
                const headers: any = {
                    'Content-Type': 'application/json'
                };
                // 设置 X-Token 请求头（如果token存在）
                if (this.token) {
                    httpRequest.setRequestHeader('X-Token', this.token);
                    headers['X-Token'] = this.token;
                }
                
                // 打印请求头
                console.log("请求头:", JSON.stringify(headers, null, 2));
                console.log("==============================");
                
                // 设置超时（30秒）
                httpRequest.timeout = 30000;
                
                // 超时处理
                httpRequest.ontimeout = () => {
                    resetSavingState();
                    console.error("========== 请求超时 ==========");
                    console.error("请求方式: POST");
                    console.error("接口地址:", url);
                    console.error("失败原因: 请求超时（30秒）");
                    console.error("==============================");
                    if (callback) {
                        callback(false);
                    }
                };
                
                // 网络错误处理
                httpRequest.onerror = () => {
                    resetSavingState();
                    console.error("========== 请求失败 ==========");
                    console.error("请求方式: POST");
                    console.error("接口地址:", url);
                    console.error("失败原因: 网络错误");
                    console.error("==============================");
                    if (callback) {
                        callback(false);
                    }
                };
                
                // 手动监听响应（因为绕过了 LayaAir 的 send 方法）
                httpRequest.onreadystatechange = () => {
                    if (httpRequest.readyState === 4) {
                        // 无论成功还是失败，都要重置保存状态
                        resetSavingState();
                        
                        if (httpRequest.status >= 200 && httpRequest.status < 300) {
                            // 请求成功
                            try {
                                let responseData: any;
                                const responseText = httpRequest.responseText;
                                
                                // 尝试解析 JSON
                                if (typeof responseText === 'string') {
                                    try {
                                        responseData = JSON.parse(responseText);
                                    } catch (e) {
                                        responseData = responseText;
                                    }
                                } else {
                                    responseData = responseText;
                                }
                                
                                // 处理响应数据（复用之前的逻辑）
                                let result: any;
                                if (typeof responseData === 'string') {
                                    result = JSON.parse(responseData);
                                } else {
                                    result = responseData;
                                }
                                
                                // 打印响应结果
                                console.log("========== 请求响应 ==========");
                                console.log("请求方式: POST");
                                console.log("接口地址:", url);
                                console.log("响应状态: 成功");
                                console.log("响应数据:", JSON.stringify(result, null, 2));
                                
                                // 处理401错误 - token失效，自动重新登录
                                if (result.code === 401) {
                                    console.warn("Token失效，尝试自动重新登录...");
                                    this.handleTokenExpired(() => {
                                        // 重新发送原请求
                                        console.log("重新发送保存请求");
                                        this.doSaveUserData(gameData, callback);
                                    });
                                } else if (result.code === 200) {
                                    console.log("响应结果: 成功");
                                    console.log("返回数据:", JSON.stringify(result.data, null, 2));
                                    if (callback) {
                                        callback(true);
                                    }
                                } else {
                                    console.log("响应结果: 失败");
                                    console.log("错误信息:", result.message);
                                    if (callback) {
                                        callback(false);
                                    }
                                }
                                console.log("==============================");
                            } catch (error) {
                                console.error("========== 请求异常 ==========");
                                console.error("请求方式: POST");
                                console.error("接口地址:", url);
                                console.error("异常类型: 解析响应数据失败");
                                console.error("异常信息:", error);
                                console.error("原始数据:", httpRequest.responseText);
                                console.error("==============================");
                                if (callback) {
                                    callback(false);
                                }
                            }
                        } else {
                            // 请求失败（HTTP状态码错误）
                            console.error("========== 请求失败 ==========");
                            console.error("请求方式: POST");
                            console.error("接口地址:", url);
                            console.error("失败原因: HTTP状态码错误");
                            console.error("状态码:", httpRequest.status);
                            console.error("错误信息:", httpRequest.statusText);
                            console.error("==============================");
                            
                            // 处理401错误 - token失效，自动重新登录
                            if (httpRequest.status === 401) {
                                // 尝试解析响应体，看是否有更详细的错误信息
                                let result: any = null;
                                try {
                                    const responseText = httpRequest.responseText;
                                    if (responseText) {
                                        try {
                                            result = JSON.parse(responseText);
                                        } catch (e) {
                                            result = { code: 401, message: httpRequest.statusText };
                                        }
                                    } else {
                                        result = { code: 401, message: httpRequest.statusText };
                                    }
                                } catch (e) {
                                    result = { code: 401, message: httpRequest.statusText };
                                }
                                
                                console.warn("Token失效（HTTP 401），尝试自动重新登录...");
                                this.handleTokenExpired(() => {
                                    // 重新发送保存请求
                                    console.log("重新发送保存请求");
                                    this.doSaveUserData(gameData, callback);
                                });
                            } else {
                                if (callback) {
                                    callback(false);
                                }
                            }
                        }
                    }
                };
                
                // 发送数据
                httpRequest.send(postData);
            } catch (error) {
                // 如果发送请求时出现异常，也要重置状态
                resetSavingState();
                console.error("========== 请求异常 ==========");
                console.error("请求方式: POST");
                console.error("接口地址:", url);
                console.error("异常类型: 发送请求时发生异常");
                console.error("异常信息:", error);
                console.error("==============================");
                if (callback) {
                    callback(false);
                }
            }
        } else {
            // 如果无法访问 http 对象，使用默认方式（可能不会设置正确的 Content-Type）
            console.warn("无法访问 HttpRequest 的 http 属性，使用默认方式发送请求（可能 Content-Type 不正确）");
            
            // 准备请求头（LayaAir 的 send 方法支持通过 headers 参数传递）
            const headers: any = {
                'Content-Type': 'application/json'
            };
            if (this.token) {
                headers['X-Token'] = this.token;
            }
            
            // 打印请求头
            console.log("请求头:", JSON.stringify(headers, null, 2));
            console.log("==============================");
            
            // 请求成功
            request.once(Laya.Event.COMPLETE, null, (data: any) => {
                resetSavingState();
                
                try {
                    // LayaAir 的 HttpRequest 在响应类型为 'json' 时会自动解析，data 已经是对象
                    // 如果是字符串，则需要手动解析
                    let result: any;
                    if (typeof data === 'string') {
                        result = JSON.parse(data);
                    } else {
                        result = data;
                    }
                    
                    // 打印响应结果
                    console.log("========== 请求响应 ==========");
                    console.log("请求方式: POST");
                    console.log("接口地址:", url);
                    console.log("响应状态: 成功");
                    console.log("响应数据:", JSON.stringify(result, null, 2));
                    if (result.code === 200) {
                        console.log("响应结果: 成功");
                        console.log("返回数据:", JSON.stringify(result.data, null, 2));
                    } else {
                        console.log("响应结果: 失败");
                        console.log("错误信息:", result.message);
                    }
                    console.log("==============================");
                    
                    if (result.code === 200) {
                        if (callback) {
                            callback(true);
                        }
                    } else {
                        if (callback) {
                            callback(false);
                        }
                    }
                } catch (error) {
                    console.error("========== 请求异常 ==========");
                    console.error("请求方式: POST");
                    console.error("接口地址:", url);
                    console.error("异常类型: 解析响应数据失败");
                    console.error("异常信息:", error);
                    console.error("原始数据:", data);
                    console.error("==============================");
                    if (callback) {
                        callback(false);
                    }
                }
            });
            
            // 请求失败
            request.once(Laya.Event.ERROR, null, (error: any) => {
                resetSavingState();
                console.error("========== 请求失败 ==========");
                console.error("请求方式: POST");
                console.error("接口地址:", url);
                console.error("失败原因: 网络请求失败");
                console.error("错误信息:", error);
                console.error("==============================");
                if (callback) {
                    callback(false);
                }
            });
            
            request.send(url, postData, 'post', 'json', headers);
        }
    }
    
    /**
     * 将游戏数据转换为API需要的格式
     * @param playerLevel 玩家等级
     * @param money 当前金钱
     * @param clickRewardBase 点击收益基础值
     * @param clickMultiplier 点击收益倍率
     * @param upgradeCost 升级所需金币
     * @param assistants 助理数据数组
     * @param challenges 挑战数据数组
     */
    public static formatGameData(
        playerLevel: number,
        money: number,
        clickRewardBase: number,
        clickMultiplier: number,
        upgradeCost: number,
        trainingCount: number,
        assistants: Array<{id: number, unlocked: boolean, level: number}>,
        challenges: Array<{id: number, completed: boolean}>
    ): any {
        return {
            playerInfo: {
                playerLevel: playerLevel,
                money: money,
                clickRewardBase: clickRewardBase,
                clickMultiplier: clickMultiplier,
                upgradeCost: upgradeCost,
                trainingCount: trainingCount
            },
            assistants: assistants.map(a => ({
                id: a.id,
                unlocked: a.unlocked,
                level: a.level
            })),
            challenges: challenges.map(c => ({
                id: c.id,
                completed: c.completed
            }))
        };
    }
    
    /**
     * 从API数据恢复游戏状态
     * @param apiData API返回的数据
     * @param assistants 助理数据数组（需要恢复unlocked和level）
     * @param challenges 挑战数据数组（需要恢复completed）
     */
    public static restoreGameData(
        apiData: any,
        assistants: Array<{id: number, unlocked: boolean, level: number, name: string, unlockCost: number}>,
        challenges: Array<{id: number, completed: boolean, name: string, requiredPower: number, reward: number, isBoss: boolean}>
    ): {
        playerLevel: number,
        money: number,
        clickRewardBase: number,
        clickMultiplier: number,
        upgradeCost: number,
        trainingCount: number,
        lastUpdateTime?: string
    } | null {
        if (!apiData) {
            console.log("API数据为空，使用默认数据");
            return null;
        }
        
        try {
            // 恢复玩家信息
            const playerInfo = apiData.playerInfo;
            if (playerInfo) {
                console.log("恢复玩家信息:", playerInfo);
            }
            
            // 恢复助理数据
            if (apiData.assistants && Array.isArray(apiData.assistants)) {
                apiData.assistants.forEach((apiAssistant: any) => {
                    const assistant = assistants.find(a => a.id === apiAssistant.id);
                    if (assistant) {
                        assistant.unlocked = apiAssistant.unlocked;
                        assistant.level = apiAssistant.level;
                        console.log("恢复助理数据:", assistant.name, "解锁:", assistant.unlocked, "等级:", assistant.level);
                    }
                });
            }
            
            // 恢复挑战数据
            if (apiData.challenges && Array.isArray(apiData.challenges)) {
                apiData.challenges.forEach((apiChallenge: any) => {
                    const challenge = challenges.find(c => c.id === apiChallenge.id);
                    if (challenge) {
                        challenge.completed = apiChallenge.completed;
                        console.log("恢复挑战数据:", challenge.name, "完成:", challenge.completed);
                    }
                });
            }
            
            // 返回玩家信息，包含lastUpdateTime
            const result: any = playerInfo || null;
            if (result && apiData.lastUpdateTime) {
                result.lastUpdateTime = apiData.lastUpdateTime;
            }
            return result;
        } catch (error) {
            console.error("恢复游戏数据失败:", error);
            return null;
        }
    }
}

