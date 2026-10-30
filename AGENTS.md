# ts-stdx

## 项目定位与边界

TypeScript 标准库扩展库，与 go-stdx 保持相同的收录方向：提供小而通用的数据操作，优先使用语言原生协议。
实现保持运行时零依赖；API、数据库和业务平台的查询、游标与持久状态由调用方拥有。

## 代码地图

```text
src/
  collections/index.ts # 按自定义 key 判断成员身份的 KeyedSet
  iter/index.ts       # 分页 loader 与原生异步生成器
tests/
  collections.test.mjs # 集合身份、迭代、相等与序列化边界
  iter.test.mjs       # Node 原生测试，验证时序、终止与取消
  types.ts            # 公共类型推导及错误用法的编译检查
```

## 关键约定

- 子路径导出按职责组织，迭代工具从 `@compforge/ts-stdx/iter` 导入；公开类型属于兼容契约。
- 集合工具从 `@compforge/ts-stdx/collections` 导入；KeyedSet 按调用方指定的 key 判断成员身份，序列化与持久化由调用方负责。
- 用原生 AsyncGenerator 表达单次遍历，loader 拥有查询与分页状态，消费方拥有处理结果与恢复检查点。
- 在稳定 owner 上用 spec / why 保存时序和生命周期约束，值得保留的验证场景关联到测试。
- 包版本以 package.json 为唯一来源；使用 npm 锁文件。make fix 格式化，make lint 只读检查格式与类型，make test 构建并运行测试。
- 当前组件规模小，lint/test 始终检查完整组件；不声明文件级筛选契约。发布内容限于 dist、README 与许可证。

## References

- [README](README.md)：接入、行为与开发命令。
