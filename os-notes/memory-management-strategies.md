# Memory Management: Strategies

**Compulsory Misses**: Pages that have never been paged into memory before.

**Capacity Misses**: Not enough memory. Must somehow increase available memory size.

* **Option 1**: Increase amount of DRAM (not quick fix)
* **Option 2**: If multiple processes in memory: adjust percentage of memory allocated to each one!

**Conflict Misses**: Technically, conflict misses don’t exist in virtual memory, since it is a "fully-associative" cache

**Policy Misses**: Caused when pages were in memory, but kicked out prematurely because of the replacement policy

## Replacement Policies

Some of the frames in main memory may be locked.

* Much of the kernel of the operating system
* Key control structures
* I/O buffers

Locking is achieved by associating a lock bit with each frame.

Beside those locked pages, we can replace the rest pages in vm system.

### FIFO (First In, First Out)
- Replace the oldest page.
- Aims for fairness by allowing each page to reside in memory for an equivalent duration.
- **Disadvantage:** Can replace heavily accessed pages over seldom-used ones.

### Random
- Randomly select a page for replacement.
- Commonly used for Translation Lookaside Buffers (TLB) due to its hardware simplicity.
- **Disadvantage:** Unpredictability can challenge real-time performance guarantees.

### Min (OPT)
- Replace the page that will remain unused for the longest upcoming duration.
- Theoretically optimal, but forecasting future access is infeasible.
- **Note:** We can use past access patterns for future predictors. This is basically what LRU done.

### LRU (Least Recently Used)
- Replace the page that has been unused for the longest duration.
- Based on the principle of locality: infrequently accessed items will likely remain so.
- LRU is considered a good practical approximation to MIN.

> **For MIN and LRU**, adding memory generally decreases the miss rate. But for FIFO, this reduction isn't guaranteed, leading to Bélády’s anomaly：
>
> <center><img src="https://p.ipic.vip/sjopmr.png" alt="Screenshot 2023-06-30 at 3.15.53 AM" style="zoom:50%;" /></center>

This method is not feasible in terms of hardware or cost. Each page could be tagged with the time of last reference.This would require a great deal of overhead. 

-----

**Implementation 1: Linked List**

We can also implement LRU by a **linked list**. When a page is referenced, it is removed from the linked list and put on the head of the linked list. In this way, the head of the linked list is always the most recently used page, while the tail is the LRU page.

---

**Implementation 2: Clock**

The global clock is incremented for every memory reference.

When a page if referenced, the contents of the clock is copied to the time-of-use filed in the PTE for that page.

----

**Implementation 3: Matrix**

When page frame $k$ is referenced, the hardware sets all the bits of row $k$ to 1, then sets all the bits of column $k$ to $0$.

At any instance, the row whose binary value is lowest is the least recently used.

### Approximating LRU: Ageing Algorithm

<center><img src="https://p.ipic.vip/zqkg4t.png" alt="image-20230607101017289" style="zoom:50%;" /></center>

There's **a R bit and a counter** associated with each page. At each clock tick, the algorithm left shifts the counter of each page and  fill the R bit in the leftmost slot. In other words, the counter will record the recent 8 clock ticks' reference behavior. 

In the figure above, we can choose between the page 3 and 5 to replace at the clock tick 4. We break the tie by the fact that age 5 was referenced twice while page 3 was referenced only once. It is possible that the reference behaviors of two pages more than 8 ticks ago are quite difference, but we don't care.

### Approximating LRU: Clock Algorithm

**Clock Algorithm**: 
- Envision physical pages in a circular arrangement with a clock hand.
- Replaces an old page but not necessarily the oldest.

The clock hand progresses (on a page fault) and checks the use bit:

- 1: Recently used; reset it and proceed.
- 0: Designate as a replacement candidate.

The algorithm's design guarantees eventual page replacement, unless all pages are frequently accessed.

-------

**N-th Chance Version of Clock Algorithm**

This version enhances the standard Clock Algorithm by tracking the number of "sweeps" (clock hand rotations) a page remains unused.
- The counter is reset when a page's "use" bit is 1.
- If the "use" bit is 0, the counter increments, and replacement occurs when it hits $N$.
- A higher $N$ brings the algorithm closer to LRU. However, finding a replaceable page might necessitate numerous clock cycles.
- The "dirty" status of a page (indicating modifications) is also considered. This ensures data consistency by writing back changes before potential replacements.

----

**Enhanced Clock Algorithm**

