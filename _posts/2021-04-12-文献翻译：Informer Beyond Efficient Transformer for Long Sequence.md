---
layout:     post
title:      文献翻译：Informer: Beyond Efficient Transformer for Long Sequence
subtitle:   arxiv: 2012.07436
date:       2021-04-13
author:     hxlh50k
header-img: null
catalog: true
tags:
    - 文献翻译
    - Informer
    - Transformer
    - LSTF
    - LSTM
    - 深度学习
---
## 说明

原作者：
>Haoyi Zhou<sup>1</sup>, Shanghang Zhang<sup>2</sup>, Jieqi Peng<sup>1</sup>, Shuai Zhang<sup>1</sup>, Jianxin Li<sup>1</sup>, Hui Xiong<sup>3</sup>, Wancai Zhang<sup>4</sup>  
<sup>1</sup>Beihang University <sup>2</sup>UC Berkeley <sup>3</sup>Rutgers University <sup>4</sup>SEDD Company   
{zhouhy, pengjq, zhangs, lijx}@act.buaa.edu.cn, shz@eecs.berkeley.edu, {xionghui,zhangwancaibuaa}@gmail.com

翻译为机翻+脑补，译者不对准确性不做承诺，博客内容仅供参考。原文中所有引用均省略，图片懒得整。

## 摘要  

　　许多实际应用需要对长序列时间序列进行预测，例如耗电量计划。长序列时间序列预测 (LSTF) 要求模型具有很高的预测能力，这是有效捕获输出和输入之间精确的长期依赖关系的能力。最近的研究表明，Transformer具有提高预测能力的潜力。但是，Transformer存在一些严重问题，导致其无法直接应用于LSTF，包括二次时间复杂度，高内存使用率以及编码器-解码器体系结构的固有局限性。为了解决这些问题，我们为LSTF设计了一个有效的基于Transformer的模型，称为Informer，它具有三个独特的特征：(1)ProbSparse自注意机制，该机制在时间复杂度和内存使用上达到$O(LlogL)$，并且在序列的相关性比对上具有类似的性能。 (2)自注意力提取通过将级联层输入减半来突出占主导地位的注意力，并有效地处理超长的输入序列。 (3)生成式解码器虽然在概念上很简单，但它在一次向前操作中预测了较长的时间序列序列，而不是一步一步地进行预测，从而极大地提高了长序列预测的推断速度。在四个大型数据集上进行的大量实验表明，Informer的性能明显优于现有方法，并为LSTF问题提供了新的解决方案。

## 1 介绍

　　时间序列预测是许多领域的重要组成部分，例如传感器网络监控，能源和智能电网管理、经济、金融和疾病传播分析。在这些场景中，我们可以利用大量关于过去行为的时间序列数据来进行长期预测，即**长序列时间序列预测**(LSTF)。然而，现有的方法大多是在短期问题背景下设计的，比如预测48个点或更少。越来越长的序列限制了模型的预测能力，以至于这一趋势阻碍了对LSTF的研究。作为一个经验示例，图(1)显示了真实数据集上的预测结果，其中LSTM网络预测了从短期(12点，0.5天)到长期(480点，20天)的变电站的小时温度。当预测长度大于48个点(图(1b)中的实心星)时，整体性能差距很大，此时均方误差上升到不令人满意的性能，推理速度急剧下降，LSTM模型开始失败。  
　　LSTF面临的主要挑战是提高预测能力，以满足日益增长的长序列需求，这需要 **(a)非凡的远程比对能力和(b)对长序列输入和输出的高效操作**。最近，Transformer模型 (译者注：[arxiv: 1706.03762]) 与RNN模型相比，在捕捉长程相关性方面表现出了更好的性能。自注意力机制可以将网络信号传播路径的最大长度减少到理论上的最短$O(1)$，并避免递归结构，Transformer显示出解决LSTF问题的巨大潜力。然而，由于其$O(L^2)$的时间复杂度和$O(L)$的空间复杂度 (译者注：原文[L-quadratic computation and memory consumption on L-length inputs/outputs]) ，自注意力机制违反了要求(b)。一些大规模的Transformer模型倾注了大量资源，在NLP任务中取得了令人印象深刻的结果，但是在几十个GPU上的训练和昂贵的部署成本使得这些模型几乎不能用于现实世界的LSTF问题。自注意力机制和Transformer体系结构的效率成为它们应用于LSTF问题的瓶颈。因此，在这篇论文中，我们试图回答这个问题：*我们能否改进变压器模型以提高计算、存储和架构效率，同时保持更高的预测能力？*  
　　一般的Transformer模型在解决LSTF问题时有三个重大限制：  

