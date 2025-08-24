# napcat 连接管理架构知识点

## 统一连接管理模式

### 设计理念

统一连接管理是一种资源优化的架构模式，使用单一的 WebSocket 连接服务所有群组，通过消息分发机制路由到对应的处理单元。这种模式在保持业务逻辑封装的同时，显著减少了系统资源消耗。

### 核心优势

1. **资源优化**
   - 全局唯一 WebSocket 连接，减少网络资源消耗
   - 降低系统内存占用和连接数限制压力
   - 简化连接状态管理和监控

2. **职责分离**
   - ConnectionManager 专注连接管理和基础服务
   - SessionManager 负责消息分发和会话调度
   - Session 专注群组级别业务逻辑

3. **扩展性强**
   - 支持动态添加群组而无需创建新连接
   - 便于未来支持多账号或其他连接类型
   - 消息分发器机制支持灵活的路由策略

4. **可维护性**
   - 分层架构便于单独测试各个组件
   - 错误隔离机制确保局部问题不影响整体
   - 统一连接管理简化了部署和运维

## 分层架构组件

### ConnectionManager（连接层）

- 管理唯一的 napcat WebSocket 连接
- 提供消息分发器注册机制
- 封装底层 API 调用（发送消息、获取用户信息等）
- 集中处理连接状态和错误

```typescript
class ConnectionManager {
    private napcat: NCWebsocket;
    private messageDispatcher?: MessageDispatcher;
    
    constructor(napcatConfig: NapcatConfig) {
        this.napcat = new NCWebsocket({
            baseUrl: napcatConfig.base_url,
            accessToken: napcatConfig.access_token,
            reconnection: napcatConfig.reconnection
        }, false);
    }
    
    setMessageDispatcher(dispatcher: MessageDispatcher): void {
        this.messageDispatcher = dispatcher;
    }
}
```

### SessionManager（分发层）

- 创建和管理 ConnectionManager 实例
- 实现消息分发逻辑，根据 groupId 路由消息
- 管理所有 Session 实例的生命周期
- 提供统一的管理接口

### Session（业务层）

- 通过 ConnectionManager 委托执行底层操作
- 专注群组级别的消息处理逻辑
- 保持向后兼容的公共接口

### 错误处理策略

- **连接层错误**：ConnectionManager 统一处理连接失败和重连
- **分发层错误**：SessionManager 处理消息路由错误，记录并跳过
- **业务层错误**：Session 处理消息解析和处理逻辑错误，不影响其他群组
- 优雅的错误日志记录和监控

## 消息处理流程

### 接收流程

1. **连接层接收**：ConnectionManager 监听 `message.group` 事件
2. **消息分发**：通过注册的 MessageDispatcher 将原始消息发送给 SessionManager
3. **路由分发**：SessionManager 根据 groupId 将消息路由到对应 Session
4. **结构化存储**：Session 直接保存完整的结构化消息格式，无需额外解析
5. **用户信息获取**：Session 通过 ConnectionManager 异步获取发送人的昵称信息
6. **业务处理**：MessageHandler 直接处理结构化消息，获得完整的语义信息
7. **日志记录**：各层记录相应的处理日志

### 发送流程

1. **结构化调用**：Session 通过 sendMessage() 接受 SendMessageSegment[] 格式消息
2. **委托转发**：Session 将结构化消息直接委托给 ConnectionManager.sendGroupMessage()
3. **连接检查**：ConnectionManager 确认 WebSocket 连接状态
4. **直接发送**：结构化消息直接符合 napcat API 格式，无需额外构造
5. **发送请求**：调用 napcat 的 send_group_msg API，支持 @ 等复杂格式
6. **结果处理**：处理发送结果和可能的错误
7. **日志记录**：记录消息发送成功或失败日志

## 消息处理回调设计

### 数据结构

