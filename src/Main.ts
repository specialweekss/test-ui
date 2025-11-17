const { regClass, property } = Laya;
import { GameDataManager } from "./GameDataManager";

@regClass()
export class Main extends Laya.Script {

    // 登录测试模式开关（true: 登录后暂停，不执行后续任务；false: 正常模式）
    private static readonly LOGIN_TEST_MODE: boolean = false;

    // 培训功能需要解锁的助理数量
    private static readonly TRAINING_REQUIRED_ASSISTANT_COUNT: number = 9;

    // 玩家信息
    private playerLevel: number = 1; // 等级从1开始
    private money: number = 0; // 当前金钱
    private clickRewardBase: number = 100; // 单次点击金币获取量基础值（初始100）
    private clickMultiplier: number = 1.0; // 点击收益倍率（初始1.0，即100%）
    private upgradeCost: number = 10; // 升级所需金币（初始10）
    private trainingCount: number = 0; // 助理培训次数（初始0）

    // UI组件
    private avatarImg: Laya.Sprite;
    private nameLabel: Laya.Text; // 玩家名称显示
    private levelLabel: Laya.Text;
    private multiplierLabel: Laya.Text; // 倍率显示（点击收益）
    private multiplierLabelBg: Laya.Sprite; // 倍率显示背景
    private perSecondLabel: Laya.Text; // 秒赚显示
    private perSecondLabelBg: Laya.Sprite; // 秒赚显示背景
    private moneyLabel: Laya.Text; // 金钱显示
    private moneyLabelBg: Laya.Sprite; // 金钱显示背景
    private upgradeBtn: Laya.Sprite;
    private upgradeCostLabel: Laya.Text; // 升级所需金币显示
    private upgradeCostLabelBg: Laya.Sprite; // 升级金币数背景
    private assistantBtn: Laya.Sprite;
    private challengeBtn: Laya.Sprite;
    
    // 弹窗管理
    private popupContainer: Laya.Sprite; // 弹窗容器
    private activePopups: Array<{sprite: Laya.Sprite, timer: number, position: "center" | "money"}> = []; // 活跃的弹窗列表
    
    // Ticket动画管理
    private ticketContainer: Laya.Sprite; // Ticket容器（用于管理ticket动画，层级在背景上面，其他按钮下面）
    
    // 窗口管理
    private assistantWindow: Laya.Sprite; // 助理窗口容器
    private settingsWindow: Laya.Sprite; // 设置窗口容器
    private challengeWindow: Laya.Sprite; // 挑战窗口容器
    
    // 加载页面管理
    private loadingPage: Laya.Sprite; // 加载页面容器
    private loginButton: any; // 微信登录按钮（wx.createUserInfoButton返回的对象）
    private progressBar: Laya.Sprite; // 进度条背景
    private progressBarFill: Laya.Sprite; // 进度条填充
    private progressLabel: Laya.Text; // 进度文字
    private userToken: string = ""; // 自定义登录态token
    
    // 助理数据
    private assistants: Array<{
        id: number; // 助理ID
        name: string; // 助理名称
        unlocked: boolean; // 是否已解锁
        level: number; // 当前等级（0表示未解锁，1-50表示已解锁的等级）
        unlockCost: number; // 解锁所需金币
    }> = [];
    
    // 挑战数据
    private challenges: Array<{
        id: number; // 挑战ID
        name: string; // 挑战名称
        requiredPower: number; // 所需战力（/秒）
        reward: number; // 奖励金币
        completed: boolean; // 是否已完成
        isBoss: boolean; // 是否为BOSS挑战
    }> = [];
    
    private assistantTimerHandler: Function; // 助理收益定时器处理函数
    
    // 连点功能相关
    private upgradeRepeatHandler: Function = null; // 主页面升级连点处理函数
    private assistantRepeatHandlers: Map<number, Function> = new Map(); // 助理操作连点处理函数映射（key: assistantId）
    private upgradeLongPressTimer: Function = null; // 升级按钮长按定时器处理函数
    private assistantLongPressTimers: Map<number, Function> = new Map(); // 助理按钮长按定时器处理函数映射（key: assistantId）
    
    // 数据加载状态
    private dataLoaded: boolean = false; // 数据是否已加载
    private dataLoadSuccess: boolean = false; // 数据是否加载成功（只有加载成功才允许上传）
    
    // 离线收益相关
    private offlineEarnings: number = 0; // 离线收益（金币）
    private offlineEarningsDialog: Laya.Sprite = null; // 离线收益弹窗
    private offlineEarningsResolved: boolean = false; // 离线收益是否已处理（领取或放弃）
    private autoSaveEnabled: boolean = false; // 是否启用自动保存（离线收益处理完成后才启用）
    
    // 助理after图片显示相关
    private assistantAfterImage: Laya.Sprite; // 桌子上方显示的助理after图片
    private clickRewardCount: number = 0; // 点击收益计数（每10次切换一次助理图片）
    private currentAssistantIndex: number = 0; // 当前显示的助理索引（在已解锁助理列表中的索引）
    private isShowingAfter: boolean = true; // 当前是否显示after图片（true: after, false: success）
    private isSwitchingAssistant: boolean = false; // 是否正在切换助理图片（用于防止动画冲突）
    private fullScreenAfterImage: Laya.Sprite; // 全屏显示的助理after图片（解锁时显示）
    private fullScreenAssistantNameLabel: Laya.Text; // 全屏显示时的助理名字文本（上方）
    private fullScreenContinueLabel: Laya.Text; // 全屏显示时的"点按任意键继续"文本（下方）
    private fullScreenBottomMask: Laya.Sprite; // 全屏显示时图片下方的黑色遮挡
    private currentChallengeId: number = 0; // 当前显示的挑战ID（用于判断是否是1号挑战的success图片）

    // 新手指引相关
    private newbieGuideMask: Laya.Sprite; // 新手指引遮挡层
    private newbieGuideTipLabel: Laya.Text; // 新手指引提示文字
    private newbieGuideClickArea: Laya.Sprite; // 新手指引可点击区域（中间部分）
    private isNewbieGuideActive: boolean = false; // 新手指引是否激活
    private newbieGuideAutoCloseTimer: Function = null; // 新手指引自动关闭定时器
    
    // 底部按钮容器
    private bottomBar: Laya.Sprite; // 底部按钮容器
    
    // 助理按钮指引相关
    private assistantGuideMask: Laya.Sprite; // 助理按钮指引遮挡层
    private assistantGuideTipLabel: Laya.Text; // 助理按钮指引提示文字
    private isAssistantGuideActive: boolean = false; // 助理按钮指引是否激活
    private assistantGuideAutoCloseTimer: Function = null; // 助理按钮指引自动关闭定时器
    
    // 助理窗口内指引相关
    private assistantUnlockGuideMask: Laya.Sprite; // 解锁指引遮挡层
    private assistantUnlockGuideTipLabel: Laya.Text; // 解锁指引提示文字
    private isAssistantUnlockGuideActive: boolean = false; // 解锁指引是否激活
    private assistantUnlockGuideAutoCloseTimer: Function = null; // 解锁指引自动关闭定时器
    
    private assistantUpgradeGuideMask: Laya.Sprite; // 升级指引遮挡层
    private assistantUpgradeGuideTipLabel: Laya.Text; // 升级指引提示文字
    private isAssistantUpgradeGuideActive: boolean = false; // 升级指引是否激活
    private assistantUpgradeGuideAutoCloseTimer: Function = null; // 升级指引自动关闭定时器
    
    // 主界面升级按钮指引相关
    private upgradeBtnGuideMask: Laya.Sprite; // 升级按钮指引遮挡层
    private upgradeBtnGuideTipLabel: Laya.Text; // 升级按钮指引提示文字
    private isUpgradeBtnGuideActive: boolean = false; // 升级按钮指引是否激活
    private upgradeBtnGuideAutoCloseTimer: Function = null; // 升级按钮指引自动关闭定时器
    
    // 挑战按钮指引相关
    private challengeBtnGuideMask: Laya.Sprite; // 挑战按钮指引遮挡层
    private challengeBtnGuideTipLabel: Laya.Text; // 挑战按钮指引提示文字
    private isChallengeBtnGuideActive: boolean = false; // 挑战按钮指引是否激活
    private challengeBtnGuideAutoCloseTimer: Function = null; // 挑战按钮指引自动关闭定时器
    
    // 挑战窗口指引相关
    private challengeWindowGuideMask: Laya.Sprite; // 挑战窗口指引遮挡层
    private challengeWindowGuideTipLabel: Laya.Text; // 挑战窗口指引提示文字
    private isChallengeWindowGuideActive: boolean = false; // 挑战窗口指引是否激活
    private challengeWindowGuideAutoCloseTimer: Function = null; // 挑战窗口指引自动关闭定时器

    onAwake() {
        console.log("onAwake called");
    }

    onEnable() {
        console.log("onEnable called");
    }

    onStart() {
        console.log("onStart called, stage size:", Laya.stage.width, Laya.stage.height);
        // 延迟一帧确保stage已初始化
        Laya.timer.frameOnce(1, this, this.showLoadingPage);
    }
    
    /**
     * 获取服务器资源URL
     * @param resourcePath 资源相对路径，如 "resources/ticket.png" 或 "resources/assist/1/head.png"
     * @returns 完整的服务器资源URL
     */
    private getServerResourceUrl(resourcePath: string): string {
        const apiBaseUrl = GameDataManager.getApiBaseUrl();
        // 确保路径以 / 开头
        const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
        return `${apiBaseUrl}${normalizedPath}`;
    }

