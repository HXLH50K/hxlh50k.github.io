---
layout: post
title: 基于Cosmic搭建Global Maplestory v083私服
description: 我回到了过去，但是那里没有人
excerpt: 基于Cosmic源码在Windows部署Maplestory v083私服的环境准备与端口配置流程。
date: 2023-06-05
author: hxlh50k
header-img: null
catalog: true
tags:
    -游戏
    -工具
    -Maplestory
---

---
# 准备工作
## 1. 整个服务器
> 单机玩家跳过该步骤，直接在本地操作

服务器配置参考：~$90 / Month  
```
Azure Standard D2lds v5  
vCPUs 2  
RAM 4GiB  
OS Windows 10 Pro
```
* 本教程全程基于Windows系统，Linux服务器请自行摸索
* Azure服务器费用偏贵，建议依据自身条件选择服务器供应商

## 2. 配置Windows防火墙规则
对以下端口设置Inbound + Outbound规则，协议为TCP + UDP，共计添加4条规则  
7575-7584（依据频道数量）,8484

## 3. 配置服务器防火墙规则
在服务器控制台配置打开对应端口的Inbound + Outbound规则

---
# 服务器端
服务器端依据该Repo搭建：<https://github.com/P0nk/Cosmic>  

1. 安装JDK17  
<https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html>

1. 安装VC++ 2019  
<https://aka.ms/vs/17/release/vc_redist.x64.exe>

1. 安装Git  
<https://git-scm.com/>

1. 安装IntelliJ IDEA  
<https://www.jetbrains.com/idea/>  
社区版即可，完成后重启

1. 安装MySql  
<https://dev.mysql.com/downloads/windows/installer/8.0.html>  
MySQL Community Server 8.0.33   
安装完成进入配置界面，注意以下选项：  
config type: server computer （本地玩家选择Developer computer）   
设置root密码，记牢。

1. 安装Sqlyog  
<https://github.com/webyog/sqlyog-community/wiki/Downloads>


1. Clone代码
    1. 打开IntelliJ，New project，全部默认，直到进入编辑器界面
    1. File - New - Project from Version Control...
    1. Url填写 `https://github.com/P0nk/Cosmic.git`
    1. 设置代码保存位置 e.g. C:\Maplestory\
    1. 等到下方进度条跑完，窗口别关

1. 初始化数据库
    1. 打开Sqlyog
    1. 右键左侧root@localhost - 执行SQL脚本
    1. 找到`C:\Maplestory\database\sql`，依次执行4个脚本

1. 修改服务器配置
    1. 打开项目根目录下的config.yaml
    1. 181行改为false
        ```
        ENABLE_PIC: true
        ENABLE_PIN: true 
        ```
    1. 165行
        ```
        DB_USER: "cosmic_server"
        DB_PASS: "snailshell"
        ```
        改为
        ```
        DB_USER: "root"
        DB_PASS: "<第4步设置的密码>"
        ```
    1. 其它配置自由修改，单机玩家建议将270行改为true  
        ```
        USE_ENABLE_SOLO_EXPEDITIONS: false
        ```

1. 通过jar文件运行服务端
    1. 回到IntelliJ，点击下方Terminal，输入`mvn clean install`，此时该命令应该是绿色底。按ctrl+enter，等编译完成（几分钟）
    1. 在项目根目录运行launch.bat

以后直接运行launch.bat即可开启服务器端。

---
# 客户端
TBD

---
# 参考资料
TBD