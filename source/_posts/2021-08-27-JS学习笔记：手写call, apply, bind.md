---
layout: post
title: JS学习笔记：手写call, apply, bind
description: 这玩意真他妈难啊
excerpt: 手写实现Function.prototype的call apply bind及相关细节解析。
date: 2021-08-27
author: hxlh50k
header-img: null
catalog: true
tags:
  - JavaScript
  - 前端
  - 学习笔记
---

本篇代码均源自于 CUG-GZ 的羽雀文档  
https://www.yuque.com/cuggz/interview/vgbphi#2eefb565e674b4299afb546659649523

## call

```javascript
Function.prototype.myCall = function (context) {
  // 判断调用对象
  if (typeof this !== 'function') {
    console.error('type error')
  }
  // 获取参数
  let args = [...arguments].slice(1),
    result = null
  // 判断 context 是否传入，如果未传入则设置为 window
  context = context || window
  // 将调用函数设为对象的方法
  context.fn = this
  // 调用函数
  result = context.fn(...args)
  // 将属性删除
  delete context.fn
  return result
}
var A = function (name) {
  this.name = name
  this.getName = function (arg1, arg2, arg3) {
    return this.name || 'wang'
  }
}

function B(name) {
  this.name = name
}

let a = new A('xiaoming')
let b = new B('xiaohong')
console.log(a.getName.myCall(b, '1', '2', '3'))
```

接下来逐行解析这段代码。

1. 定义的代码是`Function.prototype.myCall`而不是`myCall`，因为原始的`call`就是定义在`Function.prototype`下的，这种定义方式是为了让`myCall`和`call`在使用时一致。
2. `if (typeof this !== 'function')`  
   一般情况不瞎搞原型链不会触发这个 if，如果你能触发这个 if，就应该有了不需要看这个博客的水平，总而言之我不是很懂。
3. `let args = [...arguments].slice(1)` 首先说明一下`arguments`，代表当前函数传入的所有参数，是一个类 Array。当我们在代码最后添加`a.getName.myCall(b, '1', '2', '3')`，此时`myCall`中的`arguments`为：

   ```
   [Arguments] {
   '0': B { name: 'xiaohong' },
   '1': '1',
   '2': '2',
   '3': '3'
   }
   ```

   `[...arguments]`是通过解构的方式把 arguments 变为 Array，为了调用`slice()`。  
   `slice(1)`，取出后面的三个参数，类比 python 的`nums[1:]`。

4. `context`  
   Js 不检测函数传入的参数数量，参考https://blog.csdn.net/smile_lg/article/details/79740546  
   此处 context 就是传进来的第一个参数，即`B { name: 'xiaohong' }`。也就是说，`context===arguments[0]`。写个 context 在这是为了方便。
5. `context = context || window`  
   结合上一条，如果在调用`myCall`的时候什么参数也不传入，就把变量设为`window`（全局变量），在 node 环境下把`window`改为`global`。
6. `context.fn = this`  
   `fn`没有特别的含义，随便取的名字，为`context`添加一个新方法。对应到上面的代码中，此时`context === b`，`this === a.getName`。之后`context.fn`就是`b.getName`
7. `result = context.fn(...args)`  
   调用方法，没啥说的，`...args`表示解构，具体 MDN。
8. `delete context.fn`  
   6 给`b`添加了`getName`方法，但是`b`是不该有这个方法的，这里删掉。

到此`call()`解析完成。

## apply

```javascript
Function.prototype.myApply = function (context) {
  // 判断调用对象是否为函数
  if (typeof this !== 'function') {
    throw new TypeError('Error')
  }
  let result = null
  // 判断 context 是否存在，如果未传入则为 window
  context = context || window
  // 将函数设为对象的方法
  context.fn = this
  // 调用方法
  if (arguments[1]) {
    result = context.fn(...arguments[1])
  } else {
    result = context.fn()
  }
  // 将属性删除
  delete context.fn
  return result
}
```

和`call()`基本相同，只是`arguments`最大长度为 2，所有的参数都放在`arguments[1]`内。

## bind

本节代码在 CUG-GZ 的基础上修改。

<!-- prettier-ignore-start -->
```javascript
Function.prototype.myBind = function(context) {
  // 判断调用对象是否为函数
  if (typeof this !== "function") {
    throw new TypeError("Error");
  }
  // 获取参数
  var args = [...arguments].slice(1),
    fn = this;
  return function Fn() {
    //二选一
    return fn.call(context, ...args.concat(...arguments))
    return fn.apply(context, args.concat(...arguments));
  };
};
```
<!-- prettier-ignore-end -->

从第一个`return`开始看起。

1. 回顾 call 节的 6，对应到 return 前一行，此时`context === b`，`fn === this === a.getName`，bind 返回的是一个函数，在调用后直接返回对应的 call 和 apply。
2. `return`内部的`arguments`指的是`Fn`的形参，用于 bind 的分次输入。

```javascript
Function.prototype.myBind = function (context) {
  // ...
  return function Fn() {
    console.log(args)
    console.log(arguments)
    console.log(args.concat(arguments))
    return fn.apply(context, args.concat(arguments))
  }
}
console.log(a.getName.myBind(b)(1, 2, 3))
// []
// 1 2 3
// [ 1, 2, 3 ]
console.log(a.getName.myBind(b, 1)(2, 3))
// [ 1 ]
// 2 3
// [ 1, 2, 3 ]
console.log(a.getName.myBind(b, 1, 2)(3))
// [ 1, 2 ]
// 3
// [ 1, 2, 3 ]
console.log(a.getName.myBind(b, 1, 2, 3)())
// [ 1, 2, 3 ]
//
// [ 1, 2, 3 ]
```
