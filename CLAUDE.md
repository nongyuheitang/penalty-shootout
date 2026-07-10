# 世界杯点球大战

HTML5 Canvas 双人对战点球游戏。Vite + 原生 JavaScript（ES Modules），无框架依赖。

## 启动

```bash
npm install
npx vite --host --port 3000
```

浏览器打开 `http://localhost:3000`。

## 项目结构

```
penalty-shootout/
├── index.html          # 入口 HTML + 基础样式
├── vite.config.js      # Vite 配置（base 路径 + 输出目录）
├── package.json        # 依赖：vite, joy-con-webhid
├── 启动.bat             # Windows 一键启动脚本
└── src/
    ├── main.js         # 主循环 + 键盘/鼠标输入 + Joy-Con/Gamepad 角色映射
    ├── game.js         # 核心状态机（AIM→CHARGE→RUN_UP→KICK→BALL_FLY→NET_HIT→RESULT）
    ├── renderer.js     # Canvas 2D 全量渲染（球场/球员/球门/粒子/HUD/结果卡片）
    ├── constants.js    # 所有可调参数（画布尺寸/球门区域/速度/死区/时长）
    ├── input.js        # 鼠标坐标 + 触控事件
    ├── joycon.js       # Joy-Con WebHID 管理（连接/校准/输入/震动）
    ├── gamepad.js      # Gamepad API（BetterJoy 映射的标准手柄）
```

## 架构要点

### 输入系统（main.js）
三种输入方式可同时使用，手柄连接后自动禁用对应玩家的键鼠：
- **键盘**：P1=WASD+Space，P2=方向键+Enter
- **鼠标**：移动准星 + 左键蓄力/射门
- **手柄**：WebHID Joy-Con（自动校准中心偏移）> Gamepad API（BetterJoy）

### 游戏状态机（game.js）
```
AIM → CHARGE → RUN_UP → KICK → BALL_FLY → NET_HIT(进球) / RESULT(不进)
                                                      ↓
                                                  GAME_OVER(10轮结束)
```
- 10 轮交替攻防：`attacker=1` 时 P1 射 P2 守，`attacker=2` 反之
- 进球判定：球落点在球门内 + 与守门员的 2D 欧几里得距离 > 有效扑救半径
- 力度越高球越精准，但守门员有效扑救范围越小

### 渲染层级（renderer.js）
背景 → 聚光灯 → 观众席 → 球网 → 球门框 → 草地 → 守门员 → 足球 → 球员 → 瞄准锥 → 准星 → 粒子 → HUD

### Joy-Con 校准（joycon.js）
连接后采集前 60 个摇杆样本计算中心偏移，后续读数减去偏移再进死区（0.30 + n² 曲线），消除硬件漂移。

## GitHub Pages

线上地址：`https://nongyuheitang.github.io/penalty-shootout/`

部署方式：`npx vite build` 输出到 `docs/`，GitHub Pages 指向 `master` 分支的 `/docs` 目录。
