# Userspace Bypass: Accelerating Syscall-intensive Applications

> [!note]
>
> ATC '22有一篇idea看起来比较像的工作Privbox: Faster System Calls Through Sandboxed Privileged Execution，摘要里大概提到了syscall密集代码提权、沙箱、硬件辅助加速等机制，TODO：比较其与UB的异同。

**Question**: mitigate syscall overhead from the I/O path.

**Current approaches (syscall-refactoring)**:

* Integrate drivers and data processing logic in the same address space by moving data processing logic into kernel; moving drivers responsible for I/O into userspace (kernel bypass)
* Batch syscalls and allow userspace processes to queue multiple I/O requests and issue them together with only one single syscall.

> [!note]
>
> Clio (ASPLOS '22) 中负责网络I/O的Clib采用了bypass kernel的优化方法。
>
> Batch的思路在优化网络请求/系统调用等伴随时延的任务时比较好用。

**Proposed**: instrucment the instructions between syscalls under pre-defined security requirements and let kernel execute the blocks without returning to userspace. (1) Dynamic Binary Translation (DBT) (2) Software-Based Fault Isolation (SFI)

**Challenges**: (1) idenifying (2) safety/pollution (3) transparent

## Background

**Overhead of syscalls**: 

* **Direct costs**: save registers, change protection domains, and handle the registered exceptions.
* **Indirect costs**: the state of processor structure, including L1 cache data and instruction caches, translation look-aside buffers (TLB), etc., can be *polluted* by syscalls, and the Out of Order Execution (OOE) of CPU has to be stalled for the order guarantee.

To defeat transient execution attacks, OS kernel uses two sets of page tables for user space and kernel space.

> [!note]
>
> 这似乎在AArch64中已经得到了硬件实现，即`ttbr0`和`ttbr1`寄存器。

**[Optimization to system calls] asynchronous syscalls**: does not completely decouple the syscall invocation from its execution.

> [!important]
>
> Why? Remain to be investigated.

**[Optimization to system calls] syscall batching**: consecutive system calls; no computation happens between two syscalls; io_uring batch I/O requests from userspace pro- cesses and reduce the occurrences of syscalls; 

**[Optimization to system calls] in-kernel sandbox**: eBPF allows developers to attach code into kernel trace points. When kernel reaches these points, it will use a VM to execute the attached code.

**[Optimization to system calls] kernel bypass**: Data Plane Development Kit - takes over I/O devices in userspace. I/O requests are submitted to devices via a shared ring buffer, instead of syscalls.

> [!note]
>
> Most kernel bypass and syscall batching solutions (e.g., DPDK, RDMA, io_uring) require application code to interact with a queue pair asynchronously. Nonetheless, developers still prefer to write program logic in the synchronous style.
>
> 我认为这里主要是一个API迁移的问题？我感觉异步逻辑的心智负担还好。

## Design Overview

**Goal 1**: minimizing the manual efforts of developers.

**Goal 2**: minimizing changes to system architecture.

**Goal 3**: comparable performance to syscall-refactoring approaches.

### Syscall-intensive Applications

**Claim**: I/O intensive implies syscall intensive.

> [!note]
>
> 有没有其他的syscall密集场景？

Lightweight userspace instructions in I/O threads.

* (Explanation) such applications has threads for I/O and computation. 
* (Experiment) profile syscalls invoked by Redis.

### UB Modules

* **Hot syscall profiler**: by analyzing the runtime statistics, it can identify which syscall instructions are *hot*, i.e., ones with high chances to be followed by another syscall shortly.
* **JIT (BTC translator)**: converting the userspace instructions into ***Binary Translation Cache (BTC)***  that is instrumented with isolation policies (Under the SFI guidelines).
* Kernel BTC runtime.

> [!note]
>
> Idea看起来简单，但需要强调几个challenge以体现工作量。这里主要是两点：（1） 沙箱机制 （2）优化点位精确鉴定。
>
> UB的workflow和SOSP '23的Mira在框架上有点像：profile -> 指令级优化 （Mira是在IR层面优化，UB是在二进制指令层级优化） -> runtime

## Hot Syscall Identifier

Have to decide suitable path (***short path***) length for translation and instrumentation since the overhead of instrumentation grows with path length.

**Module Design**: discover hot syscalls that enclose a short userspace path.

The two syscalls are classified as candidates of hot syscalls when the instruction number is less than the threashold of short path.

> [!note]
>
> 这里的short path长度，包括后面有很多超参数都是hard coded。我觉得还可以采用Mira中类似的方法：iteratively选择一定比例的candidate来优化，如果优化效果差再回滚。

**Detailed steps**:

* **Syscall sampling**: monitoring every syscall invocation is expensive. Choose to profile less than 10% of syscalls.

> [!note]
>
> 这里感觉有点不好，采样标准、采样比例的合理性没有很好地验证，两点愚见：
>
> （1）补充相关实验，看看syscall sampling下的性能-采样比的曲线。
>
> （2）动态地、迭代地决定采样比，如上一条Note所说。

* **Coarse-grained profiling**: threads with low IO frequency will not go through fine-grained 
* **Fine-grained profiling**: high IO frequency: further analyzes which syscall instructions are invoked frequently. The frequent ones deserve userspace bypassing as more performance boost can be gained. Maintain a table recording, for each invoked syscall instruction, its location register (RIP) and a counter of how many times the next syscall is invoked within 4 microseconds (approximately the time of executing instructions of short path length).

> [!note]
>
> 本段最后提到了我前面非常关心的参数选择问题，解答了我的部分疑问。但是：（1）作者似乎只关心“can be correctly discovered”，但我觉得optimal performance也很重要 （2）随着时间推移，我们需要I/O获取/写回的数据集合也会不同，参数选择对于系统性能的影响在时间尺度上稳不稳定？

## BTC Runtime

The BTC translator follows the procedure of Dynamic Binary Translation (DBT). 

* Exit the runtime in the middle when the jump target is missing: the runtime records the information about this jump and immediately returns to userspace. Changes made to registers are updated to userspace context (i.e., `pt_regs` for x86_64), which will be written to registers when kernel returns to userspace. 
* Exit when a syscall instruction is encountered. Go on to execute the system call since it is the right boudary of the fast path. **Hot syscalls** can be chained.

**Fast path discovery**: an incremental, JIT-style approach.

* First discovers a part of the fast path, by dissembling the code segment of the target thread from the entry address iteratively.
* The translator only follows *direct jumps* and stops at the call instructions, which forces the translator to handle code only within a function at one iteration and consider it fast path.
* When an indirect jump or call is indeed made later, the target information will be collected by the BTC runtime and sent to the translator to extend the fast path after replacing the jump instructions.

> [!note]
>
> 有没有可能，某BTC translator的目标代码还有大量的跳转和procedure call，如此的迭代增量的方法会造成thrashing现象？即，存在大量的间接跳转和函数调用，大量的路径需要extend，造成比较高的overhead。期待evaluation section有实证数据支撑。
>
> ----
>
> 后续：5.2.1结尾作者解释了确实有实证结果，indirect control-flow transfer不是很频繁。

## BTC  Translator

Follow the SFI principles to provide data-access policies and control-flow policies on **kernel**, and the implementations are inherited and extended from Nacl (which differs from this work in that it assumes that the source code is avaliable), which sandboxes the untrusted x86 native code in **browser**.

Avoid elevating a fast path when the consequences can not be immediately determined (e.g., the jump targets are unknown during translation).

> [!note]
>
> 这里解释了前面的迭代增量的方法的安全方面的考量，安全和性能的trade off如何评估？

### Jump Sanitation

**Direct jump**: to prevent the code in BTC from jumping to an arbitrary address, only direct jumps whose targets are known are processed.

**Indirect jump**:  the translator inserts checks that compare the targets against a ***target address table*** when encountering the associated code at first. If not in the table, the runtime will exit and the translator will extend the fast path.

<img src="https://p.ipic.vip/lx5jxm.png" alt="Screenshot 2024-03-06 at 1.10.21 PM" style="zoom: 33%;" />

### Register Remapping

* The BTC translator disallows the BTC code to access stack registers (i.e., RSP, RBP, and RIP).
* Some registers are reserved for BTC runtime and cannot be accessed by the BTC code.

The BTC translator uses the $M$ reserved registers in BTC to serve the potential access to $N$ registers ($N = M + 3$, $3$ are for stack registers). The translator chooses one from the $M$​ reserved registers to temporally act as a special register with ***renaming***. 

Reserves R12- R15 for BTC runtime use (least frequently used). Frequently-used registers are fixed.

### Instruction Sanitization

Privileged instructions (e.g., `sysret`) are not allowed to appear in the BTC, to avoid privilege escalation by the malicious code that exploits UB. The fast path with previleged instructions will not be elevated to the kernel. 

Stack operation instructions like PUSH/POP should be rewritten. The stack registers are managed by the reserved registers in the BTC runtime.

### Memory Access Sanitization

The translator sanitizes all memory access instructions by inserting address checking instructions before the instruction. Only userspace addresses are allowed to be accessed. 

> [!Note]
>
> The translator shifts left the address by one bit and then shifts it right by one bit, to fulfill the address requirement.
>
> 这是啥意思，没懂。

Added checks do not prevent BTC from accessing unmapped memory region and triggering page fault. When invalid page fault (i.e., illegally accessing some memory regions) happens, the execution of BTC code is aborted.

### Thread Safety

* When translating an instruction, the translator prefers to use one instruction that has the same op-code as the original one. Hence, the atomicity of the original instruction is automatically preserved.
* If more than one instruction is needed for emulation, memory load or store must be completed in a single instruction.

> [!note]
>
> 有个问题：如果一条user space指令被多条BTC指令模拟，其内存操作可以保证在一条BTC指令内完成吗？

## Evaluation

An I/O micro-benchmark and two real-world applications (Redis and Nginx) for macro-benchmarks.

* Bare-metal environment (client and server)/virtualized environment (NIC pass-through being enabled)
* Run each server application in four settings: KPTI on/off × VM/physical machine.

### I/O Micro-benchmark

**In-memory file access**: create a large file in ramfs to avoid possible disk bottleneck.

* Virtualized environment/KPTI on/small I/O size, accelerates syscall-based I/O by 88.3%±0.75%.
* Larger I/O size, acceleration ratio drops to 30.3%±0.96% for the 4KiB I/O size. (Fewer syscalls are invoked)
* Without KPTI, the acceleration ratio of UB drops to 14.3%±1.83% – 41.6%±1.73%.
* The acceleration on physical machine is higher, since the IOPS on physi- cal machine is higher and UB saves more context switching overhead.

**File access on NVMe**: only consider the physical machine setting, because when VM accesses a file in a virtual NVMe disk, the file will be automatically cached into memory a priori, which behaves similarly to in-memory file access.

### Raw Socket vs. eBPF

UB accelerates raw socket by 31.5%±0.25% – 34.3%±0.72%, which are much smaller than eBPF.

The bottleneck of raw socket is **protocol stack processing**, which is bypassed by eBPF whose bottleneck may be the data movement, whose time consumption is related to packet size.

The execution performance of BTC is better than eBPF VM while it cannot achieve similar PPS to eBPF. The analysis by the author is that eBPF runs in softirq, so the packets can be dispatched into different cores while the raw socket protocol stack has in-kernel locks for concurrent access.

> [!note]
>
> One potential approach is to build a better UB runtime so more deeper kernel trace points can be exposed via syscall, and we leave this as a future work.
>
> 这个idea我没太懂，UB和kernel trace points的关系是指？

