# Interprocess Communication Cases

* L4 micro kernel
* LRPC
* ChCore
* Binder

## L4 Microkernel Family

L4, like its predecessor microkernel L3, was created by German computer scientist Jochen Liedtke as a response to the poor performance of earlier microkernel-based OSes. Liedtke felt that a system designed from the start for high performance, rather than other goals, could produce a microkernel of practical use.

<center><img src="https://p.ipic.vip/nwfp5j.png" alt="L4_family_tree" style="zoom:50%;" /></center>

### Message Passing

L4 classifies messages into two categories: short and long. Each category is handled differently in order to reduce the need for copy operations and improve communication performance.

**Short Messages**

* Use registers to pass messages and enable zero-copy communication. One register is dedicated to storing the message, which remains preserved during context switching. 
* **Shortcomings**: Relies heavily on the underlying hardware architecture.
* Pistachio introduces the concept of a **virtual message register**. The kernel will map this virtual message register to a physical register or allocate memory space if there are not enough registers available.

**Long Messages**:

