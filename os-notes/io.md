# I/O Concepts

<img src="https://p.ipic.vip/hpz4fp.png" alt="Screenshot 2023-07-01 at 1.36.41 AM" style="zoom: 67%;" />

* I/O devices you recognize are supported by I/O Controllers

* Processors accesses them by reading and writing IO registers as if they were memory. Write commands and arguments, read status and results


## Buses

Buses let us connect $n$ devices over a single set of wires, connections, and protocols. $O(n^2 )$ relations with 1 set of wires. The downside is that there can be only one transaction at a time. The rest must wait. 

----

PCI started life out as a bus. But a parallel bus has many limitations:

* Multiplexing address/data for many requests

* Slowest devices must be able to tell what’s happening (e.g., for arbitration) 
* **Bus speed is set to that of the slowest device**

PCI Express "Bus" is no longer a parallel bus. It's really a **collection of fast serial channels** or “lanes”. Devices can use as many as they need to achieve a desired bandwidth. Slow devices don’t have to share with fast ones.

<img src="https://p.ipic.vip/8qlycv.png" alt="Screenshot 2023-07-01 at 1.48.34 AM" style="zoom:50%;" />

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

  <img src="https://p.ipic.vip/vd53f3.png" alt="image-20230702195541288" style="zoom:50%;" />

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

<img src="https://p.ipic.vip/8ab7w7.png" alt="Screenshot 2023-07-02 at 8.10.09 PM" style="zoom:50%;" />

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

------



