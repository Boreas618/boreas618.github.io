# Clio: A Hardware-Software Co-Designed Disaggregated Memory System

**Memory disaggregation**: two separate **network-attached pools**, one with compute nodes (CNs) and one with memory nodes (MNs).

**Two MemDisagg Approaches**: MNs with/o computation power.

* **With Computation power**: cost of host server and performance and scalability limitations caused by the way NICs interact with the host server’s virtual memory system.
* **Without**: performance, security, and management problems.

----

**Proposed**: "***a sweet spot***" in the middle by proposing a hardware-based MemDisagg solution that has the right amount of processing power at MNs.

> **Scalability**:
>
> * Multiple application processes running on different CNs can allocate memory from the same CBoard.
> * Each process having its own remote virtual memory address space, which can span multiple CBoards.

**Key Research Question**: limited hardware resources for 100 Gbps, microsecond-level average and tail latency for TBs of memory and thousands of concurrent clients?

**Main Idea**: eliminate state from the MN hardware.

* The MN can treat each of its incoming requests in isolation even if requests that the client issues can sometimes be inter-dependent.
* The MN hardware does not store metadata or deals with it.

**Advantages of No State Design**: the hardware pipeline does not stall. Constantly high throughput. Hardware processing does not need to wait for any slower metadata operations and thus has **bounded tail latency**.

> [!note]
>
> 如果存储state，则随着运行时间和接入的CN的数量增长，MN的运行成本也会显著增长，不能很好scale。但是即使不需要等待元数据操作，CN client数量的增长会不会使MN的响应时延unbounded？

***But we cannot really eliminate state from MN hardware.*** Three reasons are explained in the paper, including synchronization problems, memory operations with metadata, per-process/client metadata.

**Approach 1: separate the metadata/control plane and the data plane**. The former running as software on a low-power ARM-based SoC at MN and the latter in hardware at MN.

> * Metadata operations like memory allocation usually need more memory but are rarer (thus not as performance critical).
> * Data operations (i.e., all memory accesses) should be fast and are best handled purely in hardware.

> [!note]
>
> 这里在MN运行metadata operations的idea和Mira中function offload有点像，在远端MN的低功耗ARM-based SoC运行的函数要满足：调用频次低、大量访问远端内存。与Mira不同的是，Clio利用硬件加速数据操作，Mira主要通过缓存加速数据操作。

**Approach 2: re-design the memory and networking data plane so that most state can be managed only at the CN side.** MN never initiates requests. Therefore, the transport-layer services at MNs can be simplified. New transport protocol manages request IDs, transport logic, retransmission buffer, congestion, and incast control all at CNs.

> [!Note]
>
> 读到这里的问题：Clio应该需要在CN端实现多个CN间的通信、同步机制。