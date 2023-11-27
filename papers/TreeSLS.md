![Screenshot 2023-11-23 at 11.49.41 PM](https://p.ipic.vip/r3ore3.png)

# Background

**Traditional Data Persistence**: Memory and disks are considered standalone components of computer systems. Applications handle the data exchange between memory and disks. **Drawback**: Crash consistency bugs and performance issues.

**Single-Level Store**: Memory and disks are considered as a whole **from the perspective of applications**. The operating system takes the responsibility for data persistence, which is transparent to applications through **checkpointing**. 

**Drawback of SLS**: 

1. Performance 

   **Mechanism**: Checkpointing ([Lab 6 of OS(H) @ Fudan University](https://github.com/Boreas618/OS-Honor-23Fall/tree/lab6))

   **Reality**: There is a huge difference between memory and disks in terms of speed, volatility, and access granularity.

   **Consequence**: Low performance and risk of data loss (The low speed implies that we cannot checkpoint frequently - can only be taken at minute-level intervals).

2. External synchrony issue

   **Handling the API of SLS for external synchrony is non-trivial**. (e.g. `cache_sync` in [Lab 6 of OS(H) @ Fudan University](https://github.com/Boreas618/OS-Honor-23Fall/tree/lab6))

**Opportunities: The emergence of fast, byte-addressable non-volatile memory (NVM)**: Storage-like durability and DRAM-like **byte-addressability (Core)** and access performance. This makes it possible to perform fast and direct manipulation of persistent data (i.e., without the need for checkpointing).

**Is NVM perfect?**: CPU and device registers can still be lost upon power failures. Therefore, checkpointing is still necessary.

**Research question**:

<center><h3>Data Persistence (Checkpointing) in SLS on NVM</h3></center>

**Challenges**:

* **The management of  the relation between runtime memory and storage**: An SLS on NVM can leverage the single-level device (i.e., NVM) as both runtime memory and storage.

* **Transparent external synchrony**.

  > **Question**: Can NVM be used as a disk, as in traditional computer systems? If so, what is the "external" towards NVM?

# Implementation

Two design issues:

* How to efficiently capture the whole-system state? **Exploiting the capability tree.**
* How to efficiently checkpoint the whole-system state? **Exploiting the checkpoint manager.**

# Capability Tree

> **Capability Tree**
>
> In capacity-based systems, resources are represented by **object**s and a capability is **an object reference with a set of access rights**. 
>
> Capability-based systems usually group all types of capabilities into a capability derivation tree. Processes can access a certain subset of the tree.
>
> <img src="https://p.ipic.vip/4g3kv1.png" alt="Screenshot 2023-11-27 at 1.51.21 AM" style="zoom: 33%;" />
>
> Check out the post on **capacity-based systems** here: https://www2.seas.gwu.edu/~parmer/posts/2016-10-31-capability-based-systems.html
>
> Check out a capability-based microkernel OS *composite os* here: https://github.com/gwsystems/composite

**Why capability tree?**

* Captures all states of the system (**Explanation**: group all resources of the system in a tree).

* Checkpointing a tree structure is simpler and more straightforward than building SLS on monolithic kernels

  > **Example:** checkpointing fs on monolithic kernels and microkernels.
  >
  > **Monolithic kernels**: FD tables, dentry-cache, and inode-cache and relations between those structures
  >
  > **Micro kernels**: just the runtime data of applications.

  **Thoughts**: The File Descriptor (FD) tables, dentry-cache, and inode-cache are integrated within the kernel's address space, sharing space with all other components like schedulers, physical memory allocator, etc. However, checkpointing the kernel's entire state is expensive. To enable cost-effective and fine-grained checkpointing, it is essential to understand "FD tables, dentry-cache, and inode-cache and relations between those structures", which is still very cubersome. In contrast, when dealing with a standalone filesystem component, checkpointing can be straightforwardly achieved by capturing its runtime data, without the need to delve into its internal structure.

* Incremental checkpointing. Intact?  no need to checkpoint.

**Question**: I think the philosophy here is that **all resources** are **packed** neatly here. Therefore, the gap between different subsystems is here is clear. Maybe it's not because the tree structure is good. It's because the micro kernels architecture makes sense.

**How each kind of object is checkpointed to the backup capability tree?**

* Small-sized and frequently updated objects (e.g., Thread) are directly copied 
* Large-sized and slowly changing objects (i.e., memory pages) are asynchronously copied (?) during runtime. 
* Objects that can be rebuilt (e.g., page tables) are not included in the checkpoint, which trades restore time for faster checkpointing.

> **Implementation Detail**: capability object root (ORoot) 
>
> For every **unique** object, TreeSLS mantains a ORoot structure to avoid redunant checkpointing. This is because an object can be shared by multiple cap groups. I guess that the ORoots hold pointers to the tree nodes and the tree nodes hold pointers to ORoots.

**Checkpointing VM Space and Page Tables**: the VM space consists of a list of virtual memory regions. We backup the virtual memory regions. The page tables are stored in DRAM and are dropped in case of failures. On recovery, we leverage the virtual memory regions to reconstruct the page table.

**Checkpointing Physical Memory objects**: to checkpoint a PMO, TreeSLS duplicates the radix tree to the backup capability tree. The pages are marked read-only initially. Once the page is modified, the page fault handler duplicates the page and updates the pointer in the backup radix tree. Note that we only store pointers in the radix tree as the runtime pages on NVM can be used after power failures. (**Question**: what about the pages in DRAM?)

