# Clio: A Hardware-Software Co-Designed Disaggregated Memory System

**Memory disaggregation**: two separate **network-attached pools**, one with compute nodes (CNs) and one with memory nodes (MNs).

**Two memDisagg approaches**: MNs with/without computation power.

* **With computation power**: cost of host server and performance and scalability limitations caused by the way NICs interact with the host server’s virtual memory system.
* **Without**: performance, security, and management problems.

## Proposed Approach

"***A sweet spot***" in the middle by proposing a hardware-based MemDisagg solution that has the right amount of processing power at MNs.

> **Scalability**
>
> * Multiple application processes running on different CNs can allocate memory from the same CBoard.
> * Each process having its own remote virtual memory address space, which can span multiple CBoards.

**Key research question**: limited hardware resources for 100 Gbps, microsecond-level average and tail latency for TBs of memory and thousands of concurrent clients?

---

**Main idea**: eliminate state from the MN hardware.

* The MN can treat each of its incoming requests in isolation even if requests that the client issues can sometimes be inter-dependent.
* The MN hardware does not store metadata or deals with it.

**Advantages of no state design**: the hardware pipeline does not stall. Constantly high throughput. Hardware processing does not need to wait for any slower metadata operations and thus has **bounded tail latency**. 

> [!note]
>
> 如果存储state，则随着运行时间和接入的CN的数量增长，MN的运行成本也会显著增长，不能很好scale。

***But we cannot really eliminate state from MN hardware.*** Three reasons are explained in the paper, including synchronization problems, memory operations with metadata, per-process/client metadata. What we should do is to eliminate as much state as we can. For example, redesign the page table (accessing page table is a data operation and can be implemented with hardware)

---

**Approach 1: separate the metadata/control plane and the data plane**. The former running as software on a low-power ARM-based SoC at MN and the latter in hardware at MN.

> * Metadata operations like memory allocation usually need more memory but are rarer (thus not as performance critical).
> * Data operations (i.e., all memory accesses) should be fast and are best handled purely in hardware.

> [!note]
>
> 这里在MN运行metadata operations的idea和Mira中function offload有点像，在远端MN的低功耗ARM-based SoC运行的函数要满足：调用频次低、大量访问远端内存。与Mira不同的是，Clio利用硬件加速数据操作，Mira主要通过缓存加速数据操作。

**Approach 2: re-design the memory and networking data plane so that most state can be managed only at the CN side.** MN never initiates requests. Therefore, the transport-layer services at MNs can be simplified. New transport protocol manages request IDs, transport logic, retransmission buffer, congestion, and incast control all at CNs.

## Goals & Related Works

* **Hosting large amounts of memory with high utilization**: each MN should host hundreds GBs to a few TBs of memory.
* **Supporting a huge number of concurrent clients**: allow many (e.g., thousands of) client processes running on tens of CNs to access and share an MN.
* **Low-latency and high-throughput**: match the state-of-the-art network speed, i.e., **100 Gbps** throughput (for bigger requests) and **sub-2 𝜇𝑠** median end-to-end latency (for smaller requests).

* **Low tail latency**: long tails like RDMA’s 16.8𝑚𝑠 remote memory access can be detrimental.
* **Protected memory accesses**.
* **Low cost**: CapEx and OpEx costs.
* **Flexible**

### Server-Based Disaggregated Memory

**Problems with RDMA**: scalability and tail-latency.

> * A process ($P_M$ ) running at an MN allocate memory in its virtual memory address space.
> * $P_M$​ register the allocated memory (called a memory region, or **MR**) with the RDMA NIC (RNIC).
> * The host OS and MMU set up and manage the page table that maps $P_M$ ’s virtual addresses to physical memory addresses.
> * To avoid always accessing host memory for address mapping, RNICs cache page table entries (PTEs)
>
> PTEs and MRs are cached in the RNIC. RDMA has serious performance (scalability) issues with either large memory (PTEs) or many disjoint memory regions (MRs).

### Physical Disaggregated Memory

Treat the memory node as raw, physical memory, a model we call **PDM**. To prevent applications from accessing raw physical memory, add an indirection layer at CNs in hardware or software to map client process VAs or keys to MN PAs.

* CNs need multiple network round trips to access an MN for complex operations.
* Require the client side to manage disaggregated memory.
* Security.

## Clio Overview