```typescript
import { SendMessageSegment } from "node-napcat-ts";

interface Message {
    id: string;                      // 消息ID
    groupId: number;                 // 群组ID
    userId: number;                  // 发送者ID
    userNickname?: string;           // 发送者昵称
    content: SendMessageSegment[];   // 结构化消息内容（统一格式）
    timestamp: Date;                 // 接收时间
}

interface MessageHandler {
    handleMessage(message: Message): Promise<void>;
}

type MessageDispatcher = (context: unknown) => void;  // 消息分发器类型
```

**重大架构升级（2024年）**：
- **统一数据结构**：移除了冗余的 `mentions` 和纯文本 `content` 字段
- **结构化消息**：使用 `SendMessageSegment[]` 统一处理接收和发送的消息
- **完整语义保留**：@ 提及、文本等所有信息都在 `content` 数组中结构化存储
- **类型安全**：与 node-napcat-ts 库的类型系统完全兼容

### 回调机制

- **分发器模式**：ConnectionManager 通过 MessageDispatcher 将消息分发给 SessionManager
- **路由机制**：SessionManager 根据 groupId 路由到对应 Session
- **实时处理**：消息到达后立即触发分发和处理链
- **异步支持**：支持异步消息处理逻辑
- **错误隔离**：各层错误处理互不影响

### @ 消息处理

- **结构化检测**：直接从 `content` 数组中检测 `at` 类型消息段
- **精确匹配**：通过遍历消息结构检测机器人是否被 @ 提及
- **统一显示**：控制台和 LLM 都能正确理解 @ 信息的完整语义

```typescript
// 新的 @ 检测机制
private isBotMentioned(message: Message): boolean {
    return message.content.some(item => 
        item.type === "at" && item.data.qq === this.botQQ.toString(),
    );
}
```

## 配置管理

### 层次结构

```yaml
napcat:
  base_url: "ws://localhost:3001"  # WebSocket 地址
  access_token: "token"            # 访问令牌
  reconnection:                    # 重连配置
    enable: true
    attempts: 10
    delay: 5000
  bot_qq: 123456789                # 机器人QQ号
  groups: [123456, 789012]         # 目标群组列表

agent:                             # 对话配置（可选）
  history_turns: 40                # 保留历史消息条数
```

### 配置验证

- 启动时验证必需配置项
- 缺少配置时抛出明确的错误信息
- 支持环境特定的配置文件

## 生命周期管理

### 启动流程

1. 加载配置文件（包括机器人QQ号）
2. 创建 LlmClient 和 SessionManager 实例
3. SessionManager 内部创建 ConnectionManager 并设置消息分发器
4. 建立唯一的 WebSocket 连接
5. 根据群组列表创建 Session 实例
6. 为每个 Session 自动创建 PassiveMessageHandler
7. 设置信号处理器用于优雅关闭

### 关闭流程

1. 接收 SIGINT 或 SIGTERM 信号
2. 调用 SessionManager 的关闭方法
3. 关闭唯一的 ConnectionManager 连接
4. 清理所有 Session 实例和资源
5. 优雅退出进程

### 错误处理

- 分层错误隔离：连接层、分发层、业务层错误独立处理
- 详细的错误日志记录
- 优雅的错误恢复机制

## 扩展点

### 消息处理扩展

- ✅ 已实现：完全结构化的消息处理架构
- ✅ 已实现：LLM 智能回复和被动对话功能
- ✅ 已实现：基于上下文的对话记忆和历史管理
- ✅ 已实现：@ 提及的完整语义理解和生成
- 🔄 待扩展：图片、文件等富媒体消息（架构已就绪）
- 🔄 待扩展：表情、回复引用等高级消息功能
- 🔄 待扩展：消息内容的预处理和过滤
- 🔄 待扩展：主动对话模式和定时发言

### 存储扩展

- 消息历史持久化存储
- 用户画像和上下文记忆
- 对话历史的查询和管理
- 分布式存储支持

### 群组管理扩展

- 动态添加和删除群组
- 群组特定的配置和行为
- 群组权限和访问控制

### 监控扩展

- 连接状态监控
- 消息数量统计
- 性能指标采集