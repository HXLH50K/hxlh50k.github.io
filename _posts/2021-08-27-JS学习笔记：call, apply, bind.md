---
layout: post
title: JS学习笔记：call, apply, bind
subtitle: 这玩意怎么这么难啊
date: 2021-08-27
author: hxlh50k
header-img: null
catalog: true
tags:
  - JavaScript
  - 前端
---

MDN:

> call() 方法使用一个指定的 this 值和单独给出的一个或多个参数来调用一个函数。  
> apply() 方法调用一个具有给定 this 值的函数，以及以一个数组（或类数组对象）的形式提供的参数。  
> bind() 方法创建一个新的函数，在 bind() 被调用时，这个新函数的 this 被指定为 bind() 的第一个参数，而其余参数将作为新函数的参数，供调用时使用。

每个字都认识，连起来就是阿巴阿巴阿巴。  
简单的理解，这三个函数就是把类 A 的方法`x()`应用到类 B 上。下面尝试自己写代码理解这三个函数。  
先定义两个类 A、B，并实例化

```JavaScript
var A = function (name) {
  this.name = name
  this.getName = function () {
    return this.name
  }
}

function B(name) {
  this.name = name
}

let a = new A('xiaoming')
let b = new B('xiaohong')
```

然后试着用 getName 访问 a、b 的 name：

```JavaScript
console.log(a.getName()) //'xiaoming'
console.log(b.getName()) //TypeError: b.getName is not a function
```

很明显，b 压根就没有`getName()`。现在我们用 call 把 a 的`getName()`应用到 b 上：

```JavaScript
console.log(a.getName()) //'xiaoming'
console.log(a.getName.call(b)) //'xiaohong'
```

可以看出`call()`把 `a.getName()`中的`this`指向了 b，打印出了`"xiaohong"`,相当于给没有`getName()`的 b 应用了该方法。  
接下来是`apply()`,`apply()`和`call()`的区别仅在于参数，在目标方法不需要参数的时候二者使用没有区别：

```JavaScript
console.log(a.getName.call(b)) //'xiaohong'
console.log(a.getName.apply(b)) //'xiaohong'
```

先改写两个类：

```JavaScript
var A = function (name) {
  this.name = name
  this.getName = function (arg1, arg2, arg3) {
    return this.name + arg1 + arg2 + arg3
  }
}

function B(name) {
  this.name = name
}

let a = new A('xiaoming')
let b = new B('xiaohong')
```

这里给`a.getName()`加上了几个没用的参数，接着开始看正主：

```JavaScript
console.log(a.getName(1, 2, 3)) //'xiaoming123'
console.log(a.getName.call(b, 1, 2, 3)) //'xiaohong123'
console.log(a.getName.apply(b, [1, 2, 3])) //'xiaohong123'
```

`apply()`接受的参数形式是 类 Array，通常使用起来更加灵活，所以用的更多。  
最后来看`bind()`，`bind()`与前两个不太一样，返回的结果是一个新函数：

```JavaScript
let f1 = a.getName.bind(b, 1, 2, 3)
console.log(f1()) //"xiaohong123"
console.log(f1) //[Function: bound ]
```

如果写的紧凑一点，直接在后面加对`()`调用：

```JavaScript
console.log(a.getName.bind(b, 1, 2, 3)()) //"xiaohong123"
```
