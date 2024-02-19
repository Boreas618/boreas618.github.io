# Mira: A Progam-Behavior-Guided Far Memory System

<img src="https://p.ipic.vip/aj389r.png" alt="Screenshot 2024-02-15 at 3.34.25 PM" style="zoom: 33%;" />

## Introduction

**Topic**: implementing far memory system

**Current Approaches**: 

* Transparently swap memory pages between local and far memory
* Use a new programming model or extend an existing one with new APIs for far-memory accesses

**Drawbacks**:

* Coarse granularity of a 4 KB page, which is often larger (2.3× to 31×) than what is actually read/written by an application. 

  > [!NOTE]
  >
  > 是否可以参考slab，透明地交换大小为$2^k$的内存？进一步地，为了防止高并发的细粒度内存交换，可以尝试复用请求，一个网络请求携带数个待交换内存（这是读到这里的想法，后面发现Mira也采用了复用请求的优化）。后续在Related Works里面有提到cache-line-based far memory systems，也是一种细粒度内存交换的思路。

* Non-trivial application-programmer or library-writer effort.

-----

**Proposed Approach**: Program-behavior-guided far-memory approach

1. **Compliers and Static Analysis**: behaviors like prefetching. A drawback of this approach is its inability to incorporate run-time information. 

   > [!NOTE]
   >
   > 这里做的是程序语义理解的工作，目的是高效利用网络带宽。

2. **Run-time Profiling**: run-time information to help static analysis and compilation.

-----

**Opportunities**:

The key differenence between far memory and SRAM: **Cache for far memory is DRAM-based and can be controlled by software.**

> [!NOTE]
>
> 也就是说，与SRAM作为缓存不同，我们可以通过静态分析、运行时Profiling来**定制工作集**。

---

**Challenges**:

* Non-fixed cache. 

  > [!NOTE]
  >
  > 为什么说far memory的缓存架构是不固定的？我的理解是挑战在于如何利用DRAM作为缓存的灵活性。

  **Solution**: Separate the local cache into spaces dedicated to and configured for different program behaviors. **For sequential accesses**, a small directly mapped cache with a cache line size of multiple consecutive data elements is used. **For accesses with good locality but large working sets**, a relatively large set-associative cache is used.

* [Unique in a far-memory environment] inefficient implementation of far-memory pointers and their dereferences will largely hurt application performance

  **Solution**: leveraging program behavior to turn as many dereferences into native memory loads as possible.

* [Unique in a far-memory environment] larger program scopes and more objects need to be potentially analyzed, as far-memory accesses are slower and local cache is larger than CPU cache.

  **Solution**: performing **coarse-grained, cache-section-specific profiling** to narrow down program scopes and objects to those with the highest potential gain from further optimization.

----

**Mechanisms**: divide into different cache sections.

**Policies**: configure

* Cache section’s size
* Cache structure (set-/full-associative)
* Cache line size
* Prefetching and eviction patterns
* Communication method （one-/two-sided RDMA）

## Mira

**Input**: an unmodified program

**Output**: 

* A cache configuration based on the program’s behavior
* A compiled code that runs on far memory via the Mira run-time system.

----

**Workflow**:

* Initial execution works almost the same as traditional page swap-based systems, except for the **profiling code** inserted. (never use far memory for stack or code, as they are small and frequently accessed)
* **Profiling**: per-function miss rate, miss latency, hit overhead (i.e., the additional latency to access data in cache over a regular memory load), and function execution time. The object sizes are also collected.
* Finding the critical functions and placing larger objects in the functions in their own sections. The section parameters are determined by program analyses.

----

Mira converts memory operations like allocation, read, and write to remotable operations **at the IR level**, which then is lowered to either cache or network accesses.

> [!NOTE]
>
> The programmers don't bother to handle the local/far memory operations.

Some functions are offloaded  to far memory.

> [!NOTE]
>
> 前文提到了代码段不会offload到远程去，但这里function应该也属于代码段的范畴吧？

**Iterative (Sample-based input-adaptation approach)**: In one round, the compilation of a program is optimized for several iterations to generate a new compilation -> Use this compilation on the next invocation of the program.

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

* If the access pattern **is sequential or stride**, then we use a directly mapped cache, as there will be no conflict.

* Otherwise, analyze the locality set (i.e., the entries of data that need to live in the local cache at the same time) and addresses in the locality set.

  *If the locality set cannot be identified, then the section should be set fully associative.* 

### Determining Cache Section Size

Use sampling and profiling to determine section sizes.

Sequential and strided cache sections only need a small size that can fit enough prefetched data to hide network delay. 

For other cache sections, we sample a few section sizes as ratios of total local memory size (e.g., 20%, 40%, 60%, 80%).

### Conversion to Remote Code

Mira turns all pointers that point to selected objects (selected by the profiling process) in non-swap sections to remote pointers (defined in Mira’s IR).

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
* Insert prefetch operations at the program location that is estimated to be one network round trip earlier than actual access. (How?)

**Eviction Hints**:

* We can find the last access of a data element in a program scope which will be marked as "evictable". If there is no line marked as evictable, Mira uses a default LRU-like eviction policy.

**Selective Transmission**:

* Use program analysis to determine the parts in a data structure that are accessed in each program scope.

**Data Access Batching**:

* If our program analysis identifies multiple addresses to be accessed at different locations, we batch them into a single network message by transforming the code.

  > [!NOTE]
  >
  > 我在前面提到了复用请求，这里就出现了这样的优化方法。

**Read/write optimization**：

* A read-only or write-only access pattern can be leveraged to achieve better performance.

### Multi-Threading Support

* For programs that have no shared-memory writes, create separated cache sections for each thread.
* If multiple threads read the same data, each thread’s cache section will have a copy of it.