1. **自注意力的二次方计算复杂度。** 自注意力机制的原子操作，即规范点积，导致每层的时间复杂性和存储器使用是O(L^2)。  
2. **长输入堆叠层的内存瓶颈。** J个编解码层的堆栈使得总内存使用量为$O(J·L^2)$，这限制了模型在接收长序列输入时的可扩展性。
3. **预测长期输出的速度骤降。** 一般的Transformer的动态解码使得逐步推理的速度与基于RNN的模型一样慢(图(1b))。  

　　之前有一些关于提高自注意力机制效率的研究：稀疏Transformer、对数稀疏Transformer、Longformer，它们都使用启发式方法来解决限制1，并将自注意力机制的复杂度降低到$O(LlogL)$，这使得它们的效率有限。Reformer也通过具有局部敏感散列自注意力达到了的$O(LlogL)$的复杂度，但它仅适用于极长的序列。最近，Linformer声称达到了线性复杂度$O(L)$，但对于真实的长序列输入，项目矩阵不能固定，可能存在退化到$O(L^2)$的风险。Transformer-XL和压缩Transformer使用辅助隐藏状态来捕获长程依赖，这可能会放大限制1，不利于打破效率瓶颈。这些工作主要集中在限制1上，而限制2和限制3在LSTF问题中还没有得到很好的解决。为了提高预测能力，我们克服了所有这些限制，并在提出的Informer中实现了超出效率的改进。  

　　为此，我们的工作明确地探讨了这三个问题。我们研究了自注意力机制中的稀疏性，改进了网络组件，并进行了广泛的实验。本文的贡献总结如下:

* 我们提出的Informer在LSTF问题中成功地提高了预测能力，验证了类Transformer模型在捕捉长序列时间序列输出和输入之间的个体长期相关性方面的潜在价值。
* 我们提出ProbSparse自注意力机制来有效取代典型的自注意力。实现了依赖对齐的$O(LlogL)$时间复杂度和$O(LlogL)$内存使用量。
* 在J个堆叠层中，我们提出了对优先级控制的注意力分数的自注意提取操作，将空间复杂度显著降低到$O((2−\epsilon)·L·logL)$，这有助于接收长序列输入。
* 我们提出了生成式解码器，该解码器只需要一次前向传播就可以获得长序列输出，同时避免了推理阶段累积误差的扩散。

## 2 准备

　　我们首先提供LSTF问题定义。在具有固定大小窗口的滚动预测设置下，我们有输入$X^t = \{x^t_1,...,x^t_{L_x} | x^t_i\in\mathbb{R}^{d_x}\}$于时间$t$，输出结果是预测相应的序列$Y^t = \{y^t_1,...,y^t_{L_y} | y^t_i\in\mathbb{R}^{d_y}\}$。与以前的工作相比，LSTF问题鼓励更长的输出长度，并且输出特征并不局限于一维$(d_y≥1)$。  
　　**编码器-解码器架构** 许多流行的模型被设计为“编码”输入（表示为$X^t$）进入一个隐藏状态（表示为$H^t$），最后从隐藏态$H^t = \{h^t_1,...,h^t_{L_h}\}$“解码”成输出（表示为$Y^t$）。该推断涉及一种名为“动态解码”的循序渐进的过程，在解码器根据前一状态$h^t_k$和来自第$k$步的其他必要输出计算新的隐藏状态$h^t_{k+1}$的情况下，然后预测第$(k+1)$个序列$y^t_{k+1}$。  
　　**输入表示方法** 给出了一种统一的输入表示，增强了时间序列输入的全局位置上下文和局部时间上下文。为了避免使描述变得琐碎，我们将详细信息放在附录B中。

