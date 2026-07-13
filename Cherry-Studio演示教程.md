# 世界杯点球大战 - Cherry Studio 现场演示教程

## 第一步：克隆项目（1分钟）

在 Cherry Studio 中执行：
```bash
git clone https://github.com/nongyuheitang/penalty-shootout.git
cd penalty-shootout
npm install
```

然后用 Cherry Studio 打开 `penalty-shootout` 文件夹。

**Cherry Studio 会自动读取 `CLAUDE.md`**，理解项目的完整架构（12个JS模块、状态机设计、输入系统、渲染管线）。

## 第二步：启动游戏（30秒）

```bash
npx vite --host --port 3000
```

浏览器打开 http://localhost:3000，可以看到完整可玩的游戏。

## 第三步：现场演示改代码（选一个）

### 演示 A：修改力度条颜色
> "把力度条改成蓝到紫的渐变"

Cherry Studio 会：
1. 定位 `renderer.js` 中力度条的渐变色代码
2. 把 `#2ecc71 → #f39c12 → #e74c3c` 改成 `#3498db → #9b59b6 → #8e44ad`
3. 热更新生效，刷新即见

### 演示 B：修改比赛轮数
> "把10轮改成6轮"

Cherry Studio 会：
1. 定位 `constants.js` 中 `TOTAL_ROUNDS = 10`
2. 改成 `TOTAL_ROUNDS = 6`
3. 刷新生效

### 演示 C：修改进球文字
> "进球时显示 '漂亮！' 而不是 '进球！'"

Cherry Studio 会：
1. 定位 `game.js` 中 `'进球！'` 字符串
2. 改成 `'漂亮！'`
3. 刷新生效

### 演示 D：调整守门员速度
> "守门员太慢了，调到1000"

Cherry Studio 会：
1. 定位 `constants.js` 中 `KEEPER_SPEED = 750`
2. 改成 `KEEPER_SPEED = 1000`

## 演示要点

对观众说的话：
1. "这个游戏有12个JS文件，Cherry Studio 读完 CLAUDE.md 就理解了全部架构"
2. "我不需要告诉它文件在哪、变量叫什么，它自己定位"
3. "热更新生效，刷新浏览器就能看到改动"
4. "改完代码后 `npm run build && git push` 就能更新线上版本"

## 常见演示故障预案

| 问题 | 解决 |
|------|------|
| Cherry Studio 没读取 CLAUDE.md | 手动 @ 引用 `CLAUDE.md` 文件 |
| 端口 3000 占用 | 换个端口：`--port 3001` |
| 没装依赖 | `npm install` |
| git clone 太慢 | 用 `git clone --depth 1` 浅克隆 |
