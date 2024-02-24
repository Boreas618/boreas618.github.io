# Mira: A Progam-Behavior-Guided Far Memory System

<img src="https://p.ipic.vip/aj389r.png" alt="Screenshot 2024-02-15 at 3.34.25 PM" style="zoom: 33%;" />

> [!note]
>
> **总结**：本文中实现far memory system的核心是缓存的设计。传统的缓存方案缺乏对程序语义的前向理解，因而很难支持精确的预取（不太精确的预取主要依赖时间或空间局部性）、低overhead的访问、和安全地释放等优化操作。Mira在IR和runtime层面实现了这些高度语义相关、细粒度、精确的优化操作，并且对用户透明，取得极大的性能提升。
>
> Mira工作可以从两个层面理解：
>
> * **框架上**，主要是iterative profiling的静态动态分析，明确了优化点位。
> * 基于框架找出优化点位，**具体优化手段**上，主要是MLIR在IR层面支持的预取、精确（selective transmission）传输、请求复用、access-pattern based优化等。

> [!important]
>
> **对这篇工作的问题**
>
> **问题1**: 按照我的理解，将被offload的函数需要满足 
>
> * 不能频繁调用，因为RPC会flush缓存，会有通讯时延。
> * 含有较多的远端内存访问。
> * 对CPU资源要求不高，因为memory node的算力比较一般。
>
> 既然这类函数既不能被频繁调用，同时对CPU资源还要求不高，总之就是存在感比较一般的函数，offload的必要性很大吗？Offload机制确实会有应用场景，特定任务中特定函数offload能带来比较高的收益，但是考虑到文章中似乎只报告了GPT-2的offload的结果，我的问题是：在更多更一般的任务上，offload的收益如何？
>
> **问题2**: 如果是运行时进行Profiling，每次iteration被调用的函数集合不尽相同，这会不会影响Profiling结论，还是说每次iteration的时间都足够长，profiling的结果足够stable and robust？

## Introduction

**Topic**: implementing far memory system

**Current Approaches**: 

* Transparently swap memory pages between local and far memory (A1)
* Use a new programming model or extend an existing one with new APIs for far-memory accesses (A2)

-----

**Drawbacks**:

* **(A1)** Coarse granularity of a 4 KB page, which is often larger (2.3× to 31×) than what is actually read/written by an application. 

  > [!NOTE]
  >
  > 是否可以参考slab，透明地交换大小为$2^k$的内存？进一步地，为了防止高并发的细粒度内存交换，可以尝试复用请求，一个网络请求携带数个待交换内存（这是读到这里的想法，后面发现Mira也采用了复用请求的优化）。后续在Related Works里面有提到cache-line-based far memory systems，也是一种细粒度内存交换的思路。

* **(A2)** Non-trivial application-programmer or library-writer effort.

-----

**Proposed Approach**: Program-behavior-guided far-memory approach

1. **Compliers and Static Analysis**: behaviors like prefetching. A drawback of this approach is its inability to incorporate run-time information. 

2. **Run-time Profiling**: run-time information to help static analysis and compilation.

-----

**Opportunities**:

The key differenence between far memory and SRAM: **Cache for far memory is DRAM-based and can be controlled by software.**

> [!NOTE]
>
> 也就是说，与SRAM作为缓存 (CPU - DRAM间的缓存)不同，我们可以通过静态分析、运行时Profiling来**定制驻留集**。

---

**Challenges**:

* Non-fixed cache

  **Solution**: Separate the local cache into spaces dedicated to and configured for different program behaviors. **For sequential accesses**, a small directly mapped cache with a cache line size of multiple consecutive data elements is used. **For accesses with good locality but large working sets**, a relatively large set-associative cache is used.
  
* [*Unique in a far-memory environment*] far-memory pointers and their dereferences

  **Solution**: turn as many dereferences into native memory loads as possible by program behaviors.

* [*Unique in a far-memory environment*] large program scopes and more objects to be potentially analyzed

  **Solution**: performing **coarse-grained, cache-section-specific profiling** to narrow down program scopes and objects to those with the highest potential gain.

----

**Mechanisms**: divide into different cache sections.

**Policies**: configure cache section’s size, cache structure (set-/full-associative), cache line size, prefetching and eviction patterns, communication method （one-/two-sided RDMA）and so on.

## Mira

**Input**: an unmodified program

**Output**: 

* A cache configuration based on the program’s behavior
* A compiled code that runs on far memory via the Mira run-time system.

----

**Workflow**:

* Initially works almost the same as traditional page swap-based systems, except for the **profiling code** inserted. (never use far memory for stack or code, as they are small and frequently accessed)
* **Profiling**: per-function miss rate, miss latency, hit overhead (i.e., the additional latency to access data in cache over a regular memory load), and function execution time. The object sizes are also collected.
* Finding the critical functions and placing larger objects in the functions in their own sections. The section parameters are determined by program analyses.

----

Mira converts memory operations like allocation, read, and write to remotable operations **at the IR level**, which then is lowered to either cache or network accesses.