## 3 方法

　　现有的时间序列预测方法大致可以分为两类：经典时间序列模型是时间序列预测的可靠工具，而深度学习技术则主要利用RNN及其变体开发一种编码器-解码器预测方法。我们提出的Informer拥有编码器-解码器架构，同时针对LSTF问题。请参阅图(2)的概述和以下部分的详细信息。

### 高效自注意力机制

　　Vaswani提出的典型自注意力（Vaswani, A.; Shazeer, N.; Parmar, N.; Uszkoreit, J.; Jones, L.; Gomez, A. N.; Kaiser, Ł.; and Polosukhin, I. 2017. Attention is all you need. In NIPS, 5998–6008.）是基于元组输入，即query、key和value定义的，其执行的缩放点积（译者注：原文[scaled dot-product]，并不理解）表示为$\mathcal{A}(\pmb{Q},\pmb{K},\pmb{V}) = Softmax(\pmb{Q}\pmb{K}^\mathrm{T}/\sqrt{d})\pmb{V}, \pmb{Q}\in\mathbb{R}^{L_Q×d}, \pmb{K}\in\mathbb{R}^{L_K×d}, \pmb{V}\in\mathbb{R}^{L_V×d}, d为输入维度$为了进一步讨论自注意力机制，让$q_i, k_i, v_i分别代表\pmb{Q}, \pmb{K}, \pmb{V}$中的第$i$行。根据Tsai等人提出的公式（Tsai, Y .-H. H.; Bai, S.; Y amada, M.; Morency, L.-P .; and Salakhutdinov, R. 2019. Transformer Dissection: An Unified Understanding for Transformer’s Attention via the Lens of Kernel. In ACL 2019, 4335–4344.），第i个query的注意力被定义为一个概率形式的核平滑器:
 $$\mathcal{A}(\pmb{\rm q}_i, \pmb{K}, \pmb{V}) = \sum_j{\frac{k(\pmb{\rm q}_i,\pmb{\rm k}_j)}{\sum_lk(\pmb{\rm q}_i,\pmb{\rm k_i})}\pmb{\rm v}_j = \mathbb{E}_{p(\pmb{\rm k}_j|\pmb{\rm q}_i)}[\pmb{\rm v}_j]} \tag{1}$$
