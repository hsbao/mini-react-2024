# examples 初始化

examples 下的代码基于 vite，构建过程如下：

```js
创建⼀个基于vite的名称为examples项⽬：pnpm create vite examples --template
进入examples⽬录：cd examples
在examples下安装依赖：pnpm i
启动：pnpm dev
浏览器端打开
```

# monorepo

在版本控制系统中，Monorepo（“mono”意为“单⼀”，“repo”是“存储库”的缩写）
是⼀种软件开发策略，其中多个专案的程式码存储在同⼀个存储库⾥⾯。

# 新建 packages ⽂件夹

```js
mkdir packages
```

# 新建 pnpm-workspace.yaml ⽂件

```js
packages: -'packages/*'
```

# 创建⼦项⽬

```js
mkdir react && cd react && pnpm init
mkdir react-dom-bindings && cd react-dom-bindings && pnpm init
mkdir react-dom && cd react-dom && pnpm init
mkdir react-reconciler && cd react-reconciler && pnpm init
mkdir scheduler && cd scheduler && pnpm init
mkdir shared && cd shared && pnpm init
```

# 安装公共依赖

```js
// 在根目录下执行
pnpm add vitest -Dw
```

# 安装项⽬内的相互依赖

```js
// 在根目录下执行
pnpm add react react-dom react-reconciler scheduler shared -Dw
```

# 安装项⽬内的相互依赖

如：给 scheduler 添加 shared 的依赖：

```js
pnpm add shared --filter scheduler
pnpm add react-reconciler --filter react-dom-bindings
pnpm add shared --filter react-dom-bindings
pnpm add scheduler --filter react-dom-bindings
```