    /**
     * 显示加载页面
     */
    private showLoadingPage(): void {
        console.log("显示加载页面");
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 创建加载页面容器
        this.loadingPage = new Laya.Sprite();
        this.loadingPage.name = "loadingPage";
        this.loadingPage.size(stageWidth, stageHeight);
        
        // 创建背景（深色背景）
        const bg = new Laya.Sprite();
        bg.name = "loadingBg";
        bg.size(stageWidth, stageHeight);
        bg.graphics.drawRect(0, 0, stageWidth, stageHeight, "#1a1a2e");
        this.loadingPage.addChild(bg);
        
        // 创建标题
        const titleLabel = new Laya.Text();
        titleLabel.name = "titleLabel";
        titleLabel.text = "加载中...";
        titleLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 32));
        titleLabel.color = "#ffffff";
        titleLabel.width = stageWidth;
        titleLabel.height = Math.max(40, stageHeight * 0.05);
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(0, stageHeight * 0.3);
        this.loadingPage.addChild(titleLabel);
        
        // 添加到舞台
        Laya.stage.addChild(this.loadingPage);
        
        // 开始检查授权和加载流程
        this.startLoadingProcess();
    }
    
    /**
     * 开始加载流程
     */
    private startLoadingProcess(): void {
        console.log("开始加载流程");
        
        // 先检查授权状态
        this.checkAuthAndLoad();
    }
    
    /**
     * 检查授权并加载
     */
    private checkAuthAndLoad(): void {
        const wx = (window as any).wx;
        
        // 检查是否在微信小游戏环境中
        if (!wx) {
            console.log("不在微信小游戏环境中，使用默认用户ID");
            this.userToken = "default_user";
            GameDataManager.setUserId("default_user");
            // 非微信环境，直接开始加载游戏（可以正常访问服务器）
            this.startGameLoading();
            return;
        }
        
        // 先尝试从本地存储加载token
        GameDataManager.loadTokenFromStorage();
        const savedToken = GameDataManager.getToken();
        if (savedToken && savedToken !== "default_user") {
            console.log("从本地存储加载token成功:", savedToken);
            this.userToken = savedToken;
            this.startGameLoading();
            return;
        }
        
        // 如果没有保存的token，进行微信登录
        console.log("开始微信登录，获取自定义登录态token");
        wx.login({
            success: (res: any) => {
                if (res.code) {
                    console.log("获取登录凭证code成功:", res.code);
                    // 将code发送到服务器，换取自定义登录态token
                    GameDataManager.wxLogin(res.code, (token: string | null) => {
                        if (token) {
                            console.log("获取token成功:", token);
                            this.userToken = token;
                            
                            if (Main.LOGIN_TEST_MODE) {
                                // 登录测试模式：暂停后续流程
                                console.log("========== 登录测试模式 ==========");
                                console.log("登录成功，Token:", token);
                                console.log("程序已暂停，不执行后续游戏加载流程");
                                console.log("====================================");
                            } else {
                                // 正常模式：开始加载游戏
                                this.startGameLoading();
                            }
                        } else {
                            console.error("获取token失败");
                            // 登录失败，显示错误弹窗，不进入游戏
                            this.showNetworkErrorDialog();
                        }
                    });
                } else {
                    console.error("获取登录凭证code失败:", res.errMsg);
                    // 登录失败，显示错误弹窗，不进入游戏
                    this.showNetworkErrorDialog();
                }
            },
            fail: (err: any) => {
                console.error("微信登录失败:", err);
                // 登录失败，显示错误弹窗，不进入游戏
                this.showNetworkErrorDialog();
            }
        });
    }
    
    
    /**
     * 开始游戏加载（显示进度条）
     */
    private startGameLoading(): void {
        console.log("开始游戏加载，用户Token:", this.userToken);
        
        // token已经在wxLogin中设置，这里不需要再次设置
        
        // 显示进度条
        this.showProgressBar();
        
        // 开始加载游戏资源
        this.loadGameResources();
    }
    
    /**
     * 显示进度条
     */
    private showProgressBar(): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 更新标题
        const titleLabel = this.loadingPage.getChildByName("titleLabel") as Laya.Text;
        if (titleLabel) {
            titleLabel.text = "加载中...";
        }
        
        // 创建进度条背景
        const progressBarWidth = Math.max(200, stageWidth * 0.6);
        const progressBarHeight = Math.max(20, stageHeight * 0.03);
        const progressBarX = (stageWidth - progressBarWidth) / 2;
        const progressBarY = stageHeight * 0.5;
        
        this.progressBar = new Laya.Sprite();
        this.progressBar.name = "progressBar";
        this.progressBar.size(progressBarWidth, progressBarHeight);
        this.progressBar.graphics.drawRect(0, 0, progressBarWidth, progressBarHeight, "#333333");
        this.progressBar.pos(progressBarX, progressBarY);
        this.loadingPage.addChild(this.progressBar);
        
        // 创建进度条填充
        this.progressBarFill = new Laya.Sprite();
        this.progressBarFill.name = "progressBarFill";
        this.progressBarFill.size(0, progressBarHeight);
        this.progressBarFill.graphics.drawRect(0, 0, progressBarWidth, progressBarHeight, "#00ff00");
        this.progressBarFill.pos(progressBarX, progressBarY);
        this.loadingPage.addChild(this.progressBarFill);
        
        // 创建进度文字
        this.progressLabel = new Laya.Text();
        this.progressLabel.name = "progressLabel";
        this.progressLabel.text = "0%";
        this.progressLabel.fontSize = Math.max(16, Math.min(stageWidth * 0.04, 20));
        this.progressLabel.color = "#ffffff";
        this.progressLabel.width = progressBarWidth;
        this.progressLabel.height = Math.max(25, stageHeight * 0.03);
        this.progressLabel.align = "center";
        this.progressLabel.valign = "middle";
        this.progressLabel.pos(progressBarX, progressBarY + progressBarHeight + 10);
        this.loadingPage.addChild(this.progressLabel);
    }
    
    /**
     * 更新加载进度
     */
    private updateProgress(progress: number): void {
        if (!this.progressBar || !this.progressBarFill) {
            return;
        }
        
        const progressBarWidth = this.progressBar.width;
        const progressValue = Math.min(100, Math.max(0, progress));
        
        // 更新进度条填充宽度
        this.progressBarFill.width = (progressBarWidth * progressValue) / 100;
        
        // 更新进度文字
        if (this.progressLabel) {
            this.progressLabel.text = Math.floor(progressValue) + "%";
        }
        
        console.log("加载进度:", Math.floor(progressValue) + "%");
    }
    
    /**
     * 加载游戏资源
     */
    private loadGameResources(): void {
        // 模拟加载步骤
        let currentProgress = 0;
        const totalSteps = 5; // 初始化数据、创建背景、创建UI、加载数据、完成
        
            // 步骤1: 初始化数据并预加载资源 (0-20%)
            this.updateProgress(0);
            Laya.timer.once(100, this, () => {
                this.initAssistants();
                this.initChallenges();
                this.calculateMultiplier();
                
                // 预加载ticket、desk和背景图片（从服务器获取）
                Laya.loader.load(this.getServerResourceUrl("resources/ticket.png"), null, null, Laya.Loader.IMAGE);
                Laya.loader.load(this.getServerResourceUrl("resources/desk.png"), null, null, Laya.Loader.IMAGE);
                Laya.loader.load(this.getServerResourceUrl("resources/back.png"), null, null, Laya.Loader.IMAGE);
                
                currentProgress = 20;
                this.updateProgress(currentProgress);
                
                // 步骤2: 创建背景 (20-40%)
                Laya.timer.once(100, this, () => {
                    this.createBackground();
                    this.createTicketContainer();
                    currentProgress = 40;
                    this.updateProgress(currentProgress);
                
                // 步骤3: 创建UI (40-60%)
                Laya.timer.once(100, this, () => {
                    this.createTopBar();
                    this.createBottomButtons();
                    this.createPopupContainer();
                    this.setupClickHandler();
                    currentProgress = 60;
                    this.updateProgress(currentProgress);
                    
                    // 步骤4: 加载用户数据 (60-90%)
                    Laya.timer.once(100, this, () => {
                        this.updateProgress(60);
                        this.loadGameData((success: boolean) => {
                            if (success) {
                                // 数据加载成功，继续加载流程
                                currentProgress = 90;
                                this.updateProgress(currentProgress);
                                
                                // 步骤5: 完成加载 (90-100%)
                                Laya.timer.once(200, this, () => {
                                    currentProgress = 100;
                                    this.updateProgress(currentProgress);
                                    
                                    // 延迟一下再进入游戏
                                    Laya.timer.once(300, this, () => {
                                        this.enterGame();
                                    });
                                });
                            } else {
                                // 数据加载失败，显示错误弹窗，不进入游戏
                                console.error("用户数据加载失败");
                                this.showNetworkErrorDialog();
                            }
                        });
                    });
                });
            });
        });
    }
    
    /**
     * 显示网络错误弹窗
     * @param isUploadError 是否为上传数据时的错误（true: 上传错误，使用新的重试逻辑；false: 登录/加载错误，使用原来的逻辑）
     */
    private showNetworkErrorDialog(isUploadError: boolean = false): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 检查是否已经存在弹窗，如果存在则先移除
        const existingDialog = Laya.stage.getChildByName("networkErrorDialog");
        if (existingDialog) {
            existingDialog.removeSelf();
        }
        
        // 创建弹窗容器
        const dialog = new Laya.Sprite();
        dialog.name = "networkErrorDialog";
        dialog.size(stageWidth, stageHeight);
        
        // 创建半透明背景遮罩
        const mask = new Laya.Sprite();
        mask.name = "mask";
        mask.size(stageWidth, stageHeight);
        mask.graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        mask.alpha = 0.5;
        mask.mouseEnabled = true;
        dialog.addChild(mask);
        
        // 弹窗尺寸（手机端适配）
        const dialogWidth = Math.max(280, Math.min(stageWidth * 0.8, 400));
        const dialogHeight = Math.max(180, Math.min(stageHeight * 0.25, 250));
        const fontSize = Math.max(16, Math.min(stageWidth * 0.04, 24));
        const buttonFontSize = Math.max(14, Math.min(stageWidth * 0.035, 20));
        
        // 创建弹窗背景
        const dialogBg = new Laya.Sprite();
        dialogBg.name = "dialogBg";
        dialogBg.size(dialogWidth, dialogHeight);
        dialogBg.graphics.drawRect(0, 0, dialogWidth, dialogHeight, "#ffffff");
        dialogBg.graphics.drawRect(2, 2, dialogWidth - 4, dialogHeight - 4, "#333333", "#333333", 2);
        dialogBg.pos((stageWidth - dialogWidth) / 2, (stageHeight - dialogHeight) / 2);
        dialog.addChild(dialogBg);
        
        // 创建错误信息文本
        const errorLabel = new Laya.Text();
        errorLabel.name = "errorLabel";
        errorLabel.text = "网络错误，请稍后重试";
        errorLabel.fontSize = fontSize;
        errorLabel.color = "#ff3333";
        errorLabel.width = dialogWidth;
        errorLabel.height = fontSize * 2;
        errorLabel.align = "center";
        errorLabel.valign = "middle";
        errorLabel.pos(0, fontSize * 1.5);
        errorLabel.mouseEnabled = false;
        dialogBg.addChild(errorLabel);
        
        // 创建重试按钮
        const retryBtn = new Laya.Sprite();
        retryBtn.name = "retryBtn";
        const retryBtnWidth = dialogWidth - fontSize * 2;
        const retryBtnHeight = fontSize * 2;
        retryBtn.size(retryBtnWidth, retryBtnHeight);
        retryBtn.graphics.drawRect(0, 0, retryBtnWidth, retryBtnHeight, "#4CAF50");
        retryBtn.graphics.drawRect(2, 2, retryBtnWidth - 4, retryBtnHeight - 4, "#45a049", "#45a049", 2);
        retryBtn.pos(fontSize, dialogHeight - fontSize * 3);
        
        const retryLabel = new Laya.Text();
        retryLabel.name = "retryLabel";
        retryLabel.text = "重试";
        retryLabel.fontSize = buttonFontSize;
        retryLabel.color = "#ffffff";
        retryLabel.width = retryBtnWidth;
        retryLabel.height = retryBtnHeight;
        retryLabel.align = "center";
        retryLabel.valign = "middle";
        retryLabel.mouseEnabled = false;
        retryBtn.addChild(retryLabel);
        
        retryBtn.mouseEnabled = true;
        retryBtn.on(Laya.Event.CLICK, this, () => {
            if (isUploadError) {
                // 上传错误：不关闭弹窗，开始重试
                GameDataManager.startRetry();
            } else {
                // 登录/加载错误：关闭弹窗，使用原来的逻辑
                dialog.removeSelf();
                this.onRetryLoadData();
            }
        });
        dialogBg.addChild(retryBtn);
        
        // 只有上传错误时才保存弹窗和按钮引用，用于更新
        if (isUploadError) {
            (this as any).networkErrorDialog = dialog;
            (this as any).networkErrorRetryBtn = retryBtn;
            (this as any).networkErrorRetryLabel = retryLabel;
        }
        
        // 直接添加到舞台（不依赖loadingPage）
        Laya.stage.addChild(dialog);
    }
    
    /**
     * 更新重试按钮状态
     */
    private updateRetryButton(text: string, enabled: boolean): void {
        const retryBtn = (this as any).networkErrorRetryBtn as Laya.Sprite;
        const retryLabel = (this as any).networkErrorRetryLabel as Laya.Text;
        
        if (retryBtn && retryLabel) {
            retryLabel.text = text;
            retryBtn.mouseEnabled = enabled;
            
            // 根据状态改变按钮颜色
            if (enabled) {
                // 可点击：绿色
                retryBtn.graphics.clear();
                const retryBtnWidth = retryBtn.width;
                const retryBtnHeight = retryBtn.height;
                retryBtn.graphics.drawRect(0, 0, retryBtnWidth, retryBtnHeight, "#4CAF50");
                retryBtn.graphics.drawRect(2, 2, retryBtnWidth - 4, retryBtnHeight - 4, "#45a049", "#45a049", 2);
            } else {
                // 不可点击：灰色
                retryBtn.graphics.clear();
                const retryBtnWidth = retryBtn.width;
                const retryBtnHeight = retryBtn.height;
                retryBtn.graphics.drawRect(0, 0, retryBtnWidth, retryBtnHeight, "#cccccc");
                retryBtn.graphics.drawRect(2, 2, retryBtnWidth - 4, retryBtnHeight - 4, "#999999", "#999999", 2);
            }
        }
    }
    
    /**
     * 关闭重试弹窗
     */
    private closeRetryDialog(): void {
        const dialog = (this as any).networkErrorDialog as Laya.Sprite;
        if (dialog) {
            dialog.removeSelf();
            (this as any).networkErrorDialog = null;
            (this as any).networkErrorRetryBtn = null;
            (this as any).networkErrorRetryLabel = null;
        }
    }
    
    /**
     * 重试加载数据
     */
    private onRetryLoadData(): void {
        // 移除错误弹窗
        const dialog = this.loadingPage.getChildByName("networkErrorDialog");
        if (dialog) {
            dialog.removeSelf();
        }
        
        // 更新进度提示
        if (this.progressLabel) {
            this.progressLabel.text = "正在重试...";
        }
        
        // 更新标题
        const titleLabel = this.loadingPage.getChildByName("titleLabel") as Laya.Text;
        if (titleLabel) {
            titleLabel.text = "加载中...";
        }
        
        // 检查是否已经开始了游戏加载流程
        // 如果还没有开始，说明是登录失败，需要重新登录
        if (!this.progressBar) {
            // 重新开始登录流程
            this.checkAuthAndLoad();
        } else {
            // 已经开始了游戏加载流程，重新加载数据
            this.updateProgress(60);
            this.loadGameData((success: boolean) => {
                if (success) {
                    // 数据加载成功，继续加载流程
                    let currentProgress = 90;
                    this.updateProgress(currentProgress);
                    
                    Laya.timer.once(200, this, () => {
                        currentProgress = 100;
                        this.updateProgress(currentProgress);
                        
                        Laya.timer.once(300, this, () => {
                            this.enterGame();
                        });
                    });
                } else {
                    // 重试失败，再次显示错误弹窗
                    console.error("数据加载重试失败");
                    this.showNetworkErrorDialog();
                }
            });
        }
    }
    
    /**
     * 进入游戏（隐藏加载页面，显示主游戏界面）
     */
    private enterGame(): void {
        console.log("进入游戏主界面");
        
        // 根据服务端数据判断是否需要播放初始化视频
        // 条件：等级为1，金币数为0，第一个助理也没有解锁
        const shouldPlayInitVideo = this.playerLevel === 1 && 
                                     this.money === 0 && 
                                     this.assistants.length > 0 && 
                                     !this.assistants[0].unlocked;
        
        if (shouldPlayInitVideo) {
            // 新用户，播放初始化视频
            console.log("检测到新用户（等级0，金币0，第一个助理未解锁），播放初始化视频");
            this.playInitVideo(() => {
                // 视频播放完成后，继续进入游戏
                this.continueEnterGame();
            });
        } else {
            // 非新用户，直接进入游戏
            console.log("非新用户，跳过初始化视频播放", {
                playerLevel: this.playerLevel,
                money: this.money,
                firstAssistantUnlocked: this.assistants.length > 0 ? this.assistants[0].unlocked : false
            });
            this.continueEnterGame();
        }
    }
    
    /**
     * 继续进入游戏（实际的进入游戏逻辑）
     */
    private continueEnterGame(): void {
        // 启动助理收益定时器
        this.startAssistantTimer();
        
        // 隐藏加载页面
        if (this.loadingPage) {
            Laya.Tween.to(this.loadingPage, { alpha: 0 }, 300, null, Laya.Handler.create(this, () => {
                if (this.loadingPage) {
                    this.loadingPage.removeSelf();
                    this.loadingPage = null;
                }
                
                // 检查是否需要显示新手指引
                this.checkAndShowNewbieGuide();
            }));
        } else {
            // 如果没有加载页面，直接检查新手指引
            this.checkAndShowNewbieGuide();
        }
    }
    
    /**
     * 检查并显示新手指引
     * 条件：用户等级为1，金币数为0，助理1号未解锁
     */
    private checkAndShowNewbieGuide(): void {
        const shouldShowGuide = this.playerLevel === 1 && 
                                this.money === 0 && 
                                this.assistants.length > 0 && 
                                !this.assistants[0].unlocked;
        
        if (shouldShowGuide) {
            console.log("检测到新用户，显示新手指引");
            this.showNewbieGuide();
        } else {
            console.log("不满足新手指引条件", {
                playerLevel: this.playerLevel,
                money: this.money,
                firstAssistantUnlocked: this.assistants.length > 0 ? this.assistants[0].unlocked : false
            });
        }
    }
    
    /**
     * 显示新手指引
     */
    private showNewbieGuide(): void {
        if (this.isNewbieGuideActive) {
            return; // 已经显示，不重复显示
        }
        
        this.isNewbieGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 创建全屏遮挡层（半透明黑色）
        this.newbieGuideMask = new Laya.Sprite();
        this.newbieGuideMask.name = "newbieGuideMask";
        this.newbieGuideMask.size(stageWidth, stageHeight);
        this.newbieGuideMask.pos(0, 0);
        
        // 计算中间可点击区域（屏幕中心，大约占屏幕的30%）
        const clickAreaSize = Math.min(stageWidth, stageHeight) * 0.3;
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;
        const clickAreaX = centerX - clickAreaSize / 2;
        const clickAreaY = centerY - clickAreaSize / 2;
        
        // 绘制遮挡层：绘制4个矩形（上下左右）来形成遮挡，中间留空
        const graphics = this.newbieGuideMask.graphics;
        graphics.clear();
        
        // 绘制上方遮挡
        graphics.drawRect(0, 0, stageWidth, clickAreaY, "#000000");
        // 绘制下方遮挡
        graphics.drawRect(0, clickAreaY + clickAreaSize, stageWidth, stageHeight - (clickAreaY + clickAreaSize), "#000000");
        // 绘制左侧遮挡
        graphics.drawRect(0, clickAreaY, clickAreaX, clickAreaSize, "#000000");
        // 绘制右侧遮挡
        graphics.drawRect(clickAreaX + clickAreaSize, clickAreaY, stageWidth - (clickAreaX + clickAreaSize), clickAreaSize, "#000000");
        
        this.newbieGuideMask.alpha = 0.7; // 70%透明度
        this.newbieGuideMask.mouseEnabled = true;
        this.newbieGuideMask.mouseThrough = false;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.newbieGuideMask);
        Laya.stage.setChildIndex(this.newbieGuideMask, Laya.stage.numChildren - 1);
        
        // 创建中间可点击区域（透明，用于接收点击事件）
        this.newbieGuideClickArea = new Laya.Sprite();
        this.newbieGuideClickArea.name = "newbieGuideClickArea";
        this.newbieGuideClickArea.size(clickAreaSize, clickAreaSize);
        this.newbieGuideClickArea.pos(clickAreaX, clickAreaY);
        this.newbieGuideClickArea.mouseEnabled = true;
        this.newbieGuideClickArea.mouseThrough = false;
        
        // 注意：点击事件在setupClickHandler中统一处理，这里不需要单独添加
        
        // 添加到stage，在遮挡层上方
        Laya.stage.addChild(this.newbieGuideClickArea);
        Laya.stage.setChildIndex(this.newbieGuideClickArea, Laya.stage.numChildren - 1);
        
        // 创建提示文字（显示在屏幕上方）
        this.newbieGuideTipLabel = new Laya.Text();
        this.newbieGuideTipLabel.name = "newbieGuideTipLabel";
        this.newbieGuideTipLabel.text = "点击屏幕收取门票，获得收益";
        this.newbieGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.newbieGuideTipLabel.color = "#000000";
        this.newbieGuideTipLabel.width = stageWidth;
        this.newbieGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.newbieGuideTipLabel.align = "center";
        this.newbieGuideTipLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部15%
        this.newbieGuideTipLabel.pos(0, stageHeight * 0.15);
        this.newbieGuideTipLabel.mouseEnabled = false;
        this.newbieGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.newbieGuideTipLabel);
        Laya.stage.setChildIndex(this.newbieGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器（避免指引出错）
        this.newbieGuideAutoCloseTimer = () => {
            console.log("新手指引2秒自动关闭定时器触发");
            this.hideNewbieGuide();
        };
        Laya.timer.once(2000, this, this.newbieGuideAutoCloseTimer);
        
        console.log("新手指引已显示，将在2秒后自动关闭或金币达到1500时关闭");
    }
    
    /**
     * 检查新手指引关闭条件（金币达到1500）
     */
    private checkNewbieGuideCloseCondition(): void {
        if (!this.isNewbieGuideActive) {
            return;
        }
        
        // 如果金币达到1500，关闭指引
        if (this.money >= 1500) {
            console.log("金币达到1500，关闭新手指引");
            this.hideNewbieGuide();
        }
    }
    
    /**
     * 隐藏新手指引
     */
    private hideNewbieGuide(): void {
        if (!this.isNewbieGuideActive) {
            return;
        }
        
        this.isNewbieGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.newbieGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.newbieGuideAutoCloseTimer);
            this.newbieGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.newbieGuideMask) {
            this.newbieGuideMask.removeSelf();
            this.newbieGuideMask = null;
        }
        
        // 移除可点击区域
        if (this.newbieGuideClickArea) {
            this.newbieGuideClickArea.removeSelf();
            this.newbieGuideClickArea = null;
        }
        
        // 移除提示文字
        if (this.newbieGuideTipLabel) {
            this.newbieGuideTipLabel.removeSelf();
            this.newbieGuideTipLabel = null;
        }
        
        console.log("新手指引已隐藏");
    }
    
    /**
     * 播放初始化视频
     * @param onComplete 播放完成回调
     */
    private playInitVideo(onComplete: () => void): void {
        const wx = (window as any).wx;
        
        // 检查是否在微信小游戏环境中
        if (!wx || !wx.createVideo) {
            console.log("不在微信小游戏环境中或不支持视频播放，跳过初始化视频，直接进入主页面");
            // 如果不在微信小游戏环境，直接执行完成回调
            if (onComplete) {
                onComplete();
            }
            return;
        }
        
        // 获取窗口信息
        const windowInfo = wx.getWindowInfo();
        const { windowWidth, windowHeight } = windowInfo;
        
        // 构建视频路径
        const apiBaseUrl = GameDataManager.getApiBaseUrl();
        const videoPath = `${apiBaseUrl}/resources/init.mp4`;
        
        console.log("开始播放初始化视频，视频路径:", videoPath);
        
        // 创建视频对象（全屏播放）
        const video = wx.createVideo({
            src: videoPath,
            width: windowWidth,
            height: windowHeight,
            loop: false, // 不循环播放
            controls: false, // 不显示控制条
            showProgress: false, // 不显示进度条
            showProgressInControlMode: false,
            autoplay: true, // 自动播放
            showCenterPlayBtn: false, // 不显示中心播放按钮
            underGameView: false, // 放在游戏画布之上渲染，确保可见
            enableProgressGesture: false, // 禁用进度手势
            objectFit: "contain" // 保持宽高比
        });
        
        // 标记视频是否正常播放
        let videoPlayed = false;
        
        // 监听视频播放开始事件（确认视频正常加载）
        video.onPlay(() => {
            console.log("初始化视频开始播放");
            videoPlayed = true;
        });
        
        // 监听视频播放结束事件
        video.onEnded(() => {
            console.log("初始化视频播放结束");
            // 视频播放完成后，销毁视频并执行完成回调
            video.destroy();
            if (onComplete) {
                onComplete();
            }
        });
        
        // 监听视频播放错误
        video.onError((res: any) => {
            console.error("初始化视频播放失败，错误信息:", res);
            // 播放失败时，销毁视频并执行完成回调（继续进入游戏）
            video.destroy();
            if (onComplete) {
                onComplete();
            }
        });
        
        // 设置超时检测：如果3秒内视频没有开始播放，则认为播放失败
        Laya.timer.once(3000, this, () => {
            if (!videoPlayed) {
                console.warn("初始化视频3秒内未开始播放，视为播放失败，直接进入主页面");
                video.destroy();
                if (onComplete) {
                    onComplete();
                }
            }
        });
        
        // 开始播放视频
        video.play();
    }
    
    /**
     * 创建游戏界面
     */
    private createUI(): void {
        console.log("创建UI, stage size:", Laya.stage.width, Laya.stage.height);
        console.log("owner:", this.owner);
        
        // 初始化助理数据
        this.initAssistants();
        
        // 初始化挑战数据
        this.initChallenges();
        
        // 初始化倍率
        this.calculateMultiplier();
        
        // 创建背景
        this.createBackground();
        
        // 创建Ticket容器
        this.createTicketContainer();
        
        // 创建顶部玩家信息
        this.createTopBar();
        
        // 创建底部按钮
        this.createBottomButtons();
        
        // 创建弹窗容器
        this.createPopupContainer();
        
        // 添加点击事件监听（点击非按钮区域增加金钱）
        this.setupClickHandler();
        
        // 注意：不在这里加载数据和启动定时器
        // 数据加载在 loadGameResources 的步骤4中统一处理
        // 定时器在 enterGame() 中启动，确保只有数据加载成功后才启动
    }
    
    /**
     * 初始化助理数据
     */
    private initAssistants(): void {
        // 第一个助理解锁需要1000金币，后续每个助理解锁所需金币为前一个的10倍
        const assistantNames = ["1号", "2号", "3号", "4号", "5号", "6号", "7号", "8号", "9号", "10号"]; // 10个助理
        let unlockCost = 1000; // 第一个助理解锁费用
        
        for (let i = 0; i < assistantNames.length; i++) {
            this.assistants.push({
                id: i + 1,
                name: assistantNames[i],
                unlocked: false,
                level: 0,
                unlockCost: unlockCost
            });
            unlockCost *= 10; // 下一个助理解锁费用是前一个的10倍
        }
        
        console.log("初始化助理数据，共", this.assistants.length, "个助理");
    }
    
    /**
     * 初始化挑战数据
     */
    private initChallenges(): void {
        // 根据图片描述初始化挑战数据
        this.challenges = [
            {
                id: 1,
                name: "1号",
                requiredPower: 500, // 点击收益500/次
                reward: 50000, // 首次挑战成功奖励5.00万
                completed: false,
                isBoss: false
            },
            {
                id: 2,
                name: "2号",
                requiredPower: 3000, // 点击收益3000/次
                reward: 200000, // 首次挑战成功奖励20.0万
                completed: false,
                isBoss: false
            },
            {
                id: 3,
                name: "3号",
                requiredPower: 60000, // 点击收益6.00万/次
                reward: 3000000, // 首次挑战成功奖励300万
                completed: false,
                isBoss: false
            },
            {
                id: 4,
                name: "4号",
                requiredPower: 500000, // 点击收益50.0万/次
                reward: 20000000, // 首次挑战成功奖励2000万
                completed: false,
                isBoss: false
            },
            {
                id: 5,
                name: "5号",
                requiredPower: 5000000, // 点击收益500万/次
                reward: 200000000, // 首次挑战成功奖励2.00亿
                completed: false,
                isBoss: false
            },
            {
                id: 6,
                name: "6号",
                requiredPower: 50000000, // 点击收益5000万/次
                reward: 2000000000, // 首次挑战成功奖励20.0亿
                completed: false,
                isBoss: false
            },
            {
                id: 7,
                name: "7号",
                requiredPower: 500000000, // 点击收益5.00亿/次
                reward: 20000000000, // 首次挑战成功奖励200亿
                completed: false,
                isBoss: false
            },
            {
                id: 8,
                name: "8号",
                requiredPower: 5000000000, // 点击收益50.0亿/次
                reward: 200000000000, // 首次挑战成功奖励2000亿
                completed: false,
                isBoss: false
            },
            {
                id: 9,
                name: "9号",
                requiredPower: 50000000000, // 点击收益500亿/次
                reward: 2000000000000, // 首次挑战成功奖励2.00兆
                completed: false,
                isBoss: false
            },
            {
                id: 10,
                name: "10号",
                requiredPower: 500000000000, // 点击收益5000亿/次
                reward: 20000000000000, // 首次挑战成功奖励20.0兆
                completed: false,
                isBoss: false
            }
        ];
        
        console.log("初始化挑战数据，共", this.challenges.length, "个挑战");
    }
    
    /**
     * 启动助理收益定时器
     */
    private startAssistantTimer(): void {
        // 每秒执行一次，计算所有已解锁助理的收益并增加金币
        this.assistantTimerHandler = this.updateAssistantEarnings;
        Laya.timer.loop(1000, this, this.assistantTimerHandler);
    }
    
    /**
     * 更新助理收益（每秒调用一次）
     */
    private updateAssistantEarnings(): void {
        let totalEarnings = 0;
        
        // 遍历所有已解锁的助理，计算总收益
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level > 0) {
                // n级助理每秒可提供解锁所需金币的0.0n倍的金币（即解锁所需金币 * n / 100）
                const earnings = Math.floor(assistant.unlockCost * assistant.level / 100);
                totalEarnings += earnings;
            }
        }
        
        // 如果有收益，乘以培训倍率（2的n次方）后增加金币并更新显示
        if (totalEarnings > 0) {
            const trainingMultiplier = Math.pow(2, this.trainingCount);
            const finalEarnings = totalEarnings * trainingMultiplier;
            this.money += finalEarnings;
            this.updateMoneyDisplay();
            this.updatePerSecondDisplay(); // 更新秒赚显示
            // 在金币下方显示收益弹窗
            this.showPopup("+" + this.formatMoney(finalEarnings) + "/秒", "money", "#00ff00");
            console.log("助理收益:", finalEarnings, "当前总金币:", this.money);
            // 数据会通过定时保存自动保存，无需手动调用
        }
    }

    /**
     * 创建背景
     */
    private createBackground(): void {
        // 创建背景Sprite
        const bg = new Laya.Sprite();
        bg.name = "background";
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        bg.size(stageWidth, stageHeight);
        
        // 加载背景图片（从服务器获取）
        const bgImagePath = this.getServerResourceUrl("resources/back.png");
        const cachedTexture = Laya.loader.getRes(bgImagePath);
        
        if (cachedTexture) {
            // 如果图片已加载，直接使用
            bg.graphics.clear();
            bg.graphics.drawTexture(cachedTexture, 0, 0, stageWidth, stageHeight);
            Laya.stage.addChild(bg);
            console.log("背景图片已加载，直接使用");
        } else {
            // 如果图片未加载，先加载再使用
            Laya.loader.load(bgImagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (texture) {
                    bg.graphics.clear();
                    bg.graphics.drawTexture(texture, 0, 0, stageWidth, stageHeight);
                    console.log("背景图片加载成功");
                } else {
                    // 如果加载失败，使用默认背景色
                    bg.graphics.clear();
                    bg.graphics.drawRect(0, 0, stageWidth, stageHeight, "#1a1a2e");
                    console.log("背景图片加载失败，使用默认背景色");
                }
            }), null, Laya.Loader.IMAGE);
            Laya.stage.addChild(bg);
        }
    }

    /**
     * 创建Ticket容器（用于管理ticket动画，层级在背景上面，其他按钮下面）
     */
    private createTicketContainer(): void {
        const ticketContainer = new Laya.Sprite();
        ticketContainer.name = "ticketContainer";
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        ticketContainer.size(stageWidth, stageHeight);
        ticketContainer.pos(0, 0);
        // 设置为不可点击，避免阻挡其他UI的点击事件
        ticketContainer.mouseEnabled = false;
        ticketContainer.mouseThrough = true;
        // 添加到舞台，确保在背景之后、其他UI之前（通过addChild顺序控制层级）
        Laya.stage.addChild(ticketContainer);
        this.ticketContainer = ticketContainer;
        
        // 创建桌子（在ticket下方，保持不动）
        this.createDesk();
        
        console.log("Ticket容器创建完成");
    }

    /**
     * 创建桌子（居中显示，保持原始比例）
     */
    private createDesk(): void {
        if (!this.ticketContainer) {
            console.warn("Ticket容器未创建，无法创建桌子");
            return;
        }

        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        const deskImagePath = this.getServerResourceUrl("resources/desk.png");

        // 创建桌子精灵
        const deskSprite = new Laya.Sprite();
        deskSprite.name = "deskSprite";
        
        // 加载桌子图片（从服务器获取）
        Laya.loader.load(deskImagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
            if (!texture) {
                console.error("加载desk图片失败");
                return;
            }

            // 设置图片
            deskSprite.graphics.clear();
            deskSprite.graphics.drawTexture(texture, 0, 0);
            
            // 使用图片原始尺寸
            const deskWidth = texture.width;
            const deskHeight = texture.height;
            deskSprite.size(deskWidth, deskHeight);
            
            // 水平居中，垂直位置在屏幕下方（只显示上半部分）
            const deskX = (stageWidth - deskWidth) / 2;
            const deskY = stageHeight - deskHeight / 3; // 只显示一半，下半部分在屏幕外
            deskSprite.pos(deskX, deskY);
            
            // 设置为不可点击
            deskSprite.mouseEnabled = false;
            deskSprite.mouseThrough = true;

            // 添加到容器
            this.ticketContainer.addChild(deskSprite);

            console.log("桌子创建完成，位置:", deskX, deskY, "尺寸:", deskWidth, "x", deskHeight, "（只显示上半部分）");
            
            // 桌子创建完成后，更新助理after图片显示
            Laya.timer.frameOnce(1, this, () => {
                this.updateAssistantAfterImage();
            });
        }), null, Laya.Loader.IMAGE);
    }

    /**
     * 显示Ticket滑动动画（从左滑到右消失）
     */
    private showTicketAnimation(): void {
        if (!this.ticketContainer) {
            console.warn("Ticket容器未创建，无法显示动画");
            return;
        }

        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        const ticketImagePath = this.getServerResourceUrl("resources/ticket.png");

        // 创建ticket图片精灵
        const ticketSprite = new Laya.Sprite();
        ticketSprite.name = "ticketSprite_" + Date.now();
        
        // 尝试从缓存获取图片，如果没有则加载
        const cachedTexture = Laya.loader.getRes(ticketImagePath);
        if (cachedTexture) {
            // 图片已缓存，直接使用
            this.createTicketSprite(ticketSprite, cachedTexture, stageWidth, stageHeight);
        } else {
            // 图片未缓存，先加载（从服务器获取）
            Laya.loader.load(ticketImagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (!texture) {
                    console.error("加载ticket图片失败");
                    return;
                }
                this.createTicketSprite(ticketSprite, texture, stageWidth, stageHeight);
            }), null, Laya.Loader.IMAGE);
        }
    }

    /**
     * 创建并显示Ticket精灵动画（保持原始比例，居中显示）
     * @param ticketSprite Ticket精灵
     * @param texture 图片纹理
     * @param stageWidth 舞台宽度
     * @param stageHeight 舞台高度
     */
    private createTicketSprite(ticketSprite: Laya.Sprite, texture: Laya.Texture, stageWidth: number, stageHeight: number): void {
        // 设置图片
        ticketSprite.graphics.clear();
        ticketSprite.graphics.drawTexture(texture, 0, 0);
        
        // 使用图片原始尺寸
        const ticketWidth = texture.width;
        const ticketHeight = texture.height;
        ticketSprite.size(ticketWidth, ticketHeight);
        
        // 设置为不可点击
        ticketSprite.mouseEnabled = false;
        ticketSprite.mouseThrough = true;

        // 初始位置：屏幕左侧外，垂直位置在屏幕下方（刚好显示）
        const startX = -ticketWidth;
        const startY = stageHeight - ticketHeight*1.3; // 刚好显示在屏幕下方
        ticketSprite.pos(startX, startY);

        // 添加到容器
        this.ticketContainer.addChild(ticketSprite);

        // 目标位置：屏幕右侧外，保持相同的Y坐标
        const endX = stageWidth;
        const endY = startY;

        // 动画时长（毫秒）
        const duration = 1000; // 1秒

        // 使用Tween动画
        Laya.Tween.to(ticketSprite, {
            x: endX,
            y: endY
        }, duration, Laya.Ease.linearIn, Laya.Handler.create(this, () => {
            // 动画完成后移除精灵
            if (ticketSprite && ticketSprite.parent) {
                ticketSprite.removeSelf();
            }
            console.log("Ticket动画完成并移除");
        }));

        console.log("Ticket动画开始，从左滑到右，尺寸:", ticketWidth, "x", ticketHeight);
    }

    /**
     * 创建顶部玩家信息栏（手机端适配）
     */
    private createTopBar(): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        const topBar = new Laya.Sprite();
        topBar.name = "topBar";
        topBar.pos(0, 0);
        // 直接添加到stage
        Laya.stage.addChild(topBar);

        // 手机端适配：使用屏幕百分比
        // 考虑摄像头区域，顶部增加安全区域（约5%或最小40像素）
        const topSafeArea = Math.max(40, stageHeight * 0.05);
        const margin = stageWidth * 0.03; // 3%边距
        const avatarSize = Math.max(60, Math.min(stageWidth * 0.12, 80)); // 头像大小：屏幕宽度12%，最小60，最大80
        const avatarX = margin;
        const avatarY = topSafeArea; // 从安全区域开始

        // 玩家头像背景
        const avatarBg = new Laya.Sprite();
        avatarBg.name = "avatarBg";
        avatarBg.size(avatarSize, avatarSize);
        avatarBg.graphics.drawRect(0, 0, avatarSize, avatarSize, "#4a4a6a");
        const borderWidth = Math.max(1, avatarSize * 0.025);
        avatarBg.graphics.drawRect(borderWidth, borderWidth, avatarSize - borderWidth * 2, avatarSize - borderWidth * 2, "#2a2a4a");
        avatarBg.pos(avatarX, avatarY);
        topBar.addChild(avatarBg);

        // 玩家头像（优先使用用户头像URL，如果不存在则使用默认图片或颜色块）
        this.avatarImg = new Laya.Sprite();
        this.avatarImg.name = "avatarImg";
        const avatarInnerSize = avatarSize * 0.875; // 头像内部大小
        this.avatarImg.size(avatarInnerSize, avatarInnerSize);
        
        // 加载用户头像
        this.loadUserAvatar(avatarInnerSize);
        
        this.avatarImg.pos(avatarX + (avatarSize - avatarInnerSize) / 2, avatarY + (avatarSize - avatarInnerSize) / 2);
        this.avatarImg.mouseEnabled = true;
        this.avatarImg.mouseThrough = false;
        // 添加点击事件：打开设置窗口，并阻止事件冒泡
        this.avatarImg.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            e.stopPropagation();
            this.onAvatarClick();
        });
        topBar.addChild(this.avatarImg);

        // 玩家名称和等级位置（头像右侧）
        const nameX = avatarX + avatarSize + margin;
        const nameY = avatarY;
        const fontSize = Math.max(16, Math.min(stageWidth * 0.04, 24)); // 字体大小：屏幕宽度4%，最小16，最大24

        // 玩家名称
        this.nameLabel = new Laya.Text();
        this.nameLabel.name = "nameLabel";
        this.nameLabel.text = "无名之辈";
        this.nameLabel.fontSize = fontSize;
        this.nameLabel.color = "#ffffff";
        this.nameLabel.pos(nameX, nameY);
        topBar.addChild(this.nameLabel);

        // 等级标签
        this.levelLabel = new Laya.Text();
        this.levelLabel.name = "levelLabel";
        this.levelLabel.text = this.playerLevel + "级";
        this.levelLabel.fontSize = Math.floor(fontSize * 0.9); // 等级字体稍小
        this.levelLabel.color = "#ffd700";
        this.levelLabel.pos(nameX, nameY + fontSize * 1.2);
        topBar.addChild(this.levelLabel);

        // 倍率显示（在屏幕中央，往下移避免和等级重合）
        const moneyIconSize = Math.max(16, Math.min(stageWidth * 0.04, 24)); // 金钱图标大小（提前定义，倍率和金钱都要用）
        const multiplierLabelBgWidth = Math.max(150, stageWidth * 0.35); // 倍率背景宽度（需要更宽以显示总收益格式）
        const multiplierLabelBgHeight = Math.max(20, fontSize * 1.2);
        const multiplierX = (stageWidth - multiplierLabelBgWidth) / 2; // 屏幕中央
        // 往下移，避免和等级重合（等级在nameY + fontSize * 1.2，点击收益应该在等级下方）
        const multiplierY = nameY + fontSize * 1.2 + Math.max(25, fontSize * 1.5); // 等级下方，增加间距
        
        // 删除总收益背景，只保留文字
        // this.multiplierLabelBg 已删除
        
        this.multiplierLabel = new Laya.Text();
        this.multiplierLabel.name = "multiplierLabel";
        // 初始显示总收益格式
        this.updateMultiplierDisplay();
        this.multiplierLabel.fontSize = fontSize;
        this.multiplierLabel.color = "#ffd700"; // 金色
        this.multiplierLabel.width = multiplierLabelBgWidth;
        this.multiplierLabel.height = multiplierLabelBgHeight;
        this.multiplierLabel.align = "center";
        this.multiplierLabel.valign = "middle";
        this.multiplierLabel.pos(multiplierX, multiplierY);
        topBar.addChild(this.multiplierLabel);
        
        // 秒赚显示（在点击收益下方，增加间距）
        const perSecondLabelBgWidth = multiplierLabelBgWidth;
        const perSecondLabelBgHeight = Math.max(20, fontSize * 1.2);
        const perSecondY = multiplierY + multiplierLabelBgHeight + Math.max(8, fontSize * 0.3); // 增加间距
        
        // 删除总秒赚背景，只保留文字
        // this.perSecondLabelBg 已删除
        
        this.perSecondLabel = new Laya.Text();
        this.perSecondLabel.name = "perSecondLabel";
        this.updatePerSecondDisplay();
        this.perSecondLabel.fontSize = fontSize;
        this.perSecondLabel.color = "#ffd700"; // 金色
        this.perSecondLabel.width = perSecondLabelBgWidth;
        this.perSecondLabel.height = perSecondLabelBgHeight;
        this.perSecondLabel.align = "center";
        this.perSecondLabel.valign = "middle";
        this.perSecondLabel.pos(multiplierX, perSecondY);
        topBar.addChild(this.perSecondLabel);
        
        // 金钱显示（在右侧）
        const moneyX = stageWidth * 0.65; // 从屏幕65%位置开始（右侧）
        const moneyY = avatarY + (avatarSize - moneyIconSize) / 2;

        // 金钱图标（使用简单的矩形代替，可以替换为图片）
        const moneyIcon = new Laya.Sprite();
        moneyIcon.name = "moneyIcon";
        moneyIcon.size(moneyIconSize, moneyIconSize);
        moneyIcon.graphics.drawRect(0, 0, moneyIconSize, moneyIconSize, "#ffd700");
        moneyIcon.pos(moneyX, moneyY);
        topBar.addChild(moneyIcon);

        // 删除金钱文字背景，只保留文字
        // this.moneyLabelBg 已删除

        // 金钱文字
        const moneyLabelBgWidth = Math.max(80, stageWidth * 0.2); // 背景宽度：屏幕20%，最小80（用于计算位置）
        const moneyLabelBgHeight = Math.max(20, fontSize * 1.2);
        this.moneyLabel = new Laya.Text();
        this.moneyLabel.name = "moneyLabel";
        this.moneyLabel.text = this.formatMoney(this.money);
        this.moneyLabel.fontSize = fontSize;
        this.moneyLabel.color = "#ffd700"; // 金色
        this.moneyLabel.width = moneyLabelBgWidth;
        this.moneyLabel.height = moneyLabelBgHeight;
        this.moneyLabel.align = "left";
        this.moneyLabel.valign = "middle";
        this.moneyLabel.pos(moneyX + moneyIconSize + margin * 0.5, moneyY);
        topBar.addChild(this.moneyLabel);
    }

    /**
     * 创建底部按钮（手机端适配）
     */
    private createBottomButtons(): void {
        const stageHeight = Laya.stage.height || 1334;
        const stageWidth = Laya.stage.width || 750;
        
        // 如果已存在，先移除
        if (this.bottomBar) {
            this.bottomBar.removeSelf();
            this.bottomBar = null;
        }
        
        this.bottomBar = new Laya.Sprite();
        this.bottomBar.name = "bottomBar";
        // 直接添加到stage
        Laya.stage.addChild(this.bottomBar);

        // 手机端适配：按钮大小和位置
        const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80)); // 按钮高度：屏幕8%，最小60，最大80
        const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120)); // 按钮宽度：屏幕25%，最小80，最大120
        const btnSpacing = Math.max(10, stageWidth * 0.02); // 按钮间距：屏幕2%，最小10
        const bottomMargin = Math.max(20, stageHeight * 0.03); // 底部边距：屏幕3%，最小20
        const btnY = stageHeight - btnHeight - bottomMargin;
        
        // 三个按钮总宽度
        const totalWidth = btnWidth * 3 + btnSpacing * 2;
        const startX = (stageWidth - totalWidth) / 2; // 居中排列

        // 升级按钮（从服务器获取图片）
        this.upgradeBtn = this.createButton("#ff6b35", 0xff6b35, this.getServerResourceUrl("resources/btn_upgrade.png"), btnWidth, btnHeight, "升级");
        this.upgradeBtn.pos(startX, btnY);
        // 添加连点功能：按住时连续升级
        this.setupUpgradeRepeatButton(this.upgradeBtn);
        this.bottomBar.addChild(this.upgradeBtn);

        // 升级所需金币显示背景（在升级按钮上方）
        const costLabelWidth = btnWidth;
        const costLabelHeight = Math.max(20, Math.floor(btnHeight * 0.3));
        const costLabelY = btnY - costLabelHeight - Math.max(5, stageHeight * 0.01);
        
        this.upgradeCostLabelBg = new Laya.Sprite();
        this.upgradeCostLabelBg.name = "upgradeCostLabelBg";
        this.upgradeCostLabelBg.size(costLabelWidth, costLabelHeight);
        this.upgradeCostLabelBg.graphics.drawRect(0, 0, costLabelWidth, costLabelHeight, "#000000");
        this.upgradeCostLabelBg.alpha = 0.7;
        this.upgradeCostLabelBg.pos(startX, costLabelY);
        this.bottomBar.addChild(this.upgradeCostLabelBg);

        // 升级所需金币显示（在升级按钮上方）
        const costFontSize = Math.max(12, Math.min(stageWidth * 0.03, 18));
        this.upgradeCostLabel = new Laya.Text();
        this.upgradeCostLabel.name = "upgradeCostLabel";
        this.upgradeCostLabel.text = this.formatMoney(this.upgradeCost);
        this.upgradeCostLabel.fontSize = costFontSize;
        this.upgradeCostLabel.color = "#ffffff";
        this.upgradeCostLabel.width = costLabelWidth;
        this.upgradeCostLabel.height = costLabelHeight;
        this.upgradeCostLabel.align = "center";
        this.upgradeCostLabel.valign = "middle";
        this.upgradeCostLabel.pos(startX, costLabelY);
        this.bottomBar.addChild(this.upgradeCostLabel);
        
        // 初始化升级按钮颜色提示
        this.updateUpgradeCostDisplay();

        // 助理按钮（从服务器获取图片）
        this.assistantBtn = this.createButton("#ff6b9d", 0xff6b9d, this.getServerResourceUrl("resources/btn_assistant.png"), btnWidth, btnHeight, "助理");
        this.assistantBtn.pos(startX + btnWidth + btnSpacing, btnY);
        this.assistantBtn.on(Laya.Event.CLICK, this, this.onAssistantClick);
        this.bottomBar.addChild(this.assistantBtn);

        // 挑战按钮（从服务器获取图片）
        this.challengeBtn = this.createButton("#ff3333", 0xff3333, this.getServerResourceUrl("resources/btn_challenge.png"), btnWidth, btnHeight, "挑战");
        this.challengeBtn.pos(startX + (btnWidth + btnSpacing) * 2, btnY);
        this.challengeBtn.on(Laya.Event.CLICK, this, this.onChallengeClick);
        this.bottomBar.addChild(this.challengeBtn);
        
        // 根据金币是否达到1500来控制按钮显示
        this.updateBottomButtonsVisibility();
    }
    
    /**
     * 更新底部按钮的显示状态（根据金币是否达到1500）
     */
    private updateBottomButtonsVisibility(): void {
        if (!this.bottomBar) {
            return;
        }
        
        // 检查1号助理解锁状态
        const firstAssistant = this.assistants.find(a => a.id === 1);
        const isFirstAssistantUnlocked = firstAssistant && firstAssistant.unlocked;
        
        if (isFirstAssistantUnlocked) {
            // 1号助理解锁后，无论金币多少都显示所有按钮
            this.bottomBar.visible = true;
            this.bottomBar.mouseEnabled = true;
            this.bottomBar.mouseThrough = false;
            
            if (this.upgradeBtn) {
                this.upgradeBtn.visible = true;
                this.upgradeBtn.mouseEnabled = true;
            }
            if (this.upgradeCostLabel) {
                this.upgradeCostLabel.visible = true;
            }
            if (this.upgradeCostLabelBg) {
                this.upgradeCostLabelBg.visible = true;
            }
            if (this.challengeBtn) {
                this.challengeBtn.visible = true;
                this.challengeBtn.mouseEnabled = true;
            }
            if (this.assistantBtn) {
                this.assistantBtn.visible = true;
                this.assistantBtn.mouseEnabled = true;
            }
            
            // 检查是否需要显示升级按钮指引
            this.checkAndShowUpgradeBtnGuide();
            
            // 检查是否需要显示挑战按钮指引
            this.checkAndShowChallengeBtnGuide();
        } else {
            // 1号助理未解锁
            if (this.money < 2100) {
                // 金币未达到2100，隐藏所有按钮
                this.bottomBar.visible = false;
                this.bottomBar.mouseEnabled = false;
                this.bottomBar.mouseThrough = true;
            } else {
                // 金币达到2100但1号助理未解锁，只显示助理按钮
                this.bottomBar.visible = true;
                this.bottomBar.mouseEnabled = true;
                this.bottomBar.mouseThrough = false;
                
                // 只显示助理按钮，隐藏升级和挑战按钮
                if (this.upgradeBtn) {
                    this.upgradeBtn.visible = false;
                    this.upgradeBtn.mouseEnabled = false;
                }
                if (this.upgradeCostLabel) {
                    this.upgradeCostLabel.visible = false;
                }
                if (this.upgradeCostLabelBg) {
                    this.upgradeCostLabelBg.visible = false;
                }
                if (this.challengeBtn) {
                    this.challengeBtn.visible = false;
                    this.challengeBtn.mouseEnabled = false;
                }
                if (this.assistantBtn) {
                    this.assistantBtn.visible = true;
                    this.assistantBtn.mouseEnabled = true;
                }
                
                // 检查是否需要显示助理按钮指引
                this.checkAndShowAssistantGuide();
            }
        }
    }
    
    /**
     * 检查并显示助理按钮指引
     * 条件：等级1，助理1号未解锁，金币超过2100
     */
    private checkAndShowAssistantGuide(): void {
        // 如果已经显示过，不再显示
        if (this.isAssistantGuideActive) {
            return;
        }
        
        const shouldShowGuide = this.playerLevel === 1 && 
                                this.money > 2100 && 
                                this.assistants.length > 0 && 
                                !this.assistants[0].unlocked;
        
        if (shouldShowGuide) {
            console.log("检测到满足助理按钮指引条件，显示指引");
            this.showAssistantGuide();
        }
    }
    
    /**
     * 显示助理按钮指引
     */
    private showAssistantGuide(): void {
        if (this.isAssistantGuideActive) {
            return; // 已经显示，不重复显示
        }
        
        this.isAssistantGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 计算助理按钮的位置和大小
        const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80));
        const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120));
        const btnSpacing = Math.max(10, stageWidth * 0.02);
        const bottomMargin = Math.max(20, stageHeight * 0.03);
        const btnY = stageHeight - btnHeight - bottomMargin;
        const totalWidth = btnWidth * 3 + btnSpacing * 2;
        const startX = (stageWidth - totalWidth) / 2;
        const assistantBtnX = startX + btnWidth + btnSpacing;
        const assistantBtnY = btnY;
        
        // 创建全屏遮挡层（半透明黑色）
        this.assistantGuideMask = new Laya.Sprite();
        this.assistantGuideMask.name = "assistantGuideMask";
        this.assistantGuideMask.size(stageWidth, stageHeight);
        this.assistantGuideMask.pos(0, 0);
        
        const graphics = this.assistantGuideMask.graphics;
        graphics.clear();
        
        // 在助理按钮位置挖一个洞（绘制4个矩形：上下左右）
        // 上方遮挡
        graphics.drawRect(0, 0, stageWidth, assistantBtnY, "#000000");
        // 下方遮挡
        graphics.drawRect(0, assistantBtnY + btnHeight, stageWidth, stageHeight - (assistantBtnY + btnHeight), "#000000");
        // 左侧遮挡
        graphics.drawRect(0, assistantBtnY, assistantBtnX, btnHeight, "#000000");
        // 右侧遮挡
        graphics.drawRect(assistantBtnX + btnWidth, assistantBtnY, stageWidth - (assistantBtnX + btnWidth), btnHeight, "#000000");
        
        this.assistantGuideMask.alpha = 0.7;
        this.assistantGuideMask.mouseEnabled = true;
        this.assistantGuideMask.mouseThrough = false;
        
        // 添加到stage最上层（遮挡层）
        Laya.stage.addChild(this.assistantGuideMask);
        Laya.stage.setChildIndex(this.assistantGuideMask, Laya.stage.numChildren - 1);
        
        // 确保底部按钮在遮挡层上方（这样按钮可以正常点击）
        if (this.bottomBar && this.bottomBar.parent) {
            Laya.stage.setChildIndex(this.bottomBar, Laya.stage.numChildren - 1);
        }
        
        // 创建提示文字（显示在屏幕上方）
        this.assistantGuideTipLabel = new Laya.Text();
        this.assistantGuideTipLabel.name = "assistantGuideTipLabel";
        this.assistantGuideTipLabel.text = "来看看刚刚得到的蛋吧~";
        this.assistantGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.assistantGuideTipLabel.color = "#000000";
        this.assistantGuideTipLabel.width = stageWidth;
        this.assistantGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.assistantGuideTipLabel.align = "center";
        this.assistantGuideTipLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部15%
        this.assistantGuideTipLabel.pos(0, stageHeight * 0.15);
        this.assistantGuideTipLabel.mouseEnabled = false;
        this.assistantGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.assistantGuideTipLabel);
        Laya.stage.setChildIndex(this.assistantGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器
        this.assistantGuideAutoCloseTimer = () => {
            console.log("助理按钮指引2秒自动关闭定时器触发");
            this.hideAssistantGuide();
        };
        Laya.timer.once(2000, this, this.assistantGuideAutoCloseTimer);
        
        console.log("助理按钮指引已显示，将在2秒后自动关闭");
    }
    
    /**
     * 隐藏助理按钮指引
     */
    private hideAssistantGuide(): void {
        if (!this.isAssistantGuideActive) {
            return;
        }
        
        this.isAssistantGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.assistantGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.assistantGuideAutoCloseTimer);
            this.assistantGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.assistantGuideMask) {
            this.assistantGuideMask.removeSelf();
            this.assistantGuideMask = null;
        }
        
        // 移除提示文字
        if (this.assistantGuideTipLabel) {
            this.assistantGuideTipLabel.removeSelf();
            this.assistantGuideTipLabel = null;
        }
        
        console.log("助理按钮指引已隐藏");
    }
    
    /**
     * 检查并显示解锁指引
     * 条件：在助理窗口内，1号助理未解锁
     */
    private checkAndShowUnlockGuide(): void {
        if (!this.assistantWindow || this.isAssistantUnlockGuideActive) {
            return;
        }
        
        // 检查1号助理是否未解锁
        const firstAssistant = this.assistants.find(a => a.id === 1);
        if (firstAssistant && !firstAssistant.unlocked) {
            console.log("检测到1号助理未解锁，显示解锁指引");
            this.showUnlockGuide();
        }
    }
    
    /**
     * 显示解锁指引
     */
    private showUnlockGuide(): void {
        if (this.isAssistantUnlockGuideActive) {
            return;
        }
        
        this.isAssistantUnlockGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 找到1号助理的卡片
        const scrollMask = this.assistantWindow.getChildByName("scrollMask") as Laya.Sprite;
        if (!scrollMask) {
            this.isAssistantUnlockGuideActive = false;
            return;
        }
        
        const cardsContainer = scrollMask.getChildByName("cardsContainer") as Laya.Sprite;
        if (!cardsContainer) {
            this.isAssistantUnlockGuideActive = false;
            return;
        }
        
        const firstCard = cardsContainer.getChildByName("assistantCard_1") as Laya.Sprite;
        if (!firstCard) {
            this.isAssistantUnlockGuideActive = false;
            return;
        }
        
        // 计算卡片在屏幕上的位置
        const cardGlobalPos = firstCard.localToGlobal(new Laya.Point(0, 0));
        const cardWidth = firstCard.width;
        const cardHeight = firstCard.height;
        
        // 创建全屏遮挡层（半透明黑色）
        this.assistantUnlockGuideMask = new Laya.Sprite();
        this.assistantUnlockGuideMask.name = "assistantUnlockGuideMask";
        this.assistantUnlockGuideMask.size(stageWidth, stageHeight);
        this.assistantUnlockGuideMask.pos(0, 0);
        
        const graphics = this.assistantUnlockGuideMask.graphics;
        graphics.clear();
        
        // 在1号助理卡片位置挖一个洞（绘制4个矩形：上下左右）
        // 上方遮挡
        graphics.drawRect(0, 0, stageWidth, cardGlobalPos.y, "#000000");
        // 下方遮挡
        graphics.drawRect(0, cardGlobalPos.y + cardHeight, stageWidth, stageHeight - (cardGlobalPos.y + cardHeight), "#000000");
        // 左侧遮挡
        graphics.drawRect(0, cardGlobalPos.y, cardGlobalPos.x, cardHeight, "#000000");
        // 右侧遮挡
        graphics.drawRect(cardGlobalPos.x + cardWidth, cardGlobalPos.y, stageWidth - (cardGlobalPos.x + cardWidth), cardHeight, "#000000");
        
        this.assistantUnlockGuideMask.alpha = 0.7;
        this.assistantUnlockGuideMask.mouseEnabled = true;
        this.assistantUnlockGuideMask.mouseThrough = false;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.assistantUnlockGuideMask);
        Laya.stage.setChildIndex(this.assistantUnlockGuideMask, Laya.stage.numChildren - 1);
        
        // 确保助理窗口在遮挡层上方
        if (this.assistantWindow && this.assistantWindow.parent) {
            Laya.stage.setChildIndex(this.assistantWindow, Laya.stage.numChildren - 1);
        }
        
        // 创建提示文字（显示在屏幕上方）
        this.assistantUnlockGuideTipLabel = new Laya.Text();
        this.assistantUnlockGuideTipLabel.name = "assistantUnlockGuideTipLabel";
        this.assistantUnlockGuideTipLabel.text = "蛋开始动了……解锁看看！";
        this.assistantUnlockGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.assistantUnlockGuideTipLabel.color = "#000000";
        this.assistantUnlockGuideTipLabel.width = stageWidth;
        this.assistantUnlockGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.assistantUnlockGuideTipLabel.align = "center";
        this.assistantUnlockGuideTipLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部15%
        this.assistantUnlockGuideTipLabel.pos(0, stageHeight * 0.15);
        this.assistantUnlockGuideTipLabel.mouseEnabled = false;
        this.assistantUnlockGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.assistantUnlockGuideTipLabel);
        Laya.stage.setChildIndex(this.assistantUnlockGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器
        this.assistantUnlockGuideAutoCloseTimer = () => {
            console.log("解锁指引2秒自动关闭定时器触发");
            this.hideUnlockGuide();
        };
        Laya.timer.once(2000, this, this.assistantUnlockGuideAutoCloseTimer);
        
        console.log("解锁指引已显示，将在2秒后自动关闭");
    }
    
    /**
     * 隐藏解锁指引
     */
    private hideUnlockGuide(): void {
        if (!this.isAssistantUnlockGuideActive) {
            return;
        }
        
        this.isAssistantUnlockGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.assistantUnlockGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.assistantUnlockGuideAutoCloseTimer);
            this.assistantUnlockGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.assistantUnlockGuideMask) {
            this.assistantUnlockGuideMask.removeSelf();
            this.assistantUnlockGuideMask = null;
        }
        
        // 移除提示文字
        if (this.assistantUnlockGuideTipLabel) {
            this.assistantUnlockGuideTipLabel.removeSelf();
            this.assistantUnlockGuideTipLabel = null;
        }
        
        console.log("解锁指引已隐藏");
    }
    
    /**
     * 检查并显示升级指引
     * 条件：1号助理已解锁，等级小于20，在助理窗口内
     */
    private checkAndShowUpgradeGuide(): void {
        if (!this.assistantWindow || this.isAssistantUpgradeGuideActive) {
            return;
        }
        
        // 检查1号助理是否已解锁且等级小于20
        const firstAssistant = this.assistants.find(a => a.id === 1);
        if (firstAssistant && firstAssistant.unlocked && firstAssistant.level < 20) {
            console.log("检测到1号助理已解锁且等级小于20，显示升级指引");
            this.showUpgradeGuide();
        }
    }
    
    /**
     * 显示升级指引
     */
    private showUpgradeGuide(): void {
        if (this.isAssistantUpgradeGuideActive) {
            return;
        }
        
        this.isAssistantUpgradeGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 找到1号助理的卡片
        const scrollMask = this.assistantWindow.getChildByName("scrollMask") as Laya.Sprite;
        if (!scrollMask) {
            this.isAssistantUpgradeGuideActive = false;
            return;
        }
        
        const cardsContainer = scrollMask.getChildByName("cardsContainer") as Laya.Sprite;
        if (!cardsContainer) {
            this.isAssistantUpgradeGuideActive = false;
            return;
        }
        
        const firstCard = cardsContainer.getChildByName("assistantCard_1") as Laya.Sprite;
        if (!firstCard) {
            this.isAssistantUpgradeGuideActive = false;
            return;
        }
        
        // 找到升级按钮
        const actionBtn = firstCard.getChildByName("actionBtn") as Laya.Sprite;
        if (!actionBtn) {
            this.isAssistantUpgradeGuideActive = false;
            return;
        }
        
        // 计算按钮在屏幕上的位置
        const btnGlobalPos = actionBtn.localToGlobal(new Laya.Point(0, 0));
        const btnWidth = actionBtn.width;
        const btnHeight = actionBtn.height;
        
        // 创建全屏遮挡层（半透明黑色）
        this.assistantUpgradeGuideMask = new Laya.Sprite();
        this.assistantUpgradeGuideMask.name = "assistantUpgradeGuideMask";
        this.assistantUpgradeGuideMask.size(stageWidth, stageHeight);
        this.assistantUpgradeGuideMask.pos(0, 0);
        
        const graphics = this.assistantUpgradeGuideMask.graphics;
        graphics.clear();
        
        // 在升级按钮位置挖一个洞（绘制4个矩形：上下左右）
        // 上方遮挡
        graphics.drawRect(0, 0, stageWidth, btnGlobalPos.y, "#000000");
        // 下方遮挡
        graphics.drawRect(0, btnGlobalPos.y + btnHeight, stageWidth, stageHeight - (btnGlobalPos.y + btnHeight), "#000000");
        // 左侧遮挡
        graphics.drawRect(0, btnGlobalPos.y, btnGlobalPos.x, btnHeight, "#000000");
        // 右侧遮挡
        graphics.drawRect(btnGlobalPos.x + btnWidth, btnGlobalPos.y, stageWidth - (btnGlobalPos.x + btnWidth), btnHeight, "#000000");
        
        this.assistantUpgradeGuideMask.alpha = 0.7;
        this.assistantUpgradeGuideMask.mouseEnabled = true;
        this.assistantUpgradeGuideMask.mouseThrough = false;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.assistantUpgradeGuideMask);
        Laya.stage.setChildIndex(this.assistantUpgradeGuideMask, Laya.stage.numChildren - 1);
        
        // 确保助理窗口在遮挡层上方
        if (this.assistantWindow && this.assistantWindow.parent) {
            Laya.stage.setChildIndex(this.assistantWindow, Laya.stage.numChildren - 1);
        }
        
        // 创建提示文字（显示在屏幕上方）
        this.assistantUpgradeGuideTipLabel = new Laya.Text();
        this.assistantUpgradeGuideTipLabel.name = "assistantUpgradeGuideTipLabel";
        this.assistantUpgradeGuideTipLabel.text = "升到20级有收益倍率加成哦~";
        this.assistantUpgradeGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.assistantUpgradeGuideTipLabel.color = "#000000";
        this.assistantUpgradeGuideTipLabel.width = stageWidth;
        this.assistantUpgradeGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.assistantUpgradeGuideTipLabel.align = "center";
        this.assistantUpgradeGuideTipLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部15%
        this.assistantUpgradeGuideTipLabel.pos(0, stageHeight * 0.15);
        this.assistantUpgradeGuideTipLabel.mouseEnabled = false;
        this.assistantUpgradeGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.assistantUpgradeGuideTipLabel);
        Laya.stage.setChildIndex(this.assistantUpgradeGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器
        this.assistantUpgradeGuideAutoCloseTimer = () => {
            console.log("升级指引2秒自动关闭定时器触发");
            this.hideUpgradeGuide();
        };
        Laya.timer.once(2000, this, this.assistantUpgradeGuideAutoCloseTimer);
        
        console.log("升级指引已显示，将在2秒后自动关闭或点击升级按钮后关闭");
    }
    
    /**
     * 隐藏升级指引
     */
    private hideUpgradeGuide(): void {
        if (!this.isAssistantUpgradeGuideActive) {
            return;
        }
        
        this.isAssistantUpgradeGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.assistantUpgradeGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.assistantUpgradeGuideAutoCloseTimer);
            this.assistantUpgradeGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.assistantUpgradeGuideMask) {
            this.assistantUpgradeGuideMask.removeSelf();
            this.assistantUpgradeGuideMask = null;
        }
        
        // 移除提示文字
        if (this.assistantUpgradeGuideTipLabel) {
            this.assistantUpgradeGuideTipLabel.removeSelf();
            this.assistantUpgradeGuideTipLabel = null;
        }
        
        console.log("升级指引已隐藏");
    }
    
    /**
     * 检查并显示升级按钮指引
     * 条件：没有窗口打开，1号助理解锁，等级为1，金额能够升级
     */
    private checkAndShowUpgradeBtnGuide(): void {
        // 如果已经显示过，不再显示
        if (this.isUpgradeBtnGuideActive) {
            return;
        }
        
        // 检查是否有窗口打开
        if (this.assistantWindow || this.settingsWindow || this.challengeWindow) {
            return;
        }
        
        // 检查1号助理解锁状态
        const firstAssistant = this.assistants.find(a => a.id === 1);
        if (!firstAssistant || !firstAssistant.unlocked) {
            return;
        }
        
        // 检查等级是否为1
        if (this.playerLevel !== 1) {
            return;
        }
        
        // 检查金额是否能够升级
        if (this.money < this.upgradeCost) {
            return;
        }
        
        console.log("检测到满足升级按钮指引条件，显示指引");
        this.showUpgradeBtnGuide();
    }
    
    /**
     * 显示升级按钮指引
     */
    private showUpgradeBtnGuide(): void {
        if (this.isUpgradeBtnGuideActive) {
            return; // 已经显示，不重复显示
        }
        
        this.isUpgradeBtnGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 计算升级按钮的位置和大小
        const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80));
        const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120));
        const btnSpacing = Math.max(10, stageWidth * 0.02);
        const bottomMargin = Math.max(20, stageHeight * 0.03);
        const btnY = stageHeight - btnHeight - bottomMargin;
        const totalWidth = btnWidth * 3 + btnSpacing * 2;
        const startX = (stageWidth - totalWidth) / 2;
        const upgradeBtnX = startX;
        const upgradeBtnY = btnY;
        
        // 创建全屏遮挡层（半透明黑色）
        this.upgradeBtnGuideMask = new Laya.Sprite();
        this.upgradeBtnGuideMask.name = "upgradeBtnGuideMask";
        this.upgradeBtnGuideMask.size(stageWidth, stageHeight);
        this.upgradeBtnGuideMask.pos(0, 0);
        
        const graphics = this.upgradeBtnGuideMask.graphics;
        graphics.clear();
        
        // 在升级按钮位置挖一个洞（绘制4个矩形：上下左右）
        // 上方遮挡
        graphics.drawRect(0, 0, stageWidth, upgradeBtnY, "#000000");
        // 下方遮挡
        graphics.drawRect(0, upgradeBtnY + btnHeight, stageWidth, stageHeight - (upgradeBtnY + btnHeight), "#000000");
        // 左侧遮挡
        graphics.drawRect(0, upgradeBtnY, upgradeBtnX, btnHeight, "#000000");
        // 右侧遮挡
        graphics.drawRect(upgradeBtnX + btnWidth, upgradeBtnY, stageWidth - (upgradeBtnX + btnWidth), btnHeight, "#000000");
        
        this.upgradeBtnGuideMask.alpha = 0.7;
        this.upgradeBtnGuideMask.mouseEnabled = true;
        this.upgradeBtnGuideMask.mouseThrough = false;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.upgradeBtnGuideMask);
        Laya.stage.setChildIndex(this.upgradeBtnGuideMask, Laya.stage.numChildren - 1);
        
        // 确保底部按钮在遮挡层上方
        if (this.bottomBar && this.bottomBar.parent) {
            Laya.stage.setChildIndex(this.bottomBar, Laya.stage.numChildren - 1);
        }
        
        // 创建提示文字（显示在屏幕上方）
        this.upgradeBtnGuideTipLabel = new Laya.Text();
        this.upgradeBtnGuideTipLabel.name = "upgradeBtnGuideTipLabel";
        this.upgradeBtnGuideTipLabel.text = "升级可以提高点击收益";
        this.upgradeBtnGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.upgradeBtnGuideTipLabel.color = "#000000";
        this.upgradeBtnGuideTipLabel.width = stageWidth;
        this.upgradeBtnGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.upgradeBtnGuideTipLabel.align = "center";
        this.upgradeBtnGuideTipLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部15%
        this.upgradeBtnGuideTipLabel.pos(0, stageHeight * 0.15);
        this.upgradeBtnGuideTipLabel.mouseEnabled = false;
        this.upgradeBtnGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.upgradeBtnGuideTipLabel);
        Laya.stage.setChildIndex(this.upgradeBtnGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器
        this.upgradeBtnGuideAutoCloseTimer = () => {
            console.log("升级按钮指引2秒自动关闭定时器触发");
            this.hideUpgradeBtnGuide();
        };
        Laya.timer.once(2000, this, this.upgradeBtnGuideAutoCloseTimer);
        
        console.log("升级按钮指引已显示，将在2秒后自动关闭或点击升级按钮后关闭");
    }
    
    /**
     * 隐藏升级按钮指引
     */
    private hideUpgradeBtnGuide(): void {
        if (!this.isUpgradeBtnGuideActive) {
            return;
        }
        
        this.isUpgradeBtnGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.upgradeBtnGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.upgradeBtnGuideAutoCloseTimer);
            this.upgradeBtnGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.upgradeBtnGuideMask) {
            this.upgradeBtnGuideMask.removeSelf();
            this.upgradeBtnGuideMask = null;
        }
        
        // 移除提示文字
        if (this.upgradeBtnGuideTipLabel) {
            this.upgradeBtnGuideTipLabel.removeSelf();
            this.upgradeBtnGuideTipLabel = null;
        }
        
        console.log("升级按钮指引已隐藏");
    }
    
    /**
     * 检查并显示挑战按钮指引
     * 条件：没有窗口打开，点击收益达到500以上，且1号挑战未解锁
     */
    private checkAndShowChallengeBtnGuide(): void {
        // 如果已经显示过，不再显示
        if (this.isChallengeBtnGuideActive) {
            return;
        }
        
        // 检查是否有窗口打开（只有主页面，没有窗口打开时才显示）
        if (this.assistantWindow || this.settingsWindow || this.challengeWindow) {
            return;
        }
        
        // 检查点击收益是否达到500以上
        const clickReward = this.getClickReward();
        if (clickReward < 500) {
            return;
        }
        
        // 检查1号挑战是否未解锁（1号挑战对应1号助理）
        const firstChallenge = this.challenges.find(c => c.id === 1);
        if (!firstChallenge || firstChallenge.completed) {
            return;
        }
        
        // 检查1号助理是否已解锁（挑战解锁条件）
        const firstAssistant = this.assistants.find(a => a.id === 1);
        if (!firstAssistant || !firstAssistant.unlocked) {
            return;
        }
        
        console.log("检测到满足挑战按钮指引条件，显示指引");
        this.showChallengeBtnGuide();
    }
    
    /**
     * 显示挑战按钮指引
     */
    private showChallengeBtnGuide(): void {
        if (this.isChallengeBtnGuideActive) {
            return; // 已经显示，不重复显示
        }
        
        this.isChallengeBtnGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 计算挑战按钮的位置和大小
        const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80));
        const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120));
        const btnSpacing = Math.max(10, stageWidth * 0.02);
        const bottomMargin = Math.max(20, stageHeight * 0.03);
        const btnY = stageHeight - btnHeight - bottomMargin;
        const totalWidth = btnWidth * 3 + btnSpacing * 2;
        const startX = (stageWidth - totalWidth) / 2;
        const challengeBtnX = startX + (btnWidth + btnSpacing) * 2;
        const challengeBtnY = btnY;
        
        // 创建全屏遮挡层（半透明黑色）
        this.challengeBtnGuideMask = new Laya.Sprite();
        this.challengeBtnGuideMask.name = "challengeBtnGuideMask";
        this.challengeBtnGuideMask.size(stageWidth, stageHeight);
        this.challengeBtnGuideMask.pos(0, 0);
        
        const graphics = this.challengeBtnGuideMask.graphics;
        graphics.clear();
        
        // 在挑战按钮位置挖一个洞（绘制4个矩形：上下左右）
        // 上方遮挡
        graphics.drawRect(0, 0, stageWidth, challengeBtnY, "#000000");
        // 下方遮挡
        graphics.drawRect(0, challengeBtnY + btnHeight, stageWidth, stageHeight - (challengeBtnY + btnHeight), "#000000");
        // 左侧遮挡
        graphics.drawRect(0, challengeBtnY, challengeBtnX, btnHeight, "#000000");
        // 右侧遮挡
        graphics.drawRect(challengeBtnX + btnWidth, challengeBtnY, stageWidth - (challengeBtnX + btnWidth), btnHeight, "#000000");
        
        this.challengeBtnGuideMask.alpha = 0.7;
        this.challengeBtnGuideMask.mouseEnabled = true;
        this.challengeBtnGuideMask.mouseThrough = false;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.challengeBtnGuideMask);
        Laya.stage.setChildIndex(this.challengeBtnGuideMask, Laya.stage.numChildren - 1);
        
        // 确保底部按钮在遮挡层上方
        if (this.bottomBar && this.bottomBar.parent) {
            Laya.stage.setChildIndex(this.bottomBar, Laya.stage.numChildren - 1);
        }
        
        // 创建提示文字（显示在屏幕上方）
        this.challengeBtnGuideTipLabel = new Laya.Text();
        this.challengeBtnGuideTipLabel.name = "challengeBtnGuideTipLabel";
        this.challengeBtnGuideTipLabel.text = "加油，通过助理的试炼！";
        this.challengeBtnGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.challengeBtnGuideTipLabel.color = "#000000";
        this.challengeBtnGuideTipLabel.width = stageWidth;
        this.challengeBtnGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.challengeBtnGuideTipLabel.align = "center";
        this.challengeBtnGuideTipLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部15%
        this.challengeBtnGuideTipLabel.pos(0, stageHeight * 0.15);
        this.challengeBtnGuideTipLabel.mouseEnabled = false;
        this.challengeBtnGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.challengeBtnGuideTipLabel);
        Laya.stage.setChildIndex(this.challengeBtnGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器
        this.challengeBtnGuideAutoCloseTimer = () => {
            console.log("挑战按钮指引2秒自动关闭定时器触发");
            this.hideChallengeBtnGuide();
        };
        Laya.timer.once(2000, this, this.challengeBtnGuideAutoCloseTimer);
        
        console.log("挑战按钮指引已显示，将在2秒后自动关闭或点击挑战按钮后关闭");
    }
    
    /**
     * 隐藏挑战按钮指引
     */
    private hideChallengeBtnGuide(): void {
        if (!this.isChallengeBtnGuideActive) {
            return;
        }
        
        this.isChallengeBtnGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.challengeBtnGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.challengeBtnGuideAutoCloseTimer);
            this.challengeBtnGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.challengeBtnGuideMask) {
            this.challengeBtnGuideMask.removeSelf();
            this.challengeBtnGuideMask = null;
        }
        
        // 移除提示文字
        if (this.challengeBtnGuideTipLabel) {
            this.challengeBtnGuideTipLabel.removeSelf();
            this.challengeBtnGuideTipLabel = null;
        }
        
        console.log("挑战按钮指引已隐藏");
    }
    
    /**
     * 检查并显示挑战窗口指引
     * 条件：1号挑战通过，且关闭success图片后（不考虑是否有窗口打开）
     */
    private checkAndShowChallengeWindowGuide(): void {
        // 如果已经显示过，不再显示
        if (this.isChallengeWindowGuideActive) {
            return;
        }
        
        // 检查1号挑战是否已通过
        const firstChallenge = this.challenges.find(c => c.id === 1);
        if (!firstChallenge || !firstChallenge.completed) {
            return;
        }
        
        console.log("检测到满足挑战窗口指引条件，显示指引");
        this.showChallengeWindowGuide();
    }
    
    /**
     * 显示挑战窗口指引
     */
    private showChallengeWindowGuide(): void {
        if (this.isChallengeWindowGuideActive) {
            return; // 已经显示，不重复显示
        }
        
        this.isChallengeWindowGuideActive = true;
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 创建全屏遮挡层（半透明黑色）
        this.challengeWindowGuideMask = new Laya.Sprite();
        this.challengeWindowGuideMask.name = "challengeWindowGuideMask";
        this.challengeWindowGuideMask.size(stageWidth, stageHeight);
        this.challengeWindowGuideMask.pos(0, 0);
        
        const graphics = this.challengeWindowGuideMask.graphics;
        graphics.clear();
        
        // 绘制全屏半透明黑色
        graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        this.challengeWindowGuideMask.alpha = 0.7;
        this.challengeWindowGuideMask.mouseEnabled = true;
        this.challengeWindowGuideMask.mouseThrough = false;
        
        // 添加点击事件：点击任意处关闭指引
        this.challengeWindowGuideMask.on(Laya.Event.CLICK, this, this.hideChallengeWindowGuide);
        
        // 添加到stage最上层
        Laya.stage.addChild(this.challengeWindowGuideMask);
        Laya.stage.setChildIndex(this.challengeWindowGuideMask, Laya.stage.numChildren - 1);
        
        // 创建提示文字（显示在屏幕中央）
        this.challengeWindowGuideTipLabel = new Laya.Text();
        this.challengeWindowGuideTipLabel.name = "challengeWindowGuideTipLabel";
        this.challengeWindowGuideTipLabel.text = "努力通过所有试炼吧~";
        this.challengeWindowGuideTipLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 36));
        this.challengeWindowGuideTipLabel.color = "#000000";
        this.challengeWindowGuideTipLabel.width = stageWidth;
        this.challengeWindowGuideTipLabel.height = Math.max(40, stageHeight * 0.06);
        this.challengeWindowGuideTipLabel.align = "center";
        this.challengeWindowGuideTipLabel.valign = "middle";
        // 位置：屏幕中央
        this.challengeWindowGuideTipLabel.pos(0, (stageHeight - this.challengeWindowGuideTipLabel.height) / 2);
        this.challengeWindowGuideTipLabel.mouseEnabled = false;
        this.challengeWindowGuideTipLabel.mouseThrough = true;
        
        // 添加到stage最上层
        Laya.stage.addChild(this.challengeWindowGuideTipLabel);
        Laya.stage.setChildIndex(this.challengeWindowGuideTipLabel, Laya.stage.numChildren - 1);
        
        // 启动2秒自动关闭定时器
        this.challengeWindowGuideAutoCloseTimer = () => {
            console.log("挑战窗口指引2秒自动关闭定时器触发");
            this.hideChallengeWindowGuide();
        };
        Laya.timer.once(2000, this, this.challengeWindowGuideAutoCloseTimer);
        
        console.log("挑战窗口指引已显示，将在2秒后自动关闭或点击任意处关闭");
    }
    
    /**
     * 隐藏挑战窗口指引
     */
    private hideChallengeWindowGuide(): void {
        if (!this.isChallengeWindowGuideActive) {
            return;
        }
        
        this.isChallengeWindowGuideActive = false;
        
        // 清除自动关闭定时器
        if (this.challengeWindowGuideAutoCloseTimer) {
            Laya.timer.clear(this, this.challengeWindowGuideAutoCloseTimer);
            this.challengeWindowGuideAutoCloseTimer = null;
        }
        
        // 移除遮挡层
        if (this.challengeWindowGuideMask) {
            this.challengeWindowGuideMask.off(Laya.Event.CLICK, this, this.hideChallengeWindowGuide);
            this.challengeWindowGuideMask.removeSelf();
            this.challengeWindowGuideMask = null;
        }
        
        // 移除提示文字
        if (this.challengeWindowGuideTipLabel) {
            this.challengeWindowGuideTipLabel.removeSelf();
            this.challengeWindowGuideTipLabel = null;
        }
        
        console.log("挑战窗口指引已隐藏");
    }

    /**
     * 创建按钮（当图片未提供时显示文字，手机端适配）
     * @param color 按钮颜色（如果图片不存在时使用）
     * @param colorValue 颜色值
     * @param imagePath 按钮图片路径（可选，如 "resources/btn_upgrade.png"）
     * @param width 按钮宽度（可选，默认根据屏幕计算）
     * @param height 按钮高度（可选，默认根据屏幕计算）
     * @param buttonText 按钮文字（当图片未提供时显示，可选）
     */
    private createButton(color: string, colorValue: number, imagePath?: string, width?: number, height?: number, buttonText?: string): Laya.Sprite {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 如果没有指定尺寸，使用默认计算
        const btnWidth = width || Math.max(80, Math.min(stageWidth * 0.25, 120));
        const btnHeight = height || Math.max(60, Math.min(stageHeight * 0.08, 80));
        const cornerRadius = Math.max(8, Math.min(btnWidth * 0.1, 12)); // 圆角半径
        
        const btn = new Laya.Sprite();
        btn.name = "button";
        btn.size(btnWidth, btnHeight);
        
        // 如果提供了图片路径，尝试加载图片
        if (imagePath) {
            Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (texture) {
                    // 加载成功，使用图片
                    btn.graphics.drawTexture(texture, 0, 0, btnWidth, btnHeight);
                } else {
                    // 加载失败，使用默认绘制并添加文字
                    btn.graphics.drawRoundRect(0, 0, btnWidth, btnHeight, cornerRadius, cornerRadius, cornerRadius, cornerRadius, color);
                    if (buttonText) {
                        const textLabel = new Laya.Text();
                        textLabel.text = buttonText;
                        textLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.04, 18));
                        textLabel.color = "#ffffff";
                        textLabel.width = btnWidth;
                        textLabel.height = btnHeight;
                        textLabel.align = "center";
                        textLabel.valign = "middle";
                        textLabel.mouseEnabled = false;
                        btn.addChild(textLabel);
                    }
                }
            }), null, null, 0, false, null, false);
        } else {
            // 按钮背景（drawRoundRect需要9个参数：x, y, width, height, lt, rt, lb, rb, fillColor）
            btn.graphics.drawRoundRect(0, 0, btnWidth, btnHeight, cornerRadius, cornerRadius, cornerRadius, cornerRadius, color);
            // 如果没有图片，添加文字
            if (buttonText) {
                const textLabel = new Laya.Text();
                textLabel.text = buttonText;
                textLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.04, 18));
                textLabel.color = "#ffffff";
                textLabel.width = btnWidth;
                textLabel.height = btnHeight;
                textLabel.align = "center";
                textLabel.valign = "middle";
                textLabel.mouseEnabled = false;
                btn.addChild(textLabel);
            }
        }

        // 按钮交互效果
        btn.on(Laya.Event.MOUSE_DOWN, this, () => {
            btn.scale(0.95, 0.95);
        });
        btn.on(Laya.Event.MOUSE_UP, this, () => {
            btn.scale(1, 1);
        });
        btn.on(Laya.Event.MOUSE_OUT, this, () => {
            btn.scale(1, 1);
        });

        return btn;
    }

    /**
     * 设置升级按钮的连点功能
     */
    private setupUpgradeRepeatButton(btn: Laya.Sprite): void {
        // 按住时立即执行一次点击，1秒后才开始连点
        btn.on(Laya.Event.MOUSE_DOWN, this, () => {
            btn.scale(0.95, 0.95);
            // 立即执行一次点击
            this.onUpgradeClick();
            // 停止之前的连点和定时器（如果存在）
            this.stopUpgradeRepeat();
            this.clearUpgradeLongPressTimer();
            // 设置1秒定时器，如果1秒后还在按住，才开始持续升级
            const longPressHandler = () => {
                // 1秒后开始连点：1秒5次，即每200ms执行一次
                this.upgradeRepeatHandler = this.onUpgradeClick;
                Laya.timer.loop(200, this, this.upgradeRepeatHandler);
                this.upgradeLongPressTimer = null;
            };
            this.upgradeLongPressTimer = longPressHandler;
            Laya.timer.once(1000, this, longPressHandler);
        });
        
        // 松开时停止连点
        btn.on(Laya.Event.MOUSE_UP, this, () => {
            btn.scale(1, 1);
            // 清除长按定时器
            this.clearUpgradeLongPressTimer();
            // 停止持续升级（如果正在持续升级）
            this.stopUpgradeRepeat();
        });
        
        // 移出按钮时也停止连点
        btn.on(Laya.Event.MOUSE_OUT, this, () => {
            btn.scale(1, 1);
            this.clearUpgradeLongPressTimer();
            this.stopUpgradeRepeat();
        });
    }
    
    /**
     * 停止升级连点
     */
    private stopUpgradeRepeat(): void {
        if (this.upgradeRepeatHandler) {
            Laya.timer.clear(this, this.upgradeRepeatHandler);
            this.upgradeRepeatHandler = null;
        }
    }
    
    /**
     * 清除升级按钮长按定时器
     */
    private clearUpgradeLongPressTimer(): void {
        if (this.upgradeLongPressTimer) {
            Laya.timer.clear(this, this.upgradeLongPressTimer);
            this.upgradeLongPressTimer = null;
        }
    }
    
    /**
     * 升级按钮点击事件
     */
    private onUpgradeClick(): void {
        // 如果升级按钮指引激活，点击后关闭指引
        if (this.isUpgradeBtnGuideActive) {
            this.hideUpgradeBtnGuide();
        }
        
        // 检查是否有足够的金币
        if (this.money >= this.upgradeCost) {
            // 消耗金币
            this.money -= this.upgradeCost;
            this.updateMoneyDisplay();
            
            // 升级
            this.playerLevel++;
            this.levelLabel.text = this.playerLevel + "级";
            
            // 如果升级后等级不再是1，关闭升级按钮指引
            if (this.playerLevel !== 1 && this.isUpgradeBtnGuideActive) {
                this.hideUpgradeBtnGuide();
            }
            
            // 提高单次点击金币获取量基础值：每次增加当前值的3%
            // 升级提升的是收益本金，倍率是额外加成
            const percentIncrease = 0.06; // 3%的百分比增长
            this.clickRewardBase = Math.floor(this.clickRewardBase + this.clickRewardBase * percentIncrease);
            
            // 升级所需金币提高10%
            this.upgradeCost = Math.floor(this.upgradeCost * 1.1);
            this.updateUpgradeCostDisplay();
            
            // 更新倍率显示和秒赚显示
            this.updateMultiplierDisplay();
            this.updatePerSecondDisplay();
            
            // 检查是否需要显示挑战按钮指引（点击收益变化可能影响是否达到500）
            this.checkAndShowChallengeBtnGuide();
            
            console.log("升级成功！当前等级:", this.playerLevel, "点击收益基础值:", this.clickRewardBase, "倍率:", this.clickMultiplier, "实际收益:", this.getClickReward(), "下次升级需要:", this.upgradeCost);
            // 数据会通过定时保存自动保存，无需手动调用
        } else {
            // 金币不足，显示弹窗提示
            this.showPopup("金币不足！需要 " + this.formatMoney(this.upgradeCost), "center", "#ff6666");
            console.log("金币不足，无法升级！需要:", this.upgradeCost, "当前:", this.money);
        }
    }

    /**
     * 挑战按钮点击事件
     */
    private onChallengeClick(): void {
        // 如果挑战按钮指引激活，点击后关闭指引
        if (this.isChallengeBtnGuideActive) {
            this.hideChallengeBtnGuide();
        }
        console.log("点击了挑战按钮");
        // 如果窗口已存在，先删除
        if (this.challengeWindow) {
            this.challengeWindow.removeSelf();
            this.challengeWindow = null;
            return;
        }
        
        // 创建挑战窗口
        this.createChallengeWindow();
    }

    /**
     * 助理按钮点击事件
     */
    private onAssistantClick(): void {
        // 如果助理按钮指引激活，点击后关闭指引
        if (this.isAssistantGuideActive) {
            this.hideAssistantGuide();
        }
        console.log("点击了助理按钮");
        // 如果窗口已存在，先删除
        if (this.assistantWindow) {
            this.assistantWindow.removeSelf();
            this.assistantWindow = null;
            return;
        }
        
        // 创建助理窗口
        this.createAssistantWindow();
    }
    
    /**
     * 创建助理窗口（包含窗口背景和关闭按钮）
     * 适配手机端：窗口使用屏幕百分比，关闭按钮更大更容易点击
     */
    private createAssistantWindow(): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 手机端适配：窗口宽度90%，高度70%，最小边距20
        const margin = 20;
        const windowWidth = Math.min(stageWidth * 0.9, stageWidth - margin * 2);
        const windowHeight = Math.min(stageHeight * 0.7, stageHeight - margin * 2);
        
        // 使用通用窗口创建函数
        const { container, panel } = this.createCommonWindow(
            windowWidth,
            windowHeight,
            "#ffffff",
            true,
            () => this.closeAssistantWindow()
        );
        
        this.assistantWindow = container;
        this.assistantWindow.name = "assistantWindow";
        
        const windowX = panel.x;
        const windowY = panel.y;
        const closeBtnMargin = Math.min(10, stageWidth * 0.02);
        
        // 创建标题
        const titleLabel = new Laya.Text();
        titleLabel.name = "titleLabel";
        titleLabel.text = "动物朋友";
        titleLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 32));
        titleLabel.color = "#ff6b9d";
        titleLabel.width = windowWidth;
        titleLabel.height = Math.max(40, stageHeight * 0.05);
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(windowX, windowY + closeBtnMargin);
        titleLabel.mouseEnabled = false;
        this.assistantWindow.addChild(titleLabel);
        
        // 创建助理总收益显示（上方，居中）
        const totalEarningsLabel = new Laya.Text();
        totalEarningsLabel.name = "totalEarningsLabel";
        totalEarningsLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        totalEarningsLabel.color = "#00aa00";
        totalEarningsLabel.width = windowWidth;
        totalEarningsLabel.height = Math.max(25, stageHeight * 0.03);
        totalEarningsLabel.align = "center";
        totalEarningsLabel.valign = "middle";
        totalEarningsLabel.pos(windowX, windowY + closeBtnMargin + Math.max(40, stageHeight * 0.05) + 5);
        totalEarningsLabel.mouseEnabled = false;
        this.updateTotalEarningsLabel(totalEarningsLabel);
        this.assistantWindow.addChild(totalEarningsLabel);
        
        // 创建总倍率显示（下方，在总收益下方）
        const totalMultiplierLabel = new Laya.Text();
        totalMultiplierLabel.name = "totalMultiplierLabel";
        totalMultiplierLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        totalMultiplierLabel.color = "#ffd700";
        totalMultiplierLabel.width = windowWidth;
        totalMultiplierLabel.height = Math.max(25, stageHeight * 0.03);
        totalMultiplierLabel.align = "center";
        totalMultiplierLabel.valign = "middle";
        totalMultiplierLabel.pos(windowX, windowY + closeBtnMargin + Math.max(40, stageHeight * 0.05) + Math.max(25, stageHeight * 0.03) + 10);
        totalMultiplierLabel.mouseEnabled = false;
        this.updateTotalMultiplierLabel(totalMultiplierLabel);
        this.assistantWindow.addChild(totalMultiplierLabel);
        
        // 创建助理培训栏（棕色背景，高度为原来的两倍）
        const baseTrainingBarHeight = Math.max(35, Math.min(stageHeight * 0.04, 45));
        const trainingBarHeight = baseTrainingBarHeight * 2; // 高度变为两倍
        const trainingBarY = windowY + closeBtnMargin + Math.max(40, stageHeight * 0.05) + Math.max(25, stageHeight * 0.03) * 2 + 15;
        const trainingBar = new Laya.Sprite();
        trainingBar.name = "trainingBar";
        trainingBar.size(windowWidth, trainingBarHeight);
        trainingBar.graphics.drawRect(0, 0, windowWidth, trainingBarHeight, "#8B4513"); // 棕色背景
        trainingBar.pos(windowX, trainingBarY);
        this.assistantWindow.addChild(trainingBar);
        
        // 左侧显示"基础收益 * (n+1)"（垂直居中）
        const baseRewardLabel = new Laya.Text();
        baseRewardLabel.name = "baseRewardLabel";
        baseRewardLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        baseRewardLabel.color = "#ffffff";
        baseRewardLabel.width = windowWidth * 0.5;
        baseRewardLabel.height = trainingBarHeight;
        baseRewardLabel.align = "left";
        baseRewardLabel.valign = "middle";
        baseRewardLabel.pos(windowX + 10, trainingBarY);
        baseRewardLabel.mouseEnabled = false;
        this.updateBaseRewardLabel(baseRewardLabel);
        this.assistantWindow.addChild(baseRewardLabel);
        
        // 右侧显示培训消耗金额（上方）
        const trainingBtnWidth = Math.max(100, Math.min(windowWidth * 0.3, 150));
        const trainingCostLabel = new Laya.Text();
        trainingCostLabel.name = "trainingCostLabel";
        trainingCostLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
        trainingCostLabel.color = "#ffd700";
        trainingCostLabel.width = trainingBtnWidth;
        trainingCostLabel.height = baseTrainingBarHeight;
        trainingCostLabel.align = "right";
        trainingCostLabel.valign = "middle";
        trainingCostLabel.pos(windowX + windowWidth - trainingBtnWidth - 10, trainingBarY);
        trainingCostLabel.mouseEnabled = false;
        this.updateTrainingCostLabel(trainingCostLabel);
        this.assistantWindow.addChild(trainingCostLabel);
        
        // 右侧显示"助理培训"按钮（下方）
        const trainingBtnHeight = Math.max(28, baseTrainingBarHeight - 10);
        const trainingBtn = new Laya.Sprite();
        trainingBtn.name = "trainingBtn";
        trainingBtn.size(trainingBtnWidth, trainingBtnHeight);
        trainingBtn.graphics.drawRoundRect(0, 0, trainingBtnWidth, trainingBtnHeight, 5, 5, 5, 5, "#4a9eff");
        trainingBtn.pos(windowX + windowWidth - trainingBtnWidth - 10, trainingBarY + baseTrainingBarHeight + (baseTrainingBarHeight - trainingBtnHeight) / 2);
        trainingBtn.mouseEnabled = true;
        trainingBtn.mouseThrough = false;
        
        // 按钮文字
        const trainingBtnLabel = new Laya.Text();
        trainingBtnLabel.text = "助理培训";
        trainingBtnLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        trainingBtnLabel.color = "#ffffff";
        trainingBtnLabel.width = trainingBtnWidth;
        trainingBtnLabel.height = trainingBtnHeight;
        trainingBtnLabel.align = "center";
        trainingBtnLabel.valign = "middle";
        trainingBtnLabel.mouseEnabled = false;
        trainingBtn.addChild(trainingBtnLabel);
        
        // 按钮交互效果
        trainingBtn.on(Laya.Event.MOUSE_DOWN, this, () => {
            trainingBtn.scale(0.95, 0.95);
        });
        trainingBtn.on(Laya.Event.MOUSE_UP, this, () => {
            trainingBtn.scale(1, 1);
        });
        trainingBtn.on(Laya.Event.MOUSE_OUT, this, () => {
            trainingBtn.scale(1, 1);
        });
        
        // 按钮点击事件
        trainingBtn.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            e.stopPropagation();
            this.handleTraining();
        });
        
        this.assistantWindow.addChild(trainingBtn);
        
        // 计算卡片区域的可见区域
        const headerHeight = closeBtnMargin + Math.max(40, stageHeight * 0.05) + Math.max(25, stageHeight * 0.03) * 2 + trainingBarHeight + 20; // 标题、统计信息和培训栏的高度
        const cardsAreaY = windowY + headerHeight;
        const cardsAreaHeight = windowHeight - headerHeight - 10; // 减去底部边距
        
        // 创建滚动遮罩容器（可见区域）
        const scrollMask = new Laya.Sprite();
        scrollMask.name = "scrollMask";
        scrollMask.size(windowWidth, cardsAreaHeight);
        scrollMask.pos(windowX, cardsAreaY);
        scrollMask.mouseEnabled = true;
        scrollMask.mouseThrough = false;
        // 设置遮罩，用于裁剪超出区域的内容
        scrollMask.scrollRect = new Laya.Rectangle(0, 0, windowWidth, cardsAreaHeight);
        this.assistantWindow.addChild(scrollMask);
        
        // 创建助理卡片容器（内容区域，可以超出可见区域）
        const cardsContainer = new Laya.Sprite();
        cardsContainer.name = "cardsContainer";
        cardsContainer.pos(0, 0); // 相对于遮罩容器的位置
        cardsContainer.mouseEnabled = true;
        cardsContainer.mouseThrough = false;
        scrollMask.addChild(cardsContainer);
        
        // 创建助理卡片（2x2网格布局）
        this.createAssistantCards(panel, cardsContainer, windowWidth, cardsAreaHeight);
        
        console.log("创建助理窗口（手机端适配），位置:", windowX, windowY, "尺寸:", windowWidth, windowHeight);
        
        // 检查是否需要显示解锁指引（延迟一帧，确保卡片已创建）
        Laya.timer.frameOnce(1, this, () => {
            this.checkAndShowUnlockGuide();
        });
    }
    
    /**
     * 创建助理卡片
     */
    private createAssistantCards(windowPanel: Laya.Sprite, container: Laya.Sprite, windowWidth: number, windowHeight: number): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 卡片布局：2x2网格
        const cols = 2;
        const rows = Math.ceil(this.assistants.length / cols);
        const cardSpacing = Math.max(10, stageWidth * 0.02); // 卡片间距
        const cardMargin = Math.max(10, stageWidth * 0.02); // 卡片边距
        const cardWidth = (windowWidth - cardMargin * 2 - cardSpacing) / cols;
        // 卡片高度增加，以容纳图片（图片宽度等于卡片宽度）+ 原有内容
        const imageHeight = cardWidth; // 图片高度等于卡片宽度（假设图片是正方形，如果不是可以调整）
        const contentHeight = 150; // 原有内容区域高度
        const cardHeight = imageHeight + contentHeight; // 总高度 = 图片高度 + 内容高度
        
        for (let i = 0; i < this.assistants.length; i++) {
            const assistant = this.assistants[i];
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            const cardX = cardMargin + col * (cardWidth + cardSpacing);
            const cardY = row * (cardHeight + cardSpacing);
            
            // 创建卡片背景
            const card = new Laya.Sprite();
            card.name = "assistantCard_" + assistant.id;
            card.size(cardWidth, cardHeight);
            card.graphics.drawRoundRect(0, 0, cardWidth, cardHeight, 8, 8, 8, 8, assistant.unlocked ? "#f0f0f0" : "#2a2a2a");
            card.pos(cardX, cardY);
            card.mouseEnabled = true;
            card.mouseThrough = false;
            container.addChild(card);
            
            // 助理图片（在名字上方，宽度等于卡片宽度）
            const imageWidth = cardWidth; // 图片宽度等于卡片宽度
            const imageHeight = cardWidth; // 图片高度等于卡片宽度（保持正方形，可根据实际图片调整）
            const imageY = 0; // 图片从顶部开始
            const imageSprite = new Laya.Sprite();
            imageSprite.name = "assistantImage";
            imageSprite.size(imageWidth, imageHeight);
            imageSprite.pos(0, imageY);
            imageSprite.mouseEnabled = false;
            
            // 根据解锁状态和助理ID显示不同图片，使用新的命名方式：{id}/egg.png 和 {id}/head.png（从服务器获取）
            const imagePath = assistant.unlocked 
                ? this.getServerResourceUrl(`resources/assist/${assistant.id}/head.png`)
                : this.getServerResourceUrl(`resources/assist/${assistant.id}/egg.png`);
            console.log("加载助理图片 - ID:", assistant.id, "解锁状态:", assistant.unlocked, "图片路径:", imagePath);
            
            const cachedTexture = Laya.loader.getRes(imagePath);
            if (cachedTexture) {
                imageSprite.graphics.clear();
                imageSprite.graphics.drawTexture(cachedTexture, 0, 0, imageWidth, imageHeight);
                console.log("使用缓存的图片资源:", imagePath);
            } else {
                Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                    if (texture && imageSprite && !imageSprite.destroyed) {
                        imageSprite.graphics.clear();
                        imageSprite.graphics.drawTexture(texture, 0, 0, imageWidth, imageHeight);
                        console.log("动态加载图片成功:", imagePath);
                    } else {
                        // 如果图片加载失败，显示占位框
                        imageSprite.graphics.clear();
                        imageSprite.graphics.drawRect(0, 0, imageWidth, imageHeight, assistant.unlocked ? "#cccccc" : "#666666");
                        console.log("图片加载失败或Sprite已销毁，使用占位框:", imagePath);
                    }
                }), null, Laya.Loader.IMAGE);
                // 加载失败时显示占位框
                imageSprite.graphics.drawRect(0, 0, imageWidth, imageHeight, assistant.unlocked ? "#cccccc" : "#666666");
            }
            
            card.addChild(imageSprite);
            
            // 助理名称（位置下移，在图片下方）
            const nameLabel = new Laya.Text();
            nameLabel.name = "nameLabel";
            nameLabel.text = assistant.name;
            nameLabel.fontSize = Math.max(16, Math.min(stageWidth * 0.04, 20));
            nameLabel.color = assistant.unlocked ? "#333333" : "#888888";
            nameLabel.width = cardWidth;
            nameLabel.height = Math.max(25, contentHeight * 0.15);
            nameLabel.align = "center";
            nameLabel.valign = "middle";
            nameLabel.pos(0, imageY + imageHeight + 5); // 在图片下方
            nameLabel.mouseEnabled = false;
            card.addChild(nameLabel);
            
            // 等级显示
            const levelLabel = new Laya.Text();
            levelLabel.name = "levelLabel";
            levelLabel.text = "Lv:" + assistant.level;
            levelLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
            levelLabel.color = assistant.unlocked ? "#ff6b35" : "#666666";
            levelLabel.width = cardWidth;
            levelLabel.height = Math.max(20, contentHeight * 0.12);
            levelLabel.align = "center";
            levelLabel.valign = "middle";
            levelLabel.pos(0, nameLabel.y + nameLabel.height);
            levelLabel.mouseEnabled = false;
            card.addChild(levelLabel);
            
            // 收益显示（已解锁时显示）
            const earningsLabel = new Laya.Text();
            earningsLabel.name = "earningsLabel";
            if (assistant.unlocked && assistant.level > 0) {
                const earnings = Math.floor(assistant.unlockCost * assistant.level / 100);
                earningsLabel.text = "秒赚: " + this.formatMoney(earnings);
            } else {
                earningsLabel.text = "";
            }
            earningsLabel.fontSize = Math.max(11, Math.min(stageWidth * 0.028, 14));
            earningsLabel.color = "#00aa00";
            earningsLabel.width = cardWidth; // 占满宽度
            earningsLabel.height = Math.max(18, contentHeight * 0.1);
            earningsLabel.align = "center";
            earningsLabel.valign = "middle";
            earningsLabel.pos(0, levelLabel.y + levelLabel.height + 5);
            earningsLabel.mouseEnabled = false;
            card.addChild(earningsLabel);
            
            // 解锁条件或升级费用显示
            const costLabel = new Laya.Text();
            costLabel.name = "costLabel";
            if (!assistant.unlocked) {
                // 显示解锁条件
                const unlockCheck = this.checkAssistantUnlockCondition(assistant.id);
                if (unlockCheck.canUnlock) {
                    costLabel.text = "解锁: " + this.formatMoney(assistant.unlockCost);
                } else {
                    // 显示解锁条件
                    let conditionText = "";
                    if (assistant.id === 1) {
                        conditionText = "解锁: " + this.formatMoney(assistant.unlockCost);
                    } else {
                        const prevAssistant = this.assistants.find(a => a.id === assistant.id - 1);
                        const requiredLevel = 20 * (assistant.id - 1);
                        if (prevAssistant && !prevAssistant.unlocked) {
                            conditionText = "需上一级解锁";
                        } else if (prevAssistant && prevAssistant.level < 10) {
                            conditionText = "需上一级10级";
                        } else if (this.playerLevel < requiredLevel) {
                            conditionText = "需主角" + requiredLevel + "级";
                        } else {
                            conditionText = "解锁: " + this.formatMoney(assistant.unlockCost);
                        }
                    }
                    costLabel.text = conditionText;
                }
            } else {
                // 计算升级费用：n级升级需要解锁费用 * (1 + n * 0.1)
                const upgradeCost = Math.floor(assistant.unlockCost * (1 + assistant.level * 0.1));
                costLabel.text = "升级: " + this.formatMoney(upgradeCost);
            }
            costLabel.fontSize = Math.max(11, Math.min(stageWidth * 0.028, 14));
            costLabel.color = "#ff6b35";
            costLabel.width = cardWidth;
            costLabel.height = Math.max(18, contentHeight * 0.1);
            costLabel.align = "center";
            costLabel.valign = "middle";
            costLabel.pos(0, earningsLabel.y + earningsLabel.height + 5);
            costLabel.mouseEnabled = false;
            card.addChild(costLabel);
            
            // 解锁/升级按钮
            const actionBtn = new Laya.Sprite();
            actionBtn.name = "actionBtn";
            const btnWidth = Math.max(60, cardWidth * 0.7);
            const btnHeight = Math.max(30, contentHeight * 0.15);
            actionBtn.size(btnWidth, btnHeight);
            const btnColor = assistant.unlocked ? "#ff6b35" : "#00aa00";
            actionBtn.graphics.drawRoundRect(0, 0, btnWidth, btnHeight, 5, 5, 5, 5, btnColor);
            actionBtn.pos((cardWidth - btnWidth) / 2, cardHeight - btnHeight - 10);
            actionBtn.mouseEnabled = true;
            actionBtn.mouseThrough = false;
            
            // 按钮文字
            const btnLabel = new Laya.Text();
            btnLabel.text = assistant.unlocked ? "升级" : "解锁";
            btnLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
            btnLabel.color = "#ffffff";
            btnLabel.width = btnWidth;
            btnLabel.height = btnHeight;
            btnLabel.align = "center";
            btnLabel.valign = "middle";
            btnLabel.mouseEnabled = false;
            actionBtn.addChild(btnLabel);
            
            // 按钮交互效果和连点功能
            const repeatHandler = () => {
                this.handleAssistantAction(assistant.id);
            };
            actionBtn.on(Laya.Event.MOUSE_DOWN, this, (e: Laya.Event) => {
                e.stopPropagation();
                actionBtn.scale(0.95, 0.95);
                // 立即执行一次点击
                this.handleAssistantAction(assistant.id);
                // 停止之前的连点和定时器（如果存在）
                this.stopAssistantRepeat(assistant.id);
                this.clearAssistantLongPressTimer(assistant.id);
                // 设置0.5秒定时器，如果0.5秒后还在按住，才开始持续升级
                const longPressHandler = () => {
                    // 0.5秒后开始连点：1秒5次，即每200ms执行一次
                    this.assistantRepeatHandlers.set(assistant.id, repeatHandler);
                    Laya.timer.loop(200, this, repeatHandler);
                    this.assistantLongPressTimers.delete(assistant.id);
                };
                this.assistantLongPressTimers.set(assistant.id, longPressHandler);
                Laya.timer.once(500, this, longPressHandler);
            });
            
            actionBtn.on(Laya.Event.MOUSE_UP, this, (e: Laya.Event) => {
                e.stopPropagation();
                actionBtn.scale(1, 1);
                // 清除长按定时器
                this.clearAssistantLongPressTimer(assistant.id);
                // 停止持续升级（如果正在持续升级）
                this.stopAssistantRepeat(assistant.id);
            });
            
            actionBtn.on(Laya.Event.MOUSE_OUT, this, (e: Laya.Event) => {
                e.stopPropagation();
                actionBtn.scale(1, 1);
                this.clearAssistantLongPressTimer(assistant.id);
                this.stopAssistantRepeat(assistant.id);
            });
            
            card.addChild(actionBtn);
        }
        
        // 计算内容总高度
        const totalContentHeight = rows * (cardHeight + cardSpacing) - cardSpacing + cardMargin * 2;
        container.size(windowWidth, Math.max(totalContentHeight, windowHeight));
        
        // 如果内容高度超过可见区域，设置遮罩并启用滚动
        if (totalContentHeight > windowHeight) {
            // 找到遮罩容器
            const scrollMask = container.parent as Laya.Sprite;
            if (scrollMask && scrollMask.name === "scrollMask") {
                // 设置遮罩的scrollRect，实现裁剪
                scrollMask.scrollRect = new Laya.Rectangle(0, 0, windowWidth, windowHeight);
                
                // 添加触摸滚动功能（支持手机端）
                let startY = 0;
                let currentY = 0;
                let isDragging = false;
                
                const onTouchStart = (e: Laya.Event) => {
                    startY = e.stageY;
                    currentY = container.y;
                    isDragging = true;
                    e.stopPropagation();
                };
                
                const onTouchMove = (e: Laya.Event) => {
                    if (isDragging) {
                        const deltaY = e.stageY - startY;
                        let newY = currentY + deltaY;
                        
                        // 限制滚动范围
                        const maxScrollY = 0; // 顶部边界
                        const minScrollY = windowHeight - totalContentHeight; // 底部边界
                        newY = Math.max(minScrollY, Math.min(maxScrollY, newY));
                        
                        container.y = newY;
                        e.stopPropagation();
                    }
                };
                
                const onTouchEnd = () => {
                    isDragging = false;
                };
                
                // 在scrollMask上监听按下事件
                scrollMask.on(Laya.Event.MOUSE_DOWN, this, onTouchStart);
                // 在stage上监听移动和抬起事件（确保即使鼠标移出也能响应）
                Laya.stage.on(Laya.Event.MOUSE_MOVE, this, onTouchMove);
                Laya.stage.on(Laya.Event.MOUSE_UP, this, onTouchEnd);
                
                console.log("启用助理列表滚动，内容高度:", totalContentHeight, "可见高度:", windowHeight);
            }
        } else {
            console.log("助理列表内容未超出可见区域，无需滚动");
        }
    }
    
    /**
     * 停止助理连点
     */
    private stopAssistantRepeat(assistantId: number): void {
        const handler = this.assistantRepeatHandlers.get(assistantId);
        if (handler) {
            Laya.timer.clear(this, handler);
            this.assistantRepeatHandlers.delete(assistantId);
        }
    }
    
    /**
     * 清除助理按钮长按定时器
     */
    private clearAssistantLongPressTimer(assistantId: number): void {
        const timerHandler = this.assistantLongPressTimers.get(assistantId);
        if (timerHandler) {
            Laya.timer.clear(this, timerHandler);
            this.assistantLongPressTimers.delete(assistantId);
        }
    }
    
    /**
     * 处理助理操作（解锁或升级）
     */
    private handleAssistantAction(assistantId: number): void {
        const assistant = this.assistants.find(a => a.id === assistantId);
        if (!assistant) {
            console.log("助理不存在，ID:", assistantId);
            return;
        }
        
        if (!assistant.unlocked) {
            // 解锁操作：先检查解锁条件
            const unlockCheck = this.checkAssistantUnlockCondition(assistant.id);
            if (!unlockCheck.canUnlock) {
                this.showPopup(unlockCheck.reason, "center", "#ff6666");
                console.log("解锁条件不满足:", unlockCheck.reason);
                return;
            }
            
            if (this.money >= assistant.unlockCost) {
                this.money -= assistant.unlockCost;
                assistant.unlocked = true;
                assistant.level = 1; // 解锁后等级为1
                this.updateMoneyDisplay();
                this.updateMultiplierDisplay(); // 更新倍率显示
                this.updatePerSecondDisplay(); // 更新秒赚显示
                this.showPopup("解锁成功！", "center", "#00ff00");
                console.log("解锁助理:", assistant.name, "当前等级:", assistant.level);
                
                // 如果正在显示解锁指引，关闭它
                if (this.isAssistantUnlockGuideActive) {
                    this.hideUnlockGuide();
                }
                
                // 刷新窗口
                this.refreshAssistantWindow();
                
                // 更新底部按钮显示状态（1号助理解锁后显示所有按钮）
                this.updateBottomButtonsVisibility();
                // 更新桌子上方的助理图片显示
                this.updateAssistantAfterImage();
                // 全屏显示after图片
                this.showFullScreenAfterImage(assistant.id);
                // 数据会通过定时保存自动保存，无需手动调用
            } else {
                // 金币不足时，只显示简单提示
                this.showPopup("金币不足！", "center", "#ff6666");
                console.log("金币不足，无法解锁！需要:", assistant.unlockCost, "当前:", this.money);
            }
        } else {
            // 升级操作
            if (assistant.level >= 50) {
                this.showPopup("已达到最高等级！", "center", "#ffaa00");
                console.log("助理已达到最高等级:", assistant.name);
                return;
            }
            
            // 计算升级费用：n级升级需要解锁费用 * (1 + n * 0.1)
            const upgradeCost = Math.floor(assistant.unlockCost * (1 + assistant.level * 0.1));
            
            if (this.money >= upgradeCost) {
                this.money -= upgradeCost;
                const previousLevel = assistant.level;
                assistant.level++;
                this.updateMoneyDisplay();
                this.updateMultiplierDisplay(); // 更新倍率显示（如果达到20级会有加成）
                this.updatePerSecondDisplay(); // 更新秒赚显示
                // 删除升级成功弹窗
                console.log("升级助理:", assistant.name, "当前等级:", assistant.level);
                
                // 如果正在显示升级指引，关闭它
                if (this.isAssistantUpgradeGuideActive) {
                    this.hideUpgradeGuide();
                }
                
                // 如果正好升级到20级，显示after图片
                if (assistant.level === 20 && previousLevel === 19) {
                    // 计算倍率值：20% * 助理ID
                    const multiplierValue = 20 * assistant.id;
                    this.showFullScreenAfterImageWithText(assistant.id, `倍率提升${multiplierValue.toFixed(1)}%`);
                }
                
                // 刷新窗口
                this.refreshAssistantWindow();
                // 数据会通过定时保存自动保存，无需手动调用
            } else {
                // 金币不足时，只显示简单提示
                this.showPopup("金币不足！", "center", "#ff6666");
                console.log("金币不足，无法升级！需要:", upgradeCost, "当前:", this.money);
            }
        }
    }
    
    /**
     * 刷新助理窗口（重新创建所有卡片）
     */
    private refreshAssistantWindow(): void {
        if (!this.assistantWindow) {
            return;
        }
        
        // 找到滚动遮罩容器
        const scrollMask = this.assistantWindow.getChildByName("scrollMask") as Laya.Sprite;
        if (scrollMask) {
            // 找到卡片容器（在scrollMask内部）
            const cardsContainer = scrollMask.getChildByName("cardsContainer") as Laya.Sprite;
        if (cardsContainer) {
            cardsContainer.removeChildren();
            const windowPanel = this.assistantWindow.getChildByName("windowPanel") as Laya.Sprite;
            if (windowPanel) {
                const stageWidth = Laya.stage.width || 750;
                const stageHeight = Laya.stage.height || 1334;
                const windowWidth = windowPanel.width;
                const windowHeight = windowPanel.height;
                    // 计算卡片区域高度
                    const closeBtnMargin = Math.min(10, stageWidth * 0.02);
                    const baseTrainingBarHeight = Math.max(35, Math.min(stageHeight * 0.04, 45));
                    const trainingBarHeight = baseTrainingBarHeight * 2; // 高度变为两倍
                    const headerHeight = closeBtnMargin + Math.max(40, stageHeight * 0.05) + Math.max(25, stageHeight * 0.03) * 2 + trainingBarHeight + 20;
                    const cardsAreaHeight = windowHeight - headerHeight - 10;
                    this.createAssistantCards(windowPanel, cardsContainer, windowWidth, cardsAreaHeight);
                }
            }
        }
        
        // 更新总收益显示
        const totalEarningsLabel = this.assistantWindow.getChildByName("totalEarningsLabel") as Laya.Text;
        if (totalEarningsLabel) {
            this.updateTotalEarningsLabel(totalEarningsLabel);
        }
        
        // 更新总倍率显示
        const totalMultiplierLabel = this.assistantWindow.getChildByName("totalMultiplierLabel") as Laya.Text;
        if (totalMultiplierLabel) {
            this.updateTotalMultiplierLabel(totalMultiplierLabel);
        }
        
        // 更新基础收益显示
        const baseRewardLabel = this.assistantWindow.getChildByName("baseRewardLabel") as Laya.Text;
        if (baseRewardLabel) {
            this.updateBaseRewardLabel(baseRewardLabel);
        }
        
        // 更新培训消耗显示
        const trainingCostLabel = this.assistantWindow.getChildByName("trainingCostLabel") as Laya.Text;
        if (trainingCostLabel) {
            this.updateTrainingCostLabel(trainingCostLabel);
        }
    }
    
    /**
     * 更新总收益显示
     */
    private updateTotalEarningsLabel(label: Laya.Text): void {
        // 计算所有助理的基础秒赚
        let baseEarnings = 0;
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level > 0) {
                baseEarnings += Math.floor(assistant.unlockCost * assistant.level / 100);
            }
        }
        // 乘以培训倍率（2的n次方）
        const trainingMultiplier = Math.pow(2, this.trainingCount);
        const finalEarnings = baseEarnings * trainingMultiplier;
        // 直接显示秒赚
        label.text = "秒赚: " + this.formatMoney(finalEarnings) + "/秒";
    }
    
    /**
     * 更新助理总倍率显示
     */
    private updateTotalMultiplierLabel(label: Laya.Text): void {
        // 只计算助理部分的倍率加成
        let assistantMultiplier = 0;
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level >= 20) {
                // 第n个助理（id为n）升到20级，增加20%*n的倍率
                assistantMultiplier += 0.2 * assistant.id;
            }
        }
        const assistantBonus = assistantMultiplier * 100;
        if (assistantBonus > 0) {
            label.text = "助理总倍率加成: +" + assistantBonus.toFixed(0) + "%";
        } else {
            label.text = "助理总倍率加成: 0%";
        }
    }
    
    /**
     * 更新基础收益显示
     */
    private updateBaseRewardLabel(label: Laya.Text): void {
        const multiplier = Math.pow(2, this.trainingCount); // 培训n次，基础收益是原来的2的n次方倍
        label.text = "基础收益 * " + multiplier;
    }
    
    /**
     * 更新培训消耗显示
     */
    private updateTrainingCostLabel(label: Laya.Text): void {
        // 检查是否解锁足够数量的助理
        const unlockedCount = this.assistants.filter(a => a.unlocked).length;
        const requiredCount = Main.TRAINING_REQUIRED_ASSISTANT_COUNT;
        if (unlockedCount < requiredCount) {
            label.text = `需解锁${requiredCount}位助理`;
            return;
        }
        
        // 计算培训消耗：第一次培训消耗为第8位助理的解锁金额，后续每次乘2
        const targetAssistant = this.assistants.find(a => a.id === requiredCount);
        if (!targetAssistant) {
            label.text = "数据错误";
            return;
        }
        const baseCost = targetAssistant.unlockCost; // 第一次培训消耗（第8位助理的解锁金额）
        const trainingCost = baseCost * Math.pow(2, this.trainingCount); // 后续每次乘2
        label.text = this.formatMoney(trainingCost);
    }
    
    /**
     * 处理助理培训
     */
    private handleTraining(): void {
        // 检查是否解锁足够数量的助理
        const unlockedCount = this.assistants.filter(a => a.unlocked).length;
        const requiredCount = Main.TRAINING_REQUIRED_ASSISTANT_COUNT;
        if (unlockedCount < requiredCount) {
            // 弹窗提示，不要被窗口阻拦
            this.showPopup(`需要解锁${requiredCount}位助理才能进行培训`, "center", "#ff6666");
            console.log("培训失败：未解锁足够数量的助理，当前解锁数量:", unlockedCount, "需要:", requiredCount);
            return;
        }
        
        // 计算培训消耗：第一次培训消耗为第8位助理的解锁金额，后续每次乘2
        const targetAssistant = this.assistants.find(a => a.id === requiredCount);
        if (!targetAssistant) {
            this.showPopup("数据错误，无法进行培训", "center", "#ff6666");
            console.log("培训失败：找不到第", requiredCount, "位助理");
            return;
        }
        const baseCost = targetAssistant.unlockCost; // 第一次培训消耗（第8位助理的解锁金额）
        const trainingCost = baseCost * Math.pow(2, this.trainingCount); // 后续每次乘2
        
        // 检查金币是否足够
        if (this.money < trainingCost) {
            this.showPopup("金币不足！需要 " + this.formatMoney(trainingCost), "center", "#ff6666");
            console.log("培训失败：金币不足，需要:", trainingCost, "当前:", this.money);
            return;
        }
        
        // 执行培训
        this.money -= trainingCost;
        this.trainingCount++;
        this.updateMoneyDisplay();
        this.updateMultiplierDisplay(); // 更新倍率显示（因为基础收益改变了）
        this.updatePerSecondDisplay(); // 更新秒赚显示
        
        // 刷新助理窗口
        this.refreshAssistantWindow();
        
        console.log("培训成功！培训次数:", this.trainingCount, "消耗:", trainingCost);
    }
    
    /**
     * 更新挑战总倍率显示
     */
    private updateChallengeTotalMultiplierLabel(label: Laya.Text): void {
        // 只计算挑战部分的倍率加成
        let challengeMultiplier = 0;
        for (const challenge of this.challenges) {
            if (challenge.completed) {
                // 第n个挑战（id为n）完成，增加50%*n的倍率
                challengeMultiplier += 0.5 * challenge.id;
            }
        }
        const challengeBonus = challengeMultiplier * 100;
        if (challengeBonus > 0) {
            label.text = "挑战总倍率加成: +" + challengeBonus.toFixed(0) + "%";
        } else {
            label.text = "挑战总倍率加成: 0%";
        }
    }
    
    /**
     * 关闭助理窗口
     */
    private closeAssistantWindow(): void {
        // 关闭窗口后，检查是否需要显示升级按钮指引
        Laya.timer.frameOnce(1, this, () => {
            this.checkAndShowUpgradeBtnGuide();
        });
        if (this.assistantWindow) {
            this.assistantWindow.removeSelf();
            this.assistantWindow = null;
            console.log("关闭助理窗口");
        }
    }
    
    /**
     * 通用窗口创建函数
     * @param windowWidth 窗口宽度
     * @param windowHeight 窗口高度
     * @param bgColor 窗口背景颜色（默认白色）
     * @param hasCloseButton 是否有关闭按钮（默认true）
     * @param onClose 关闭回调函数
     * @returns 返回窗口容器和窗口面板 {container: Laya.Sprite, panel: Laya.Sprite, closeButton?: Laya.Sprite}
     */
    private createCommonWindow(
        windowWidth: number, 
        windowHeight: number, 
        bgColor: string = "#ffffff",
        hasCloseButton: boolean = true,
        onClose?: () => void
    ): {container: Laya.Sprite, panel: Laya.Sprite, closeButton?: Laya.Sprite} {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        const windowX = (stageWidth - windowWidth) / 2;
        const windowY = (stageHeight - windowHeight) / 2;
        
        // 创建窗口容器
        const container = new Laya.Sprite();
        container.name = "windowContainer";
        container.mouseEnabled = true;
        container.mouseThrough = false;
        
        // 创建窗口背景遮罩层（半透明黑色背景）
        const bgMask = new Laya.Sprite();
        bgMask.name = "windowBgMask";
        bgMask.size(stageWidth, stageHeight);
        bgMask.graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        bgMask.alpha = 0.5;
        bgMask.mouseEnabled = true;
        bgMask.mouseThrough = false;
        // 点击背景遮罩层关闭窗口
        bgMask.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            e.stopPropagation();
            if (onClose) {
                onClose();
            }
        });
        container.addChild(bgMask);
        
        // 创建窗口主体（带圆角）
        const windowPanel = new Laya.Sprite();
        windowPanel.name = "windowPanel";
        windowPanel.size(windowWidth, windowHeight);
        const cornerRadius = 10;
        windowPanel.graphics.drawRoundRect(0, 0, windowWidth, windowHeight, cornerRadius, cornerRadius, cornerRadius, cornerRadius, bgColor);
        windowPanel.pos(windowX, windowY);
        windowPanel.mouseEnabled = true;
        windowPanel.mouseThrough = false;
        // 阻止窗口面板的点击事件冒泡到背景遮罩层
        windowPanel.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            e.stopPropagation();
        });
        container.addChild(windowPanel);
        
        let closeButton: Laya.Sprite | undefined = undefined;
        
        // 创建关闭按钮（如果需要）
        if (hasCloseButton) {
            const closeBtnSize = Math.max(50, Math.min(stageWidth * 0.08, 60));
            closeButton = new Laya.Sprite();
            closeButton.name = "closeButton";
            closeButton.size(closeBtnSize, closeBtnSize);
            closeButton.graphics.drawRoundRect(0, 0, closeBtnSize, closeBtnSize, 8, 8, 8, 8, "#ff3333");
            // 位置：右上角，距离边缘10像素（如果屏幕太小则使用5像素）
            const closeBtnMargin = Math.min(10, stageWidth * 0.02);
            closeButton.pos(windowX + windowWidth - closeBtnSize - closeBtnMargin, windowY + closeBtnMargin);
            closeButton.mouseEnabled = true;
            closeButton.mouseThrough = false;
            
            // 添加鼠标悬停效果（手机端可能不支持，但保留）
            closeButton.on(Laya.Event.MOUSE_OVER, this, () => {
                closeButton!.alpha = 0.8;
            });
            closeButton.on(Laya.Event.MOUSE_OUT, this, () => {
                closeButton!.alpha = 1.0;
            });
            
            // 添加点击事件：点击后关闭窗口
            closeButton.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
                e.stopPropagation();
                if (onClose) {
                    onClose();
                }
            });
            
            // 创建关闭按钮文字（X符号，字体大小随按钮大小调整）
            const closeLabel = new Laya.Text();
            closeLabel.text = "×";
            closeLabel.fontSize = Math.floor(closeBtnSize * 0.6); // 字体大小为按钮的60%
            closeLabel.color = "#ffffff";
            closeLabel.width = closeBtnSize;
            closeLabel.height = closeBtnSize;
            closeLabel.align = "center";
            closeLabel.valign = "middle";
            closeLabel.mouseEnabled = false; // 文字不阻挡点击
            closeButton.addChild(closeLabel);
            
            container.addChild(closeButton);
        }
        
        // 添加到舞台
        Laya.stage.addChild(container);
        
        // 确保弹窗容器在窗口之上（如果弹窗容器存在）
        if (this.popupContainer && Laya.stage.contains(this.popupContainer)) {
            const windowIndex = Laya.stage.getChildIndex(container);
            const popupIndex = Laya.stage.getChildIndex(this.popupContainer);
            if (popupIndex < windowIndex) {
                Laya.stage.setChildIndex(this.popupContainer, windowIndex + 1);
            }
        }
        
        return { container, panel: windowPanel, closeButton };
    }
    
    /**
     * 创建设置窗口
     */
    private createSettingsWindow(): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 手机端适配：窗口宽度80%，高度60%
        const margin = 20;
        const windowWidth = Math.min(stageWidth * 0.8, stageWidth - margin * 2);
        const windowHeight = Math.min(stageHeight * 0.8, stageHeight - margin * 2);
        
        // 使用通用窗口创建函数
        const { container, panel } = this.createCommonWindow(
            windowWidth,
            windowHeight,
            "#ffffff",
            true,
            () => this.closeSettingsWindow()
        );
        
        this.settingsWindow = container;
        this.settingsWindow.name = "settingsWindow";
        
        const windowX = panel.x;
        const windowY = panel.y;
        
        // 创建标题
        const titleLabel = new Laya.Text();
        titleLabel.name = "titleLabel";
        titleLabel.text = "设置";
        titleLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 32));
        titleLabel.color = "#333333";
        titleLabel.width = windowWidth;
        titleLabel.height = Math.max(40, stageHeight * 0.05);
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(windowX, windowY + 20);
        titleLabel.mouseEnabled = false;
        this.settingsWindow.addChild(titleLabel);
        
        // 内容区域（从上到下：头像、等级、点击收益、秒赚、退出按钮）
        const contentStartY = windowY + Math.max(60, stageHeight * 0.08);
        const itemSpacing = Math.max(30, stageHeight * 0.04);
        const itemFontSize = Math.max(18, Math.min(stageWidth * 0.045, 24));
        let currentY = contentStartY;
        
        // 1. 头像
        const avatarSize = Math.max(80, Math.min(stageWidth * 0.2, 120));
        const settingsAvatar = new Laya.Sprite();
        settingsAvatar.name = "settingsAvatar";
        settingsAvatar.size(avatarSize, avatarSize);
        // 使用和主界面相同的头像（从服务器获取）
        Laya.loader.load(this.getServerResourceUrl("resources/avatar.png"), Laya.Handler.create(this, (texture: Laya.Texture) => {
            if (texture) {
                settingsAvatar.graphics.drawTexture(texture, 0, 0, avatarSize, avatarSize);
            } else {
                settingsAvatar.graphics.drawRect(0, 0, avatarSize, avatarSize, "#5a9");
            }
        }), null, null, 0, false, null, false);
        settingsAvatar.pos(windowX + (windowWidth - avatarSize) / 2, currentY);
        settingsAvatar.mouseEnabled = false;
        this.settingsWindow.addChild(settingsAvatar);
        currentY += avatarSize + itemSpacing;
        
        // 2. 等级
        const levelText = new Laya.Text();
        levelText.name = "levelText";
        levelText.text = "等级: " + this.playerLevel + "级";
        levelText.fontSize = itemFontSize;
        levelText.color = "#333333";
        levelText.width = windowWidth;
        levelText.height = itemFontSize * 1.5;
        levelText.align = "center";
        levelText.valign = "middle";
        levelText.pos(windowX, currentY);
        levelText.mouseEnabled = false;
        this.settingsWindow.addChild(levelText);
        currentY += itemFontSize * 1.5 + itemSpacing;
        
        // 3. 点击收益
        const clickRewardText = new Laya.Text();
        clickRewardText.name = "clickRewardText";
        this.updateSettingsClickReward(clickRewardText);
        clickRewardText.fontSize = itemFontSize;
        clickRewardText.color = "#00ff00";
        clickRewardText.width = windowWidth;
        clickRewardText.height = itemFontSize * 1.5;
        clickRewardText.align = "center";
        clickRewardText.valign = "middle";
        clickRewardText.pos(windowX, currentY);
        clickRewardText.mouseEnabled = false;
        this.settingsWindow.addChild(clickRewardText);
        currentY += itemFontSize * 1.5 + itemSpacing;
        
        // 4. 秒赚
        const perSecondText = new Laya.Text();
        perSecondText.name = "perSecondText";
        this.updateSettingsPerSecond(perSecondText);
        perSecondText.fontSize = itemFontSize;
        perSecondText.color = "#00aa00";
        perSecondText.width = windowWidth;
        perSecondText.height = itemFontSize * 1.5;
        perSecondText.align = "center";
        perSecondText.valign = "middle";
        perSecondText.pos(windowX, currentY);
        perSecondText.mouseEnabled = false;
        this.settingsWindow.addChild(perSecondText);
        currentY += itemFontSize * 1.5 + itemSpacing;
        
        // 4.5. 基础本金/秒赚倍率显示
        const baseEarningsMultiplierText = new Laya.Text();
        baseEarningsMultiplierText.name = "baseEarningsMultiplierText";
        baseEarningsMultiplierText.fontSize = itemFontSize;
        baseEarningsMultiplierText.color = "#ffd700";
        baseEarningsMultiplierText.width = windowWidth;
        baseEarningsMultiplierText.height = itemFontSize * 1.5;
        baseEarningsMultiplierText.align = "center";
        baseEarningsMultiplierText.valign = "middle";
        baseEarningsMultiplierText.pos(windowX, currentY);
        baseEarningsMultiplierText.mouseEnabled = false;
        this.updateSettingsBaseEarningsMultiplier(baseEarningsMultiplierText);
        this.settingsWindow.addChild(baseEarningsMultiplierText);
        currentY += itemFontSize * 1.5 + itemSpacing;
        
        // 4.6. 当前总倍率加成显示
        const totalMultiplierText = new Laya.Text();
        totalMultiplierText.name = "totalMultiplierText";
        totalMultiplierText.fontSize = itemFontSize;
        totalMultiplierText.color = "#ffd700";
        totalMultiplierText.width = windowWidth;
        totalMultiplierText.height = itemFontSize * 1.5;
        totalMultiplierText.align = "center";
        totalMultiplierText.valign = "middle";
        totalMultiplierText.pos(windowX, currentY);
        totalMultiplierText.mouseEnabled = false;
        this.updateSettingsTotalMultiplier(totalMultiplierText);
        this.settingsWindow.addChild(totalMultiplierText);
        currentY += itemFontSize * 1.5 + itemSpacing;
        
        // 5. 退出按钮
        const exitBtnWidth = Math.max(120, windowWidth * 0.5);
        const exitBtnHeight = Math.max(50, stageHeight * 0.06);
        const exitBtn = new Laya.Sprite();
        exitBtn.name = "exitBtn";
        exitBtn.size(exitBtnWidth, exitBtnHeight);
        exitBtn.graphics.drawRoundRect(0, 0, exitBtnWidth, exitBtnHeight, 8, 8, 8, 8, "#ff3333");
        exitBtn.pos(windowX + (windowWidth - exitBtnWidth) / 2, currentY);
        exitBtn.mouseEnabled = true;
        exitBtn.mouseThrough = false;
        
        // 退出按钮文字
        const exitBtnLabel = new Laya.Text();
        exitBtnLabel.text = "退出";
        exitBtnLabel.fontSize = Math.max(18, Math.min(stageWidth * 0.04, 24));
        exitBtnLabel.color = "#ffffff";
        exitBtnLabel.width = exitBtnWidth;
        exitBtnLabel.height = exitBtnHeight;
        exitBtnLabel.align = "center";
        exitBtnLabel.valign = "middle";
        exitBtnLabel.mouseEnabled = false;
        exitBtn.addChild(exitBtnLabel);
        
        // 按钮交互效果
        exitBtn.on(Laya.Event.MOUSE_DOWN, this, () => {
            exitBtn.scale(0.95, 0.95);
        });
        exitBtn.on(Laya.Event.MOUSE_UP, this, () => {
            exitBtn.scale(1, 1);
        });
        exitBtn.on(Laya.Event.MOUSE_OUT, this, () => {
            exitBtn.scale(1, 1);
        });
        
        // 退出按钮点击事件
        exitBtn.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            e.stopPropagation();
            this.exitGame();
        });
        
        this.settingsWindow.addChild(exitBtn);
        
        console.log("创建设置窗口，位置:", windowX, windowY, "尺寸:", windowWidth, windowHeight);
    }
    
    /**
     * 更新设置窗口的点击收益显示
     */
    private updateSettingsClickReward(label: Laya.Text): void {
        // 直接显示最终值（乘以培训倍率后的值）
        const finalReward = this.getClickReward();
        label.text = "点击收益: " + this.formatMoney(finalReward);
    }
    
    /**
     * 更新设置窗口的秒赚显示
     */
    private updateSettingsPerSecond(label: Laya.Text): void {
        // 计算所有助理的基础秒赚
        let baseEarnings = 0;
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level > 0) {
                baseEarnings += Math.floor(assistant.unlockCost * assistant.level / 100);
            }
        }
        // 乘以培训倍率（2的n次方）
        const trainingMultiplier = Math.pow(2, this.trainingCount);
        const finalEarnings = baseEarnings * trainingMultiplier;
        // 直接显示最终值
        label.text = "秒赚: " + this.formatMoney(finalEarnings) + "/秒";
    }
    
    /**
     * 更新设置窗口的基础收益倍率显示
     */
    private updateSettingsBaseEarningsMultiplier(label: Laya.Text): void {
        const displayMultiplier = this.trainingCount + 1;
        label.text = "基础收益 * " + displayMultiplier;
    }
    
    /**
     * 更新设置窗口的当前总倍率加成显示
     */
    private updateSettingsTotalMultiplier(label: Laya.Text): void {
        // 重新计算倍率（确保是最新的）
        this.calculateMultiplier();
        // 计算倍率加成百分比（减去基础倍率1.0）
        const multiplierBonus = (this.clickMultiplier - 1.0) * 100;
        if (multiplierBonus > 0) {
            label.text = "当前总倍率加成: +" + multiplierBonus.toFixed(0) + "%";
        } else {
            label.text = "当前总倍率加成: 0%";
        }
    }
    
    /**
     * 关闭设置窗口
     */
    private closeSettingsWindow(): void {
        // 关闭窗口后，检查是否需要显示升级按钮指引
        Laya.timer.frameOnce(1, this, () => {
            this.checkAndShowUpgradeBtnGuide();
        });
        if (this.settingsWindow) {
            this.settingsWindow.removeSelf();
            this.settingsWindow = null;
            console.log("关闭设置窗口");
        }
    }
    
    /**
     * 创建挑战窗口（包含窗口背景和关闭按钮）
     * 适配手机端：窗口使用屏幕百分比，关闭按钮更大更容易点击
     */
    private createChallengeWindow(): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 手机端适配：窗口宽度90%，高度75%，最小边距20
        const margin = 20;
        const windowWidth = Math.min(stageWidth * 0.9, stageWidth - margin * 2);
        const windowHeight = Math.min(stageHeight * 0.75, stageHeight - margin * 2);
        
        // 使用通用窗口创建函数
        const { container, panel } = this.createCommonWindow(
            windowWidth,
            windowHeight,
            "#ffffff",
            true,
            () => this.closeChallengeWindow()
        );
        
        this.challengeWindow = container;
        this.challengeWindow.name = "challengeWindow";
        
        const windowX = panel.x;
        const windowY = panel.y;
        const closeBtnMargin = Math.min(10, stageWidth * 0.02);
        
        // 创建标题背景（红色横幅，带金色装饰）
        const titleBgHeight = Math.max(50, Math.min(stageHeight * 0.06, 70));
        const titleBg = new Laya.Sprite();
        titleBg.name = "titleBg";
        titleBg.size(windowWidth, titleBgHeight);
        titleBg.graphics.drawRect(0, 0, windowWidth, titleBgHeight, "#cc0000");
        // 添加金色边框
        titleBg.graphics.drawRect(2, 2, windowWidth - 4, titleBgHeight - 4, "#ffd700", "#cc0000", 2);
        titleBg.pos(windowX, windowY + closeBtnMargin);
        this.challengeWindow.addChild(titleBg);
        
        // 创建标题文字
        const titleLabel = new Laya.Text();
        titleLabel.name = "titleLabel";
        titleLabel.text = "助理试炼";
        titleLabel.fontSize = Math.max(28, Math.min(stageWidth * 0.07, 36));
        titleLabel.color = "#000000"; // 改为黑色，在金色/红色背景上更清晰
        titleLabel.width = windowWidth;
        titleLabel.height = titleBgHeight;
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(windowX, windowY + closeBtnMargin);
        titleLabel.mouseEnabled = false;
        this.challengeWindow.addChild(titleLabel);
        
        // 创建挑战总倍率显示（居中显示）
        const totalMultiplierLabel = new Laya.Text();
        totalMultiplierLabel.name = "challengeTotalMultiplierLabel";
        totalMultiplierLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        totalMultiplierLabel.color = "#ffd700";
        totalMultiplierLabel.width = windowWidth;
        totalMultiplierLabel.height = Math.max(25, stageHeight * 0.03);
        totalMultiplierLabel.align = "center";
        totalMultiplierLabel.valign = "middle";
        totalMultiplierLabel.pos(windowX, windowY + closeBtnMargin + titleBgHeight + 5);
        totalMultiplierLabel.mouseEnabled = false;
        this.updateChallengeTotalMultiplierLabel(totalMultiplierLabel);
        this.challengeWindow.addChild(totalMultiplierLabel);
        
        // 计算列表区域的可见区域
        const headerHeight = closeBtnMargin + titleBgHeight + Math.max(25, stageHeight * 0.03) + 15; // 标题和统计信息的高度
        const listAreaY = windowY + headerHeight;
        const listAreaHeight = windowHeight - headerHeight - 10; // 减去底部边距
        
        // 创建滚动遮罩容器（可见区域）
        const scrollMask = new Laya.Sprite();
        scrollMask.name = "scrollMask";
        scrollMask.size(windowWidth, listAreaHeight);
        scrollMask.pos(windowX, listAreaY);
        scrollMask.mouseEnabled = true;
        scrollMask.mouseThrough = false;
        // 设置遮罩，用于裁剪超出区域的内容
        scrollMask.scrollRect = new Laya.Rectangle(0, 0, windowWidth, listAreaHeight);
        this.challengeWindow.addChild(scrollMask);
        
        // 创建挑战列表容器（内容区域，可以超出可见区域）
        const listContainer = new Laya.Sprite();
        listContainer.name = "listContainer";
        listContainer.pos(0, 0); // 相对于遮罩容器的位置
        listContainer.mouseEnabled = true;
        listContainer.mouseThrough = false;
        scrollMask.addChild(listContainer);
        
        // 创建挑战列表项
        this.createChallengeListItems(panel, listContainer, windowWidth, listAreaHeight);
        
        console.log("创建挑战窗口（手机端适配），位置:", windowX, windowY, "尺寸:", windowWidth, windowHeight);
    }
    
    /**
     * 创建挑战列表项
     */
    private createChallengeListItems(windowPanel: Laya.Sprite, container: Laya.Sprite, windowWidth: number, availableHeight: number): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 每个挑战项的高度
        const itemHeight = 150;
        const itemSpacing = 8;
        const itemMargin = Math.max(10, stageWidth * 0.02);
        
        for (let i = 0; i < this.challenges.length; i++) {
            const challenge = this.challenges[i];
            const itemY = i * (itemHeight + itemSpacing);
            
            // 创建挑战项背景（白色面板，底部黄色边框）
            const itemBg = new Laya.Sprite();
            itemBg.name = "challengeItem_" + challenge.id;
            itemBg.size(windowWidth - itemMargin * 2, itemHeight);
            itemBg.graphics.drawRect(0, 0, windowWidth - itemMargin * 2, itemHeight, "#ffffff");
            // 底部黄色边框
            itemBg.graphics.drawRect(0, itemHeight - 3, windowWidth - itemMargin * 2, 3, "#ffd700");
            itemBg.pos(itemMargin, itemY);
            itemBg.mouseEnabled = true;
            itemBg.mouseThrough = false;
            container.addChild(itemBg);
            
            // 挑战头像（使用对应的助理头像）
            const avatarSize = Math.max(50, Math.min(itemHeight * 0.6, 70));
            const avatarX = 10;
            const avatarY = (itemHeight - avatarSize) / 2;
            
            // 获取对应的助理信息
            const assistant = this.assistants.find(a => a.id === challenge.id);
            const assistantName = assistant ? assistant.name : "未知助理";
            
            const avatar = new Laya.Sprite();
            avatar.name = "avatar";
            avatar.size(avatarSize, avatarSize);
            
            // 根据解锁状态和助理ID显示不同图片（从服务器获取）
            const imagePath = this.isChallengeUnlocked(challenge.id) 
                ? this.getServerResourceUrl(`resources/assist/${challenge.id}/head.png`)
                : this.getServerResourceUrl(`resources/assist/${challenge.id}/egg.png`);
            
            const cachedTexture = Laya.loader.getRes(imagePath);
            if (cachedTexture) {
                avatar.graphics.clear();
                avatar.graphics.drawTexture(cachedTexture, 0, 0, avatarSize, avatarSize);
            } else {
                // 如果图片未加载，使用占位图形
                if (this.isChallengeUnlocked(challenge.id)) {
                    avatar.graphics.drawCircle(avatarSize / 2, avatarSize / 2, avatarSize / 2, "#4a9eff");
                } else {
                    avatar.graphics.drawCircle(avatarSize / 2, avatarSize / 2, avatarSize / 2, "#888888");
                }
                // 尝试加载图片（从服务器获取）
                Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                    if (texture && avatar && !avatar.destroyed) {
                        avatar.graphics.clear();
                        avatar.graphics.drawTexture(texture, 0, 0, avatarSize, avatarSize);
                    }
                }), null, Laya.Loader.IMAGE);
            }
            
            avatar.pos(avatarX, avatarY);
            avatar.mouseEnabled = false;
            itemBg.addChild(avatar);
            
            // 挑战名称（使用对应的助理名称）
            const nameLabel = new Laya.Text();
            nameLabel.name = "nameLabel";
            nameLabel.text = assistantName;
            nameLabel.fontSize = Math.max(16, Math.min(stageWidth * 0.04, 20));
            nameLabel.color = this.isChallengeUnlocked(challenge.id) ? "#333333" : "#888888";
            nameLabel.width = (windowWidth - itemMargin * 2) * 0.4;
            nameLabel.height = itemHeight * 0.25;
            nameLabel.align = "left";
            nameLabel.valign = "middle";
            nameLabel.pos(avatarX + avatarSize + 10, 5);
            nameLabel.mouseEnabled = false;
            itemBg.addChild(nameLabel);
            
            // 点击收益显示（原战力显示）
            const powerLabel = new Laya.Text();
            powerLabel.name = "powerLabel";
            powerLabel.text = "点击收益: " + this.formatPower(challenge.requiredPower) + "/次";
            powerLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
            powerLabel.color = "#00aa00";
            powerLabel.width = (windowWidth - itemMargin * 2) * 0.4;
            powerLabel.height = itemHeight * 0.2;
            powerLabel.align = "left";
            powerLabel.valign = "middle";
            powerLabel.pos(avatarX + avatarSize + 10, itemHeight * 0.25 + 5);
            powerLabel.mouseEnabled = false;
            itemBg.addChild(powerLabel);
            
            // 奖励显示（标注为首次挑战成功奖励和倍率加成）
            const rewardLabel = new Laya.Text();
            rewardLabel.name = "rewardLabel";
            // 计算倍率加成值（第n个挑战50%*n）
            const multiplierBonus = 0.5 * challenge.id;
            rewardLabel.text = "首次挑战成功奖励: " + this.formatMoney(challenge.reward) + "\n倍率加成: +" + (multiplierBonus * 100).toFixed(0) + "%";
            rewardLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
            rewardLabel.color = "#ffd700";
            rewardLabel.width = (windowWidth - itemMargin * 2) * 0.4;
            rewardLabel.height = itemHeight * 0.4; // 增加高度以容纳两行文字
            rewardLabel.align = "left";
            rewardLabel.valign = "top";
            rewardLabel.pos(avatarX + avatarSize + 10, itemHeight * 0.45 + 5);
            rewardLabel.mouseEnabled = false;
            itemBg.addChild(rewardLabel);
            
            // 状态显示和按钮（按钮放在下方，水平居中，增加间距避免挡住文字）
            const btnWidth = 120;
            const btnHeight = 30;
            const btnX = ((windowWidth - itemMargin * 2) - btnWidth) / 2; // 水平居中
            const btnY = itemHeight - btnHeight - 15; // 底部，留15像素边距，避免挡住上方文字
            
            if (this.isChallengeUnlocked(challenge.id)) {
                // 已解锁：显示挑战按钮
                const challengeBtn = new Laya.Sprite();
                challengeBtn.name = "challengeBtn";
                challengeBtn.size(btnWidth, btnHeight);
                challengeBtn.graphics.drawRoundRect(0, 0, btnWidth, btnHeight, 5, 5, 5, 5, "#ff6b35");
                challengeBtn.pos(btnX, btnY);
                challengeBtn.mouseEnabled = true;
                challengeBtn.mouseThrough = false;
                
                // 按钮文字
                const btnLabel = new Laya.Text();
                btnLabel.text = "挑战";
                btnLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
                btnLabel.color = "#ffffff";
                btnLabel.width = btnWidth;
                btnLabel.height = btnHeight;
                btnLabel.align = "center";
                btnLabel.valign = "middle";
                btnLabel.mouseEnabled = false;
                challengeBtn.addChild(btnLabel);
                
                // 按钮交互效果
                challengeBtn.on(Laya.Event.MOUSE_DOWN, this, () => {
                    challengeBtn.scale(0.95, 0.95);
                });
                challengeBtn.on(Laya.Event.MOUSE_UP, this, () => {
                    challengeBtn.scale(1, 1);
                });
                challengeBtn.on(Laya.Event.MOUSE_OUT, this, () => {
                    challengeBtn.scale(1, 1);
                });
                
                // 挑战按钮点击事件
                challengeBtn.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
                    e.stopPropagation();
                    this.handleChallenge(challenge.id);
                });
                
                itemBg.addChild(challengeBtn);
            } else {
                // 未解锁：显示锁定状态（放在下方，水平居中）
                const lockLabel = new Laya.Text();
                lockLabel.name = "lockLabel";
                // 显示需要解锁对应的助理
                const assistant = this.assistants.find(a => a.id === challenge.id);
                const assistantName = assistant ? assistant.name : "对应助理";
                lockLabel.text = `需要先解锁${assistantName}`;
                lockLabel.fontSize = Math.max(11, Math.min(stageWidth * 0.028, 14));
                lockLabel.color = "#888888";
                lockLabel.width = windowWidth - itemMargin * 2;
                lockLabel.height = 30;
                lockLabel.align = "center";
                lockLabel.valign = "middle";
                lockLabel.pos(0, itemHeight - 30 - 15); // 底部，留15像素边距，避免挡住上方文字
                lockLabel.mouseEnabled = false;
                itemBg.addChild(lockLabel);
                
                // 如果是BOSS挑战，显示VS图标和"挑战BOSS"文字（放在下方）
                if (challenge.isBoss) {
                    const vsLabel = new Laya.Text();
                    vsLabel.name = "vsLabel";
                    vsLabel.text = "VS";
                    vsLabel.fontSize = Math.max(18, Math.min(stageWidth * 0.045, 24));
                    vsLabel.color = "#ff3333";
                    vsLabel.width = windowWidth - itemMargin * 2;
                    vsLabel.height = 20;
                    vsLabel.align = "center";
                    vsLabel.valign = "middle";
                    vsLabel.pos(0, itemHeight - 60); // 在锁定文字上方，增加间距
                    vsLabel.mouseEnabled = false;
                    itemBg.addChild(vsLabel);
                    
                    const bossLabel = new Laya.Text();
                    bossLabel.name = "bossLabel";
                    bossLabel.text = "挑战BOSS";
                    bossLabel.fontSize = Math.max(10, Math.min(stageWidth * 0.025, 12));
                    bossLabel.color = "#ff3333";
                    bossLabel.width = windowWidth - itemMargin * 2;
                    bossLabel.height = 15;
                    bossLabel.align = "center";
                    bossLabel.valign = "middle";
                    bossLabel.pos(0, itemHeight - 45); // 在锁定文字上方，增加间距
                    bossLabel.mouseEnabled = false;
                    itemBg.addChild(bossLabel);
                }
            }
        }
        
        // 计算总内容高度
        const totalContentHeight = this.challenges.length * (itemHeight + itemSpacing) - itemSpacing;
        
        // 如果内容高度超过可见区域，设置遮罩并启用滚动
        if (totalContentHeight > availableHeight) {
            // 找到遮罩容器
            const scrollMask = container.parent as Laya.Sprite;
            if (scrollMask && scrollMask.name === "scrollMask") {
                // 设置遮罩的scrollRect，实现裁剪
                scrollMask.scrollRect = new Laya.Rectangle(0, 0, windowWidth, availableHeight);
                
                // 添加触摸滚动功能（支持手机端）
                let startY = 0;
                let currentY = 0;
                let isDragging = false;
                
                const onTouchStart = (e: Laya.Event) => {
                    startY = e.stageY;
                    currentY = container.y;
                    isDragging = true;
                    e.stopPropagation();
                };
                
                const onTouchMove = (e: Laya.Event) => {
                    if (isDragging) {
                        const deltaY = e.stageY - startY;
                        let newY = currentY + deltaY;
                        
                        // 限制滚动范围
                        const maxScrollY = 0; // 顶部边界
                        const minScrollY = availableHeight - totalContentHeight; // 底部边界
                        newY = Math.max(minScrollY, Math.min(maxScrollY, newY));
                        
                        container.y = newY;
                        e.stopPropagation();
                    }
                };
                
                const onTouchEnd = () => {
                    isDragging = false;
                };
                
                // 在scrollMask上监听按下事件
                scrollMask.on(Laya.Event.MOUSE_DOWN, this, onTouchStart);
                // 在stage上监听移动和抬起事件（确保即使鼠标移出也能响应）
                Laya.stage.on(Laya.Event.MOUSE_MOVE, this, onTouchMove);
                Laya.stage.on(Laya.Event.MOUSE_UP, this, onTouchEnd);
                
                console.log("启用挑战列表滚动，内容高度:", totalContentHeight, "可见高度:", availableHeight);
            }
        } else {
            console.log("挑战列表内容未超出可见区域，无需滚动");
        }
    }
    
    /**
     * 检查挑战是否已解锁
     * 第n个挑战需要解锁第n个助理
     */
    private isChallengeUnlocked(challengeId: number): boolean {
        // 查找对应的助理
        const assistant = this.assistants.find(a => a.id === challengeId);
        if (!assistant) {
            return false;
        }
        
        // 挑战解锁条件：对应的助理已解锁
        return assistant.unlocked;
    }
    
    /**
     * 处理挑战
     */
    private handleChallenge(challengeId: number): void {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (!challenge) {
            console.log("挑战不存在，ID:", challengeId);
            return;
        }
        
        // 检查是否已解锁（需要对应的助理已解锁）
        if (!this.isChallengeUnlocked(challengeId)) {
            const assistant = this.assistants.find(a => a.id === challengeId);
            const assistantName = assistant ? assistant.name : "对应助理";
            this.showPopup(`需要先解锁${assistantName}才能挑战`, "center", "#ff6666");
            console.log("挑战未解锁，需要先解锁对应的助理，挑战ID:", challengeId, "助理ID:", challengeId);
            return;
        }
        
        // 检查是否已完成
        if (challenge.completed) {
            this.showPopup("该挑战已完成", "center", "#ffaa00");
            return;
        }
        
        // 获取当前点击收益
        const currentPower = this.getCurrentPower();
        
        // 检查点击收益是否足够
        if (currentPower < challenge.requiredPower) {
            this.showPopup("点击收益不足！需要 " + this.formatPower(challenge.requiredPower) + "/次", "center", "#ff6666");
            console.log("点击收益不足，需要:", challenge.requiredPower, "当前:", currentPower);
            return;
        }
        
        // 挑战成功
        challenge.completed = true;
        this.money += challenge.reward;
        this.updateMoneyDisplay();
        
        // 更新倍率（挑战完成会增加倍率加成）
        this.calculateMultiplier();
        this.updateMultiplierDisplay();
        
        // 计算倍率加成值（第n个挑战50%*n）
        const multiplierBonus = 0.5 * challenge.id;
        const multiplierBonusPercent = multiplierBonus * 100; // 转换为百分比
        console.log("挑战成功:", challenge.name, "获得奖励:", challenge.reward, "倍率加成:", multiplierBonusPercent + "%");
        
        // 先播放视频，视频播放完成后再显示success图片（传入倍率值）
        this.playChallengeSuccessVideo(challenge.id, multiplierBonusPercent);
        
        // 刷新挑战窗口
        this.refreshChallengeWindow();
        // 数据会通过定时保存自动保存，无需手动调用
    }
    
    /**
     * 获取当前战力（点击收益）
     */
    private getCurrentPower(): number {
        // 返回当前点击收益（基础值 * 倍率）
        return this.getClickReward();
    }
    
    /**
     * 格式化战力显示
     */
    private formatPower(power: number): string {
        if (power >= 1000000000000) {
            // 兆
            return (power / 1000000000000).toFixed(2) + "兆";
        } else if (power >= 100000000) {
            // 亿
            return (power / 100000000).toFixed(2) + "亿";
        } else if (power >= 10000) {
            // 万
            return (power / 10000).toFixed(2) + "万";
        }
        return Math.floor(power).toString();
    }
    
    /**
     * 刷新挑战窗口（重新创建所有列表项）
     */
    private refreshChallengeWindow(): void {
        if (!this.challengeWindow) {
            return;
        }
        
        // 更新总倍率显示
        const totalMultiplierLabel = this.challengeWindow.getChildByName("challengeTotalMultiplierLabel") as Laya.Text;
        if (totalMultiplierLabel) {
            this.updateChallengeTotalMultiplierLabel(totalMultiplierLabel);
        }
        
        // 找到滚动遮罩容器
        const scrollMask = this.challengeWindow.getChildByName("scrollMask") as Laya.Sprite;
        if (scrollMask) {
            // 找到列表容器（在scrollMask内部）
            const listContainer = scrollMask.getChildByName("listContainer") as Laya.Sprite;
            if (listContainer) {
                listContainer.removeChildren();
                
                const windowPanel = this.challengeWindow.getChildByName("windowPanel") as Laya.Sprite;
                if (windowPanel) {
                    const stageWidth = Laya.stage.width || 750;
                    const windowWidth = windowPanel.width;
                    const availableHeight = scrollMask.height; // 使用scrollMask的高度作为可见区域高度
                    this.createChallengeListItems(windowPanel, listContainer, windowWidth, availableHeight);
                }
            }
        }
    }
    
    /**
     * 关闭挑战窗口
     */
    private closeChallengeWindow(): void {
        // 关闭窗口后，检查是否需要显示升级按钮指引和挑战按钮指引
        Laya.timer.frameOnce(1, this, () => {
            this.checkAndShowUpgradeBtnGuide();
            this.checkAndShowChallengeBtnGuide();
        });
        if (this.challengeWindow) {
            this.challengeWindow.removeSelf();
            this.challengeWindow = null;
            console.log("关闭挑战窗口");
        }
    }
    
    /**
     * 退出小游戏
     */
    private exitGame(): void {
        console.log("退出小游戏");
        // 在微信小游戏环境中，使用 wx.exitMiniProgram
        // 在其他环境中，尝试关闭窗口
        const wxObj = (window as any).wx;
        if (wxObj && wxObj.exitMiniProgram) {
            wxObj.exitMiniProgram({
                success: () => {
                    console.log("退出小游戏成功");
                },
                fail: (err: any) => {
                    console.log("退出小游戏失败:", err);
                }
            });
        } else {
            // 如果不是微信小游戏环境，尝试其他退出方式
            console.log("当前环境不支持退出小游戏");
            // 可以显示提示信息
            this.showPopup("当前环境不支持退出", "center", "#ffaa00");
        }
    }

    /**
     * 设置点击事件处理（点击非按钮区域增加金钱）
     */
    private setupClickHandler(): void {
        Laya.stage.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            const clickX = e.stageX;
            const clickY = e.stageY;
            
            // 如果新手指引激活，检查是否点击在中间可点击区域
            if (this.isNewbieGuideActive) {
                const target = e.target as Laya.Sprite;
                // 如果点击的是新手指引的可点击区域，触发收益（不立即关闭，等金币达到1500或2秒后自动关闭）
                if (this.newbieGuideClickArea && (target === this.newbieGuideClickArea || this.newbieGuideClickArea.contains(target))) {
                    // 触发正常的点击收益逻辑
                    this.handleClickReward();
                    // 检查金币是否达到1500，如果达到则关闭指引
                    this.checkNewbieGuideCloseCondition();
                    return;
                } else {
                    // 点击了其他区域（被遮挡层拦截），不处理
                    return;
                }
            }
            
            // 检查是否点击在窗口上
            const target = e.target as Laya.Sprite;
            if (this.assistantWindow && (target === this.assistantWindow || this.assistantWindow.contains(target))) {
                // 点击了助理窗口区域，不处理（让窗口自己的点击事件处理）
                return;
            }
            if (this.settingsWindow && (target === this.settingsWindow || this.settingsWindow.contains(target))) {
                // 点击了设置窗口区域，不处理（让窗口自己的点击事件处理）
                return;
            }
            if (this.challengeWindow && (target === this.challengeWindow || this.challengeWindow.contains(target))) {
                // 点击了挑战窗口区域，不处理（让窗口自己的点击事件处理）
                return;
            }
            
            // 检查是否点击在头像上
            if (this.avatarImg && (target === this.avatarImg || this.avatarImg.contains(target))) {
                // 点击了头像，不处理（头像有自己的点击事件）
                return;
            }
            
            // 检查是否点击在按钮上
            const isOnButton = this.isPointOnButton(clickX, clickY);
            
            if (!isOnButton) {
                // 点击非按钮区域，触发点击收益
                this.handleClickReward();
            }
        });
    }
    
    /**
     * 处理点击收益（增加金钱、显示弹窗、显示动画等）
     */
    private handleClickReward(): void {
        // 增加金钱（使用当前点击收益：基础值 * 倍率）
                this.money += this.getClickReward();
                this.updateMoneyDisplay();
                
                // 显示获得金币弹窗（在金币数下方）
                // 使用money位置类型，会自动计算位置，确保在屏幕上可见
                this.showPopup("+" + this.formatMoney(this.getClickReward()), "money", "#00ff00");
                
                // 显示Ticket滑动动画（从左下方滑到右下方消失）
                this.showTicketAnimation();
                
                // 更新点击收益计数，每10次切换一次助理图片
                this.clickRewardCount++;
                if (this.clickRewardCount >= 10) {
                    this.clickRewardCount = 0;
                    this.switchToNextAssistant();
                }
                
                console.log("点击增加金钱:", this.getClickReward(), "当前金钱:", this.money);
                // 数据会通过定时保存自动保存，无需手动调用
    }

    /**
     * 判断点击位置是否在按钮上（手机端适配）
     * @param x 点击的x坐标
     * @param y 点击的y坐标
     */
    private isPointOnButton(x: number, y: number): boolean {
        const stageHeight = Laya.stage.height || 1334;
        const stageWidth = Laya.stage.width || 750;
        
        // 手机端适配：按钮大小和位置根据屏幕计算
        const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80));
        const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120));
        const btnSpacing = Math.max(10, stageWidth * 0.02);
        const bottomMargin = Math.max(20, stageHeight * 0.03);
        const btnY = stageHeight - btnHeight - bottomMargin;
        
        // 三个按钮总宽度
        const totalWidth = btnWidth * 3 + btnSpacing * 2;
        const startX = (stageWidth - totalWidth) / 2;

        // 升级按钮区域
        const upgradeBtnX = startX;
        if (x >= upgradeBtnX && x <= upgradeBtnX + btnWidth && 
            y >= btnY && y <= btnY + btnHeight) {
            return true;
        }

        // 助理按钮区域
        const assistantBtnX = startX + btnWidth + btnSpacing;
        if (x >= assistantBtnX && x <= assistantBtnX + btnWidth && 
            y >= btnY && y <= btnY + btnHeight) {
            return true;
        }

        // 挑战按钮区域
        const challengeBtnX = startX + (btnWidth + btnSpacing) * 2;
        if (x >= challengeBtnX && x <= challengeBtnX + btnWidth && 
            y >= btnY && y <= btnY + btnHeight) {
            return true;
        }

        return false;
    }

    /**
     * 获取当前点击收益（基础值 * 倍率）
     */
    private getClickReward(): number {
        // 培训n次，基础收益是原来的2的n次方倍，然后再乘以总倍率
        const trainingMultiplier = Math.pow(2, this.trainingCount);
        return Math.floor(this.clickRewardBase * trainingMultiplier * this.clickMultiplier);
    }
    
    /**
     * 计算并更新倍率（基于助理20级加成）
     */
    private calculateMultiplier(): void {
        let totalMultiplier = 1.0; // 基础倍率100%
        
        // 遍历所有助理，如果达到20级，增加20%*n的倍率
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level >= 20) {
                // 第n个助理（id为n）升到20级，增加20%*n的倍率
                totalMultiplier += 0.2 * assistant.id;
            }
        }
        
        // 遍历所有挑战，如果已完成，增加50%*n的倍率
        for (const challenge of this.challenges) {
            if (challenge.completed) {
                // 第n个挑战（id为n）完成，增加50%*n的倍率
                totalMultiplier += 0.5 * challenge.id;
            }
        }
        
        this.clickMultiplier = totalMultiplier;
    }
    
    /**
     * 更新倍率显示（首页总收益显示）
     */
    private updateMultiplierDisplay(): void {
        if (this.multiplierLabel) {
            this.calculateMultiplier(); // 重新计算倍率
            // 直接显示最终值（乘以培训倍率后的值）
            const finalReward = this.getClickReward();
            this.multiplierLabel.text = "点击收益: " + this.formatMoney(finalReward);
        }
    }
    
    /**
     * 更新秒赚显示
     */
    private updatePerSecondDisplay(): void {
        if (this.perSecondLabel) {
            // 计算所有助理的基础秒赚
            let baseEarnings = 0;
            for (const assistant of this.assistants) {
                if (assistant.unlocked && assistant.level > 0) {
                    baseEarnings += Math.floor(assistant.unlockCost * assistant.level / 100);
                }
            }
            // 乘以培训倍率（2的n次方）
            const trainingMultiplier = Math.pow(2, this.trainingCount);
            const finalEarnings = baseEarnings * trainingMultiplier;
            // 直接显示最终值
            this.perSecondLabel.text = "秒赚: " + this.formatMoney(finalEarnings) + "/秒";
        }
    }
    
    /**
     * 头像点击事件：打开设置窗口
     */
    private onAvatarClick(): void {
        console.log("点击了头像");
        // 如果窗口已存在，先删除
        if (this.settingsWindow) {
            this.settingsWindow.removeSelf();
            this.settingsWindow = null;
            return;
        }
        
        // 创建设置窗口
        this.createSettingsWindow();
    }
    
    /**
     * 检查助理解锁条件
     * @param assistantId 助理ID
     * @returns 是否可以解锁，以及解锁条件说明
     */
    private checkAssistantUnlockCondition(assistantId: number): { canUnlock: boolean; reason: string } {
        const assistant = this.assistants.find(a => a.id === assistantId);
        if (!assistant) {
            return { canUnlock: false, reason: "助理不存在" };
        }
        
        // 第一个助理（id=1）只需要金币
        if (assistantId === 1) {
            return { canUnlock: true, reason: "" };
        }
        
        // 其他助理需要：
        // 1. 上一级助理解锁
        // 2. 上一级助理达到10级
        // 3. 主角等级达到20*(n-1)级
        const prevAssistant = this.assistants.find(a => a.id === assistantId - 1);
        if (!prevAssistant) {
            return { canUnlock: false, reason: "上一级助理不存在" };
        }
        
        if (!prevAssistant.unlocked) {
            return { canUnlock: false, reason: "需要上一级助理解锁" };
        }
        
        if (prevAssistant.level < 10) {
            return { canUnlock: false, reason: "需要上一级助理达到10级" };
        }
        
        const requiredLevel = 20 * (assistantId - 1);
        if (this.playerLevel < requiredLevel) {
            return { canUnlock: false, reason: "需要主角等级达到" + requiredLevel + "级" };
        }
        
        return { canUnlock: true, reason: "" };
    }
    
    /**
     * 更新金钱显示（手机端适配）
     */
    private updateMoneyDisplay(): void {
        if (this.moneyLabel) {
            this.moneyLabel.text = this.formatMoney(this.money);
            // 删除背景后，直接设置文字宽度
            const stageWidth = Laya.stage.width || 750;
            const textWidth = this.moneyLabel.textWidth || 80;
            const minWidth = Math.max(80, stageWidth * 0.2); // 最小宽度：屏幕20%，最小80
            this.moneyLabel.width = Math.max(textWidth + 10, minWidth);
        }
        // 同时更新升级按钮的颜色提示
        this.updateUpgradeCostDisplay();
        
        // 检查新手指引关闭条件（金币达到1500）
        this.checkNewbieGuideCloseCondition();
        
        // 更新底部按钮显示状态
        this.updateBottomButtonsVisibility();
        
        // 检查是否需要显示升级按钮指引（金币变化可能影响是否能够升级）
        this.checkAndShowUpgradeBtnGuide();
        
        // 检查是否需要显示挑战按钮指引（点击收益变化可能影响是否达到500）
        this.checkAndShowChallengeBtnGuide();
    }

    /**
     * 更新升级所需金币显示（手机端适配）
     */
    private updateUpgradeCostDisplay(): void {
        if (this.upgradeCostLabel) {
            this.upgradeCostLabel.text = this.formatMoney(this.upgradeCost);
            // 如果金币不足，改变颜色提示
            if (this.money < this.upgradeCost) {
                this.upgradeCostLabel.color = "#ff6666"; // 红色提示
            } else {
                this.upgradeCostLabel.color = "#ffffff"; // 白色正常
            }
            // 更新背景宽度以适应文字（手机端适配）
            if (this.upgradeCostLabelBg && this.upgradeBtn) {
                const stageWidth = Laya.stage.width || 750;
                const stageHeight = Laya.stage.height || 1334;
                const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120));
                const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80));
                const btnSpacing = Math.max(10, stageWidth * 0.02);
                const bottomMargin = Math.max(20, stageHeight * 0.03);
                const btnY = stageHeight - btnHeight - bottomMargin;
                const totalWidth = btnWidth * 3 + btnSpacing * 2;
                const startX = (stageWidth - totalWidth) / 2;
                const costLabelWidth = btnWidth;
                const costLabelHeight = Math.max(20, Math.floor(btnHeight * 0.3));
                const costLabelY = btnY - costLabelHeight - Math.max(5, stageHeight * 0.01);
                
                const textWidth = this.upgradeCostLabel.textWidth || costLabelWidth;
                this.upgradeCostLabelBg.width = Math.max(textWidth + 10, costLabelWidth);
                this.upgradeCostLabel.width = this.upgradeCostLabelBg.width;
                // 更新背景位置使其居中（相对于按钮）
                const offsetX = (this.upgradeCostLabelBg.width - costLabelWidth) / 2;
                this.upgradeCostLabelBg.pos(startX - offsetX, costLabelY);
                this.upgradeCostLabel.pos(startX - offsetX, costLabelY);
            }
        }
    }

    /**
     * 创建弹窗容器
     */
    private createPopupContainer(): void {
        this.popupContainer = new Laya.Sprite();
        this.popupContainer.name = "popupContainer";
        Laya.stage.addChild(this.popupContainer);
    }

    /**
     * 显示弹窗（手机端适配）
     * @param text 弹窗文字
     * @param position 位置类型："center"（屏幕中央）或 "money"（金币数下方）
     * @param color 文字颜色
     * @param yOffset Y轴偏移（用于money位置时）
     */
    private showPopup(text: string, position: "center" | "money", color: string, yOffset?: number): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 手机端适配：弹窗大小根据屏幕计算
        const popupWidth = Math.max(150, Math.min(stageWidth * 0.6, 300)); // 弹窗宽度：屏幕60%，最小150，最大300
        const popupHeight = Math.max(30, Math.min(stageHeight * 0.05, 50)); // 弹窗高度：屏幕5%，最小30，最大50
        const fontSize = Math.max(14, Math.min(stageWidth * 0.04, 22)); // 字体大小：屏幕4%，最小14，最大22
        
        // 创建弹窗容器
        const popup = new Laya.Sprite();
        popup.name = "popup";
        
        // 如果是money位置的弹窗（收益弹窗），删除背景，文字改为深金色
        if (position === "money") {
            // 创建弹窗文字（无背景，深金色，适配白色背景）
            const label = new Laya.Text();
            label.name = "popupLabel";
            label.text = text;
            label.fontSize = fontSize;
            label.color = "#b8860b"; // 深金色（DarkGoldenrod），适配白色背景
            label.width = popupWidth;
            label.height = popupHeight;
            label.align = "center";
            label.valign = "middle";
            popup.addChild(label);
        } else {
            // 其他位置的弹窗保持原有样式（有背景）
            const bg = new Laya.Sprite();
            bg.name = "popupBg";
            bg.size(popupWidth, popupHeight);
            bg.graphics.drawRect(0, 0, popupWidth, popupHeight, "#000000");
            bg.alpha = 0.8;
            
            // 创建弹窗文字
            const label = new Laya.Text();
            label.name = "popupLabel";
            label.text = text;
            label.fontSize = fontSize;
            label.color = color;
            label.width = popupWidth;
            label.height = popupHeight;
            label.align = "center";
            label.valign = "middle";
            
            popup.addChild(bg);
            popup.addChild(label);
        }
        
        // 计算位置
        let x = 0;
        let y = 0;
        
        if (position === "center") {
            // 屏幕中央，根据已有中央弹窗数量向下偏移
            const centerPopupsCount = this.activePopups.filter(p => p.position === "center").length;
            const offsetY = Math.max(40, stageHeight * 0.04); // 偏移量：屏幕4%，最小40
            x = (stageWidth - popupWidth) / 2;
            y = (stageHeight - popupHeight) / 2 + (centerPopupsCount * offsetY);
        } else if (position === "money") {
            // 金币数下方，根据已有金币弹窗数量向下偏移
            const moneyPopupsCount = this.activePopups.filter(p => p.position === "money").length;
            const moneyX = stageWidth * 0.65; // 金钱标签的X坐标（屏幕65%，右侧）
            const moneyIconSize = Math.max(16, Math.min(stageWidth * 0.04, 24));
            const margin = stageWidth * 0.03;
            const moneyLabelBgWidth = Math.max(80, stageWidth * 0.2);
            const moneyFontSize = Math.max(16, Math.min(stageWidth * 0.04, 24));
            const avatarSize = Math.max(60, Math.min(stageWidth * 0.12, 80));
            const avatarY = Math.max(10, stageHeight * 0.02);
            const moneyY = avatarY + (avatarSize - moneyIconSize) / 2;
            const offsetY = Math.max(25, stageHeight * 0.02); // 偏移量：屏幕2%，最小25
            
            // 计算弹窗位置：在金币标签下方
            const baseY = yOffset || (moneyY + Math.max(20, moneyFontSize * 1.2));
            const calculatedY = baseY + (moneyPopupsCount * offsetY);
            
            // 确保弹窗在屏幕可见区域内（不超过屏幕高度的80%）
            const maxY = stageHeight * 0.8;
            y = Math.min(calculatedY, maxY);
            
            // X坐标：靠右显示，在金币标签右侧，右对齐
            const moneyLabelRightX = moneyX + moneyIconSize + margin * 0.5 + moneyLabelBgWidth; // 金币标签右边缘
            x = stageWidth - popupWidth*0.8; // 屏幕右侧，留10像素边距
        }
        
        popup.pos(x, y);
        this.popupContainer.addChild(popup);
        // 确保弹窗容器在所有窗口前面（通过调整在stage中的顺序）
        if (this.popupContainer.parent) {
            const parent = this.popupContainer.parent;
            let maxWindowIndex = -1;
            
            // 找到所有窗口中层级最高的索引
            if (this.assistantWindow && parent.contains(this.assistantWindow)) {
                const windowIndex = parent.getChildIndex(this.assistantWindow);
                maxWindowIndex = Math.max(maxWindowIndex, windowIndex);
            }
            if (this.settingsWindow && parent.contains(this.settingsWindow)) {
                const windowIndex = parent.getChildIndex(this.settingsWindow);
                maxWindowIndex = Math.max(maxWindowIndex, windowIndex);
            }
            if (this.challengeWindow && parent.contains(this.challengeWindow)) {
                const windowIndex = parent.getChildIndex(this.challengeWindow);
                maxWindowIndex = Math.max(maxWindowIndex, windowIndex);
            }
            
            // 如果弹窗容器在窗口后面，则移到所有窗口前面
            if (maxWindowIndex >= 0) {
                const popupIndex = parent.getChildIndex(this.popupContainer);
                if (popupIndex <= maxWindowIndex) {
                    parent.setChildIndex(this.popupContainer, maxWindowIndex + 1);
                }
            }
        }
        
        // 添加到活跃弹窗列表
        const popupData = {
            sprite: popup,
            timer: 0,
            position: position
        };
        this.activePopups.push(popupData);
        
        // 设置弹窗不阻挡点击（mouseEnabled设为false）
        popup.mouseEnabled = false;
        if (position !== "money") {
            // money位置的弹窗没有背景，所以不需要设置bg
            const bg = popup.getChildByName("popupBg") as Laya.Sprite;
            if (bg) {
                bg.mouseEnabled = false;
            }
        }
        const label = popup.getChildByName("popupLabel") as Laya.Text;
        if (label) {
            label.mouseEnabled = false;
        }
        
        // 1秒后移除弹窗
        const timerHandler = () => {
            popupData.timer += 100;
            if (popupData.timer >= 1000) {
                // 记录当前弹窗的位置
                const currentY = popup.y;
                
                // 淡出效果
                Laya.Tween.to(popup, { alpha: 0 }, 200, null, Laya.Handler.create(this, () => {
                    popup.removeSelf();
                    const index = this.activePopups.indexOf(popupData);
                    if (index > -1) {
                        this.activePopups.splice(index, 1);
                    }
                    
                    // 让下方的同类型弹窗上移填补空位
                    this.movePopupsUp(position, currentY);
                }));
                Laya.timer.clear(this, timerHandler);
            }
        };
        Laya.timer.loop(100, this, timerHandler);
    }


    /**
     * 让下方的弹窗上移填补空位（手机端适配）
     * @param position 弹窗类型
     * @param removedY 被移除弹窗的Y坐标
     */
    private movePopupsUp(position: "center" | "money", removedY: number): void {
        const stageHeight = Laya.stage.height || 1334;
        
        // 获取所有同类型的弹窗
        const sameTypePopups = this.activePopups.filter(p => p.position === position);
        
        // 按Y坐标排序
        sameTypePopups.sort((a, b) => a.sprite.y - b.sprite.y);
        
        // 计算偏移量（手机端适配）
        const offset = position === "center" 
            ? Math.max(40, stageHeight * 0.04)  // 中央弹窗偏移：屏幕4%，最小40
            : Math.max(25, stageHeight * 0.02); // 金钱弹窗偏移：屏幕2%，最小25
        
        // 找到被移除弹窗下方的弹窗，让它们上移
        for (const popupData of sameTypePopups) {
            if (popupData.sprite.y > removedY) {
                // 上移一个位置
                const targetY = popupData.sprite.y - offset;
                Laya.Tween.to(popupData.sprite, { y: targetY }, 200);
            }
        }
    }

    /**
     * 格式化金钱显示
     * @param amount 金钱数量
     */
    private formatMoney(amount: number): string {
        if (amount >= 1000000000000) {
            // 1兆及以上，使用"兆"作为单位，保留小数点后两位
            return (amount / 1000000000000).toFixed(2) + "兆";
        } else if (amount >= 100000000) {
            // 1亿及以上，使用"亿"作为单位，保留小数点后两位
            return (amount / 100000000).toFixed(2) + "亿";
        } else if (amount >= 10000) {
            // 1万及以上，使用"万"作为单位，保留小数点后两位
            return (amount / 10000).toFixed(2) + "万";
        }
        // 没有单位时显示为整数
        return Math.floor(amount).toString();
    }
    
    /**
     * 加载游戏数据（游戏启动时调用）
     * @param callback 加载完成后的回调函数，参数为是否加载成功
     */
    private loadGameData(callback?: (success: boolean) => void): void {
        console.log("开始加载游戏数据...");
        
        // 更新UI显示用户昵称（使用默认值）
        if (this.nameLabel) {
            this.nameLabel.text = "无名之辈";
        }
        
        // 更新进度提示
        if (this.progressLabel) {
            this.progressLabel.text = "正在加载用户数据...";
        }
        
        // 加载用户数据
        GameDataManager.loadUserData((data: any) => {
            if (data) {
                console.log("数据加载成功，开始恢复游戏状态");
                // 恢复游戏数据
                const playerInfo = GameDataManager.restoreGameData(data, this.assistants, this.challenges);
                
                if (playerInfo) {
                    // 恢复玩家信息
                    this.playerLevel = playerInfo.playerLevel || this.playerLevel;
                    this.money = playerInfo.money || this.money;
                    this.clickRewardBase = playerInfo.clickRewardBase || this.clickRewardBase;
                    this.clickMultiplier = playerInfo.clickMultiplier || this.clickMultiplier;
                    this.upgradeCost = playerInfo.upgradeCost || this.upgradeCost;
                    this.trainingCount = playerInfo.trainingCount || this.trainingCount;
                    
                    // 更新显示
                    if (this.levelLabel) {
                        this.levelLabel.text = this.playerLevel + "级";
                    }
                    this.updateMoneyDisplay();
                    this.updateUpgradeCostDisplay();
                    this.updateMultiplierDisplay();
                    this.updatePerSecondDisplay();
                    
                    // 更新助理after图片显示（延迟一帧确保桌子已创建）
                    Laya.timer.frameOnce(1, this, () => {
                        this.updateAssistantAfterImage();
                    });
                    
                    console.log("游戏数据恢复完成");
                    
                    // 计算离线收益（如果距离上次更新时间大于1分钟）
                    this.calculateOfflineEarnings(playerInfo.lastUpdateTime);
                } else {
                    console.log("使用默认游戏数据");
                    // 没有数据，直接标记为已处理，可以开始自动保存
                    this.offlineEarningsResolved = true;
                }
                
                this.dataLoaded = true;
                this.dataLoadSuccess = true; // 标记数据加载成功
                
                // 如果有离线收益，显示弹窗；否则直接启动自动保存
                if (this.offlineEarnings > 0) {
                    // 延迟一帧显示弹窗，确保UI已创建
                    Laya.timer.frameOnce(1, this, () => {
                        this.showOfflineEarningsDialog();
                    });
                } else {
                    // 没有离线收益，直接启动自动保存
                    this.offlineEarningsResolved = true;
                    this.startAutoSave();
                }
                
                // 调用回调函数，传递成功标志
                if (callback) {
                    callback(true);
                }
            } else {
                console.log("数据加载失败，使用默认数据，不启动自动保存");
                this.dataLoaded = true;
                this.dataLoadSuccess = false; // 标记数据加载失败，不允许上传
                // 数据加载失败时不启动自动保存，避免上传数据
                
                // 调用回调函数，传递失败标志
                if (callback) {
                    callback(false);
                }
            }
        });
    }
    
    /**
     * 加载用户头像（使用默认头像）
     * @param avatarSize 头像大小
     */
    private loadUserAvatar(avatarSize: number): void {
        // 直接使用默认头像
        console.log("加载默认头像");
        this.loadDefaultAvatar(avatarSize);
    }
    
    /**
     * 加载默认头像
     * @param avatarSize 头像大小
     */
    private loadDefaultAvatar(avatarSize: number): void {
        // 尝试加载默认头像图片（从服务器获取）
        // 如果图片不存在，会使用默认颜色块
        Laya.loader.load(this.getServerResourceUrl("resources/avatar.png"), Laya.Handler.create(this, (texture: Laya.Texture) => {
            if (texture) {
                // 加载成功，使用图片
                this.avatarImg.graphics.clear();
                this.avatarImg.graphics.drawTexture(texture, 0, 0, avatarSize, avatarSize);
            } else {
                // 加载失败，使用默认颜色块
                this.avatarImg.graphics.clear();
                this.avatarImg.graphics.drawRect(0, 0, avatarSize, avatarSize, "#5a9");
            }
        }), null, null, 0, false, null, false);
    }
    
    /**
     * 启动定时保存
     */
    private startAutoSave(): void {
        // 只有在离线收益处理完成后才启动自动保存
        if (!this.offlineEarningsResolved) {
            console.log("离线收益未处理，暂不启动自动保存");
            return;
        }
        
        // 设置网络错误回调（用于显示错误弹窗，上传数据时的错误）
        GameDataManager.setOnNetworkError(() => {
            this.showNetworkErrorDialog(true); // true 表示是上传错误
        });
        
        // 设置更新重试按钮的回调
        GameDataManager.setUpdateRetryButton((text: string, enabled: boolean) => {
            this.updateRetryButton(text, enabled);
        });
        
        // 设置关闭重试弹窗的回调
        GameDataManager.setCloseRetryDialog(() => {
            this.closeRetryDialog();
        });
        
        // 启动定时保存
        // 注意：如需修改自动保存间隔，请直接修改 GameDataManager 中的 autoSaveInterval 变量，然后重启游戏
        GameDataManager.startAutoSave(() => {
            return this.getCurrentGameData();
        });
        this.autoSaveEnabled = true;
        console.log("定时保存已启动");
    }
    
    /**
     * 获取当前游戏数据（用于定时保存）
     */
    private getCurrentGameData(): any {
        // 如果数据还未加载完成，返回null
        if (!this.dataLoaded) {
            return null;
        }
        
        // 如果数据加载失败，返回null（不上传数据）
        if (!this.dataLoadSuccess) {
            return null;
        }
        
        // 如果离线收益未处理完成，返回null（不上传数据，避免更新时间变动）
        if (!this.offlineEarningsResolved) {
            return null;
        }
        
        // 格式化游戏数据
        return GameDataManager.formatGameData(
            this.playerLevel,
            this.money,
            this.clickRewardBase,
            this.clickMultiplier,
            this.upgradeCost,
            this.trainingCount,
            this.assistants,
            this.challenges
        );
    }
    
    /**
     * 计算离线收益
     * @param lastUpdateTime 上次更新时间（格式：YYYY-MM-DD HH:mm:ss）
     */
    private calculateOfflineEarnings(lastUpdateTime?: string): void {
        // 如果没有上次更新时间，不计算离线收益
        if (!lastUpdateTime) {
            console.log("没有上次更新时间，不计算离线收益");
            this.offlineEarnings = 0;
            return;
        }
        
        try {
            // 解析上次更新时间（支持ISO格式：2025-11-16T09:40:31）
            let lastUpdate: Date;
            
            // 如果是ISO格式（包含T），直接解析
            if (lastUpdateTime.includes('T')) {
                lastUpdate = new Date(lastUpdateTime);
            } else {
                // 传统格式：YYYY-MM-DD HH:mm:ss，替换为 YYYY/MM/DD HH:mm:ss
                lastUpdate = new Date(lastUpdateTime.replace(/-/g, '/').replace(' ', 'T'));
            }
            
            // 检查日期是否有效
            if (isNaN(lastUpdate.getTime())) {
                console.error("无效的日期格式:", lastUpdateTime);
                this.offlineEarnings = 0;
                return;
            }
            
            const now = new Date();
            const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
            
            console.log("上次更新时间:", lastUpdate.toLocaleString(), "当前时间:", now.toLocaleString());
            console.log("距离上次更新时间:", diffSeconds, "秒");
            
            // 如果距离上次更新时间小于等于60秒（1分钟），不计算离线收益
            if (diffSeconds <= 60) {
                console.log("距离上次更新时间不足1分钟，不计算离线收益");
                this.offlineEarnings = 0;
                return;
            }
            
            // 如果时间差为负数（可能是时区问题），不计算离线收益
            if (diffSeconds < 0) {
                console.warn("时间差为负数，可能是时区问题，不计算离线收益");
                this.offlineEarnings = 0;
                return;
            }
            
            // 计算每秒收益（使用当前的助理配置）
            let perSecondEarnings = 0;
            for (const assistant of this.assistants) {
                if (assistant.unlocked && assistant.level > 0) {
                    // n级助理每秒可提供解锁所需金币的0.0n倍的金币（即解锁所需金币 * n / 100）
                    const earnings = Math.floor(assistant.unlockCost * assistant.level / 100);
                    perSecondEarnings += earnings;
                }
            }
            
            // 乘以培训倍率（2的n次方）
            const trainingMultiplier = Math.pow(2, this.trainingCount);
            const finalPerSecondEarnings = perSecondEarnings * trainingMultiplier;
            
            // 计算离线收益（离线秒数 * 每秒收益）
            this.offlineEarnings = Math.floor(finalPerSecondEarnings * diffSeconds);
            
            console.log("离线收益计算:", "离线秒数=" + diffSeconds, "每秒收益=" + finalPerSecondEarnings, "总收益=" + this.offlineEarnings);
        } catch (error) {
            console.error("计算离线收益失败:", error, "lastUpdateTime:", lastUpdateTime);
            this.offlineEarnings = 0;
        }
    }
    
    /**
     * 显示离线收益弹窗
     */
    private showOfflineEarningsDialog(): void {
        if (this.offlineEarnings <= 0) {
            return;
        }
        
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 创建弹窗容器
        const dialog = new Laya.Sprite();
        dialog.name = "offlineEarningsDialog";
        dialog.size(stageWidth, stageHeight);
        
        // 创建半透明背景遮罩
        const mask = new Laya.Sprite();
        mask.name = "mask";
        mask.size(stageWidth, stageHeight);
        mask.graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        mask.alpha = 0.5;
        mask.mouseEnabled = true;
        dialog.addChild(mask);
        
        // 弹窗尺寸（手机端适配）
        const dialogWidth = Math.max(280, Math.min(stageWidth * 0.8, 400));
        const dialogHeight = Math.max(200, Math.min(stageHeight * 0.3, 300));
        const fontSize = Math.max(16, Math.min(stageWidth * 0.04, 24));
        const buttonFontSize = Math.max(14, Math.min(stageWidth * 0.035, 20));
        
        // 创建弹窗背景
        const dialogBg = new Laya.Sprite();
        dialogBg.name = "dialogBg";
        dialogBg.size(dialogWidth, dialogHeight);
        dialogBg.graphics.drawRect(0, 0, dialogWidth, dialogHeight, "#ffffff");
        dialogBg.graphics.drawRect(2, 2, dialogWidth - 4, dialogHeight - 4, "#333333", "#333333", 2);
        dialogBg.pos((stageWidth - dialogWidth) / 2, (stageHeight - dialogHeight) / 2);
        dialog.addChild(dialogBg);
        
        // 创建标题
        const titleLabel = new Laya.Text();
        titleLabel.name = "titleLabel";
        titleLabel.text = "离线收益";
        titleLabel.fontSize = fontSize + 4;
        titleLabel.color = "#333333";
        titleLabel.width = dialogWidth;
        titleLabel.height = fontSize * 2;
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(0, fontSize * 0.5);
        titleLabel.mouseEnabled = false;
        dialogBg.addChild(titleLabel);
        
        // 创建收益显示
        const earningsLabel = new Laya.Text();
        earningsLabel.name = "earningsLabel";
        earningsLabel.text = "获得金币: " + this.formatMoney(this.offlineEarnings);
        earningsLabel.fontSize = fontSize;
        earningsLabel.color = "#ff6600";
        earningsLabel.width = dialogWidth;
        earningsLabel.height = fontSize * 1.5;
        earningsLabel.align = "center";
        earningsLabel.valign = "middle";
        earningsLabel.pos(0, fontSize * 3);
        earningsLabel.mouseEnabled = false;
        dialogBg.addChild(earningsLabel);
        
        // 创建按钮容器
        const buttonContainer = new Laya.Sprite();
        buttonContainer.name = "buttonContainer";
        buttonContainer.pos(0, dialogHeight - fontSize * 4);
        dialogBg.addChild(buttonContainer);
        
        // 创建放弃按钮
        const cancelBtn = new Laya.Sprite();
        cancelBtn.name = "cancelBtn";
        const cancelBtnWidth = (dialogWidth - fontSize) / 2;
        const cancelBtnHeight = fontSize * 2;
        cancelBtn.size(cancelBtnWidth, cancelBtnHeight);
        cancelBtn.graphics.drawRect(0, 0, cancelBtnWidth, cancelBtnHeight, "#cccccc");
        cancelBtn.graphics.drawRect(2, 2, cancelBtnWidth - 4, cancelBtnHeight - 4, "#999999", "#999999", 2);
        cancelBtn.pos(fontSize * 0.5, 0);
        
        const cancelLabel = new Laya.Text();
        cancelLabel.name = "cancelLabel";
        cancelLabel.text = "放弃";
        cancelLabel.fontSize = buttonFontSize;
        cancelLabel.color = "#333333";
        cancelLabel.width = cancelBtnWidth;
        cancelLabel.height = cancelBtnHeight;
        cancelLabel.align = "center";
        cancelLabel.valign = "middle";
        cancelLabel.mouseEnabled = false;
        cancelBtn.addChild(cancelLabel);
        
        cancelBtn.mouseEnabled = true;
        cancelBtn.on(Laya.Event.CLICK, this, () => {
            this.onOfflineEarningsCancel();
        });
        buttonContainer.addChild(cancelBtn);
        
        // 创建领取按钮
        const confirmBtn = new Laya.Sprite();
        confirmBtn.name = "confirmBtn";
        const confirmBtnWidth = (dialogWidth - fontSize) / 2;
        const confirmBtnHeight = fontSize * 2;
        confirmBtn.size(confirmBtnWidth, confirmBtnHeight);
        confirmBtn.graphics.drawRect(0, 0, confirmBtnWidth, confirmBtnHeight, "#4CAF50");
        confirmBtn.graphics.drawRect(2, 2, confirmBtnWidth - 4, confirmBtnHeight - 4, "#45a049", "#45a049", 2);
        confirmBtn.pos(cancelBtnWidth + fontSize, 0);
        
        const confirmLabel = new Laya.Text();
        confirmLabel.name = "confirmLabel";
        confirmLabel.text = "领取";
        confirmLabel.fontSize = buttonFontSize;
        confirmLabel.color = "#ffffff";
        confirmLabel.width = confirmBtnWidth;
        confirmLabel.height = confirmBtnHeight;
        confirmLabel.align = "center";
        confirmLabel.valign = "middle";
        confirmLabel.mouseEnabled = false;
        confirmBtn.addChild(confirmLabel);
        
        confirmBtn.mouseEnabled = true;
        confirmBtn.on(Laya.Event.CLICK, this, () => {
            this.onOfflineEarningsConfirm();
        });
        buttonContainer.addChild(confirmBtn);
        
        // 添加到舞台
        Laya.stage.addChild(dialog);
        this.offlineEarningsDialog = dialog;
    }
    
    /**
     * 离线收益弹窗 - 领取按钮点击
     */
    private onOfflineEarningsConfirm(): void {
        console.log("领取离线收益:", this.offlineEarnings);
        
        // 增加金币
        this.money += this.offlineEarnings;
        this.updateMoneyDisplay();
        
        // 关闭弹窗
        this.closeOfflineEarningsDialog();
        
        // 标记为已处理，启动自动保存
        this.offlineEarningsResolved = true;
        this.startAutoSave();
    }
    
    /**
     * 离线收益弹窗 - 放弃按钮点击
     */
    private onOfflineEarningsCancel(): void {
        console.log("放弃离线收益");
        
        // 关闭弹窗
        this.closeOfflineEarningsDialog();
        
        // 标记为已处理，启动自动保存
        this.offlineEarningsResolved = true;
        this.startAutoSave();
    }
    
    /**
     * 关闭离线收益弹窗
     */
    private closeOfflineEarningsDialog(): void {
        if (this.offlineEarningsDialog) {
            this.offlineEarningsDialog.removeSelf();
            this.offlineEarningsDialog = null;
        }
        this.offlineEarnings = 0;
    }
    
    /**
     * 保存游戏数据（已废弃，改为定时保存）
     * 保留此方法是为了兼容性，实际不再使用
     */
    private saveGameData(): void {
        // 不再使用，数据会通过定时保存自动保存
    }
    
    /**
     * 更新桌子上方的助理图片显示（after或success）
     */
    private updateAssistantAfterImage(useAnimation: boolean = false): void {
        // 获取所有已解锁的助理
        const unlockedAssistants = this.assistants.filter(a => a.unlocked);
        
        if (unlockedAssistants.length === 0) {
            // 没有解锁的助理，不显示图片
            if (this.assistantAfterImage) {
                // 如果有动画，先滑出再销毁
                if (useAnimation && !this.isSwitchingAssistant) {
                    this.isSwitchingAssistant = true;
                    const stageWidth = Laya.stage.width || 750;
                    Laya.Tween.to(this.assistantAfterImage, {
                        x: -stageWidth
                    }, 300, Laya.Ease.linearIn, Laya.Handler.create(this, () => {
            if (this.assistantAfterImage) {
                this.assistantAfterImage.destroy();
                this.assistantAfterImage = null;
                        }
                        this.isSwitchingAssistant = false;
                    }));
                } else {
                    this.assistantAfterImage.destroy();
                    this.assistantAfterImage = null;
                }
            }
            return;
        }
        
        // 确保索引有效
        if (this.currentAssistantIndex >= unlockedAssistants.length) {
            this.currentAssistantIndex = 0;
        }
        
        const currentAssistant = unlockedAssistants[this.currentAssistantIndex];
        // 根据状态显示after或success图片
        // 如果挑战未完成，强制显示after
        let imageType = this.isShowingAfter ? "after" : "success";
        if (imageType === "success" && !this.isChallengeCompleted(currentAssistant.id)) {
            // 挑战未完成，强制显示after
            imageType = "after";
            this.isShowingAfter = true; // 同步状态
            console.log("挑战未完成，强制显示after图片，助理ID:", currentAssistant.id);
        }
        const imagePath = this.getServerResourceUrl(`resources/assist/${currentAssistant.id}/${imageType}.png`);
        
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 获取桌子位置
        const deskSprite = this.ticketContainer?.getChildByName("deskSprite") as Laya.Sprite;
        if (!deskSprite) {
            console.warn("桌子Sprite不存在，无法定位助理图片");
            return;
        }
        
        // 计算目标位置（居中位置）
        const calculateTargetPosition = (texture: Laya.Texture) => {
            const imageWidth = texture.width || 200;
            const imageHeight = texture.height || 200;
            const scale = 1;
            const displayWidth = imageWidth * scale;
            const displayHeight = imageHeight * scale;
            const centerX = (stageWidth - displayWidth) / 2;
            const centerY = stageHeight - displayHeight;
            return { displayWidth, displayHeight, centerX, centerY };
        };
        
        // 显示新图片的函数
        const showNewImage = (texture: Laya.Texture) => {
            const { displayWidth, displayHeight, centerX, centerY } = calculateTargetPosition(texture);
        
            // 如果图片Sprite不存在，创建它
            const isNewImage = !this.assistantAfterImage;
            if (isNewImage) {
                this.assistantAfterImage = new Laya.Sprite();
                this.assistantAfterImage.name = "assistantAfterImage";
                this.assistantAfterImage.mouseEnabled = false;
                this.assistantAfterImage.mouseThrough = true;
                
                // 添加到ticketContainer（桌子所在的容器）
                if (this.ticketContainer) {
                    this.ticketContainer.addChild(this.assistantAfterImage);
                }
            }
            
            // 如果是切换且有旧图片，执行滑动动画（不改变旧图片内容）
            if (useAnimation && !isNewImage) {
                // 停止之前的动画
                Laya.Tween.clearAll(this.assistantAfterImage);
                this.isSwitchingAssistant = true;
                
                // 先让旧图片向左滑出（保持旧图片内容不变）
                Laya.Tween.to(this.assistantAfterImage, {
                    x: -stageWidth
                }, 300, Laya.Ease.linearIn, Laya.Handler.create(this, () => {
                    // 旧图片滑出后，更新为新图片并从右边滑入
                    this.assistantAfterImage.graphics.clear();
                    this.assistantAfterImage.graphics.drawTexture(texture, 0, 0, displayWidth, displayHeight);
                    this.assistantAfterImage.size(displayWidth, displayHeight);
                    
                    // 新图片从右边开始
                    this.assistantAfterImage.pos(stageWidth, centerY);
                    
                    // 将助理图片移到桌子后面（降低z-index，index越小越靠后）
                    if (this.ticketContainer) {
                        const deskIndex = this.ticketContainer.getChildIndex(deskSprite);
                        this.ticketContainer.setChildIndex(this.assistantAfterImage, Math.max(0, deskIndex - 1));
                    }
                    
                    // 滑入到中间
                    Laya.Tween.to(this.assistantAfterImage, {
                        x: centerX
                    }, 300, Laya.Ease.linearOut, Laya.Handler.create(this, () => {
                        this.isSwitchingAssistant = false;
                        console.log("助理图片切换动画完成 - 助理ID:", currentAssistant.id, "图片类型:", imageType);
                    }));
                }));
            } else {
                // 首次创建或不需要动画，直接显示
                // 停止之前的动画
                if (this.assistantAfterImage) {
                    Laya.Tween.clearAll(this.assistantAfterImage);
                }
                
                // 绘制图片
                this.assistantAfterImage.graphics.clear();
                this.assistantAfterImage.graphics.drawTexture(texture, 0, 0, displayWidth, displayHeight);
                this.assistantAfterImage.size(displayWidth, displayHeight);
                this.assistantAfterImage.pos(centerX, centerY);
                
                // 将助理图片移到桌子后面（降低z-index，index越小越靠后）
                if (this.ticketContainer) {
                    const deskIndex = this.ticketContainer.getChildIndex(deskSprite);
                    this.ticketContainer.setChildIndex(this.assistantAfterImage, Math.max(0, deskIndex - 1));
                }
                
                if (isNewImage) {
                    console.log("创建助理图片 - 助理ID:", currentAssistant.id, "图片类型:", imageType);
                } else {
                    console.log("更新助理图片 - 助理ID:", currentAssistant.id, "图片类型:", imageType);
                }
            }
        };
        
        // 加载图片
        const cachedTexture = Laya.loader.getRes(imagePath);
        if (cachedTexture) {
            showNewImage(cachedTexture);
        } else {
            // 动态加载图片
            Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (texture) {
                    showNewImage(texture);
                } else {
                    console.log("图片加载失败:", imagePath);
                }
            }), null, Laya.Loader.IMAGE);
        }
    }
    
    /**
     * 检查助理对应的挑战是否完成
     * @param assistantId 助理ID
     * @returns 如果挑战完成返回true，否则返回false
     */
    private isChallengeCompleted(assistantId: number): boolean {
        const challenge = this.challenges.find(c => c.id === assistantId);
        return challenge ? challenge.completed : false;
    }
    
    /**
     * 切换到下一个助理图片（after→success→下一个助理的after→success...循环）
     * 如果助理对应的挑战未完成，跳过success图片
     */
    private switchToNextAssistant(): void {
        const unlockedAssistants = this.assistants.filter(a => a.unlocked);
        
        if (unlockedAssistants.length === 0) {
            // 没有解锁的助理，不显示图片
            if (this.assistantAfterImage) {
                this.assistantAfterImage.destroy();
                this.assistantAfterImage = null;
            }
            return;
        }
        
        // 如果当前显示的是after，尝试切换到success
        if (this.isShowingAfter) {
            const currentAssistant = unlockedAssistants[this.currentAssistantIndex];
            // 检查当前助理对应的挑战是否完成
            if (this.isChallengeCompleted(currentAssistant.id)) {
                // 挑战已完成，可以显示success
                this.isShowingAfter = false;
                console.log("切换到success图片，当前助理ID:", currentAssistant.id);
            } else {
                // 挑战未完成，跳过success，直接切换到下一个助理的after
                this.isShowingAfter = true;
                this.currentAssistantIndex = (this.currentAssistantIndex + 1) % unlockedAssistants.length;
                const nextAssistant = unlockedAssistants[this.currentAssistantIndex];
                console.log("挑战未完成，跳过success，切换到下一个助理的after图片，助理ID:", nextAssistant.id);
            }
        } else {
            // 如果当前显示的是success，切换到下一个助理的after
            this.isShowingAfter = true;
            this.currentAssistantIndex = (this.currentAssistantIndex + 1) % unlockedAssistants.length;
            console.log("切换到下一个助理的after图片，当前索引:", this.currentAssistantIndex, "助理ID:", unlockedAssistants[this.currentAssistantIndex].id);
        }
        
        // 更新图片显示（使用动画）
        this.updateAssistantAfterImage(true);
    }
    
    /**
     * 全屏显示助理after图片（解锁时显示）
     * @param assistantId 助理ID
     */
    private showFullScreenAfterImage(assistantId: number): void {
        // 清除当前挑战ID（这是助理图片，不是挑战success图片）
        this.currentChallengeId = 0;
        // 如果已有全屏图片正在显示，先移除
        if (this.fullScreenAfterImage) {
            // 停止所有Tween动画
            Laya.Tween.clearAll(this.fullScreenAfterImage);
            // 移除事件监听
            this.fullScreenAfterImage.off(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
            this.fullScreenAfterImage.destroy();
            this.fullScreenAfterImage = null;
        }
        
        // 清理文本对象
        if (this.fullScreenAssistantNameLabel) {
            this.fullScreenAssistantNameLabel.destroy();
            this.fullScreenAssistantNameLabel = null;
        }
        if (this.fullScreenContinueLabel) {
            this.fullScreenContinueLabel.destroy();
            this.fullScreenContinueLabel = null;
        }
        // 清理黑色遮挡
        if (this.fullScreenBottomMask) {
            this.fullScreenBottomMask.destroy();
            this.fullScreenBottomMask = null;
        }
        
        // 查找助理名字
        const assistant = this.assistants.find(a => a.id === assistantId);
        const assistantName = assistant ? assistant.name : "未知助理";
        
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        const imagePath = this.getServerResourceUrl(`resources/assist/${assistantId}/after.png`);
        
        // 创建全屏显示的Sprite
        this.fullScreenAfterImage = new Laya.Sprite();
        this.fullScreenAfterImage.name = "fullScreenAfterImage";
        this.fullScreenAfterImage.size(stageWidth, stageHeight);
        this.fullScreenAfterImage.mouseEnabled = false; // 初始不可点击，1秒后启用
        this.fullScreenAfterImage.mouseThrough = false; // 需要响应点击事件
        
        // 添加到stage的最上层，确保不被其他UI阻拦
        Laya.stage.addChild(this.fullScreenAfterImage);
        // 设置到最上层
        Laya.stage.setChildIndex(this.fullScreenAfterImage, Laya.stage.numChildren - 1);
        
        // 加载图片（从服务器获取）
        const cachedTexture = Laya.loader.getRes(imagePath);
        if (cachedTexture) {
            // 使用缓存的图片
            this.displayFullScreenImage(cachedTexture, stageWidth, stageHeight, assistantId, assistantName);
            console.log("全屏显示助理after图片 - 助理ID:", assistantId, "使用缓存图片");
        } else {
            // 动态加载图片（从服务器获取）
            Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (texture && this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
                    this.displayFullScreenImage(texture, stageWidth, stageHeight, assistantId, assistantName);
                    console.log("全屏显示助理after图片 - 助理ID:", assistantId, "动态加载图片成功");
                } else {
                    console.log("全屏显示图片加载失败:", imagePath);
                    // 加载失败也要清理
                    if (this.fullScreenAfterImage) {
                        this.fullScreenAfterImage.destroy();
                        this.fullScreenAfterImage = null;
                    }
                }
            }), null, Laya.Loader.IMAGE);
        }
    }
    
    /**
     * 全屏显示助理after图片（带自定义文字，用于20级升级）
     * @param assistantId 助理ID
     * @param customText 自定义文字（显示在图片上方）
     */
    private showFullScreenAfterImageWithText(assistantId: number, customText: string): void {
        // 清除当前挑战ID（这是助理图片，不是挑战success图片）
        this.currentChallengeId = 0;
        // 如果已有全屏图片正在显示，先移除
        if (this.fullScreenAfterImage) {
            // 停止所有Tween动画
            Laya.Tween.clearAll(this.fullScreenAfterImage);
            // 移除事件监听
            this.fullScreenAfterImage.off(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
            this.fullScreenAfterImage.destroy();
            this.fullScreenAfterImage = null;
        }
        
        // 清理文本对象
        if (this.fullScreenAssistantNameLabel) {
            this.fullScreenAssistantNameLabel.destroy();
            this.fullScreenAssistantNameLabel = null;
        }
        if (this.fullScreenContinueLabel) {
            this.fullScreenContinueLabel.destroy();
            this.fullScreenContinueLabel = null;
        }
        // 清理黑色遮挡
        if (this.fullScreenBottomMask) {
            this.fullScreenBottomMask.destroy();
            this.fullScreenBottomMask = null;
        }
        
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        const imagePath = this.getServerResourceUrl(`resources/assist/${assistantId}/after.png`);
        
        // 创建全屏显示的Sprite
        this.fullScreenAfterImage = new Laya.Sprite();
        this.fullScreenAfterImage.name = "fullScreenAfterImage";
        this.fullScreenAfterImage.size(stageWidth, stageHeight);
        this.fullScreenAfterImage.mouseEnabled = false; // 初始不可点击，1秒后启用
        this.fullScreenAfterImage.mouseThrough = false; // 需要响应点击事件
        
        // 添加到stage的最上层，确保不被其他UI阻拦
        Laya.stage.addChild(this.fullScreenAfterImage);
        // 设置到最上层
        Laya.stage.setChildIndex(this.fullScreenAfterImage, Laya.stage.numChildren - 1);
        
        // 加载图片（从服务器获取）
        const cachedTexture = Laya.loader.getRes(imagePath);
        if (cachedTexture) {
            // 使用缓存的图片
            this.displayFullScreenImageWithText(cachedTexture, stageWidth, stageHeight, customText);
            console.log("全屏显示助理after图片（20级升级） - 助理ID:", assistantId, "使用缓存图片");
        } else {
            // 动态加载图片（从服务器获取）
            Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (texture && this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
                    this.displayFullScreenImageWithText(texture, stageWidth, stageHeight, customText);
                    console.log("全屏显示助理after图片（20级升级） - 助理ID:", assistantId, "动态加载图片成功");
                } else {
                    console.log("全屏显示图片加载失败:", imagePath);
                    // 加载失败也要清理
                    if (this.fullScreenAfterImage) {
                        this.fullScreenAfterImage.destroy();
                        this.fullScreenAfterImage = null;
                    }
                }
            }), null, Laya.Loader.IMAGE);
        }
    }
    
    /**
     * 显示全屏图片（内部方法，带自定义文字）
     * @param texture 图片纹理
     * @param stageWidth 舞台宽度
     * @param stageHeight 舞台高度
     * @param customText 自定义文字
     */
    private displayFullScreenImageWithText(texture: Laya.Texture, stageWidth: number, stageHeight: number, customText: string): void {
        if (!this.fullScreenAfterImage || this.fullScreenAfterImage.destroyed) {
            return;
        }
        
        const imageWidth = texture.width || 200;
        const imageHeight = texture.height || 200;
        
        // 计算目标尺寸（屏幕的80%）
        const targetScale = 0.8;
        const targetDisplayWidth = stageWidth * targetScale;
        const targetDisplayHeight = stageHeight * targetScale;
        
        // 计算图片缩放比例，使图片适应目标尺寸（保持宽高比）
        const scaleX = targetDisplayWidth / imageWidth;
        const scaleY = targetDisplayHeight / imageHeight;
        const imageScale = Math.max(scaleX, scaleY); // 使用较大的缩放比例，确保图片能填满目标区域
        
        // 最终绘制尺寸（这是图片的实际绘制尺寸，最终显示为屏幕的80%）
        const finalDisplayWidth = imageWidth * imageScale;
        const finalDisplayHeight = imageHeight * imageScale;
        
        // 设置图片中心点为缩放中心
        this.fullScreenAfterImage.pivotX = finalDisplayWidth / 2;
        this.fullScreenAfterImage.pivotY = finalDisplayHeight / 2;
        
        // 居中显示
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;
        this.fullScreenAfterImage.pos(centerX, centerY);
        
        // 绘制图片（使用最终尺寸）
        this.fullScreenAfterImage.graphics.clear();
        this.fullScreenAfterImage.graphics.drawTexture(texture, 0, 0, finalDisplayWidth, finalDisplayHeight);
        
        // 设置初始缩放（较大，比如1.5倍）
        const initialScale = 1.5;
        this.fullScreenAfterImage.scaleX = initialScale;
        this.fullScreenAfterImage.scaleY = initialScale;
        
        // 使用Tween快速缩小到目标尺寸（scale = 1.0，因为绘制尺寸已经是按屏幕80%计算的）
        Laya.Tween.to(this.fullScreenAfterImage, {
            scaleX: 1.0,
            scaleY: 1.0
        }, 300, Laya.Ease.backOut, Laya.Handler.create(this, () => {
            console.log("全屏after图片缩放动画完成，最终显示为屏幕的80%");
        }));
        
        // 创建自定义文字文本（显示在图片上方）
        this.fullScreenAssistantNameLabel = new Laya.Text();
        this.fullScreenAssistantNameLabel.name = "fullScreenAssistantNameLabel";
        this.fullScreenAssistantNameLabel.text = customText;
        this.fullScreenAssistantNameLabel.fontSize = Math.max(28, Math.min(stageWidth * 0.08, 48));
        this.fullScreenAssistantNameLabel.color = "#ffffff";
        this.fullScreenAssistantNameLabel.width = stageWidth;
        this.fullScreenAssistantNameLabel.height = Math.max(40, stageHeight * 0.06);
        this.fullScreenAssistantNameLabel.align = "center";
        this.fullScreenAssistantNameLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部10%
        this.fullScreenAssistantNameLabel.pos(0, stageHeight * 0.1);
        this.fullScreenAssistantNameLabel.mouseEnabled = false;
        this.fullScreenAssistantNameLabel.mouseThrough = true;
        // 添加到stage的最上层
        Laya.stage.addChild(this.fullScreenAssistantNameLabel);
        Laya.stage.setChildIndex(this.fullScreenAssistantNameLabel, Laya.stage.numChildren - 1);
        console.log("显示自定义文字:", customText);
        
        // 创建全屏黑色遮挡（在图片后方）
        this.fullScreenBottomMask = new Laya.Sprite();
        this.fullScreenBottomMask.name = "fullScreenBottomMask";
        // 全屏遮挡
        this.fullScreenBottomMask.size(stageWidth, stageHeight);
        this.fullScreenBottomMask.pos(0, 0);
        // 绘制半透明黑色矩形（全屏）
        this.fullScreenBottomMask.graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        this.fullScreenBottomMask.alpha = 0.6; // 60%透明度
        this.fullScreenBottomMask.mouseEnabled = false;
        this.fullScreenBottomMask.mouseThrough = true;
        // 添加到stage，在图片后方（z-index更低）
        Laya.stage.addChild(this.fullScreenBottomMask);
        // 设置层级：确保在图片下方（图片会显示在遮挡上方）
        const imageIndex = Laya.stage.getChildIndex(this.fullScreenAfterImage);
        // 如果图片索引大于0，将遮挡设置到图片下方；否则设置为0
        const maskIndex = imageIndex > 0 ? imageIndex - 1 : 0;
        Laya.stage.setChildIndex(this.fullScreenBottomMask, maskIndex);
        console.log("创建全屏黑色遮挡（在图片后方），遮挡层级:", maskIndex, "图片层级:", imageIndex);
        
        // 1秒后启用点击，并显示"点按任意键继续"文字
        Laya.timer.once(1000, this, () => {
            if (this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
                // 启用点击
                this.fullScreenAfterImage.mouseEnabled = true;
                // 添加点击事件监听
                this.fullScreenAfterImage.on(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
                console.log("全屏after图片已启用点击，点击屏幕任意位置可关闭");
                
                // 创建"点按任意键继续"文本（显示在图片下方）
                this.fullScreenContinueLabel = new Laya.Text();
                this.fullScreenContinueLabel.name = "fullScreenContinueLabel";
                this.fullScreenContinueLabel.text = "点按任意键继续";
                this.fullScreenContinueLabel.fontSize = Math.max(20, Math.min(stageWidth * 0.05, 32));
                this.fullScreenContinueLabel.color = "#ffffff";
                this.fullScreenContinueLabel.width = stageWidth;
                this.fullScreenContinueLabel.height = Math.max(30, stageHeight * 0.04);
                this.fullScreenContinueLabel.align = "center";
                this.fullScreenContinueLabel.valign = "middle";
                // 位置：屏幕下方，距离底部10%
                this.fullScreenContinueLabel.pos(0, stageHeight * 0.9);
                this.fullScreenContinueLabel.mouseEnabled = false;
                this.fullScreenContinueLabel.mouseThrough = true;
                // 添加到stage的最上层
                Laya.stage.addChild(this.fullScreenContinueLabel);
                Laya.stage.setChildIndex(this.fullScreenContinueLabel, Laya.stage.numChildren - 1);
                console.log("显示'点按任意键继续'提示");
            }
        });
    }
    
    /**
     * 显示全屏图片（内部方法）
     * @param texture 图片纹理
     * @param stageWidth 舞台宽度
     * @param stageHeight 舞台高度
     * @param assistantId 助理ID
     * @param assistantName 助理名字
     */
    private displayFullScreenImage(texture: Laya.Texture, stageWidth: number, stageHeight: number, assistantId: number, assistantName: string): void {
        if (!this.fullScreenAfterImage || this.fullScreenAfterImage.destroyed) {
            return;
        }
        
        const imageWidth = texture.width || 200;
        const imageHeight = texture.height || 200;
        
        // 计算目标尺寸（屏幕的80%）
        const targetScale = 0.8;
        const targetDisplayWidth = stageWidth * targetScale;
        const targetDisplayHeight = stageHeight * targetScale;
        
        // 计算图片缩放比例，使图片适应目标尺寸（保持宽高比）
        const scaleX = targetDisplayWidth / imageWidth;
        const scaleY = targetDisplayHeight / imageHeight;
        const imageScale = Math.max(scaleX, scaleY); // 使用较大的缩放比例，确保图片能填满目标区域
        
        // 最终绘制尺寸（这是图片的实际绘制尺寸，最终显示为屏幕的80%）
        const finalDisplayWidth = imageWidth * imageScale;
        const finalDisplayHeight = imageHeight * imageScale;
        
        // 设置图片中心点为缩放中心
        this.fullScreenAfterImage.pivotX = finalDisplayWidth / 2;
        this.fullScreenAfterImage.pivotY = finalDisplayHeight / 2;
        
        // 居中显示
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;
        this.fullScreenAfterImage.pos(centerX, centerY);
        
        // 绘制图片（使用最终尺寸）
        this.fullScreenAfterImage.graphics.clear();
        this.fullScreenAfterImage.graphics.drawTexture(texture, 0, 0, finalDisplayWidth, finalDisplayHeight);
        
        // 设置初始缩放（较大，比如1.5倍）
        const initialScale = 1.5;
        this.fullScreenAfterImage.scaleX = initialScale;
        this.fullScreenAfterImage.scaleY = initialScale;
        
        // 使用Tween快速缩小到目标尺寸（scale = 1.0，因为绘制尺寸已经是按屏幕80%计算的）
        Laya.Tween.to(this.fullScreenAfterImage, {
            scaleX: 1.0,
            scaleY: 1.0
        }, 300, Laya.Ease.backOut, Laya.Handler.create(this, () => {
            console.log("全屏after图片缩放动画完成，最终显示为屏幕的80%");
        }));
        
        // 创建助理名字文本（显示在图片上方）
        this.fullScreenAssistantNameLabel = new Laya.Text();
        this.fullScreenAssistantNameLabel.name = "fullScreenAssistantNameLabel";
        this.fullScreenAssistantNameLabel.text = assistantName;
        this.fullScreenAssistantNameLabel.fontSize = Math.max(28, Math.min(stageWidth * 0.08, 48));
        this.fullScreenAssistantNameLabel.color = "#ffffff";
        this.fullScreenAssistantNameLabel.width = stageWidth;
        this.fullScreenAssistantNameLabel.height = Math.max(40, stageHeight * 0.06);
        this.fullScreenAssistantNameLabel.align = "center";
        this.fullScreenAssistantNameLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部10%
        this.fullScreenAssistantNameLabel.pos(0, stageHeight * 0.1);
        this.fullScreenAssistantNameLabel.mouseEnabled = false;
        this.fullScreenAssistantNameLabel.mouseThrough = true;
        // 添加到stage的最上层
        Laya.stage.addChild(this.fullScreenAssistantNameLabel);
        Laya.stage.setChildIndex(this.fullScreenAssistantNameLabel, Laya.stage.numChildren - 1);
        console.log("显示助理名字:", assistantName);
        
        // 创建全屏黑色遮挡（在图片后方）
        this.fullScreenBottomMask = new Laya.Sprite();
        this.fullScreenBottomMask.name = "fullScreenBottomMask";
        // 全屏遮挡
        this.fullScreenBottomMask.size(stageWidth, stageHeight);
        this.fullScreenBottomMask.pos(0, 0);
        // 绘制半透明黑色矩形（全屏）
        this.fullScreenBottomMask.graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        this.fullScreenBottomMask.alpha = 0.6; // 60%透明度
        this.fullScreenBottomMask.mouseEnabled = false;
        this.fullScreenBottomMask.mouseThrough = true;
        // 添加到stage，在图片后方（z-index更低）
        Laya.stage.addChild(this.fullScreenBottomMask);
        // 设置层级：确保在图片下方（图片会显示在遮挡上方）
        const imageIndex = Laya.stage.getChildIndex(this.fullScreenAfterImage);
        // 如果图片索引大于0，将遮挡设置到图片下方；否则设置为0
        const maskIndex = imageIndex > 0 ? imageIndex - 1 : 0;
        Laya.stage.setChildIndex(this.fullScreenBottomMask, maskIndex);
        console.log("创建全屏黑色遮挡（在图片后方），遮挡层级:", maskIndex, "图片层级:", imageIndex);
        
        // 1秒后启用点击，并显示"点按任意键继续"文字
        Laya.timer.once(1000, this, () => {
            if (this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
                // 启用点击
                this.fullScreenAfterImage.mouseEnabled = true;
                // 添加点击事件监听
                this.fullScreenAfterImage.on(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
                console.log("全屏after图片已启用点击，点击屏幕任意位置可关闭");
                
                // 创建"点按任意键继续"文本（显示在图片下方）
                this.fullScreenContinueLabel = new Laya.Text();
                this.fullScreenContinueLabel.name = "fullScreenContinueLabel";
                this.fullScreenContinueLabel.text = "点按任意键继续";
                this.fullScreenContinueLabel.fontSize = Math.max(20, Math.min(stageWidth * 0.05, 32));
                this.fullScreenContinueLabel.color = "#ffffff";
                this.fullScreenContinueLabel.width = stageWidth;
                this.fullScreenContinueLabel.height = Math.max(30, stageHeight * 0.04);
                this.fullScreenContinueLabel.align = "center";
                this.fullScreenContinueLabel.valign = "middle";
                // 位置：屏幕下方，距离底部10%
                this.fullScreenContinueLabel.pos(0, stageHeight * 0.9);
                this.fullScreenContinueLabel.mouseEnabled = false;
                this.fullScreenContinueLabel.mouseThrough = true;
                // 添加到stage的最上层
                Laya.stage.addChild(this.fullScreenContinueLabel);
                Laya.stage.setChildIndex(this.fullScreenContinueLabel, Laya.stage.numChildren - 1);
                console.log("显示'点按任意键继续'提示");
            }
        });
    }
    
    /**
     * 播放挑战成功视频
     * @param assistantId 助理ID（对应挑战ID）
     * @param multiplierBonusPercent 倍率加成百分比值
     */
    private playChallengeSuccessVideo(assistantId: number, multiplierBonusPercent: number): void {
        const wx = (window as any).wx;
        
        // 检查是否在微信小游戏环境中
        if (!wx || !wx.createVideo) {
            console.log("不在微信小游戏环境中或不支持视频播放，直接显示success图片");
            // 如果不在微信小游戏环境，直接显示success图片
            this.showFullScreenSuccessImage(assistantId, multiplierBonusPercent);
            return;
        }
        
        // 获取窗口信息
        const windowInfo = wx.getWindowInfo();
        const { windowWidth, windowHeight } = windowInfo;
        
        // 构建视频路径（url前部分和gameDataManager一致）
        // 使用GameDataManager的apiBaseUrl作为基础URL
        const apiBaseUrl = GameDataManager.getApiBaseUrl();
        const videoPath = `${apiBaseUrl}/resources/assist/${assistantId}/success.mp4`;
        
        console.log("开始播放挑战成功视频 - 助理ID:", assistantId, "视频路径:", videoPath);
        
        // 创建视频对象（保持原比例，宽度占满屏幕）
        const video = wx.createVideo({
            src: videoPath,
            width: windowWidth,
            height: windowHeight, // 高度设置为屏幕高度，实际显示高度会根据视频比例自适应
            loop: false, // 不循环播放
            controls: false, // 不显示控制条
            showProgress: false, // 不显示进度条
            showProgressInControlMode: false,
            autoplay: true, // 自动播放
            showCenterPlayBtn: false, // 不显示中心播放按钮
            underGameView: false, // 放在游戏画布之上渲染，确保可见
            enableProgressGesture: false, // 禁用进度手势
            objectFit: "contain" // 保持宽高比，宽度占满屏幕，高度按比例自适应
        });
        
        // 监听视频播放结束事件
        video.onEnded(() => {
            console.log("挑战成功视频播放结束 - 助理ID:", assistantId);
            // 视频播放完成后，销毁视频并显示success图片（传入倍率值）
            video.destroy();
            this.showFullScreenSuccessImage(assistantId, multiplierBonusPercent);
        });
        
        // 监听视频播放错误
        video.onError((res: any) => {
            console.error("视频播放失败 - 助理ID:", assistantId, "错误信息:", res);
            // 播放失败时，直接显示success图片（传入倍率值）
            video.destroy();
            this.showFullScreenSuccessImage(assistantId, multiplierBonusPercent);
        });
        
        // 开始播放视频
        video.play();
        console.log("挑战成功视频开始播放 - 助理ID:", assistantId);
    }
    
    /**
     * 全屏显示挑战成功success图片
     * @param challengeId 挑战ID（对应助理ID）
     * @param multiplierBonusPercent 倍率加成百分比值
     */
    private showFullScreenSuccessImage(challengeId: number, multiplierBonusPercent: number): void {
        // 记录当前显示的挑战ID
        this.currentChallengeId = challengeId;
        
        // 如果已有全屏图片正在显示，先移除
        if (this.fullScreenAfterImage) {
            // 停止所有Tween动画
            Laya.Tween.clearAll(this.fullScreenAfterImage);
            // 移除事件监听
            this.fullScreenAfterImage.off(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
            this.fullScreenAfterImage.destroy();
            this.fullScreenAfterImage = null;
        }
        
        // 清理文本对象
        if (this.fullScreenAssistantNameLabel) {
            this.fullScreenAssistantNameLabel.destroy();
            this.fullScreenAssistantNameLabel = null;
        }
        if (this.fullScreenContinueLabel) {
            this.fullScreenContinueLabel.destroy();
            this.fullScreenContinueLabel = null;
        }
        // 清理黑色遮挡
        if (this.fullScreenBottomMask) {
            this.fullScreenBottomMask.destroy();
            this.fullScreenBottomMask = null;
        }
        
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        const imagePath = this.getServerResourceUrl(`resources/assist/${challengeId}/success.png`);
        
        // 创建全屏显示的Sprite
        this.fullScreenAfterImage = new Laya.Sprite();
        this.fullScreenAfterImage.name = "fullScreenAfterImage";
        this.fullScreenAfterImage.size(stageWidth, stageHeight);
        this.fullScreenAfterImage.mouseEnabled = false; // 初始不可点击，1秒后启用
        this.fullScreenAfterImage.mouseThrough = false; // 需要响应点击事件
        
        // 添加到stage的最上层，确保不被其他UI阻拦
        Laya.stage.addChild(this.fullScreenAfterImage);
        // 设置到最上层
        Laya.stage.setChildIndex(this.fullScreenAfterImage, Laya.stage.numChildren - 1);
        
        // 加载图片（从服务器获取）
        const cachedTexture = Laya.loader.getRes(imagePath);
        if (cachedTexture) {
            // 使用缓存的图片
            this.displayFullScreenSuccessImage(cachedTexture, stageWidth, stageHeight, multiplierBonusPercent);
            console.log("全屏显示挑战成功success图片 - 挑战ID:", challengeId, "使用缓存图片");
        } else {
            // 动态加载图片（从服务器获取）
            Laya.loader.load(imagePath, Laya.Handler.create(this, (texture: Laya.Texture) => {
                if (texture && this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
                    this.displayFullScreenSuccessImage(texture, stageWidth, stageHeight, multiplierBonusPercent);
                    console.log("全屏显示挑战成功success图片 - 挑战ID:", challengeId, "动态加载图片成功");
                } else {
                    console.log("全屏显示图片加载失败:", imagePath);
                    // 加载失败也要清理
                    if (this.fullScreenAfterImage) {
                        this.fullScreenAfterImage.destroy();
                        this.fullScreenAfterImage = null;
                    }
                }
            }), null, Laya.Loader.IMAGE);
        }
    }
    
    /**
     * 显示全屏挑战成功图片（内部方法）
     * @param texture 图片纹理
     * @param stageWidth 舞台宽度
     * @param stageHeight 舞台高度
     * @param multiplierBonusPercent 倍率加成百分比值
     */
    private displayFullScreenSuccessImage(texture: Laya.Texture, stageWidth: number, stageHeight: number, multiplierBonusPercent: number): void {
        if (!this.fullScreenAfterImage || this.fullScreenAfterImage.destroyed) {
            return;
        }
        
        const imageWidth = texture.width || 200;
        const imageHeight = texture.height || 200;
        
        // 计算目标尺寸（屏幕的80%）
        const targetScale = 0.8;
        const targetDisplayWidth = stageWidth * targetScale;
        const targetDisplayHeight = stageHeight * targetScale;
        
        // 计算图片缩放比例，使图片适应目标尺寸（保持宽高比）
        const scaleX = targetDisplayWidth / imageWidth;
        const scaleY = targetDisplayHeight / imageHeight;
        const imageScale = Math.max(scaleX, scaleY); // 使用较大的缩放比例，确保图片能填满目标区域
        
        // 最终绘制尺寸（这是图片的实际绘制尺寸，最终显示为屏幕的80%）
        const finalDisplayWidth = imageWidth * imageScale;
        const finalDisplayHeight = imageHeight * imageScale;
        
        // 设置图片中心点为缩放中心
        this.fullScreenAfterImage.pivotX = finalDisplayWidth / 2;
        this.fullScreenAfterImage.pivotY = finalDisplayHeight / 2;
        
        // 居中显示
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;
        this.fullScreenAfterImage.pos(centerX, centerY);
        
        // 绘制图片（使用最终尺寸）
        this.fullScreenAfterImage.graphics.clear();
        this.fullScreenAfterImage.graphics.drawTexture(texture, 0, 0, finalDisplayWidth, finalDisplayHeight);
        
        // 设置初始缩放（较大，比如1.5倍）
        const initialScale = 1.5;
        this.fullScreenAfterImage.scaleX = initialScale;
        this.fullScreenAfterImage.scaleY = initialScale;
        
        // 使用Tween快速缩小到目标尺寸（scale = 1.0，因为绘制尺寸已经是按屏幕80%计算的）
        Laya.Tween.to(this.fullScreenAfterImage, {
            scaleX: 1.0,
            scaleY: 1.0
        }, 300, Laya.Ease.backOut, Laya.Handler.create(this, () => {
            console.log("全屏success图片缩放动画完成，最终显示为屏幕的80%");
        }));
        
        // 创建"试炼成功，倍率提升{倍率值}%"文本（显示在图片上方）
        this.fullScreenAssistantNameLabel = new Laya.Text();
        this.fullScreenAssistantNameLabel.name = "fullScreenAssistantNameLabel";
        this.fullScreenAssistantNameLabel.text = `试炼成功~倍率提升${multiplierBonusPercent.toFixed(0)}%`;
        this.fullScreenAssistantNameLabel.fontSize = Math.max(28, Math.min(stageWidth * 0.08, 48));
        this.fullScreenAssistantNameLabel.color = "#ffffff";
        this.fullScreenAssistantNameLabel.width = stageWidth;
        this.fullScreenAssistantNameLabel.height = Math.max(40, stageHeight * 0.06);
        this.fullScreenAssistantNameLabel.align = "center";
        this.fullScreenAssistantNameLabel.valign = "middle";
        // 位置：屏幕上方，距离顶部10%
        this.fullScreenAssistantNameLabel.pos(0, stageHeight * 0.1);
        this.fullScreenAssistantNameLabel.mouseEnabled = false;
        this.fullScreenAssistantNameLabel.mouseThrough = true;
        // 添加到stage的最上层
        Laya.stage.addChild(this.fullScreenAssistantNameLabel);
        Laya.stage.setChildIndex(this.fullScreenAssistantNameLabel, Laya.stage.numChildren - 1);
        console.log("显示挑战成功文字: 试炼成功，倍率提升", multiplierBonusPercent.toFixed(0) + "%");
        
        // 创建全屏黑色遮挡（在图片后方）
        this.fullScreenBottomMask = new Laya.Sprite();
        this.fullScreenBottomMask.name = "fullScreenBottomMask";
        // 全屏遮挡
        this.fullScreenBottomMask.size(stageWidth, stageHeight);
        this.fullScreenBottomMask.pos(0, 0);
        // 绘制半透明黑色矩形（全屏）
        this.fullScreenBottomMask.graphics.drawRect(0, 0, stageWidth, stageHeight, "#000000");
        this.fullScreenBottomMask.alpha = 0.6; // 60%透明度
        this.fullScreenBottomMask.mouseEnabled = false;
        this.fullScreenBottomMask.mouseThrough = true;
        // 添加到stage，在图片后方（z-index更低）
        Laya.stage.addChild(this.fullScreenBottomMask);
        // 设置层级：确保在图片下方（图片会显示在遮挡上方）
        const imageIndex = Laya.stage.getChildIndex(this.fullScreenAfterImage);
        // 如果图片索引大于0，将遮挡设置到图片下方；否则设置为0
        const maskIndex = imageIndex > 0 ? imageIndex - 1 : 0;
        Laya.stage.setChildIndex(this.fullScreenBottomMask, maskIndex);
        console.log("创建全屏黑色遮挡（在图片后方），遮挡层级:", maskIndex, "图片层级:", imageIndex);
        
        // 1秒后启用点击，并显示"点按任意键继续"文字
        Laya.timer.once(1000, this, () => {
            if (this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
                // 启用点击
                this.fullScreenAfterImage.mouseEnabled = true;
                // 添加点击事件监听
                this.fullScreenAfterImage.on(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
                console.log("全屏success图片已启用点击，点击屏幕任意位置可关闭");
                
                // 创建"点按任意键继续"文本（显示在图片下方）
                this.fullScreenContinueLabel = new Laya.Text();
                this.fullScreenContinueLabel.name = "fullScreenContinueLabel";
                this.fullScreenContinueLabel.text = "点按任意键继续";
                this.fullScreenContinueLabel.fontSize = Math.max(20, Math.min(stageWidth * 0.05, 32));
                this.fullScreenContinueLabel.color = "#ffffff";
                this.fullScreenContinueLabel.width = stageWidth;
                this.fullScreenContinueLabel.height = Math.max(30, stageHeight * 0.04);
                this.fullScreenContinueLabel.align = "center";
                this.fullScreenContinueLabel.valign = "middle";
                // 位置：屏幕下方，距离底部10%
                this.fullScreenContinueLabel.pos(0, stageHeight * 0.9);
                this.fullScreenContinueLabel.mouseEnabled = false;
                this.fullScreenContinueLabel.mouseThrough = true;
                // 添加到stage的最上层
                Laya.stage.addChild(this.fullScreenContinueLabel);
                Laya.stage.setChildIndex(this.fullScreenContinueLabel, Laya.stage.numChildren - 1);
                console.log("显示'点按任意键继续'提示");
            }
        });
    }
    
    /**
     * 隐藏全屏after图片（点击后调用）
     */
    private hideFullScreenAfterImage(): void {
        // 保存当前挑战ID（在清除之前）
        const closedChallengeId = this.currentChallengeId;
        
        // 清除当前挑战ID
        this.currentChallengeId = 0;
        
        // 检查是否需要显示升级指引（解锁完成且关闭助理图片后）
        // 注意：升级指引只在助理窗口内显示，所以这里检查的是助理图片关闭
        if (closedChallengeId === 0) {
            console.log("这是助理图片关闭，检查升级指引");
            // 这是助理图片关闭，检查升级指引
            Laya.timer.frameOnce(1, this, () => {
                this.checkAndShowUpgradeGuide();
            });
        }
        
        // 检查是否需要显示挑战窗口指引（只有1号挑战的success图片关闭时才需要指引）
        if (closedChallengeId === 1) {
            console.log("这是1号挑战的success图片关闭，检查挑战窗口指引");
            // 这是1号挑战的success图片关闭，检查挑战窗口指引
            Laya.timer.frameOnce(1, this, () => {
                this.checkAndShowChallengeWindowGuide();
            });
        }
        if (this.fullScreenAfterImage && !this.fullScreenAfterImage.destroyed) {
            // 停止所有Tween动画
            Laya.Tween.clearAll(this.fullScreenAfterImage);
            // 移除点击事件监听
            this.fullScreenAfterImage.off(Laya.Event.CLICK, this, this.hideFullScreenAfterImage);
            // 销毁Sprite
            this.fullScreenAfterImage.destroy();
            this.fullScreenAfterImage = null;
            console.log("全屏after图片已移除（点击关闭）");
        }
        
        // 清理文本对象
        if (this.fullScreenAssistantNameLabel) {
            this.fullScreenAssistantNameLabel.destroy();
            this.fullScreenAssistantNameLabel = null;
        }
        if (this.fullScreenContinueLabel) {
            this.fullScreenContinueLabel.destroy();
            this.fullScreenContinueLabel = null;
        }
        // 清理黑色遮挡
        if (this.fullScreenBottomMask) {
            this.fullScreenBottomMask.destroy();
            this.fullScreenBottomMask = null;
        }
    }
}