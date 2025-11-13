const { regClass, property } = Laya;

@regClass()
export class Main extends Laya.Script {

    // 玩家信息
    private playerLevel: number = 1; // 等级从1开始
    private money: number = 0; // 当前金钱
    private clickRewardBase: number = 100; // 单次点击金币获取量基础值（初始100）
    private clickMultiplier: number = 1.0; // 点击收益倍率（初始1.0，即100%）
    private upgradeCost: number = 10; // 升级所需金币（初始10）

    // UI组件
    private avatarImg: Laya.Sprite;
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
    
    // 窗口管理
    private assistantWindow: Laya.Sprite; // 助理窗口容器
    private settingsWindow: Laya.Sprite; // 设置窗口容器
    private challengeWindow: Laya.Sprite; // 挑战窗口容器
    
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

    onAwake() {
        console.log("onAwake called");
    }

    onEnable() {
        console.log("onEnable called");
    }

    onStart() {
        console.log("onStart called, stage size:", Laya.stage.width, Laya.stage.height);
        // 延迟一帧确保stage已初始化
        Laya.timer.frameOnce(1, this, this.createUI);
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
        
        // 创建顶部玩家信息
        this.createTopBar();
        
        // 创建底部按钮
        this.createBottomButtons();
        
        // 创建弹窗容器
        this.createPopupContainer();
        
        // 添加点击事件监听（点击非按钮区域增加金钱）
        this.setupClickHandler();
        
        // 启动助理收益定时器（每秒执行一次）
        this.startAssistantTimer();
    }
    
    /**
     * 初始化助理数据
     */
    private initAssistants(): void {
        // 第一个助理解锁需要1000金币，后续每个助理解锁所需金币为前一个的10倍
        const assistantNames = ["周训", "宝儿", "婉婷", "付嫣"]; // 根据图片中的助理名称
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
                name: "手打柠檬茶",
                requiredPower: 500, // 点击收益500/次
                reward: 50000, // 首次挑战成功奖励5.00万
                completed: false,
                isBoss: false
            },
            {
                id: 2,
                name: "打歌水果捞",
                requiredPower: 3000, // 点击收益3000/次
                reward: 200000, // 首次挑战成功奖励20.0万
                completed: false,
                isBoss: false
            },
            {
                id: 3,
                name: "大声发特调",
                requiredPower: 60000, // 点击收益6.00万/次
                reward: 3000000, // 首次挑战成功奖励300万
                completed: false,
                isBoss: false
            },
            {
                id: 4,
                name: "铁牛牛肉面",
                requiredPower: 500000, // 点击收益50.0万/次
                reward: 20000000, // 首次挑战成功奖励2000万
                completed: false,
                isBoss: false
            },
            {
                id: 5,
                name: "蒜蓉羊头",
                requiredPower: 1000000000000, // 点击收益1.00兆/次（1兆=1万亿）
                reward: 100000000000000, // 首次挑战成功奖励100兆
                completed: false,
                isBoss: true
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
        
        // 如果有收益，增加金币并更新显示
        if (totalEarnings > 0) {
            this.money += totalEarnings;
            this.updateMoneyDisplay();
            this.updatePerSecondDisplay(); // 更新秒赚显示
            // 在金币下方显示收益弹窗
            this.showPopup("+" + this.formatMoney(totalEarnings) + "/秒", "money", "#00ff00");
            console.log("助理收益:", totalEarnings, "当前总金币:", this.money);
        }
    }

