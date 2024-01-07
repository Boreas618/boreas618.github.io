# Exceptions

**Exception** is an abrupt **change** in the control flow in response to some change in the processor’s state.

> The term **interrupt** is sometimes used as a synonym for exception. In this note, we will use these two terms interchangeably.

In the case, when the processor detects that the event has occured, it makes an indirect procedure call through a jump table called an **exception vector table**, to an operating system subroutine (the **exception handler**) that is specially designed to process this particular kind of event. 

When the exception handler finishes processing, one of three things happens, depending on the type of event that caused the exception:

* Returns to the **current** instruction
* Returns to the **next** instruction
* **Abort**s the interrupted program

## Exception Handling

Exceptions are denoted with **exception number**s. Assigned by processor or kernel.

At system boot time, the operating system allocates and initializes a jump table called an **exception vector table**.

The exception number is an index into the exception vector table, whose starting address is contained in a special CPU register called the **exception vector table base register**.

----

When exceptions occur, control is being transfered from a user program to the kernel and certain data (like CPU registers' values, return address, etc.) are saved (pushed) onto the kernel's stack. This ensures that the interrupt handling routine has all the necessary information it needs, and after handling the interrupt, the system can restore the user program's state and resume its execution. This is because the kernel needs this information to handle the interrupt, and it also helps to isolate the interrupt handling routine from potentially unsafe user code.

After the handler has processed the event, it optionally returns to the interrupted program by executing a special “return from interrupt” instruction.

## Classes of Exceptions

| Class       | Cause                         | Async/sync | Return behavior           |
| ----------- | ----------------------------- | ---------- | ------------------------- |
| Interrupt   | I/O devices/Signal            | Async      | Next instruction          |
| System call | Intentional exception         | Sync       | Next instruction          |
| Fault       | Potentially recoverable error | Sync       | Might current instruction |
| Abort       | Nonrecoverable error          | Sync       | Never returns             |

* **Interrupts**: Occur asynchronously as a result of signals from I/O devices that are external to the processor.

  I/O devices such as network adapters, disk controllers, and timer chips trigger interrupts by signaling a pin on the processor chip and placing onto the system bus the exception number that identifies the device that caused the interrupt.

  **After the current instruction finishes executing**, the processor notices that the interrupt pin has gone high, reads the exception number from the system bus, and then calls the appropriate interrupt handler.

  The interrupts can be further classified into maskable Interrupt and non-maskable interrupt. They can also be called as external/hardware interrupt.

* **System calls**: Executing `syscall` instruction causes a trap to an exception handler that decodes the argument and calls the appropriate kernel routine.

  > **Distinguish between the calling and executing of system calls.** The former is in user mode and the latter is in kernel mode.

* **Faults**: If the handler is able to correct the error condition, it returns control to the faulting instruction, thereby re-executing it. Otherwise, the handler returns to an `abort`routine in the kernel that terminates the application program that caused the fault.

* **Aborts**: Aborts result from unrecoverable fatal errors.

## Interrupts in Linux x86-64 Systems

There are up to 256 different interrupt types. Numbers in the range from 0 to 31 correspond to exceptions that are defined by the Intel architects and thus are identical for any x86-64 system. Numbers in the range from 32 to 255 correspond to interrupts and traps that are defined by the operating system. Entry 64 points to the system call trap handler.

| Exception number | Description              | Exception class   |
| ---------------- | ------------------------ | ----------------- |
| 0                | Divide error             | Fault             |
| 13               | General protection fault | Fault             |
| 14               | Page fault               | Fault             |
| 18               | Machine check            | Abort             |
| 32-255           | OS-defined exceptions    | Interrupt or trap |

Each system call has a unique integer number that corresponds to an offset in a jump table in the kernel. 

> This jump table is not the same as the exception table. 
>
> * The **interrupt vector table** deals with unexpected conditions in the kernel's operation and helps it recover or handle such situations gracefully.
> *  The **system call jump table** serves as an index to quickly and efficiently route system call requests from user space programs to the appropriate kernel functions.

<center><img src="https://p.ipic.vip/trbk4b.png" alt="Screenshot 2023-07-13 at 11.57.46 PM" style="zoom:50%;" /></center>

All arguments to Linux system calls are passed through general purpose registers rather than the stack. By convention, `%rax` contains the syscall number, with up to six arguments in `%rdi`, `%rsi`, `%rdx`,  `%r10`, `%r8` and `%r9`. On return from the system, registers `%r11`and `%rcx`are destroyed, and `%rax` contains the return value. A negative return value between -4095 and -1 indicates an error corresponding to negative `errno`.
