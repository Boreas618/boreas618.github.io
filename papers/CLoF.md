<center><img src="https://p.ipic.vip/pceykm.png" alt="Screenshot 2023-11-29 at 10.27.59 PM" style="zoom:50%;" /></center>

## Background

**NUMA**: **N**on-**U**niform Memory Access. CPUs are organized into clusters known as NUMA nodes, which are further grouped into packages.

<center><img src="https://d3i71xaburhd42.cloudfront.net/9bd0f0527d8d2f751c622ec14388017224f4810b/1-Figure1-1.png" alt="High performance locks for multi-level NUMA systems | Semantic Scholar" style="zoom:50%;" /></center>

Efficient locking mechanism for such systems (many core & NUMA) is important for the scalability and performance of multi-threaded applications.

**Challenges**: Nature of NUMA architecture.

> Example: a wide spectrum of memory-access latencies depending on the local of data on memory. What if an object is on the main memory of another NUMA node?

**Requirements for locks on multi-level NUMA systems**:

* **Multi-level**: locks should support not only NUMA nodes, but also packages, cache levels, and cache coloring/tagging policies.
* **Heterogeneity**: contention characteristics of each level of multi-level is different.
* **Architecture-optimized**:  different architectures allow for different optimizations - differnt algorithms for different architectures.
* **Correctness**: weak memory models (WMMs) on Armv8 - aggressive reorderings of memory accesses to improve performance - carefully use memory barriers to enforce the necessary order, which is error-prone.

**Idea of CLoF**: Given a set of simple, NUMA-oblivious spinlocks verified on WMMs, CLoF generates hundreds of heterogeneous, multi-level NUMA-aware spinlocks (i.e., CLoF locks) for a target platform.

**Contributions**: 

* A technique to capture the multiple levels of the memory hierarchy.
* Two techniques to derive the lock generator: syntactic recursive generator and context abstraction.
* A correctness argument for CLoF.
* An approach to select the best generated lock.

## Existing Works

### NUMA-oblivious Spinlocks

* **Ticketlock**: a spinlock consisting of two fields: `ticket` and `grant`. To acquire the lock, a thread atomically increments the `ticket` and waits for `grant` to equal its ticket value.

  > **Advantage**: fair
  >
  > **Disadvantage**: all threads spin on a single memory location (the `grant` field) which is not good to many core systems. (**Global-spinning**)

* **MCS lock**: a popular **local-spinning** lock. Each thread has its own node. To acquire the lock, a thread appends its node to the tail of a global queue. The head of the queue is the lock owner, while the other threads wait on memory locations of their own nodes. On release, the owner updates the node of its successor to pass the lock.
* **CLH lock**: (as the big kernel lock in the seL4 microkernel) creates an indirect list where a thread spins on the node of its predecessor. On release, the owner writes a message on its own node and takes its predecessor’s node along for subsequent lock acquisitions.
* **Hemlock**: similar to CLH lock and employs a Coherence-Traffic Reduction (CTR) technique specific to the x86 architecture.

All of the above locks are NUMA-oblivious and do not scale well beyond one NUMA node.

### NUMA-aware Locks

In NUMA-aware locks, instead of releasing the lock in a strict FIFO order, the lock owner may prefer passing the lock to a thread whose core is in its NUMA node. This approach reduces cache misses of the cache misses of the data accessed inside the critical section.

> **Example**: CNA lock is a modified MCS lock, in which the lock owner scans the MCS queue and reorders the waiting threads such that the lock is passed first to the threads from the same NUMA node.

**Shortcomings**: most NUMA-aware locks only support 2-level NUMA hierarchies: system level and NUMA-node level.

**HMCS lock**: a multi-level NUMA-aware lock, which creates a tree of MCS locks mirroring the configured hierarchy.

> On an x86 platform with hyperthreading, the authors of HMCS lock suggest a hierarchy of system level, NUMA-node level, and core level (i.e., hyperthread pairs). To enter the critical section, the thread needs to acquire the ownership of the locks on its path from the leaf till the root (system level), e.g., core, NUMA node, and system. To exploit locality, the lock is passed to the waiting thread, which shares most levels (e.g., in the same core or in the same NUMA node), as long as the threshold at that level is not reached.

### Heterogeneous NUMA-aware Locks

**HMCS lock**: each level contains a set of MCS locks.

**Lock Cohorting**: a technique that allows combining different NUMA-oblivious locks in a 2-level hierarchy.

Locks created with a hierarchy of different locks are **level-heterogeneous**, whereas locks created with a hierarchy of identical locks are **level-homogeneous**. Therefore, **HMCS** lock is level-homogeneous.