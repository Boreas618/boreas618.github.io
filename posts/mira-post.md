# Mira: A Progam-Behavior-Guided Far Memory System

<img src="https://p.ipic.vip/aj389r.png" alt="Screenshot 2024-02-15 at 3.34.25 PM" style="zoom: 33%;" />

::: tip Summary
The core of implementing a far memory system in this article is the design of the cache, with the main optimization goals being to increase the hit rate, reduce the miss rate, and use the cache to hide the latency of accessing remote data. Traditional caching schemes lack forward understanding of program semantics, making it difficult to support precise prefetching (imprecise prefetching mainly relies on temporal or spatial locality), low-overhead access, and safe release of resources, among other optimization operations. Mira achieves these highly semantic-related, fine-grained, and precise optimization operations at the IR and runtime levels, and does so transparently to the user, resulting in significant performance improvements.
:::

## Introduction

**Topic**: implementing far memory system

**Current Approaches**: 

* Transparently swap memory pages between local and far memory
* Use a new programming model or extend an existing one with new APIs for far-memory accesses

-----

**Drawbacks**:

* Coarse granularity of a 4 KB page, which is often larger (2.3× to 31×) than what is actually read/written by an application. 

::: tip Note
Is it possible to transparently exchange memory of size $2^k$ by referencing a slab? Furthermore, to prevent fine-grained memory swapping under high concurrency, an attempt can be made to mutiplex requests, where a single network request carries several memories to be swapped (this was an initial thought by myself, but it was later found that Mira also adopted the optimization of reusing requests). Subsequently, cache-line-based far memory systems are mentioned in the Related Works, which represent another approach to fine-grained memory swapping.
:::

* Non-trivial application-programmer or library-writer effort.

-----

**Proposed Approach**: Program-behavior-guided far-memory approach

1. **Compliers and Static Analysis**: behaviors like prefetching. A drawback of this approach is its inability to incorporate run-time information. 

2. **Run-time Profiling**: run-time information to help static analysis and compilation.

-----

**Opportunities**:

The key differenence between far memory and SRAM: **Cache for far memory is DRAM-based and can be controlled by software.**

::: tip Note
This means that, unlike SRAM which serves as a cache (cache between CPU - DRAM), we can customize the resident set through static analysis and runtime profiling.
:::

---

**Challenges**:

* Non-fixed cache. 

  **Solution**: Separate the local cache into spaces dedicated to and configured for different program behaviors. **For sequential accesses**, a small directly mapped cache with a cache line size of multiple consecutive data elements is used. **For accesses with good locality but large working sets**, a relatively large set-associative cache is used.

* [*Unique in a far-memory environment*] inefficient implementation of far-memory pointers and their dereferences will largely hurt application performance

  **Solution**: leveraging program behavior to turn as many dereferences into native memory loads as possible.

* [*Unique in a far-memory environment*] larger program scopes and more objects need to be potentially analyzed, as far-memory accesses are slower and local cache is larger than CPU cache.

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

Some functions are offloaded to far memory.

**Iterative (Sample-based input-adaptation approach)**: In one round, the compilation of a program is optimized for several iterations to generate a new compilation -> Use this compilation on the next invocation of the program.

::: tip Note
Here is an idea similar to gradient descent. Considering that the cost of each iteration is not high (only considering functions that “suffer the most”), the expense of multiple iterations becomes acceptable.
:::

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

::: tip Note
Is the length of the cache line **chosen from a limited number of hard-coded options** or **dynamically calculated based on the characteristics of different objects**? In other words, is there a detailed discussion on the degree of freedom in choosing the length of the cache line?
:::

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

::: tip Note
Explicit remote operations can more precisely control far-memory accesses and thereby improve application performance.
:::

The overhead for accessing the source of truth of the remote pointer can be mitigated by prefetching.

-----

Resolving a remote pointer:

* Looking up the pointer in the local cache.
* If not found in the cache, fetching the data from far memory to the local cache.
* The actual data access

However, if we have already accessed **a cache line** and **know that it is still in the local cache**, we would know its local memory address. By keeping the address, we would avoid the redundant looking up the pointer.

::: tip Note
This means the mapping of the pointer symbol to the address it points to is cached, simplifying pointer dereferencing to a memory load.
:::

**Knowing that it is still in the local cache**: 

* **Single-threaded**: through static analysis.
* When our analysis finds conflicting accesses or is unsure about the occurrence of conflict accesses, Mira can mark cache lines as “dont-evict” to indicate that evicting them would cause a huge overhead.

### Program Optimization

**Adaptive Prefetching**: 

* Instead of predicting future accesses based on run-time history, we use program analysis to determine what will be accessed in the future.

* Insert prefetch operations at the program location that is estimated to be one network round trip earlier than actual access.

----

**Eviction Hints**:

We can find the last access of a data element in a program scope which will be marked as "evictable". If there is no line marked as evictable, Mira uses a default LRU-like eviction policy.

Prefetching hides the **latency for sequential edge accesses**, and early eviction **hides the write-back overhead behind the performance critical path.**