<img src="https://p.ipic.vip/6gx0fp.png" alt="Screenshot 2024-02-26 at 9.37.02 PM" style="zoom:50%;" />

A non-transparent interface where applications (running at CNs) allocate and access disaggregated memory via explicit API calls. By design, Clio’s APIs can also be called by a runtime to support a transparent interface and allow the use of unmodified user applications.

> [!Note]
>
> 所以这里看到Clio和Mira的传承性，Mira的工作可以省去explicit API calls，通过MLIR和runtime协同运作来透明地处理远程内存操作。

*(Context matter)* Apart from the regular virtual memory address space, each process has a separate Remote virtual memory Address Space (RAS).

*(Context matter)* Each application process has a unique global PID across all CNs which is assigned by Clio when the application starts.

**Asynchronous APIs**: non-blocking

* A calling thread proceeds after calling an asynchronous API and later calls `rpoll` to get the result.
* Asynchronous APIs follow a release order.

Ensure consistency between metadata and data operations, by ensuring that potentially conflicting operations execute synchronously in the program order.

**Clio threads and processes can share data even when they are not on the same CN.** Clio does not enforce cache coherence automatically and lets applications choose their own coherence protocols.

> [!Note]
>
> 这里应该指的是ping pong问题吧？虽然说在传统SRAM-based cache的环境下，ping pong问题的讨论和解决方案是不少的，但是在disaggregated的硬件环境中是不是有特殊的问题？稍后需要文献调研一下。

**Roles**:

* CNs are regular servers each equipped with a regular Ethernet NIC and connected to a top-of-rack (ToR) switch.
* MNs are our customized devices directly connected to a ToR switch.
* Applications run at CNs on top of the user-space library called CLib, which is in charge of request ordering, request retry, congestion, and incast control.

**Components of MNs**:

* An ASIC which runs the hardware logic for all data accesses (we call it the fast path and prototyped it with FPGA)
* An ARM processor which runs software for handling metadata and control operations (i.e., the slow path)
* An FPGA which hosts application computation offloading (i.e., the extend path).

An incoming request arrives at the ASIC and travels through standard Ethernet physical and MAC layers and a Match-and-Action-Table (MAT) that decides which of the three paths the request should go to based on the request type.

## Clio Design

**Principles**:

* **Avoid state whenever possible**: get rid of RDMA’s MR indirection and its metadata altogether by directly mapping application process’ RAS VAs to PAs (instead of to MRs then to PAs).

* **Moving non-critical operations and state to software and making the hardware fast path deterministic**: If an operation is non-critical and it involves complex processing logic and/or metadata, our idea is to move it to the software slow path running in an ARM processor.

  > VA allocation is expected to be a rare because in Clio the application can percept the existence of MNs and may avoid remote accesses as much as possible.

* **Shifting functionalities and state to CNs**: shift functionalities to CNs when 1) largely reducing hardware resource consumption at MNs, 2) not slowing down common-case foreground data operations, 3) not sacrificing security guarantees 4) adding bounded memory space and CPU cycle overheads to CNs.
* **Making off-chip data structures efficient and scalable**: a part of states are stored off-chip and we need to build cache for the off-chip states to ensure a bounded latency regardless of the number of client processes for cache-misses.
* **Making the hardware fast path smooth by treating each data unit independently at MN**: make each data unit independent by including all the information needed to process a unit in it and by allowing MNs to execute data units in any order that they arrive.

### Overflow-free Hash-based Page Table 

The radix-tree-style, per-address space page table design cannot be used in MemDisagg:

* Too many clients, too many page tables.
* Too many clients, too many TLB misses, too many DRAM pagetable lookups.

> The TLB size in an MN will be similar or even smaller than a single server’s TLB (for cost concerns). A multi-level page table design requires multiple DRAM accesses when there is a translation lookaside buffer (TLB) miss since the working set is very large given the vast number of memory accesses from clients.
>
> Each DRAM access is more costly for systems like RDMA NIC which has to cross the PCIe bus to access the page table in main memory.

**Proposed**: a new overflow-free hash-based page table design that sets the total page table size according to the physical memory size and bounds address translation to at most one DRAM access.

* All page table entries (PTEs) from all processes in a single hash table whose size is proportional to the physical memory size of an MN. The VAs and PIDs are hashed.
* The location of this page table is fixed in the off-chip DRAM and is known by the fast path address translation unit, thus avoiding any lookups.
* As we anticipate applications to **allocate big chunks of VAs in their RAS**, we use huge pages and support a configurable set of page sizes. With the default 4 MB page size, the hash table consumes only 0.4% of the physical memory.
* **Avoid hash overflows at VA allocation time**: software maintains per-process VA allocation trees and find the suitable VA range that won't cause hash overflow.

