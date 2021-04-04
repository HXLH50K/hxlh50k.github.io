本文参考了[PandoraBox扩大内部容量](https://zfuns.github.io/pdr/)，修正了原文的错误并作出了一些改进。

0. 格式化U盘为ext3或ext4文件系统，这一步在windows下可使用diskgenius新版实现，官网下载免费版即可；

1. 查看你的分区信息： 查看U盘的挂载点 mount 查看U盘的UUID blkid 记下U盘的uuid和挂载路径；如果blkid不可用，可以使用block info代替；

2. overlay分区准备：  
    删除U盘内所有文件 `rm -rf /mnt/sda/*` `/mnt/sda/`是U盘自动挂载的路径  
    复制原overlay分区的内容到U盘 `cp -a /overlay/* /mnt/sda/` ；

3. 挂载设置： `vim /etc/config/fstab` 在原配置下添加
    ```
    config 'mount'
        option enabled '1'
        option uuid 'b928fe2c-4881-4ba3-9a6e-a0f6dc2b302e'
        option target '/overlay'
    ```
4. reboot