- Not accessed recently, not modified. (No.1 pick)
- Accessed recently, not modified. (No.2 pick)
- Not accessed recently, modified.
- Accessed recently, modified.

1. Scan the frame buffer from the current position.The first frame encountered with (u=0, m=0) is selected for replacement.
2. If step1fails, scan again, looking for the frame with (u=0, m=1). The first such frame encountered is selected for replacement.
3. If step 2 fails, the pointer should have returned to its original position and all of the frames in the set will have a use bit of 0. Repeat step 1 and, if necessary, step 2.This time, a frame will be found for the replacement.

**Advantage**: compared with clock algorithm, the enhanced clock alogorithm takes m bit into consideration.

### Second-Chance Algorithm

This blends the simplicity of FIFO with the efficacy of LRU.

It inspect the use bit of the oldest page. 

* If it is 0, the page is both old and unused, so it is replaced immediately.
* If the use bit is 1, the bit is cleared, the page is put onto the end of the list of pages, and its load time is updated as though it had just arrived in memory.

It can avoids the problem of throwing out a heavily used page

## Page Buffering

System keeps a pool of free frames. When a page fault occurs, a victim page is chosen as before. However, the desired page is read into a free frame from the pool before the victim is written out.

This procedure allows the process to restart as soon as possible, without waiting for the victim page to be written out. When the victim is later written out, its frame is added to the free frame pool.

----

An expansion is to maintain a list of modified pages.

- Whenever the paging device is idle, a modified page is selected and is written to secondary storage.
- Its modified bit is then reset.

## Allocation of Page Frames

Possible Replacement Scopes:

* **Global replacement**: process selects replacement frame from set of all frames; one process can take a frame from another
* **Local replacement**: each process selects from only its own set of allocated frames

### Equal allocation (Fixed Scheme):

Every process gets same amount of memory.

Example: 100 frames, 5 processes : process gets 20 frames.

### Proportional allocation (Fixed Scheme)

Allocate according to the size of process.

> Computation proceeds as follows:
>
> $s_i$ = size of process $p_i$ and $S=\sum s_i$ 
>
> $m$ = total number of physical frames in the system
>
> $a_i$ = (allocation for $p_i$) =$\frac{s_i}{S} \times m$

### Priority Allocation

Proportional scheme using priorities rather than size.

Possible behavior: If process $p_i$ generates a page fault, select for replacement a frame from a process with lower priority number.

We want find a balance between page-fault rate and number of frames. We dynamically adjust the number of frames a process is allocated.

<center><img src="https://p.ipic.vip/sxoaml.png" alt="image-20230630214738969" style="zoom:50%;" /></center>

## Working-Set Model

### Thrashing

If a process does not have "enough" pages, the page-fault rate is very high. This leads to low CPU utilization and the operating system spends most of its time swapping to disk. If there are more threads, more memory is needed and thus we need to spend a lot time on paging and swapping.

![Screenshot 2023-06-30 at 9.52.41 PM](https://p.ipic.vip/6dabts.png)

### Working-Set Model

$\Delta$ is the working-set window (fixed number of page references)

$WS_i$ (working set of Process $P_i$) = total set of pages referenced in the most recent $D$ (varies in time)

> * If $D$ is too small, we will not encompass entire locality.
> * If $D$ is too large, we will encompass several localities.
> * If $D$ = $\infin$, we will encompass entire program.

$D$ = $\sum|WS_i|$ total demand frames 

If $D > m$ $\rightarrow$ Thrashing:

* **Policy**: if $D > m$, then suspend/swap out processes
* This can improve overall system behavior by a lot!

- Periodically remove from the resident set of a process those pages that are not in its working set.

------

Page fault frequency is an important parameter for the memory allocation decision process. 

**A high page fault frequency** indicates that a process is running inefficiently because it is short of page frames. 

**A low page fault frequency** indicates that increasing the number of allocated frames will not considerably increase efficiency.

### Page Fault Frequency Algorithm

A **threshold F** is defined. 

When a page fault occurs, the OS notes the virtual time since the last page fault for that process. 

* If the virtual time is less than **F**, then a page is added to the resident set of the process. 
* Otherwise, discard all pages with a use bit of zero, and shrink the resident set accordingly. At the same time, reset the use bit on the remaining pages of the process to 0.

**Disadvantage**: PFF does not perform well during the transient periods when there is a shift to a new locality.

### Variable-Interval Sampled Working Set

VSWS attempts to deal with the phenomenon of interlocality transition (局部性过渡).

The VSWS evaluates the working set of a process at sampling instances based on elapsed virtual time.
