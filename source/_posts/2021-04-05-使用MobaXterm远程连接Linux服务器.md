---
layout:     post
title:      使用MobaXterm远程连接Linux服务器
description:   新手向的远程连接教程
excerpt: 通过图示步骤使用MobaXterm配置SSH会话含用户名密钥与跳板机连接指南。
date:       2021-04-05
author:     hxlh50k
header-img: null
catalog: true
tags:
    - Linux
    - MobaXterm
    - 远程连接
---
1. [官网](https://mobaxterm.mobatek.net/)下载**MobaXterm**，免费版即可，后续有需求可自行购买专业版。推荐下载**Installer edition**；

2. 安装完成后，进入主界面，点击左上角**Session**新建一个会话，之后选择**SSH**模式；    
![picture1](01.jpg)

3. 按图输入所需连接的地址和端口号，并勾选**Specify username**后点击右侧图标；  
![picture2](02.jpg)

4. 新建一个用户并记在本地，密码如果是使用key连接可不填；  
![picture3](03.jpg)

5. 回到上级界面，点击下拉框并选择刚才的用户名；  
![picture4](04.jpg)

6. 如果使用key连接，按下图所示添加私钥文件的路径；  
![picture5](05.jpg)

7. 如果使用跳板机，按下图所示添加跳板机。如果跳板机使用密钥连接，则类似步骤5添加私钥，否则跳过。跳板机密码会在初次连接时要求输入，之后选择记住即可；  
![picture6](06.jpg)

8. 点击OK，回到主界面，双击左侧新建的Session连接服务器；  
![picture7](07.jpg)

9. 连接成功后如图所示，左边为MobaXterm提供的sftp连接，可以进行图形化的文件管理，适合小白使用。
![picture8](08.jpg)

* 有关跳板机的使用。如果在步骤3中的地址连接的是跳板机，则步骤7应当跳过，并且在步骤8进入服务器后使用ssh命令进入目标服务器。这种方法会导致左边的sftp连接到跳板机上，即使ssh后也不会连接到目标服务器，故不推荐使用。