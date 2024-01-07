# I/O

<center><img src="https://harttle.land/assets/img/blog/intel-io.png" alt="Computer Organization and Design 笔记 - Storage and Other I/O Topics |  Harttle Land" style="zoom:75%;" /></center>

* I/O devices you recognize are supported by **I/O controller**s.

* Processors accesses them by reading and writing IO registers as if they were memory. Write commands and arguments, read status and results.

Peripheral devices such as graphics cards, mice, keyboards, and disks communicate with the CPU and main memory using various bus systems, often facilitated by bridge components.


## Buses

Buses let us connect $n$ devices over a single set of wires, connections, and protocols. $O(n^2 )$ relations with 1 set of wires. The downside is that there can be only one transaction at a time. The rest must wait. 

----

PCI started life out as a bus. But a parallel bus has many limitations:

* Multiplexing address/data for many requests

* Slowest devices must be able to tell what’s happening (e.g., for arbitration) 
* **Bus speed is set to that of the slowest device**

PCI Express "Bus" is no longer a parallel bus. It's really a **collection of fast serial channels** or “lanes”. Devices can use as many as they need to achieve a desired bandwidth. Slow devices don’t have to share with fast ones.

<center><img src="https://p.ipic.vip/8qlycv.png" alt="Screenshot 2023-07-01 at 1.48.34 AM" style="zoom:50%;" /></center>

CPU interacts with a *Controller* which contains a set of *registers* that can be read and written. The controller may contain memory for request queues, etc.

Processor accesses registers in two ways: 

* **Port-Mapped I/O**: in/out instructions like `out 0x21,AL`

* **Memory-mapped I/O**: load/store instructions

  Registers/memory appear in physical address space

  I/O accomplished with load and store instructions

## Operational Parameters for I/O

* **Data granularity**: Byte vs. Block

  Some devices provide single byte at a time (e.g., keyboard). Others provide whole blocks (e.g., disks, networks, etc.)

* **Access pattern**: Sequential vs. Random

  Some devices must be accessed sequentially (e.g., tape). Others can be accessed "randomly" (e.g., disk, cd, etc.) indicates a fixed overhead to start transfers. .Some devices require continual monitoring. Others generate interrupts when they need service.

* **Transfer Mechanism**:

  **Programmed I/O**: Each byte transferred via processor in/out or load/store.

  **Direct Memory Access**: Give controller access to memory bus. Ask it to transfer data blocks to/from memory directly.

  <center><img src="https://p.ipic.vip/vd53f3.png" alt="image-20230702195541288" style="zoom:50%;" /></center>

* **I/O Device Notifying the OS**

  **I/O Interrupt**: Device generates an interrupt whenever it needs service. Pro: handles unpredictable events well. Con: interrupts relatively high overhead.

  **Polling**: OS periodically checks a device-specific status register and I/O device puts completion information in status register. Pro: low overhead. Con: may waste many cycles on polling if infrequent or unpredictable I/O operations.

  **Actual devices combine both polling and interrupts**:

  > **High-bandwidth network adapter**:
  >
  > * Interrupt for first incoming packet
  >
  > * Poll for following packets until hardware queues are empty

* **Cycle Stealing**: used to transfer data on the system bus. The instruction cycle is suspended so data can be transferred. The CPU pauses one bus cycle. No interrupts occur so we do not save the context.

## I/O Software

<center><img src="https://p.ipic.vip/8ab7w7.png" alt="Screenshot 2023-07-02 at 8.10.09 PM" style="zoom:50%;" /></center>

### Kernel I/O Subsystem (Device-Independent Software)

The goal of kernel I/O subsystem is to provide uniform interfaces despite wide range of different devices. This is also referred to as device-independent software. 

The basic function of the device- independent software is:

- Perform the I/O functions that are common to all devices (such as **buffering**, **error reporting**, **allocating** and **releasing** dedicated devices, and providing a device-independent block size).
- Provide a **uniform interface** to the user-level software.

### Device Drivers

**Device Driver**: Device-specific code in the kernel that interacts directly with the device hardware

* Supports a standard, internal interface
* Same kernel I/O system can interact easily with different device drivers
* Special device-specific configuration supported with the `ioctl()` system call

Device Drivers typically divided into 2 pieces:

* **Top half:** accessed in call path from system calls. It implements a set of standard, cross-device calls like `open()`, `close()`, `read()`, `write()`, `ioctl()`, `strategy()`. This is the kernel’s interface to the device driver. Top half will start I/O to device, may put thread to sleep until finished. This part is called the device-independent softwares.
* **Bottom half**: also refered to as interrupt handlers. Gets input or transfers next block of output. May wake sleeping threads if I/O now complete