----

**Selective Transmission**:

Use program analysis to determine the parts in a data structure that are accessed in each program scope.

> [!note]
>
> Similar ideas：![Screenshot 2024-02-21 at 12.56.17 PM](https://p.ipic.vip/k0khyh.png)

----

**Data Access Batching**:

If our program analysis identifies multiple addresses to be accessed at different locations, we batch them into a single network message by transforming the code.

---

**Read/write Optimization**：

A read-only or write-only access pattern can be leveraged to achieve better performance.

### Multi-Threading Support

* For programs that have no shared-memory writes, create separated cache sections for each thread.
* Use shared cache sections for writable shared-memory multi-threading. Full associative with cache line size being the largest access granularity among all accessing threads. Static analysis alone cannot determine whether a cache line could **be evicted by another thread before it is accessed by the current thread**. We **mark a cache line as "dont-evict" from a thread’s dereferencing time** (first access) until the end of the line’s lifetime in all threads. 

Traditional thread synchronization methods such as locks still work as is on Mira since we never make synchronization primitives remotable.

::: tip note
Placing the lock in the non-swap section should be fine — as a shared object, the lock would be placed in the shared cache section, avoiding the traditional ping pong problem of locks in an SMP environment. However, putting the lock in the swap section indeed seems to have little significance.
:::

### Data Communication Methods

**Two methods for communication**:

* **One-sided Communication**: data is directly read/written from/to far memory.
* **Two-sided Communication**: data is sent as messages and far-memory nodes copy the messages to their final locations.

-----

**Policy**:

* **A section’s access pattern is reading/writing the entire data structure**: directly read/write.
* **A section only accesses partial data structure**: use two-sided communication.

::: tip Notes
Why adopt this strategy? It's still the issue of read/write amplification. Consider this data structure in far memory:

```c
struct foo {
  int a [100];
  double b;
  int c [100];
}
```

Now, we have updated `foo` locally and want to write the update back to far memory.

* If the entire `foo` is updated, then we can directly write back a large piece of memory starting from `&foo` (One-sided communication).
* If only a few fields in `foo` are updated, such as `a[1], a[50], b, c[2]`, and we insist on using one-sided communication, then the overhead becomes enormous — in fact, the vast majority of the content in `foo` has not changed. If we force these hundreds of bytes of data to be written back, then most of the remote write operations are wasted effort. Therefore, it is more cost-effective to tell the remote memory node which fields need to be updated.
:::

### Function Offloading

Certain types of far memory nodes have computation power that can execute application code.

**Key Qualifications for Functions to be Offloaded**:

* **Computation-light**: far-memory nodes have less computation power
* **High Frequency of Remote Accesses**

## Implementation

### New MLIR Abstractions

Two new MLIR dialects for far memory: 

* `remotable`: Data objects in non-swap cache sections and for func- tions that can be offloaded.
* `rmem`: operations to access and manipulate remotable objects and functions. Load, store, and prefetching.

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

**Loading an `rmem` pointer from far memory**

* Initially, a `rmem` pointer has the value of an allocated **far-memory address** for a remotable memory space.
* When an `rmem.load` happens, first check if the data the `rmem` points to has been fetched. If not, fetch it.
* For the next step of this case or for the cache-hit case, we **set the section ID and the offset of the object within the section** as the value of the rmem pointer. ***We have mentioned this procedure at the pointer dereferencing part.***

---

**Pointers to both local and `remotable` objects**

A `rmem` pointer can also be set to point a local object. The dereferencing scheme for remote objects cannot be applied this scenario. Therefore, a dummy cache section 0 is introduced to indicate local variables.

----

**Generating offloaded function binaries**

Everything this part is under my expectations, except that: to ensure that a remotable function sees the up-to-date remotable objects during its execution, we flush all cached remotable objects that the remotable function accesses to far-memory before calling the function.

::: tip Notes
Here, there's an implicit condition: the function being offloaded should not be called frequently, as this would lead to a large number of cache misses and network I/O. But then, is it necessary to offload a function that is not called frequently?
:::

---

**Behavior Analysis**:

For the performance-critical sections we identified, Mira performs a detailed analysis of memory operations, concerning the range of addresses that will be accessed in each section.

**Memory dependency analysis** together with **scalar evolution** for reasoning about memory accesses and their patterns within a code block.

**Possible optimizations based on the analysis**: batch multiple `rmem` pointer dereferences, prefetch optimization.

## Evaluation

When a far-memory device is slow, offloaded functions’ computation overhead can outweigh the bene- fit of offloading (i.e., reducing data communication). 

Mira automatically adjusts what functions to offload based on profiling and system environments. With the slow device setup, Mira only selects two offloading targets, both functions are data-access heavy reduce operators.

::: tip Notes
Alright, previously I doubted whether offloading would actually be effective, but it seems here that it indeed has an effect. However, are the offloading experiments conducted on GPT and MCF? Can the performance reward of offloading be general?
:::
