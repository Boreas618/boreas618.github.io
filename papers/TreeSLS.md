![Screenshot 2023-11-23 at 11.49.41 PM](https://p.ipic.vip/r3ore3.png)

## Background

**Traditional Data Persistence**: Memory and disks are considered standalone components of computer systems. Applications handle the data exchange between memory and disks. **Drawback**: Crash consistency bugs and performance issues.

**Single-Level Store**: Memory and disks are considered as a whole **from the perspective of applications**. The operating system takes the responsibility for data persistence, which is transparent to applications through **checkpointing**. 

**Drawback of SLS**: 

1. Performance 

   **Mechanism for Data Persistance**: Checkpointing ([Lab 6 of OS(H) @ Fudan University](https://github.com/Boreas618/OS-Honor-23Fall/tree/lab6))

   **Reality**: There is a huge difference between memory and disks in terms of speed, volatility, and access granularity.

   **Consequence**: Low performance and risk of data loss (The low speed implies that we cannot checkpoint frequently - can only be taken at minute-level intervals).

2. External synchrony issue

   **Handling the API of SLS for external synchrony is non-trivial**.

**Opportunities: The emergence of fast, byte-addressable non-volatile memory (NVM)**: Storage-like durability and DRAM-like **byte-addressability (Core feature, which indicates that we can use NVM as (part of) main memory)** and access performance. This makes it possible to perform fast and direct manipulation of persistent data (i.e., without the need for checkpointing).

**Is NVM perfect?**: CPU and device registers can still be lost upon power failures. Therefore, checkpointing is still necessary.

**Research question**:

<center><h3>Data Persistence (Checkpointing) in SLS on NVM</h3></center>

**Challenges**:

* **The management of  the relation between runtime memory and storage**: An SLS on NVM can leverage NVM as both runtime memory and storage.
* **Transparent external synchrony**. For example, in a database server, we need to first update the database and then send the response to the client.

## Implementation

Two design issues:

* How to efficiently capture the whole-system state? **Exploiting the capability tree.**
* How to efficiently checkpoint the whole-system state? **Exploiting the checkpoint manager.**

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

* It captures all states of the system (**Explanation**: group all resources of the system in a tree).

* Checkpointing a tree structure is simpler and more straightforward than building SLS on monolithic kernels

  > **Example:** checkpointing fs on monolithic kernels and microkernels.
  >
  > **Monolithic kernels**: FD tables, dentry-cache, and inode-cache and relations between those structures
  >
  > **Micro kernels**: just the runtime data of applications.

  **My Thoughts**: The File Descriptor (FD) tables, dentry-cache, and inode-cache are integrated within the kernel's address space, sharing space with all other components like schedulers, physical memory allocator, etc. However, checkpointing the kernel's entire state is expensive. To enable cost-effective and fine-grained checkpointing, it is essential to understand FD tables, dentry-cache, and inode-cache and relations between those structures, which is still very cubersome. In contrast, when dealing with a standalone filesystem component, checkpointing can be straightforwardly achieved by capturing its runtime data, without the need to delve into its internal structure.

* Incremental checkpointing. Intact?  then no need to checkpoint.

**My Thoughts**: I think the philosophy here is that **all resources** are **packed** neatly here. In other words, the micro kernel system holds great modularity. Therefore, the gap between different subsystems is here is clear. Maybe it's not because the tree structure is good. It's because the micro kernels architecture makes sense.

**How each kind of object is checkpointed to the backup capability tree?**

* Small-sized and frequently updated objects (e.g., Thread) are directly copied 
* Large-sized and slowly changing objects (e.g., memory pages) are asynchronously copied (e.g., copy-on-write) during runtime. 
* Objects that can be rebuilt (e.g., page tables) are not included in the checkpoint, which trades restore time for faster checkpointing.

> **Implementation Detail**: capability object root (ORoot) 
>
> For every **unique** object, TreeSLS mantains a ORoot structure to avoid redunant checkpointing. This is because an object can be shared by multiple cap groups. I guess that the ORoots hold pointers to the tree nodes and the tree nodes hold pointers to ORoots.

**Checkpointing VM Space and Page Tables**: the VM space consists of a list of virtual memory regions. We backup the virtual memory regions. The page tables are stored in DRAM and are dropped in case of failures. On recovery, we leverage the virtual memory regions to reconstruct the page table.

**Checkpointing Physical Memory Objects (Important)**: TreeSLS duplicates the radix tree to the backup capability tree to checkpoint a PMO. The pages (on NVM, which are used as runtime memory. Pages on DRAM have some other mechanisms) are marked read-only initially. Once the page is modified, the page fault handler **duplicates the page** (on NVM) and updates the pointer in the backup radix tree. Therefore, we only keep one checkpoint of the modified page on NVM, which saves the memory.

**Methods to Copy Pages**:

* **Stop-and-copy**: copy all the modified pages to the backup in the stop-the-world checkpointing.
* **Copy-on-write**: during the checkpointing time, not to copy the page to backup. Only mark the page to be read-only; When the page is gonna to be modified, the page fault handler copies the page to backup.

**Mechanism: Hybrid Copy (Most Value Idea)**

TreeSLS checkpoints these hot pages on DRAM with **stop-and-copy** and the rest pages on NVM with **copy-on-write**.

**My Thoughts**: I believe the initial idea here is to employ **copy-on-write** in both scenarios. However, relying solely on copy-on-write, which entails setting DRAM pages to read-only and delaying the copy back until the next page fault, implies a risk. If a failure occurs between the previous checkpoint and the actual page fault handler, the data on DRAM might be lost. Nonetheless, this risk can be mitigated by using stop-and-copy. Also, the cost for handling page faults is relatively too high. Essentially, **stop-and-copy** acts as an optimization to **copy-on-write** in the context of DRAM. Conversely, the copy-on-write approach is quite effective for NVM. Since NVM is non-volatile, it doesn't face data loss issues. Thus, employing **copy-on-write** in NVM circumvents the significant overhead associated with **stop-and-copy** for all pages.

**Mechanism: Versioning using Radix tree**

As we have mentioned earlier, the backup radix tree has pointers to the original runtime page if the page is not changed. If we need to back up the runtime page, we duplicate it and modify the radix tree to point to the backup copy of the runtime page. Therefore, we get one source **runtime page** and one **backup page** in NVM.

Then, some hot runtime pages on NVM shall be referenced frequently and we need to move them to DRAM. Thus, we get three "copies" of this page: the DRAM one, the runtime one on NVM, and the backup one on NVM (Note that having backup page is the necessary condition for having three copies).

In order to back up the DRAM one when performing **stop-and-copy** (as we have mentioned in hybrid copy), both of the pages on NVM can be used to store the content of the DRAM one.

In case the DRAM page needs to be evicted from DRAM given it's less frequently accessed (in this case, the runtime page and the backup page have the same content), it will replace the place of the runtime page on NVM and set its version number to the latest number. By the way, it will also set the version number of the backup page to 0, which will foster later **copy-on-write** from the runtime page with the latest version number and the backup page with version number 0.

## Evaluation

- Does TreeSLS function well in various scenarios?
- How much time does a checkpoint take?
- How do checkpoints in TreeSLS affect the performance of running applications?
- How do real applications perform on TreeSLS?
