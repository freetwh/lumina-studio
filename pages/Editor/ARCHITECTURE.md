# Editor 架构文档

## 架构对比

### 重构前（单文件架构）

```
┌─────────────────────────────────────┐
│       index.tsx (918 行)            │
│  ┌───────────────────────────────┐  │
│  │  数据加载逻辑                  │  │
│  │  状态管理                      │  │
│  │  键盘事件                      │  │
│  │  鼠标交互（拖拽/框选）         │  │
│  │  关键帧 CRUD                   │  │
│  │  动画 CRUD                     │  │
│  │  选区管理                      │  │
│  │  模板管理                      │  │
│  │  播放控制                      │  │
│  │  灯光渲染计算                  │  │
│  │  弹窗管理                      │  │
│  │  渲染逻辑                      │  │
│  └───────────────────────────────┘  │
│        ❌ 职责过多，难以维护         │
└─────────────────────────────────────┘
```

### 重构后（分层架构）

```
┌─────────────────────────────────────────────────────────┐
│                   index.tsx (380 行)                     │
│              仅负责组合和协调各层                         │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Components  │  │    Hooks     │  │   Services   │
│   (UI 层)    │  │  (业务层)    │  │  (工具层)    │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ EditorToolbar│  │ useProjectData│  │ projectService│
│ AnimationLib │  │ useDialogs    │  │ animationCalc│
│ PreviewArea  │  │ useKeyboard   │  │ collision    │
│ Inspector    │  │ useCanvasPan  │  │ Detector     │
│ Timeline     │  │ useSelectionBox│  └──────────────┘
└──────────────┘  │ useKeyframeDrag│
                  │ useLightRenderer│
                  │ useKeyframe    │
                  │ Operations     │
                  │ useAnimation   │
                  │ Operations     │
                  │ useSelection   │
                  │ Operations     │
                  │ useAnimation   │
                  │ Playback       │
                  └──────────────┘
```

## 数据流

```
用户交互
   │
   ▼
┌──────────────────────────┐
│      index.tsx           │  ◄─── 路由事件
│   (协调层/组合层)         │
└────────┬─────────────────┘
         │
         │ 调用 Hook 方法
         │
         ▼
┌──────────────────────────┐
│      Business Hooks      │
│   (业务逻辑封装)          │
│  - 状态管理               │
│  - 副作用处理             │
│  - 业务规则               │
└────────┬─────────────────┘
         │
         │ 调用 Service
         │
         ▼
┌──────────────────────────┐
│      Services            │
│   (纯函数工具)            │
│  - 数据计算               │
│  - 持久化                 │
│  - 算法逻辑               │
└──────────────────────────┘
```

## 模块职责

### 入口层（index.tsx）
**职责**: 组合协调  
**禁止**: 业务逻辑、复杂计算

- 引入所有 Hooks
- 管理 UI 状态（选中项、缩放）
- 路由事件到对应 Hook
- 渲染主要组件

### 业务层（Hooks）
**职责**: 封装业务逻辑  
**可以**: 调用 Service、管理状态

| Hook | 职责 | 行数 |
|------|------|------|
| useProjectData | 项目数据加载、撤销重做 | 75 |
| useDialogs | 弹窗状态管理 | 81 |
| useKeyboardShortcuts | 键盘快捷键 | 60 |
| useCanvasPan | 画布平移 | 70 |
| useSelectionBox | 框选逻辑 | 158 |
| useKeyframeDrag | 关键帧拖拽 | 109 |
| useLightRenderer | 灯光渲染计算 | 71 |
| useKeyframeOperations | 关键帧 CRUD | 155 |
| useAnimationOperations | 动画 CRUD、模板 | 137 |
| useSelectionOperations | 选区操作 | 84 |
| useAnimationPlayback | 播放控制 | 106 |

### 工具层（Services）
**职责**: 纯函数工具  
**禁止**: 副作用、状态管理

| Service | 职责 | 行数 |
|---------|------|------|
| projectService | localStorage 封装 | 25 |
| animationCalculator | 动画时长计算 | 13 |
| collisionDetector | 碰撞检测、轨道查找 | 75 |

## 优势总结

### 1. 单一职责
每个文件只负责一件事，修改影响范围小

### 2. 依赖清晰
- Service 层无依赖
- Hook 层依赖 Service
- 入口层依赖 Hook

### 3. 易于测试
- Service 层可独立单元测试
- Hook 层可独立集成测试

### 4. 可维护性
- 新增功能：添加新 Hook
- 修改逻辑：定位到对应 Hook
- 删除功能：移除对应 Hook

### 5. 可复用性
- Hook 可在其他项目使用
- Service 可作为工具库

## 命名规范

### Hooks
- 以 `use` 开头
- 描述功能，如 `useKeyframeOperations`
- 返回对象包含 `handle` 前缀方法

### Services
- 以功能命名，如 `projectService`
- 导出纯函数
- 函数名动词开头，如 `calculateDuration`

### 组件
- PascalCase 命名
- 清晰描述用途，如 `EditorToolbar`

## 文件组织原则

1. **按功能分组** 而非文件类型
2. **相关代码放一起** 降低心智负担
3. **避免过深嵌套** 最多 3 层目录
4. **文件大小适中** 单文件不超过 200 行（含注释）

