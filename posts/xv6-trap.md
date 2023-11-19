# Exception and Interrupt Handling in xv6

In this post, we will introduce how xv6 implement traps.

## xv6

In $^5$, the designers of xv6 share the same understanding of **trap** as the RISC-V specification$^4$. In this context, **trap** refers to the transfer of control to a trap handler, which can be triggered by an exception or an interrupt.

Let's say a user calls the `freemem` system call to calculate the number of free pages.

```c
int num = -1;

if (freemem(&num) < 0) {
  fprintf(2, "freemem failed!\\\\n");
  exit(1);
}
```

What happens when the user calls `freemem`? In other words, to where is the control transferred?

In fact, the `freemem` function we call is a "stub" for the system call. Its function body is the following assembly code:

```assembly
# user/usys.S
.global freemem
freemem:
	li a7, SYS_freemem
	ecall
	ret
```

`SYS_freemem` is the system call number defined in `kernel/syscall.h`. In RISC-V, a system call is made by placing the system call number in register `a7` and executing an `ecall` instruction to jump to the trap handler.

Before we move on to explore what happens in the trap handler, let's take a moment to explain why some readers of this post may not be able to find `usys.S` in `user`. This is because the file is dynamically generated by the Perl script `user/usys.pl`. The dynamic generation occurs during the kernel's make process, which means it can only be seen after running `make qemu` or other commands that execute the Perl script.

> Xv6 trap handling proceeds in four stages: (1) hardware actions taken by the RISC-V CPU, (2) an assembly “vector” that prepares the way for kernel C code, (3) a C trap handler that decides what to do with the trap, and (4) the system call or device-driver service routine$^5$.

### Phase 1: hardware actions taken by the RISC-V CPU

We have executed the `ecall` instruction and the hardware begins to take control, subsequently transferring the control flow to the trap handler. The sequence of hardware actions includes procedures that manipulate registers in order to prepare for the trap handler. Therefore, we will first introduce some registers that will be manipulated in the hardware actions phase and subsequent phases.

- `stvec`: The kernel writes the address of its trap handler here; the RISC-V jumps here to handle a trap.

- `sepc`: When a trap occurs, RISC-V saves the program counter here (since the pc is then overwritten with stvec). The sret (return from trap) instruction copies sepc to the pc. The kernel can write to sepc to control where sret goes.

- `scause`: The RISC-V puts a number here that describes the reason for the trap.

- `sscratch`: The kernel places a value here that comes in handy at the very start of a trap

  handler.

- `sstatus`: The SIE bit in sstatus controls whether device interrupts are enabled. If the kernel clears SIE, the RISC-V will defer device interrupts until the kernel sets SIE. The SPP bit indicates whether a trap came from user mode or supervisor mode, and controls to what mode sret returns.

Here, the leading 's' in the names of the registers means supervisor mode, which is above the user and machine modes.

When it needs to force a trap, the RISC-V hardware does the following for all trap types (other than timer interrupts):

1. If the trap is a device interrupt, and the `sstatus` SIE bit is clear, don’t do any of the following.
2. Disable interrupts by clearing SIE.
3. Copy the `pc` to`sepc`.
4. Save the current mode (user or supervisor) in the SPP bit in `sstatus`.
5. Set `scause` to reflect the trap’s cause.
6. Set the mode to supervisor.
7. Copy `stvec` to the `pc`.

The actions performed by hardware are now clear. However, one question remains: when does the kernel write the address of its trap handler into `stvec`? This is a non-trivial question. 

In the xv6 book$^5$, traps can be classified into two classes: traps from user space and traps from kernel space. The former include interrupts, exceptions, or system calls from user space, while the latter include interrupts and exceptions from kernel space. It is important to note that exceptions from kernel space are unacceptable and will cause the kernel to panic.

**For traps from user space**, the routine of setting `stvec` to `uservec` occurs during the creation of new processes. Specifically, `stvec` is set to `trampoline_uservec` in the `usertrapret` function, which is called in `forkret`. `forkret` serves as the entry point for a new process. In summary, `stvec` is set to the user trap handler when a user process starts to run. **For traps from kernel space**, it is less subtle and clear in the source code.

### Phase 2: an assembly “vector” that prepares the way for kernel C code

Do you still remember the four phases mentioned above? Now that the actions performed by the hardware are complete, we have jumped to the address specified in `stvec`. This address is referred to as **an assembly "vector" that prepares the way for kernel C code**.

> ...
>
> Xv6 satisfies these constraints with a ***trampoline*** page that contains `uservec`. Xv6 maps the trampoline page at the same virtual address in the kernel page table and in every user page table. This virtual address is `TRAMPOLINE` (as we saw in Figure 2.3 and in Figure 3.3). The trampoline contents are set in `trampoline.S`, and (when executing user code) `stvec` is set to `uservec` (kernel/trampoline.S:16).

The assembly code for `uservec` is clear enough with comments. Each process has a virtual memory area called `TRAPFRAME` where contexts from user space are saved. After the registers have been saved, the kernel stack pointer, page table, and hart id are fetched from `TRAPFRAME`, and the control is transferred to `usertrap` now.

### Phase 3: a C trap handler that decides what to do with the trap

The C trap handler determines the cause of this trap by reading `scause`. The return address should be set to the next instruction if the trap is a system call. After the trap handler has determined that the trap is a system call, control is transferred to `syscall`, which will call the predefined system call function according to the system call number specified in `a7`.

### Phase 4: the system call or device-driver service routine

This is where the system call code is executed. To find the corresponding system call code, the system call number is used to index into a function pointer array and retrieve the appropriate function pointer. The system call functions are defined in `sysproc.c`.

Note that if the system call is made by `freemem(&num)`, which means we have to copy the number of free pages to `num`, the difference in page tables should be taken into consideration. Because in the kernel, we have a different virtual memory space from the user, which means that we have to consult the virtual memory address of the user process that made the system call to copy the value to the right place.

This can be done by the following code:

```c
struct proc *p = myproc();
uint64 addr;
argaddr(0, &addr); // get parameter 0, which is the address of `num`
if(copyout(p->pagetable, addr, (char *)&sum, sizeof(sum)) < 0)
	return -1;
```

Above are the four phases of making and executing system calls in xv6. Handling user space interrupts and exceptions are similar in terms of the four phases. Returning from a trap is all about recovering the user contexts and is similar to saving contexts. The control is transferred from `usertrapret` to `userret`, and finally, to the next instructions of the instruction that causes the system call.

# References

1. w568w, (2023). *OS-23Fall-FDU Repository* https://github.com/idlebo/OS-23Fall-FDU/blob/lab3/doc/trap.explained.md
2. Intel, (2023). *Intel® 64 and IA-32 Architectures Software Developer Manuals* https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html
3. Arm, (2023). *AArch64 Exception and Interrupt Handling* https://developer.arm.com/documentation/100933/0100/AArch64-Exception-and-Interrupt-Handling
4. RISC-V, (2023). *RISC-V Specifications* https://riscv.org/technical/specifications/
5. Cox, R., Kaashoek, M. F., & Morris, R. (2011). Xv6, a simple Unix-like teaching operating system. *2013-09-05]. http://pdos. csail. mit. edu/6.828/2012/xv6. html*.