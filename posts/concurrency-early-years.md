# The Computer Science of Concurrency: The Early Years

```
@inbook{10.1145/3335772.3335775,
author = {Lamport, Leslie},
title = {The computer science of concurrency: the early years},
year = {2019},
isbn = {9781450372701},
publisher = {Association for Computing Machinery},
address = {New York, NY, USA},
url = {https://doi.org/10.1145/3335772.3335775},
booktitle = {Concurrency: The Works of Leslie Lamport},
pages = {13–26},
numpages = {14}
}
```

这篇文章主要涉及并发的理论与算法，而非具体编程语言的实现。作者Leslie Lamport是2013年图灵奖得主，其主要贡献有（1）在分布式系统领域的奠基性工作 （2）LaTeX。

## The Beginning: Mutual Exclusion

### The Problem

> 这里介绍了Edsger Dijkstra在1965年发表的经典论文**Solution of a Problem in Concurrent Programming Control**。本文对Mutual Exclusion的问题的描述比较简略模糊，我重新阅读了Dijkstra的工作，并且整理如下：
>
> **问题**：现有$N$个**cyclic processes**，每个cycle均含有一段**critical section**，我们需要为运行这些进程的计算机编写程序，使得任意时刻只有1个进程处于其critical section中。进程间可以通过共享存储的方式进行通行，访问共享存储的操作保证是原子的。Dijkstra进一步对问题的解法提出了如下要求：
>
> * $N$个进程地位相同，没有静态定义的优先级。
> * 解法不能对$N$个进程的执行进度作出假设。
> * 任意一个进程在critical section**外**阻塞不会引发其他进程阻塞。
> * 不能发生活锁。

基于以上问题描述，本文将Dijkstra期望的解法性质总结为：

* **Mutual Exclusion (safety)**: 两个critical section不会并发地(concurrently)执行。
* **Livelock Freedom (liveness)**: 如果某进程在等待进入critical section，那么其保证会最终进入critical section。

我们尝试用Dijkstra算法实现这样一个问题：考虑1个全局的counter，5个进程各自给该counter增加计数500，counter的最终值应为$5 \times 500 =2500$。

```c
#include <stdatomic.h>

int count = 0;

atomic_bool b[N];
atomic_bool c[N];
atomic_int k = 0;

void* process(void* arg) {
  long i = (long)arg;  // Thread (process) identifier

  int cnt = 0;
  while (cnt < 500) {
    atomic_store(&b[i], false);
  L1:
    if (atomic_load(&k) != i) {
      atomic_store(&c[i], true);
      if (atomic_load(&b[atomic_load(&k)])) atomic_store(&k, i);
      goto L1;
    } else {
      atomic_store(&c[i], false);
      for (int j = 0; j < N; j++) {
        if (j != i && !atomic_load(&c[j])) goto L1;
      }
    }

    count += 1;

    atomic_store(&b[i], true);
    atomic_store(&c[i], true);

    cnt++;
  }
}
```

* `b[N]` 表明各进程进入critical section的意图，`false`表示进程准备进入critical section。
* `c[N] `表明各进程是否处于critical section中。
* `k` 表明PID为`k`的进程将优先进入critical section。

注意，Dijktra算法存在一个关键约定：进程间可以通过共享存储的方式进行通行，**访问共享存储的操作保证是原子的**。因此，我们引入`<stdatomic.h>`以实现对共享存储的原子操作。可编译运行的C程序请见附件`dijkstra.c`。

### The First “Real” Solution

Leslie Lamport本人提出了Bakery算法。Bakery算法采用tick number来进行进程同步。每个进程等待tick number小于自身的进程离开critical section。

```c
void lock(int thread) {
    // Step 1: Doorway - Indicate intention to enter critical section
    entering[thread] = true;

    // Step 2: Take a number
    int max_number = 0;
    for (int i = 0; i < THREADS; ++i) {
        int num = number[i];
        max_number = num > max_number ? num : max_number;
    }
    number[thread] = max_number + 1;

    // Step 3: Wait for turn
    entering[thread] = false;
    for (int i = 0; i < THREADS; ++i) {
        // Wait until thread i receives its number:
        while (entering[i]);

        // Wait until all threads with smaller numbers finish their work:
        while (
          number[i] != 0 && 
          (number[i] < number[thread] || (number[i] == number[thread] && i < thread))
        );
    }
}

void unlock(int thread) {
    // Leave the critical section by setting your number to 0
    number[thread] = 0;
}
```

该算法使用tick number来控制访问critical section。Bakery算法中，对于全局的`number`数组，每个进程只可以写入自己的slot，但是可以读任何slot。可以证明，读操作不要求是原子的，而写操作需要保证正确写入。