其中$p(\pmb{\rm k}_i|\pmb{\rm q}_i) = k(\pmb{\rm q}_i, \pmb{\rm k}_j)/\sum_l{k(\pmb{\rm q}_i,\pmb{\rm k}_l)}$，且$k({\rm q}_i,{\rm k}_l)$选择了不对称的指数核$exp(\pmb{\rm q}_i\pmb{\rm k}^\mathrm{T}_j/\sqrt{d})$。自注意力通过计算概率$p(\pmb{\rm k}_j|\pmb{\rm q}_i)$将值进行组合并获得输出。它需要使用$O(L^2)$时间进行点积计算和$O(L_QL_K)$的内存使用，这是提高预测能力的主要缺点。  
　　前人的一些尝试表明，自注意力概率的分布具有潜在的稀疏性，他们在不显著影响性能的情况下，对所有的$p(\pmb{\rm k}_j|\pmb{\rm q}_i)$都设计了“选择性”计数策略。稀疏Transformer合并了行输出和列输入，其中稀疏性是由这些分离的空间相关性引起的。对数稀疏Transformer注意到自注意力的循环模式，并迫使每个单元格以指数步长关注前一个单元格。Longformer将前两部作品扩展到更复杂的稀疏配置。但是，他们都局限于从启发式的方法进行理论分析，用相同的策略来解决每个多头自注意力问题，这就限制了他们的进一步提高。  
　　为了激励我们的方法，我们首先对习得的规范自注意力的注意模式进行定性评估。“稀疏性”自注意力得分形成了一个长尾分布(详见附录C)，即少数点积对贡献了主要注意力，其他点积对贡献了次要注意力。那么下一个问题是如何区分它们呢？  
　　**Query稀疏度度量** 根据公式(1)，第i个query对所有key的关注被定义为概率p(kj|qi)，并且输出是其与值v的合成。主要的点积对鼓励相应query的注意力概率分布远离均匀分布。如果$p(\pmb{\rm k}_j|\pmb{\rm q}_i)$接近均匀分布$q(\pmb{\rm k}_j|\pmb{\rm q}_i) = 1/L_k$，则自注意力成为对$\pmb{V}$的普通求和，并且这对住宅输入（译者注：原文[residential input]，可能是某种数据集？）是多余的。当然，分布$p$和$q$之间的“相似性”可以用来区分“重要的”query。我们通过Kullback-Leibler散度来衡量“相似性” $KL(q||p) = \ln{\sum^{L_K}_{l=1}{e^{\pmb{\rm q}_i\pmb{\rm k}_l^\mathrm{T}/\sqrt{d}}}}-\frac{1}{L_K}\sum^{L_K}_{j=1}\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}/\sqrt{d}-\ln{L_K}$ 。丢弃常量，我们将第i个query的稀疏度量定义为
$$M(\pmb{\rm q}_i, \pmb{K}=\ln{\sum^{L_K}_{j=1}{e^{\frac{\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}}{\sqrt{d}}}}}-\frac{1}{L_K}\sum^{L_K}_{j=1}{\frac{\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}}{\sqrt{d}}})\tag{2}$$  
其中，第一项是$\pmb{\rm q}_i$在所有key上的Log-Sum-Exp(LSE)（译者注：与softmax公式有关），第二项是它们的算术平均值。如果第i个query获得较大的$M(\pmb{\rm q}_i，\pmb{K})$，则其关注概率$p$更加“多样化”，并且很有可能在长尾自注意力分布的头部包含占主导地位的点积对。  
　　**ProbSparse自注意力** 基于候选的测量，我们通过允许每个key只关注$u$个主要查询来实现ProbSparse自注意力：
$$\mathcal{A}(\pmb{Q},\pmb{K},\pmb{V})=Softmax(\frac{\overline{\pmb{Q}}\pmb{K}^\mathrm{T}}{\sqrt{d}})\pmb{V}\tag{3}$$
其中$\pmb{Q}$是和$\pmb{\rm q}$相同大小的稀疏矩阵，并且它仅包含稀疏度量$M(\pmb{\rm q}，\pmb{K})$下的$Top-u$个query。在固定采样因子c的控制下，设置$u=c·\ln{LQ}$，使得ProbSparse自注意力算法的每个query-key只需进行$O(\ln{LQ})$复杂度的点积计算，并且层内存使用量保持$O(L_K\ln{L_Q})$。在多头视角下，这种关注为每个头生成不同的稀疏query-key对，从而避免了严重的信息丢失。  
　　然而，遍历测量$M(\pmb{\rm q}_i，\pmb{K})$的所有query需要计算每个点积对，即二次方时间复杂度$O(L_QL_K)$，此外LSE操作还存在潜在的数值稳定性问题。受此启发，我们提出了一种有效获取query稀疏性度量的经验近似方法。  
　　**引理1.** 对于每个query$\pmb{\rm q}_i\in\mathbb{R}^d$和属于key集合$\pmb{K}$中的key$\pmb{\rm k}_j\in\mathbb{R}^d$，其有界，为：$\ln{L_K} \leq M(\pmb{\rm q}_i,\pmb{K}) \leq \max_j{\{\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}/\sqrt{d}\}}-\frac{1}{L_K}\sum^{L_K}_{j=1}{\{\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}/\sqrt{d}\}}+\ln{L_K}$。当$\pmb{\rm q}_i\in\pmb{K}$时，它也成立。  
　　从引理1(证明见附录D.1)出发，我们提出最大均值测度为
$$\overline{M}(\pmb{\rm q}_i,\pmb{K})=\max_j{\{\frac{\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}}{\sqrt{d}}\}-\frac{1}{L_K}\sum^{L_K}_{j=1}{\frac{\pmb{\rm q}_i\pmb{\rm k}_j^\mathrm{T}}{\sqrt{d}}}}\tag{4}$$  
　　$Top-u$的范围大致适用于命题1的边界松弛(参见附录D.2)。在长尾分布下，我们只需要随机抽样$U = L_K\ln{L_Q}$的点积对就可以计算出$M(\pmb{\rm q}_i，\pmb{K})$，例如用零填充其他对。然后，我们从中选择稀疏的$Top-u$作为$\pmb{Q}$。$M(\pmb{\rm q}_i，\pmb{K})$中的$max$算子对零值不太敏感，数值稳定。实际上，在自注意力计算中，query和key的输入长度通常是相等的，即$L_Q= L_K= L$，因此稀疏自注意力的总时间复杂度和空间复杂度为$0(L\ln{L})$。  