------

**Block Devices**: *e.g.* disk drives, tape drives, DVD-ROM

* Access blocks of data
* Commands include `open()`, `read()`, `write()`, `seek()`
* Raw I/O or file-system (directories, files, permissions) access
* Memory-mapped file access possible

----

**Character Devices**: *e.g.* keyboards, mice, serial ports, some USB devices

* Single characters at a time
* Commands include `get()`, `put()`
* Libraries layered on top allow line editing ( we somethings want the user to type in a line of command )

------

**Network Devices**: *e.g.* Ethernet, Wireless, Bluetooth

* Different enough from block/character to have own interface

* Unix and Windows include `socket` interface

  Separates network protocol (TCP, UDP) from network operation (sending and receiving data)

  Includes `select()` functionality

* Usage: pipes, FIFOs, streams, queues, mailboxes

## I/O Buffering

Two types of devices

- **Block-oriented devices** stores information in blocks that are usually of fixed size, and transfers are made a block at a time.
- **Stream-oriented devices** transfer data in and out as a stream of bytes, with no block structure. Used for terminals, printers, communication ports, mouse, and most other devices that are not secondary storage.

### Single Buffer

When a user process issues an I/O request, the OS assigns a buffer in the system portion (kernel space)  of main memory to the operation.

For block-oriented input, the input transfers are made to the system buffer. On transfer completion, the process moves the block into user space.

Define $T$ as the time from I/O device to buffer, $M$ as the time from buffer to user space, and $C$ as the user process data processing time.

**Without Buffering**: Execution per block is $T + C$.

**With Single Buffering**: Execution per block is $\max(T, C) + M$.

<center><img src="https://p.ipic.vip/zq429z.png" alt="Screenshot 2023-12-23 at 6.17.45 AM" style="zoom: 33%;" /></center>

### Double Buffer

An improvement over single buffering is to use two system buffers instead of one. A process can transfer data to (or from) one buffer while the operating system empties (or fills) the other buffer

**With Double Buffering **: Execution per block is $\max(C, T)$. If $C\leq T$, it is possible to keep the block- oriented device going at full speed. If $C>T$, double buffering ensures that the process will not have to wait on I/O.

> **Practice (COMP130110Final@FDU)**
>
> Suppose a file contains 10 disk blocks. Now a user process need read the entire file into memory for analysis. Suppose one I/O buffer has the same size as one disk block. It will take OS 100ms to read one disk block into buffer, and 50ms to transfer the data block from buffer to user process. The user process needs 50ms to finish analyzing one data block. What is total time needed for reading and analyzing the entire file if single buffer is used? What’s the total time if double buffer is used? Why?
> $$
> t_{\text{single}} = n \times(\max(C, T)+M) + C
> $$
>
> $$
> t_{\text{double}} = n\times\max({C, T}) + M + C
> $$

### Circular Buffer

More than two buffers are used

<center><img src="https://p.ipic.vip/psodw8.png" alt="Screenshot 2023-12-23 at 8.39.52 PM" style="zoom: 33%;" /></center>

-----

**Difference Between Buffer and Cache**:  They are frequently combined; however, there is a difference in intent.

- The success of cache exists mainly in that the same datum will be read from cache multiple times, or that written data will soon be read.
- Buffering is to smooth out peaks in I/O demand.

## Spooling

The term “spool” is an acronym of “**S**imultaneous **P**eripheral **O**peration **O**n-**l**ine”.

The print spooling is the most common spooling application. Printers are relatively slow peripherals. In comparison, disk devices are orders of magnitude faster. Without spooling print data, the speed of program operation is constrained by the slowest device (printers) – this program is “print bounded”. The key to spooling is asynchronous processing, where the process is not constrained by the speed of slow devices (particularly printers).

----

A spooler contains two parts:

* An operating system extension to trap data destined for a printer and buffers it.

- A simple program that independently writes trapped data to the printer.

----

With spooling

- A spooling mechanism traps the I/O request, captures the output data, and releases the application to continue processing.
- Afterwards, it writes the captured data to the printer, independent of the original application.

----

Spooling can be managed by a system daemon processor an in-kernel thread. To print a file, a process first generates the entire file to be printed and puts it in the spooling directory. Only the daemon process has the permission to use the printer’s special file to print the files in the directory.