Some functions are offloaded  to far memory.

**Iterative (Sample-based input-adaptation approach)**: In **one round**, the compilation of a program is **optimized for several iterations** to generate a new compilation -> Use this compilation on the next invocation of the program.

> [!NOTE]
>
> 这里是一个类似于梯度下降的思路。考虑到每次迭代的成本不高（只考虑functions that “suffer the most”），多次迭代的开销便可以接受。

### Profiling

**Mechnisms:**

* Instrument profiling code during compilation
* Only profile coarse-grained cache section performance at the function level or at allocation sites.

**Determining Cache Sections and Analysis Scopes**:

* After a profiling run, pick the top 10% highest performance overhead to analyze. ~~(How to measure performance overhead? )~~ 

  The overhead is defined as **the ratio of time spent in Mira runtime over the remaining program execution time**. (handling cache hits (e.g., cache lookup), misses (going across the network to fetch cache lines from far memory), and evictions.)

* After picking functions, inspect large objects.

*If the performance after the iteration gets worse, the optimization will be recalled.*

### Program Analysis for Cache Configurations

**Determining cache line size**: 

* A cache line to be no larger than the data access granularity to avoid read/write amplification.
* Cover as many of the sequential accessed objects as possible.

> [!NOTE]
>
> Cache line长度是**从有限个hard coded的选项中选择**还是**根据不同object的特征动态计算**？即有没有关于Cache line长度的选择的自由度的详细讨论？

**Determining cache section structure**:

* If the access pattern **is sequential or stride**, then we use a directly mapped cache, as there will be no conflict. (And a directly mapped cache is faster than associative ones)

* Otherwise, analyze the locality set (i.e., the entries of data that need to live in the local cache at the same time) and addresses in the locality set.

  *If the locality set cannot be identified, then the section should be set fully associative.* 

### Determining Cache Section Size

Use sampling and profiling to determine section sizes.

Sequential and strided cache sections only need a small size that can fit enough prefetched data to hide network delay. 

For other cache sections, we sample a few section sizes as ratios of total local memory size (e.g., 20%, 40%, 60%, 80%).

### Conversion to Remote Code

Mira turns all pointers that point to selected objects (selected by the profiling process) in non-swap sections to remote pointers (defined in Mira’s IR).

> [!note]
>
> Explicit remote operations can more precisely control far-memory accesses and thereby improve application performance.
>
> 也就是说，将non-swap段中的指针操作全部转换为远程指针可以降低访存开销。我的理解是，这确保了指针指向的地址保证是远程的，避免了判断这个指针能否本地deref的开销，相当于做了剪枝的操作？

The overhead for accessing the source of truth of the remote pointer can be mitigated by prefetching.

-----

Resolving a remote pointer:

* Looking up the pointer in the local cache.
* If not found in the cache, fetching the data from far memory to the local cache.
* The actual data access

However, if we have already accessed **a cache line** and **know that it is still in the local cache**, we would know its local memory address. By keeping the address, we would avoid the redundant looking up the pointer.

> [!NOTE]
>
> 也就是 指针symbol - 指向的地址 的映射被缓存了，指针dereference被简化为memory load。

**Knowing that it is still in the local cache**: 

* **Single-threaded**: through static analysis.
* When our analysis finds conflicting accesses or is unsure about the occurrence of conflict accesses, Mira can mark cache lines as “dont-evict” to indicate that evicting them would cause a huge overhead.

### Program Optimization

**Adaptive Prefetching**: 

* Instead of predicting future accesses based on run-time history, we use program analysis to determine what will be accessed in the future.

* Insert prefetch operations at the program location that is estimated to be one network round trip earlier than actual access.

  > [!note]
  >
  > How? 估计一下round trip大概是多少行IR吗？

**Eviction Hints**: Find the last access of a data element in a program scope which will be marked as "evictable". If there is no line marked as evictable, Mira uses a default LRU-like eviction policy.

> Prefetching hides the **latency for sequential edge accesses**, and early eviction **hides the write-back overhead behind the performance critical path.**

**Selective Transmission** (Sub-structure Level Memory Manipulation): Use program analysis to determine the parts in a data structure that are accessed in each program scope.

**Data Access Batching**: If our program analysis identifies multiple addresses to be accessed at different locations, we batch them into a single network message by transforming the code.

> [!NOTE]
>
> 我在前面提到了复用请求，这里就出现了这样的优化方法。

**Read/write Optimization**： A read-only or write-only access pattern can be leveraged to achieve better performance.

### Multi-Threading Support

* For programs that have no shared-memory writes, create separated cache sections for each thread.
* Use shared cache sections for writable shared-memory multi-threading. Full associative with cache line size being the largest access granularity among all accessing threads. Static analysis alone cannot determine whether a cache line could **be evicted by another thread before it is accessed by the current thread**. We **mark a cache line as "dont-evict" from a thread’s dereferencing time** (first access) until the end of the line’s lifetime in all threads. 

Traditional thread synchronization methods such as locks still work as is on Mira since we never make synchronization primitives remotable.