**Trade off**: potential retry overhead at allocation time (at the slow path) vs. better run-time performance and simpler hardware design (at the fast path).

The retry overhead is manageable because:

* Each retry takes only a few microseconds with our implementation.
* Huge pages, which means fewer pages need to be allocated. 
* Choose a hash function that has very low collision rate.
* Set the page table to have extra slots (2× by default) which absorbs most overflows.

> [!note]
>
> 我读到这里之前也很好奇为什么retry overhead为啥能管控住，我猜想作者可能会基于定量分析的结果给出解释。但同时这里给出两点基于实现中特殊优化的理由（3，4）和一点定性理由（2，这个是我没想到的）。

**TLB**: TLB in a fix-sized on-chip memory area. On a TLB miss, the fast path fetches the PTE from off-chip memory and inserts it to the TLB by replacing an existing TLB entry with the LRU policy.

**Downside**: It cannot **guarantee that** a specific VA can be inserted into the page table. Currently, Clio finds a new VA range if the user-specified range cannot be inserted into the page table.

> [!Note]
>
> 能不能引入命名空间的概念，以VA、PID、NS来构建hash table？（这是一个非常初步的想法。）

### Low-Tail-Latency Page Fault Handling

Many existing far-memory systems allocate a big chunk of remote memory and then use different parts of it for smaller objects to avoid frequently triggering the slow remote allocation operation.

**Proposed**: handle page faults in hardware and with bounded latency (constant three cycles).

**Challenge**: fast-path waits for slow-path to allocate physical memory.

**Proposed**: an asynchronous design to shift PA allocation off the performance-critical path.

Maintain a set of free physical page numbers in an async buffer, which the ARM continuously fulfills by finding free physical page addresses and reserving them without actually using the pages.  After getting a PA from the async buffer and establishing a valid PTE, the page fault handler performs three tasks in parallel: writing the PTE to the off-chip page table, inserting the PTE to the TLB, and continuing the original faulting request.

> [!note]
>
> 这里有一种类似线程池的思想。问题：物理内存分配为啥采用lazy allocation？既然我们的`ralloc`接口已经暴露给了用户，用户调用该接口分配物理内存，接下来势必要使用这段内存（如果不使用，那么为何要分配呢？我暂时没有想到有什么场景是分配但不使用的），何必要等到触发page fault再来分配呢？（虽然说，处理page fault的成本总体可控。）

### Asymmetric Network Tailored for MemDisagg

**Proposed**: 

* Maintain transport logic, state, and data buffers only at CNs, essentially making MNs "transportless".
* Relax the reliability of the transport and instead enforce ordering and loss recovery at the memory request level.

CLib bypasses the kernel to directly issue raw Ethernet requests to an Ethernet NIC. MNs include only standard Ethernet physical, link, and network layers and a slim layer for handling corner-case requests.

**Removing connections with request-response semantics**: Applications running at CNs directly initiate Clio APIs to an MN without any connections.

* CLib assigns a unique request ID to each request.
* The MN attaches the same request ID when sending the response back.
* CLib uses responses as ACKs and matches a response with an outstanding request using the request ID.

**Lifting reliability to the memory request level**: 

* CLib retries the entire memory request if any packet is lost or corrupted in the sending or the receiving direction.
* On the receiving path, MN’s network stack only checks a packet’s integrity at the link layer. If a packet is corrupted, the MN immediately sends a NACK to the sender CN.
* CLib retries a memory request if one of three situations happens: a NACK is received, the response from MN is corrupted, or no response is received within a TIMEOUT period. 

**CN-managed congestion and incast control**: 

* CLib adopts a simple delay-based, reactive policy that uses end-to-end RTT delay as the congestion signal.
* Each CN maintains one congestion window, cwnd, per MN that controls the maximum number of outstanding requests that can be made to the MN from this CN.  The size of the congestion window can be adjusted.
* Each CLib maintains one incast window, iwnd, which controls the maximum bytes of expected responses (the size of the responses can be calculated). CLib sends a request only when both cwnd and iwnd have room.
* To have CNs handle incast to MNs, we draw inspiration from Swift by allowing cwnd to fall below one packet (0.1 means a packet within 10 RTTs) when long delay is observed at a CN. 

