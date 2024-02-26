# Clio: A Hardware-Software Co-Designed Disaggregated Memory System

**Memory disaggregation**: two separate **network-attached pools**, one with compute nodes (CNs) and one with memory nodes (MNs).

**Two MemDisagg Approaches**: MNs with/without computation power.

* **With Computation power**: cost of host server and performance and scalability limitations caused by the way NICs interact with the host server’s virtual memory system.
* **Without**: performance, security, and management problems.

## Proposed Approach

"***A sweet spot***" in the middle by proposing a hardware-based MemDisagg solution that has the right amount of processing power at MNs.

> **Scalability**
>
> * Multiple application processes running on different CNs can allocate memory from the same CBoard.
> * Each process having its own remote virtual memory address space, which can span multiple CBoards.

**Key Research Question**: limited hardware resources for 100 Gbps, microsecond-level average and tail latency for TBs of memory and thousands of concurrent clients?

---

**Main Idea**: eliminate state from the MN hardware.

* The MN can treat each of its incoming requests in isolation even if requests that the client issues can sometimes be inter-dependent.
* The MN hardware does not store metadata or deals with it.

**Advantages of No State Design**: the hardware pipeline does not stall. Constantly high throughput. Hardware processing does not need to wait for any slower metadata operations and thus has **bounded tail latency**. 

> [!note]
>
> 如果存储state，则随着运行时间和接入的CN的数量增长，MN的运行成本也会显著增长，不能很好scale。但是即使不需要等待元数据操作，CN client数量的增长会不会使MN的响应时延unbounded？

***But we cannot really eliminate state from MN hardware.*** Three reasons are explained in the paper, including synchronization problems, memory operations with metadata, per-process/client metadata. What we should do is to eliminate as much state as we can. For example, redesign the page table (accessing page table is a data operation and )

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