### 编码器:允许在内存使用限制下处理较长的顺序输入

　　编码器的设计目的是提取长序列输入的鲁棒长程相关性。在输入表示之后，第$t$个序列输入$X^t$已经被变形为矩阵$X^t_en\in\mathbb{R}^{L_x \times d_{model}}$。为了清楚起见，我们在图(3)中给出了编码器的草图。  
　　**自我注意的提取** 作为*ProbSparse*自我注意机制的自然结果，编码器的特征图具有value$\pmb{V}$的冗余组合。我们使用提取操作将主要特征赋予高级特征，并在下一层生成聚焦的自我注意特征图。它大幅削减了输入的时间维度，看到了图(3)中关注块的n头权重矩阵(重叠的红色方块)。受膨胀卷积的启发，我们从第j层向前推进到第(j+1)层的“提取”如下：
$$X^t_{j+1}=MaxPool(ELU(Conv1d([X^t_j]_{AB})))\tag{5}$$
其中$[·]_{AB}$表示注意力模块，包括它包含了多头*ProbSparse*自我注意和基本操作，$Conv1d(·)$利用$ELU(·)$激活函数在时间维上执行1维卷积滤波器(核宽度=3)。在堆叠一个层后，我们增加了一个步长为2的最大池化层，并将$X^t$下采样到一半，从而将整个内存使用量减少到$O((2−\epsilon)L\log{L})$，$\epsilon$是一个很小的数字。为了增强提取操作的健壮性，我们用减半的输入构建主栈的副本，并通过一次丢弃一层来逐步减少自我关注提取层的数量，就像图(2)中的金字塔一样，从而使它们的输出维度对齐。因此，我们将所有堆栈的输出连接起来，得到编码器的最终特征图。

### 解码器：通过一次前向传播生成长顺序输出

图(2)使用标准的解码器结构，它由两个相同的多头关注层堆叠而成。然而，在长期预测中，采用生成式推理来缓解速度骤降。我们向解码器提供以下向量：
$$X^t_{de}=Concat(X^t_{token},X^t_0)\in\mathbb{R}^{(L_{token}+L_y) \times d_{model}}\tag{6}$$
其中$X^t_{token}\in\mathbb{R}^{L_{token}\times d_{model}}$是开始令牌$X^t_0\in\mathbb{R}^{L_y\times d_{model}}$是目标序列的占位符(将标量设置为0)。通过将遮罩点积设置为$−\infty$，将遮罩多头注意力应用于ProbSparse自我注意计算。它防止每个位置关注即将到来的位置，从而避免自回归。一个全连接层获得最终输出，它的大小$d_y$取决于我们执行的是单变量预测还是多变量预测。  
　　**生成式推理** 起始令牌被有效地应用于NLP的“动态解码”，我们将其扩展为一种生成式的方法。我们不选择特定的标志作为令牌，而是采样输入序列中的$L_{token}$长序列，例如输出序列之前的较早切片。以预测168个点为例(实验部分的7天温度预测)，我们将目标序列前5天的已知时间作为“开始令牌”，并以$X_{de}=\{X_{5d}，X_0\}$作为生成式推理解码器的输入。$X_0$包含目标序列的时间戳，即目标周的上下文。然后，我们提出的解码器通过一次前向传播预测输出，而不是传统编解码器体系结构中耗时的“动态解码”。在计算效率部分给出了详细的性能比较。  
　　**Loss函数** 我们在预测目标序列时选择MSE损失函数，损失从解码器的输出传回整个模型。

## ***后面实验、结论、附录懒得翻译了自己看原文吧***