### Request Ordering and Data Consistency

**Proposed**:

* Using CNs to ensure that no two concurrently outstanding requests are dependent on each other.
* Using MNs to ensure that every user request is only executed once even in the event of retries.

**Deal with packet reordering only at CNs in CLib**: CLib splits a request that is bigger than link-layer maximum transmission unit (MTU) into several link-layer packets and attaches a Clio header to each packet, which includes sender-receiver addresses, a request ID, and request type. This enables the MN to treat each packet independently. **Only write requests will be bigger than MTU, and the order of data writing within a write request does not affect correctness as long as proper inter-request ordering is followed.**

**Enforcing intra-thread inter-request ordering at CN**:

* Since only one synchronous request can be outstanding in a thread, there cannot be any inter-request reordering problem.

> [!note]
>
> 注意这里的inter-request ordering问题是在intra-thread尺度上的，而inter-thread的inter-request ordering需要借助Clio提供的同步原语解决。

* There can be multiple outstanding asynchronous requests. Our provided consistency level disallows concurrent asynchronous requests that are dependent on each other (WAW, RAW, or WAR). In addition, all requests must complete before `rrelease`.

> [!Note]
>
> 大量网络传输的控制逻辑交由CN端Clib实现，Clib的网络操作overhead需要评估。

CLib keeps track of all inflight requests and matches every new request’s virtual page number (VPN) to the inflight ones’. If a WAR, RAW, or WAW dependency is detected, CLib blocks the new request until the conflicting request finishes.

**Inter-thread/process consistency**: implement all synchronization primitives like `rlock` and `rfence` at MN, because they need to work across threads and processes that possibly reside on different CNs. (one of the only two cases where MN needs to maintain state.)

> [!note]
>
> MN维护并发原语的状态的开销是可以接受的，因为（1）critical section不多（2）critical section不长。在critical section逻辑非常简单的情况下，锁还是比较fancy的（比如我们在使用`pthread_cond`时也会带一个mutex，但是mutex保护的区域很短，所以开销很少。）

**Handling retries**:

* CLib attaches a new request ID to each retry, making it a new request with its own matching response.
* Per CLib’s ordering enforcement, there is only one outstanding request (or a retry) at any time.
* A small buffer at MN to record the request IDs of recently executed writes and atomic APIs and the results of the atomic APIs.
* A retry attaches its own request ID and the ID of the failed request. If MN finds a match of the latter in the buffer, it will not execute the request and send the cached result as the response.

Size of the buffer: $3×\text{TIMEOUT}×\text{bandwidth}$，which is 30 KB in our setting. One of the only two types of state MN maintains and does not affect the scalability of MN (static and rather small). With this size, the MN can łrememberž an operation long enough for two retries from the CN. Only when both retries and the original request all fail, the MN will fail to properly handle a future retry.

### Extension and Offloading Support

Extend the core MN to support application computation offloading in the extend path. Users can write and deploy application offloads both in FPGA and in software (run in the ARM).

### Distributed MNs

LegoOS’ two-level distributed virtual memory management approach:

* A global controller manages RASs in coarse granularity (assigning 1 GB virtual memory regions to different MNs). 
* Each MN then manages the assigned regions at fine granularity.

**Difference with Lego OS**: in Clio, each MN can be over-committed, and when an MN is under memory pressure, it migrates data to another MN that is less pressured (coordinated by the global controller).  Instead of swapping, we proactively migrate a rarely accessed memory region to another MN when an MN is under memory pressure (its free physical memory space is below a threshold).

## Clio Implementation

The ARM’s access to **on-board DRAM** is much slower than the FPGA’s access because the ARM has to first physically cross the FPGA then to the DRAM.

To mitigate the problem of slow accesses to on-board DRAM from ARM, we maintain **shadow copies of metadata at ARM’s local DRAM.**

## Evaluation

**Scalability**: the latency of Clio and RDMA as (1) the number of client processes (2) the number of PTEs and memory regions increases.

**Latency variation**: the latency of reading/writing 16 B data when the operation results in a TLB hit, a TLB miss, a first-access page fault, and MR miss.

**Read/write throughput**: Clio’s throughput by varying the number of concurrent client threads.

**Allocation performance**: Clio’s VA and PA alloca- tion and RDMA’s MR registration performance.
