# Process and Thread

A process is the unit of resource allocation, while a thread is the unit of scheduling.

## Process

Process is the basic unit the oprating system allocating resources for.

A process is made up of three parts: PCB, Program and Data.

The **process control block** stores all the information the operating system needs about a particular process: where it is stored in memory, where its executable image is on disk, which user asked it to start executing, what privileges the process has, and so forth.

A typical x86-64 virtual memory layout is presented below. The `.data` segment is primarily used for storing global and static variables that are initialized. The `.bss` segment is used for uninitialized global and static variables. The `.rodata` stores constant data and string literals. The `.text` is the read-only code.

<img src="https://p.ipic.vip/q52zgk.png" alt="Screenshot 2023-08-15 at 4.20.59 PM" style="zoom: 33%;" />

> In Intel processors, the privilege level of a process is stored in a **field** within the Code Segment (CS) register. This **field** is known as the Current Privilege Level (CPL).
>
> The CPL can have four levels of privilege from 0 to 3, with level 0 being the most privileged and level 3 being the least. Typically, the kernel code runs at privilege level 0 (known as Ring 0), and user applications run at privilege level 3 (Ring 3).
>
> When a user-level process executes a system call, it triggers a transition from Ring 3 to Ring 0. The processor automatically changes the CPL to 0. When the kernel code has finished handling the system call, it executes a special return-from-system-call instruction, and the processor switches the CPL back to 3.

### Process Life Cycle

A process in five states:

* **Creating**: referred to as `UNUSED` in xv6.
* **Runable/ Ready**
* **Running**
* **Blocked/ Waiting**: The execution of this process is suspended and will not be scheduled. A process stops as a result of receiving a `SIGSTOP`, `SIGTSP`, `SIGTTIN` or `SIGTTOU` signal, and remains stopped until it receives a `SIGCONT` signal, at which point it becomes running again. It can be further categorized as **uninterruptible sleep** and **interruptible sleep**.
* **Terminated**: A process become terminated for: Receving a signal whose default action is to terminate the process; Returning from the main routine; Calling the `exit` function.

<img src="https://p.ipic.vip/wfs7i8.png" style="zoom: 33%;" />

> **Suspended Processes**
>
> Consider a system without virtual memory where each process to be executed must be loaded fully into main memory.
>
> **Problem**: Processor is so much faster than I/O that the processor could be still idle most of the time.
>
> **Solution**: Swap these processes to disk to free up more memory and load some other processes to increase throughput.
>
> Swapping is also an I/O operation.Why it does not make the situation worse? Disk I/O is the fastest I/O on a system.
>
> **Two Suspend States**
>
> * `Blocked/Suspend`:The process is in secondary memory and awaiting an event.
> * `Ready/Suspend`:The process is in secondary memory and is available for execution if loaded into main memory.
>
> `Blocked/Suspend` $\rightarrow$ `Ready/Suspend`: The event that the process is waiting for occurs.
>
> `Ready/Suspend` $\rightarrow$ `Ready`
>
> - When there are no ready processes in main memory.
> - A process in the Ready/Suspend has higher priority than any processes in the Ready state.

### Process Control

See [Programming: Process and Thread](./programming-process-and-thread).

## Thread

**Each thread of a multi-thread program have its own stack and PC.** They do **share the data (typically global variables)** and code from the process. 

> **Application of Thread: Parallel block zero**
>
> In practice, the operating system will often create a thread to run block zero in the background. The memory of an exiting process does not need to be cleared until the memory is needed — that is, when the next process is created.

### Per-Thread State

The thread control block holds two types of per-thread information:

1. **Per-thread Computation State**

   A pointer to the thread’s stack and a copy of its processor registers.

   In some systems, the general-purpose registers for a stopped thread are stored on the top of the stack, and the TCB contains only a pointer to the stack (Many early and simplistic computer architectures and operating systems employed this method). In other systems, the TCB contains space for a copy of all processor registers (*nix).

<img src="https://p.ipic.vip/at02p3.png" alt="" width="375">

2. **Per-thread Metadata**: thread ID, scheduling priority, status, et al.

### Thread Life Cycle

<img src="https://p.ipic.vip/ut6ns7.png" style="zoom:50%;" />

### Thread Control

**Creating a Thread**: The creation of a thread involves the setup of its own stack, where local variables, function arguments, and return addresses are stored. Let's break down the following code that demonstrates this:

```c
Thread *
create_thread() 
{
  	// Create TCB.
    Thread *t = kalloc(sizeof(Thread));
    init_proc(p);
    return p;
}

void 
init_thread(Thread *t) 
{
    /*
     * Do some initialization here.
     */
    t->kstack = kalloc_page();
    t->kcontext = t->kstack + PAGE_SIZE - sizeof(KernelContext) - sizeof(UserContext);
    t->ucontext = t->kstack + PAGE_SIZE - sizeof(UserContext);
}

int 
start_thread(Thread *t, void (*func)(u64), u64 arg) 
{
    // Initialize the kernel context
    t->kcontext->csregs[11] = (u64)&stub;
    t->kcontext->x0 = (u64)func;
    t->kcontext->x1 = (u64)arg;
    activate_thread(t);
    return pid;
}

u64 
stub(void (*func)(u64), u64 arg) 
{
    set_return_addr(func);
    return arg;
}
```

**Deleting a Thread**: When a thread calls `thread_exit`,  there are two steps to deleting the thread: 

* Remove the thread from the ready list so that it will never run again. 
* Free the per-thread state allocated for the thread.

A thread never deletes its own state. Some other thread must do it. On exit, the thread transitions to the **FINISHED** state, moves its TCB from the ready list to a list of finished threads the scheduler should never run. Once the finished thread is no longer running, it is safe for some *other* thread to free the state of the thread.

### Implementing Threads

* **User Level Threads**

  User threads function fully within user space, bypassing kernel intervention for operations. They're managed by user-level thread libraries like POSIX Pthreads or Java Thread API. They switch contexts faster than kernel threads but can block other user threads if one performs a blocking operation.

* **Kernel Level Threads**

  Kernel threads can execute kernel code and alter kernel data structures. Managed by the OS, they're used for tasks like process scheduling. They offer more concurrency than user threads but have higher context-switching overhead.

* **Hybrid Thread Approach**

  This method merges benefits of user and kernel threads. The OS recognizes both thread types and can map multiple user threads to one kernel thread or keep a one-to-one ratio. It balances fast context switching of user threads with kernel thread integration, but managing this system can be complex.

### Multi-thread Model

**One-to-one**: In Linux and pintos, we adopt the simple one-to-one threading model. Every user thread has its kernel thread. In kernel, we use the kernel stack and in user mode we use the user stack. 

**Many-to-one**: We can perform user-level `yield` without borthering switching to the kernel mode. However, this model has some downsides. If one user thread initiates an I/O job, all the other user threads will also go to sleep. The reason is that they share a common kernel thread.

To address this issue, we propose **Many-to-Many** model.

<img src="https://w3.cs.jmu.edu/kirkpams/OpenCSF/Books/csf/html/_images/CSF-Images.6.1.png" alt="6.2. Processes vs. Threads — Computer Systems Fundamentals" style="zoom: 33%;" />