    /**
     * 创建背景
     */
    private createBackground(): void {
        // 创建渐变背景（模拟夜空）
        const bg = new Laya.Sprite();
        bg.name = "background";
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        bg.graphics.drawRect(0, 0, stageWidth, stageHeight, "#1a1a2e");
        
        // 直接添加到stage
        Laya.stage.addChild(bg);

        // 添加一些星星装饰
        for (let i = 0; i < 50; i++) {
            const star = new Laya.Sprite();
            star.name = "star_" + i;
            const x = Math.random() * stageWidth;
            const y = Math.random() * stageHeight * 0.6; // 只在上半部分
            const size = Math.random() * 2 + 1;
            star.graphics.drawCircle(0, 0, size, "#ffffff");
            star.pos(x, y);
            star.alpha = Math.random() * 0.8 + 0.2;
            bg.addChild(star);
        }
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

        // 玩家头像（加载自定义图片，如果图片不存在则使用默认颜色块）
        this.avatarImg = new Laya.Sprite();
        this.avatarImg.name = "avatarImg";
        const avatarInnerSize = avatarSize * 0.875; // 头像内部大小
        this.avatarImg.size(avatarInnerSize, avatarInnerSize);
        // 尝试加载头像图片，路径：assets/resources/avatar.png
        // 如果图片不存在，会使用默认颜色块
        Laya.loader.load("resources/avatar.png", Laya.Handler.create(this, (texture: Laya.Texture) => {
            if (texture) {
                // 加载成功，使用图片
                this.avatarImg.graphics.drawTexture(texture, 0, 0, avatarInnerSize, avatarInnerSize);
            } else {
                // 加载失败，使用默认颜色块
                this.avatarImg.graphics.drawRect(0, 0, avatarInnerSize, avatarInnerSize, "#5a9");
            }
        }), null, null, 0, false, null, false);
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
        const nameLabel = new Laya.Text();
        nameLabel.name = "nameLabel";
        nameLabel.text = "无名之辈";
        nameLabel.fontSize = fontSize;
        nameLabel.color = "#ffffff";
        nameLabel.pos(nameX, nameY);
        topBar.addChild(nameLabel);

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
        
        this.multiplierLabelBg = new Laya.Sprite();
        this.multiplierLabelBg.name = "multiplierLabelBg";
        this.multiplierLabelBg.size(multiplierLabelBgWidth, multiplierLabelBgHeight);
        this.multiplierLabelBg.graphics.drawRect(0, 0, multiplierLabelBgWidth, multiplierLabelBgHeight, "#000000");
        this.multiplierLabelBg.alpha = 0.7;
        this.multiplierLabelBg.pos(multiplierX, multiplierY);
        topBar.addChild(this.multiplierLabelBg);
        
        this.multiplierLabel = new Laya.Text();
        this.multiplierLabel.name = "multiplierLabel";
        // 初始显示总收益格式
        this.updateMultiplierDisplay();
        this.multiplierLabel.fontSize = fontSize;
        this.multiplierLabel.color = "#00ff00";
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
        
        this.perSecondLabelBg = new Laya.Sprite();
        this.perSecondLabelBg.name = "perSecondLabelBg";
        this.perSecondLabelBg.size(perSecondLabelBgWidth, perSecondLabelBgHeight);
        this.perSecondLabelBg.graphics.drawRect(0, 0, perSecondLabelBgWidth, perSecondLabelBgHeight, "#000000");
        this.perSecondLabelBg.alpha = 0.7;
        this.perSecondLabelBg.pos(multiplierX, perSecondY);
        topBar.addChild(this.perSecondLabelBg);
        
        this.perSecondLabel = new Laya.Text();
        this.perSecondLabel.name = "perSecondLabel";
        this.updatePerSecondDisplay();
        this.perSecondLabel.fontSize = fontSize;
        this.perSecondLabel.color = "#00aa00";
        this.perSecondLabel.width = perSecondLabelBgWidth;
        this.perSecondLabel.height = perSecondLabelBgHeight;
        this.perSecondLabel.align = "center";
        this.perSecondLabel.valign = "middle";
        this.perSecondLabel.pos(multiplierX, perSecondY);
        topBar.addChild(this.perSecondLabel);
        
        // 金钱显示（在右侧）
        const moneyX = stageWidth * 0.75; // 从屏幕75%位置开始（右侧）
        const moneyY = avatarY + (avatarSize - moneyIconSize) / 2;

        // 金钱图标（使用简单的矩形代替，可以替换为图片）
        const moneyIcon = new Laya.Sprite();
        moneyIcon.name = "moneyIcon";
        moneyIcon.size(moneyIconSize, moneyIconSize);
        moneyIcon.graphics.drawRect(0, 0, moneyIconSize, moneyIconSize, "#ffd700");
        moneyIcon.pos(moneyX, moneyY);
        topBar.addChild(moneyIcon);

        // 金钱文字背景
        const moneyLabelBgWidth = Math.max(80, stageWidth * 0.2); // 背景宽度：屏幕20%，最小80
        const moneyLabelBgHeight = Math.max(20, fontSize * 1.2);
        this.moneyLabelBg = new Laya.Sprite();
        this.moneyLabelBg.name = "moneyLabelBg";
        this.moneyLabelBg.size(moneyLabelBgWidth, moneyLabelBgHeight);
        this.moneyLabelBg.graphics.drawRect(0, 0, moneyLabelBgWidth, moneyLabelBgHeight, "#000000");
        this.moneyLabelBg.alpha = 0.7;
        this.moneyLabelBg.pos(moneyX + moneyIconSize + margin * 0.5, moneyY);
        topBar.addChild(this.moneyLabelBg);

        // 金钱文字
        this.moneyLabel = new Laya.Text();
        this.moneyLabel.name = "moneyLabel";
        this.moneyLabel.text = this.formatMoney(this.money);
        this.moneyLabel.fontSize = fontSize;
        this.moneyLabel.color = "#ffd700";
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
        
        const bottomBar = new Laya.Sprite();
        bottomBar.name = "bottomBar";
        // 直接添加到stage
        Laya.stage.addChild(bottomBar);

        // 手机端适配：按钮大小和位置
        const btnHeight = Math.max(60, Math.min(stageHeight * 0.08, 80)); // 按钮高度：屏幕8%，最小60，最大80
        const btnWidth = Math.max(80, Math.min(stageWidth * 0.25, 120)); // 按钮宽度：屏幕25%，最小80，最大120
        const btnSpacing = Math.max(10, stageWidth * 0.02); // 按钮间距：屏幕2%，最小10
        const bottomMargin = Math.max(20, stageHeight * 0.03); // 底部边距：屏幕3%，最小20
        const btnY = stageHeight - btnHeight - bottomMargin;
        
        // 三个按钮总宽度
        const totalWidth = btnWidth * 3 + btnSpacing * 2;
        const startX = (stageWidth - totalWidth) / 2; // 居中排列

        // 升级按钮（可以传入图片路径，如 "resources/btn_upgrade.png"）
        this.upgradeBtn = this.createButton("#ff6b35", 0xff6b35, "resources/btn_upgrade.png", btnWidth, btnHeight, "升级");
        this.upgradeBtn.pos(startX, btnY);
        // 添加连点功能：按住时连续升级
        this.setupUpgradeRepeatButton(this.upgradeBtn);
        bottomBar.addChild(this.upgradeBtn);

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
        bottomBar.addChild(this.upgradeCostLabelBg);

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
        bottomBar.addChild(this.upgradeCostLabel);
        
        // 初始化升级按钮颜色提示
        this.updateUpgradeCostDisplay();

        // 助理按钮（可以传入图片路径，如 "resources/btn_assistant.png"）
        this.assistantBtn = this.createButton("#ff6b9d", 0xff6b9d, "resources/btn_assistant.png", btnWidth, btnHeight, "助理");
        this.assistantBtn.pos(startX + btnWidth + btnSpacing, btnY);
        this.assistantBtn.on(Laya.Event.CLICK, this, this.onAssistantClick);
        bottomBar.addChild(this.assistantBtn);

        // 挑战按钮（可以传入图片路径，如 "resources/btn_challenge.png"）
        this.challengeBtn = this.createButton("#ff3333", 0xff3333, "resources/btn_challenge.png", btnWidth, btnHeight, "挑战");
        this.challengeBtn.pos(startX + (btnWidth + btnSpacing) * 2, btnY);
        this.challengeBtn.on(Laya.Event.CLICK, this, this.onChallengeClick);
        bottomBar.addChild(this.challengeBtn);
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
        // 先执行一次点击
        btn.on(Laya.Event.CLICK, this, this.onUpgradeClick);
        
        // 按住时开始连点
        btn.on(Laya.Event.MOUSE_DOWN, this, () => {
            btn.scale(0.95, 0.95);
            // 立即执行一次
            this.onUpgradeClick();
            // 停止之前的连点（如果存在）
            this.stopUpgradeRepeat();
            // 开始连点：1秒5次，即每200ms执行一次
            this.upgradeRepeatHandler = this.onUpgradeClick;
            Laya.timer.loop(200, this, this.upgradeRepeatHandler);
        });
        
        // 松开时停止连点
        btn.on(Laya.Event.MOUSE_UP, this, () => {
            btn.scale(1, 1);
            this.stopUpgradeRepeat();
        });
        
        // 移出按钮时也停止连点
        btn.on(Laya.Event.MOUSE_OUT, this, () => {
            btn.scale(1, 1);
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
     * 升级按钮点击事件
     */
    private onUpgradeClick(): void {
        // 检查是否有足够的金币
        if (this.money >= this.upgradeCost) {
            // 消耗金币
            this.money -= this.upgradeCost;
            this.updateMoneyDisplay();
            
            // 升级
            this.playerLevel++;
            this.levelLabel.text = this.playerLevel + "级";
            
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
            console.log("升级成功！当前等级:", this.playerLevel, "点击收益基础值:", this.clickRewardBase, "倍率:", this.clickMultiplier, "实际收益:", this.getClickReward(), "下次升级需要:", this.upgradeCost);
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
        titleLabel.text = "美女助理";
        titleLabel.fontSize = Math.max(24, Math.min(stageWidth * 0.06, 32));
        titleLabel.color = "#ff6b9d";
        titleLabel.width = windowWidth;
        titleLabel.height = Math.max(40, stageHeight * 0.05);
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(windowX, windowY + closeBtnMargin);
        titleLabel.mouseEnabled = false;
        this.assistantWindow.addChild(titleLabel);
        
        // 创建助理总收益显示（左侧）
        const totalEarningsLabel = new Laya.Text();
        totalEarningsLabel.name = "totalEarningsLabel";
        totalEarningsLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        totalEarningsLabel.color = "#00aa00";
        totalEarningsLabel.width = windowWidth * 0.6; // 占60%宽度
        totalEarningsLabel.height = Math.max(25, stageHeight * 0.03);
        totalEarningsLabel.align = "center";
        totalEarningsLabel.valign = "middle";
        totalEarningsLabel.pos(windowX + windowWidth * 0.1, windowY + closeBtnMargin + Math.max(40, stageHeight * 0.05) + 5);
        totalEarningsLabel.mouseEnabled = false;
        this.updateTotalEarningsLabel(totalEarningsLabel);
        this.assistantWindow.addChild(totalEarningsLabel);
        
        // 创建总倍率显示（右侧，在总收益旁边）
        const totalMultiplierLabel = new Laya.Text();
        totalMultiplierLabel.name = "totalMultiplierLabel";
        totalMultiplierLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
        totalMultiplierLabel.color = "#ffd700";
        totalMultiplierLabel.width = windowWidth * 0.3; // 占30%宽度
        totalMultiplierLabel.height = Math.max(25, stageHeight * 0.03);
        totalMultiplierLabel.align = "center";
        totalMultiplierLabel.valign = "middle";
        totalMultiplierLabel.pos(windowX + windowWidth * 0.7, windowY + closeBtnMargin + Math.max(40, stageHeight * 0.05) + 5);
        totalMultiplierLabel.mouseEnabled = false;
        this.updateTotalMultiplierLabel(totalMultiplierLabel);
        this.assistantWindow.addChild(totalMultiplierLabel);
        
        // 创建助理卡片容器
        const cardsContainer = new Laya.Sprite();
        cardsContainer.name = "cardsContainer";
        cardsContainer.pos(windowX, windowY + closeBtnMargin + Math.max(40, stageHeight * 0.05) + Math.max(25, stageHeight * 0.03) + 15);
        this.assistantWindow.addChild(cardsContainer);
        
        // 创建助理卡片（2x2网格布局）
        this.createAssistantCards(panel, cardsContainer, windowWidth, windowHeight);
        
        console.log("创建助理窗口（手机端适配），位置:", windowX, windowY, "尺寸:", windowWidth, windowHeight);
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
        const cardHeight = Math.max(150, Math.min((windowHeight * 0.5) / rows, 200)); // 卡片高度
        
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
            
            // 助理名称
            const nameLabel = new Laya.Text();
            nameLabel.name = "nameLabel";
            nameLabel.text = assistant.name;
            nameLabel.fontSize = Math.max(16, Math.min(stageWidth * 0.04, 20));
            nameLabel.color = assistant.unlocked ? "#333333" : "#888888";
            nameLabel.width = cardWidth;
            nameLabel.height = Math.max(25, cardHeight * 0.15);
            nameLabel.align = "center";
            nameLabel.valign = "middle";
            nameLabel.pos(0, 5);
            nameLabel.mouseEnabled = false;
            card.addChild(nameLabel);
            
            // 等级显示
            const levelLabel = new Laya.Text();
            levelLabel.name = "levelLabel";
            levelLabel.text = "Lv:" + assistant.level;
            levelLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
            levelLabel.color = assistant.unlocked ? "#ff6b35" : "#666666";
            levelLabel.width = cardWidth;
            levelLabel.height = Math.max(20, cardHeight * 0.12);
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
            earningsLabel.height = Math.max(18, cardHeight * 0.1);
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
            costLabel.height = Math.max(18, cardHeight * 0.1);
            costLabel.align = "center";
            costLabel.valign = "middle";
            costLabel.pos(0, earningsLabel.y + earningsLabel.height + 5);
            costLabel.mouseEnabled = false;
            card.addChild(costLabel);
            
            // 解锁/升级按钮
            const actionBtn = new Laya.Sprite();
            actionBtn.name = "actionBtn";
            const btnWidth = Math.max(60, cardWidth * 0.7);
            const btnHeight = Math.max(30, cardHeight * 0.15);
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
            
            // 按钮点击事件（单次点击）
            actionBtn.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
                e.stopPropagation();
                this.handleAssistantAction(assistant.id);
            });
            
            // 按钮交互效果和连点功能
            const repeatHandler = () => {
                this.handleAssistantAction(assistant.id);
            };
            actionBtn.on(Laya.Event.MOUSE_DOWN, this, (e: Laya.Event) => {
                e.stopPropagation();
                actionBtn.scale(0.95, 0.95);
                // 停止之前的连点（如果存在）
                this.stopAssistantRepeat(assistant.id);
                // 立即执行一次
                this.handleAssistantAction(assistant.id);
                // 开始连点：1秒5次，即每200ms执行一次
                this.assistantRepeatHandlers.set(assistant.id, repeatHandler);
                Laya.timer.loop(200, this, repeatHandler);
            });
            
            actionBtn.on(Laya.Event.MOUSE_UP, this, (e: Laya.Event) => {
                e.stopPropagation();
                actionBtn.scale(1, 1);
                this.stopAssistantRepeat(assistant.id);
            });
            
            actionBtn.on(Laya.Event.MOUSE_OUT, this, (e: Laya.Event) => {
                e.stopPropagation();
                actionBtn.scale(1, 1);
                this.stopAssistantRepeat(assistant.id);
            });
            
            card.addChild(actionBtn);
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
                // 刷新窗口
                this.refreshAssistantWindow();
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
                assistant.level++;
                this.updateMoneyDisplay();
                this.updateMultiplierDisplay(); // 更新倍率显示（如果达到20级会有加成）
                this.updatePerSecondDisplay(); // 更新秒赚显示
                this.showPopup("升级成功！", "center", "#00ff00");
                console.log("升级助理:", assistant.name, "当前等级:", assistant.level);
                // 刷新窗口
                this.refreshAssistantWindow();
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
        
        // 找到卡片容器
        const cardsContainer = this.assistantWindow.getChildByName("cardsContainer") as Laya.Sprite;
        if (cardsContainer) {
            cardsContainer.removeChildren();
            const windowPanel = this.assistantWindow.getChildByName("windowPanel") as Laya.Sprite;
            if (windowPanel) {
                const stageWidth = Laya.stage.width || 750;
                const stageHeight = Laya.stage.height || 1334;
                const windowWidth = windowPanel.width;
                const windowHeight = windowPanel.height;
                this.createAssistantCards(windowPanel, cardsContainer, windowWidth, windowHeight);
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
    }
    
    /**
     * 更新总收益显示
     */
    private updateTotalEarningsLabel(label: Laya.Text): void {
        let totalEarnings = 0;
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level > 0) {
                totalEarnings += Math.floor(assistant.unlockCost * assistant.level / 100);
            }
        }
        label.text = "助理总秒赚: " + this.formatMoney(totalEarnings) + "/秒";
    }
    
    /**
     * 更新总倍率显示
     */
    private updateTotalMultiplierLabel(label: Laya.Text): void {
        this.calculateMultiplier(); // 重新计算倍率
        // 计算总提升倍率（减去基础倍率1.0）
        const totalBonus = (this.clickMultiplier - 1.0) * 100;
        if (totalBonus > 0) {
            label.text = "总倍率: +" + totalBonus.toFixed(0) + "%";
        } else {
            label.text = "总倍率: 0%";
        }
    }
    
    /**
     * 关闭助理窗口
     */
    private closeAssistantWindow(): void {
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
        const windowHeight = Math.min(stageHeight * 0.6, stageHeight - margin * 2);
        
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
        // 使用和主界面相同的头像
        Laya.loader.load("resources/avatar.png", Laya.Handler.create(this, (texture: Laya.Texture) => {
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
        const totalBonus = (this.clickMultiplier - 1.0) * 100;
        label.text = "点击收益: " + this.formatMoney(this.clickRewardBase) + "*(1+" + totalBonus.toFixed(0) + "%)";
    }
    
    /**
     * 更新设置窗口的秒赚显示
     */
    private updateSettingsPerSecond(label: Laya.Text): void {
        let totalEarnings = 0;
        for (const assistant of this.assistants) {
            if (assistant.unlocked && assistant.level > 0) {
                totalEarnings += Math.floor(assistant.unlockCost * assistant.level / 100);
            }
        }
        label.text = "秒赚: " + this.formatMoney(totalEarnings) + "/秒";
    }
    
    /**
     * 关闭设置窗口
     */
    private closeSettingsWindow(): void {
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
        titleLabel.text = "街头争霸";
        titleLabel.fontSize = Math.max(28, Math.min(stageWidth * 0.07, 36));
        titleLabel.color = "#ffd700";
        titleLabel.width = windowWidth;
        titleLabel.height = titleBgHeight;
        titleLabel.align = "center";
        titleLabel.valign = "middle";
        titleLabel.pos(windowX, windowY + closeBtnMargin);
        titleLabel.mouseEnabled = false;
        this.challengeWindow.addChild(titleLabel);
        
        // 创建挑战列表容器
        const listContainer = new Laya.Sprite();
        listContainer.name = "listContainer";
        const listStartY = windowY + closeBtnMargin + titleBgHeight + 10;
        listContainer.pos(windowX, listStartY);
        this.challengeWindow.addChild(listContainer);
        
        // 创建挑战列表项
        this.createChallengeListItems(panel, listContainer, windowWidth, windowHeight - (listStartY - windowY) - 20);
        
        console.log("创建挑战窗口（手机端适配），位置:", windowX, windowY, "尺寸:", windowWidth, windowHeight);
    }
    
    /**
     * 创建挑战列表项
     */
    private createChallengeListItems(windowPanel: Laya.Sprite, container: Laya.Sprite, windowWidth: number, availableHeight: number): void {
        const stageWidth = Laya.stage.width || 750;
        const stageHeight = Laya.stage.height || 1334;
        
        // 每个挑战项的高度
        const itemHeight = Math.max(100, Math.min(availableHeight / this.challenges.length, 120));
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
            
            // 挑战头像（使用简单的圆形代替，可以替换为图片）
            const avatarSize = Math.max(50, Math.min(itemHeight * 0.6, 70));
            const avatarX = 10;
            const avatarY = (itemHeight - avatarSize) / 2;
            
            const avatar = new Laya.Sprite();
            avatar.name = "avatar";
            avatar.size(avatarSize, avatarSize);
            if (this.isChallengeUnlocked(challenge.id)) {
                // 已解锁：使用彩色
                avatar.graphics.drawCircle(avatarSize / 2, avatarSize / 2, avatarSize / 2, "#4a9eff");
            } else {
                // 未解锁：使用灰色
                avatar.graphics.drawCircle(avatarSize / 2, avatarSize / 2, avatarSize / 2, "#888888");
            }
            avatar.pos(avatarX, avatarY);
            avatar.mouseEnabled = false;
            itemBg.addChild(avatar);
            
            // 挑战名称
            const nameLabel = new Laya.Text();
            nameLabel.name = "nameLabel";
            nameLabel.text = challenge.name;
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
            
            // 奖励显示（标注为首次挑战成功奖励）
            const rewardLabel = new Laya.Text();
            rewardLabel.name = "rewardLabel";
            rewardLabel.text = "首次挑战成功奖励: " + this.formatMoney(challenge.reward);
            rewardLabel.fontSize = Math.max(12, Math.min(stageWidth * 0.03, 16));
            rewardLabel.color = "#ffd700";
            rewardLabel.width = (windowWidth - itemMargin * 2) * 0.4;
            rewardLabel.height = itemHeight * 0.2;
            rewardLabel.align = "left";
            rewardLabel.valign = "middle";
            rewardLabel.pos(avatarX + avatarSize + 10, itemHeight * 0.45 + 5);
            rewardLabel.mouseEnabled = false;
            itemBg.addChild(rewardLabel);
            
            // 状态显示和按钮
            const statusX = (windowWidth - itemMargin * 2) - 100;
            const statusY = (itemHeight - 30) / 2;
            
            if (this.isChallengeUnlocked(challenge.id)) {
                // 已解锁：显示挑战按钮
                const challengeBtn = new Laya.Sprite();
                challengeBtn.name = "challengeBtn";
                challengeBtn.size(90, 30);
                challengeBtn.graphics.drawRoundRect(0, 0, 90, 30, 5, 5, 5, 5, "#ff6b35");
                challengeBtn.pos(statusX, statusY);
                challengeBtn.mouseEnabled = true;
                challengeBtn.mouseThrough = false;
                
                // 按钮文字
                const btnLabel = new Laya.Text();
                btnLabel.text = "挑战";
                btnLabel.fontSize = Math.max(14, Math.min(stageWidth * 0.035, 18));
                btnLabel.color = "#ffffff";
                btnLabel.width = 90;
                btnLabel.height = 30;
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
                // 未解锁：显示锁定状态
                const lockLabel = new Laya.Text();
                lockLabel.name = "lockLabel";
                lockLabel.text = "完成前置挑战解锁";
                lockLabel.fontSize = Math.max(11, Math.min(stageWidth * 0.028, 14));
                lockLabel.color = "#888888";
                lockLabel.width = 100;
                lockLabel.height = 30;
                lockLabel.align = "center";
                lockLabel.valign = "middle";
                lockLabel.pos(statusX, statusY);
                lockLabel.mouseEnabled = false;
                itemBg.addChild(lockLabel);
                
                // 如果是BOSS挑战，显示VS图标和"挑战BOSS"文字
                if (challenge.isBoss) {
                    const vsLabel = new Laya.Text();
                    vsLabel.name = "vsLabel";
                    vsLabel.text = "VS";
                    vsLabel.fontSize = Math.max(18, Math.min(stageWidth * 0.045, 24));
                    vsLabel.color = "#ff3333";
                    vsLabel.width = 100;
                    vsLabel.height = 20;
                    vsLabel.align = "center";
                    vsLabel.valign = "middle";
                    vsLabel.pos(statusX, statusY - 15);
                    vsLabel.mouseEnabled = false;
                    itemBg.addChild(vsLabel);
                    
                    const bossLabel = new Laya.Text();
                    bossLabel.name = "bossLabel";
                    bossLabel.text = "挑战BOSS";
                    bossLabel.fontSize = Math.max(10, Math.min(stageWidth * 0.025, 12));
                    bossLabel.color = "#ff3333";
                    bossLabel.width = 100;
                    bossLabel.height = 15;
                    bossLabel.align = "center";
                    bossLabel.valign = "middle";
                    bossLabel.pos(statusX, statusY + 15);
                    bossLabel.mouseEnabled = false;
                    itemBg.addChild(bossLabel);
                }
            }
        }
    }
    
    /**
     * 检查挑战是否已解锁
     */
    private isChallengeUnlocked(challengeId: number): boolean {
        // 第一个挑战总是解锁的
        if (challengeId === 1) {
            return true;
        }
        
        // 其他挑战需要完成前一个挑战才能解锁
        const prevChallenge = this.challenges.find(c => c.id === challengeId - 1);
        return prevChallenge ? prevChallenge.completed : false;
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
        
        // 检查是否已解锁
        if (!this.isChallengeUnlocked(challengeId)) {
            this.showPopup("需要完成前置挑战解锁", "center", "#ff6666");
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
        this.showPopup("挑战成功！获得 " + this.formatMoney(challenge.reward), "center", "#00ff00");
        console.log("挑战成功:", challenge.name, "获得奖励:", challenge.reward);
        
        // 刷新挑战窗口
        this.refreshChallengeWindow();
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
        
        // 找到列表容器
        const listContainer = this.challengeWindow.getChildByName("listContainer") as Laya.Sprite;
        if (listContainer) {
            listContainer.removeChildren();
            const windowPanel = this.challengeWindow.getChildByName("windowPanel") as Laya.Sprite;
            if (windowPanel) {
                const stageWidth = Laya.stage.width || 750;
                const stageHeight = Laya.stage.height || 1334;
                const windowWidth = windowPanel.width;
                const windowHeight = windowPanel.height;
                const titleBg = this.challengeWindow.getChildByName("titleBg") as Laya.Sprite;
                const closeBtnMargin = Math.min(10, stageWidth * 0.02);
                const listStartY = closeBtnMargin + (titleBg ? titleBg.height : 50) + 10;
                const availableHeight = windowHeight - listStartY - 20;
                this.createChallengeListItems(windowPanel, listContainer, windowWidth, availableHeight);
            }
        }
    }
    
    /**
     * 关闭挑战窗口
     */
    private closeChallengeWindow(): void {
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
                // 点击非按钮区域，增加金钱（使用当前点击收益：基础值 * 倍率）
                this.money += this.getClickReward();
                this.updateMoneyDisplay();
                
                // 显示获得金币弹窗（在金币数下方）
                // 使用money位置类型，会自动计算位置，确保在屏幕上可见
                this.showPopup("+" + this.formatMoney(this.getClickReward()), "money", "#00ff00");
                
                console.log("点击增加金钱:", this.getClickReward(), "当前金钱:", this.money);
            }
        });
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
        return Math.floor(this.clickRewardBase * this.clickMultiplier);
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
        
        this.clickMultiplier = totalMultiplier;
    }
    
    /**
     * 更新倍率显示（首页总收益显示）
     */
    private updateMultiplierDisplay(): void {
        if (this.multiplierLabel) {
            this.calculateMultiplier(); // 重新计算倍率
            // 显示格式：点击收益：本金*(1+总倍率)
            const totalBonus = (this.clickMultiplier - 1.0) * 100; // 总倍率提升部分
            this.multiplierLabel.text = "点击收益: " + this.formatMoney(this.clickRewardBase) + "*(1+" + totalBonus.toFixed(0) + "%)";
        }
    }
    
    /**
     * 更新秒赚显示
     */
    private updatePerSecondDisplay(): void {
        if (this.perSecondLabel) {
            // 计算所有助理的总秒赚
            let totalEarnings = 0;
            for (const assistant of this.assistants) {
                if (assistant.unlocked && assistant.level > 0) {
                    totalEarnings += Math.floor(assistant.unlockCost * assistant.level / 100);
                }
            }
            this.perSecondLabel.text = "秒赚: " + this.formatMoney(totalEarnings) + "/秒";
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
            // 更新背景宽度以适应文字（手机端适配）
            if (this.moneyLabelBg) {
                const stageWidth = Laya.stage.width || 750;
                const textWidth = this.moneyLabel.textWidth || 80;
                const minWidth = Math.max(80, stageWidth * 0.2); // 最小宽度：屏幕20%，最小80
                this.moneyLabelBg.width = Math.max(textWidth + 10, minWidth);
                this.moneyLabel.width = this.moneyLabelBg.width;
            }
        }
        // 同时更新升级按钮的颜色提示
        this.updateUpgradeCostDisplay();
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
        
        // 创建弹窗背景
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
        
        // 创建弹窗容器
        const popup = new Laya.Sprite();
        popup.name = "popup";
        popup.addChild(bg);
        popup.addChild(label);
        
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
            const moneyX = stageWidth * 0.75; // 金钱标签的X坐标（屏幕75%，右侧）
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
            
            // X坐标：金币标签右侧，但确保弹窗不超出屏幕
            const moneyLabelX = moneyX + moneyIconSize + margin * 0.5;
            const maxX = stageWidth - popupWidth - 10; // 留10像素边距
            x = Math.min(moneyLabelX, maxX);
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
        bg.mouseEnabled = false;
        label.mouseEnabled = false;
        
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
        if (amount >= 10000) {
            // 有单位时保留小数点后两位
            return (amount / 10000).toFixed(2) + "万";
        }
        // 没有单位时显示为整数
        return Math.floor(amount).toString();
    }
}