> [!note]
>
> **如果**把锁放到non-swap section里 —— 作为共享object，锁会被放在shared cache section里，不会产生传统锁在SMP环境下cache ping pong问题。

### Data Communication Methods

**Two methods for communication**:

* **One-sided communication**: data is directly read/written from/to far memory.
* **Two-sided communication**: data is sent as messages and far-memory nodes copy the messages to their final locations.

-----

**Policy**:

* **A section’s access pattern is reading/writing the entire data structure**: directly read/write.
* **A section only accesses partial data structure**: use two-sided communication.

> [!note]
>
> 为什么采取这样的策略？还是read/write amplification的问题。考虑far memory中的这个数据结构：
>
> ```c
> struct foo {
>   	int a [100];
>   	double b;
>   	int c [100];
> }
> ```
>
> 现在，我们在本地更新了`foo`，并且想要将更新写回far memoy。
>
> * 如果是更新整个`foo`，那么我们可以直接将`&foo`起始一大片内存空间直接写回（单向通信）。
> * 如果仅仅更新了`foo`中的几个字段，如`a[1], a[50], b, c[2]`，而我们非要采用单向通信，那么开销就非常巨大了——事实上，`foo`中绝大部分内容没有发生改变，如果硬要将这数百byte的数据写回，那么绝大多数的远程写操作都是无用功。因此，告诉远程memory node哪些字段需要更新才是更加划算的。

### Function Offloading

Certain types of far memory nodes have computation power that can execute application code.

**Key Qualifications for Functions to be Offloaded**:

* **Computation-light**: far-memory nodes have less computation power
* **High Frequency of Remote Accesses**

> [!note]
>
> 见本篇笔记开头所述问题。

## Implementation

### New MLIR Abstractions

Two new MLIR dialects for far memory: 

* `remotable`: data objects in non-swap cache sections and for functions that can be offloaded.
* `rmem`: operations to access and manipulate remotable objects and functions. **Load**, **store**, and **prefetching**.

```c
@_redges, @_rnodes = remotable.alloc(..)

remotable.func @trvs_graph_rmt(%arg0: !remotable<struct<edge>>) {
  scf.for %i = %0 to %num_edges { // scf is an MLIR dialect
    // dereference remote pointer to local pointer
    %1 = rmem.deref %arg0[%0]
    %2 = rmem.deref %1->from
    %3 = rmem.deref %1->to
    func.call @update_node (%1, %2, %3)
  }
}
```

### Static Analysis and Code Generation

**Objects**: The selected objects are changed to `remotable` objects and support `rmem` operations. Mira finds all pointers pointing to remotable objects via forward dataflow analysis and type-based alias analysis.

**Functions**: If a function only accesses remotable objects, stack variables, and heap variables allocated and released within the function scope, then we mark the function as remotable.

The analysis results are saved for later iterations.

----

**Implementing `remotable.alloc`**: 

* **A remote allocator** performs the actual memory allocation at far memory.
* **A local allocator** acquires allocated far-memory addresses from the remote allocator and buffers the addresses locally.

----

**Loading an `rmem` Pointer From Far Memory**

* Initially, a `rmem` pointer has the value of an allocated **far-memory address** for a remotable memory space.
* When an `rmem.load` happens, first check if the data the `rmem` points to has been fetched. If not, fetch it.
* For the next step of this case or for the cache-hit case, we **set the section ID and the offset of the object within the section** as the value of the `rmem` pointer. ***We have mentioned this procedure at the pointer dereferencing part.***

---

**Pointers to Both Local and `remotable` Objects**

A `rmem` pointer can also be set to point a local object. The dereferencing scheme for remote objects cannot be applied this scenario. Therefore, a dummy cache section 0 is introduced to indicate local variables.

----

**Generating Offloaded Function Binaries**

Everything this part is under my expectations, except that: to ensure that a `remotable` function sees the up-to-date remotable objects during its execution, we flush all cached remotable objects that the remotable function accesses to far-memory before calling the function.

> [!note]
>
> 这里隐含着一个条件：被offload的函数不能被频繁调用，否则会产生大量的cache miss和网络I/O。但是，不被频繁调用的函数还有必要offload吗？

---

**Behavior Analysis**:

For the performance-critical sections we identified, Mira performs a detailed analysis of memory operations, concerning the range of addresses that will be accessed in each section.

**Memory dependency analysis** together with **scalar evolution** for reasoning about memory accesses and their patterns within a code block.

**Possible optimizations based on the analysis**: batch multiple `rmem` pointer dereferences, prefetch optimization.

## Evaluation

When a far-memory device is slow, offloaded functions’ computation overhead can outweigh the benefit of offloading (i.e., reducing data communication). 

Mira automatically adjusts what functions to offload based on profiling and system environments. With the slow device setup, Mira only selects two offloading targets, both functions are data-access heavy reduce operators.

> [!note]
>
> 好吧，前面我怀疑了offload到底会不会有效果，这里看来确实有效果。但是，GPT和MCF是不是没做offload的实验？offload的效果在其他任务上也好吗？

