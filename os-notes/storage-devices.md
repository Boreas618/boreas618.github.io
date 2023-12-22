# Storage Devices

**Magnetic disks**

* Storage that rarely becomes corrupted

* Large capacity at low cost

* Block level random access (except for SMR – later!)

* Slow performance for random access

* Better performance for sequential access

**Flash memory**

* Storage that rarely becomes corrupted

* Capacity at intermediate cost (5-20x disk)

* Block level random access

* Good performance for reads; worse for random writes

* Erasure requirement in large blocks

* Wear patterns issue

## HDD

In the early days of hard drivers, the number of sectors pre track was the same for all tracks on the disk. The date density for the outer track is lower.

To make better use of the available space on the disk, hard drive manufacturers started using a technique called zone bit recording (ZBR). In ZBR, the hard drive surface is divided into different zones or regions, each of which contains a certain number of sectors per track. The outer zones, which are larger, contain more sectors per track than the inner zones. This means that more data can be stored on the outer tracks, matching their larger physical size.

The rotational speed of the disk (how fast it spins) is typically constant, not varying between zones. So the outer zones can achieve higher transfer rate.

We should try out best to achieve locality on disk:

* Read block from random place on disk:

  Seek (5ms) + Rot. Delay (4ms) + Transfer (0.082ms) = 9.082ms

  Approx 9ms to fetch/put data: $\frac{4096 bytes}{9.082×10-3 s} \approx  451KB/s$

* Read block from random place in same cylinder:

  Rot. Delay (4ms) + Transfer (0.082ms) = 4.082ms 

  Approx 4ms to fetch/put data: $\frac{4096 bytes}{4.082×10-3 s}\approx 1.03MB/s$

* Read next block on same track:

  Transfer (0.082ms): $\frac{4096 bytes}{0.082×10-3 s} \approx 50MB/sec$

## SSD

### Read

Read 4 KB Page: ~25 usec 

There's no seek or rotational latency

**Transfer time**: transfer a 4KB page

SATA: $300-600MB/s$ => $ \frac{4\times 10^3 b}  {400 \times 10^6 bps} \approx 10 us$

Latency = Queuing Time + Controller time + Xfer Time

Highest Bandwidth: Both Sequential and Random reads

### Write

Writing is adding electrons and erasing is removing electrons. Can only write empty pages in a block

Erasing a block takes ~1.5ms

Controller maintains pool of empty blocks by coalescing used pages (read, erase, write), also reserves some % of capacity

We can only erase in big chunks:

<img src="https://p.ipic.vip/8oqs2i.png" alt="image-20230703000834471" style="zoom:50%;" />

Eeasure are 10 times slower than writes and writes are 10 times slower than reads.

**Why not just erase and rewrite new version of entire 256KB block?**

* Erasure is very slow (milliseconds)

* Each block has a finite lifetime, can only be erased and rewritten about 10K times

* Heavily used blocks likely to wear out quickly

### Solutions

Two principles:

* **Layer of Indirection**: Maintain a *Flash Translation Layer (FTL)* in SSD. Map virtual block numbers (which OS uses) to physical page numbers (which flash mem. controller uses)
* **Copy on Write**: Don’t overwrite a page when OS updates its data. Instead, write new version in a free page. Update FTL mapping to point to new location.

There's no need to erase and rewrite entire 256KB block when making small modifications. SSD controller can assign mappings to spread workload across pages.

What to do with old versions of pages? *Garbage Collection* in background. Erase blocks with old pages, add to free list.

# Performance

* **Latency** – time to **complete a task** (the time delay between the initiation of a request or an action and the beginning of a response or the arrival of the requested data)

  If the round-trip latency is 50 milliseconds, it means it takes 50 milliseconds for the request to reach the server and for the server's response to travel back to the browser.

  Measured in units of time (s, ms, us, …, hours, years)

  Disk Latency = Queueing Time + Controller Time + Seek Time + Rotation Time + Xfer Time

  ![Screenshot 2023-07-03 at 6.08.07 PM](https://p.ipic.vip/19ewi9.png)

* **Response Time** - time to initiate and operation and get its response

  Able to issue one that *depends* on the result.

  The total response time for a web page to load is 500 milliseconds, which includes the 50 milliseconds of latency and 450 milliseconds of processing time within the browser.

  Know that it is done (anti-dependence, resource usage)

* **Throughput** or **Bandwidth** – rate at which tasks are performed

  Measured in units of things per unit time (ops/s, GFLOP/s)

* **Start up or “Overhead”** **–** time to initiate an operation

Latency specifically refers to the delay or time it takes for a signal or data to travel, while response time encompasses the latency and the time taken for processing or computation to provide a complete response.

Most I/O operations are roughly linear in *b* bytes

Latency(b) = Overhead + b/TransferCapacity

**Performance** is calculated by operation time (4 mins to run a mile…) or rate (mph, mpg, …) 

Effective bandwidth is calculated by $\frac{b}{S+\frac{b}{B}}$.

Half-power bandwidth is the point where $E(b)=\frac{B}{2}$.

## Queuing behavior

<img src="https://p.ipic.vip/srn4hn.png" alt="Screenshot 2023-07-03 at 12.56.20 AM" style="zoom:50%;" />

Contributing factors to latency:

* Software paths (can be loosely modeled by a queue)

* Hardware controller

* I/O device service time

Can lead to big increases of latency as utilization increases

<img src="https://p.ipic.vip/ztt66w.png" alt="Screenshot 2023-07-03 at 12.47.25 AM" style="zoom:50%;" />

## Queueing Theory

### Little's Law

![image-20230703185610179](https://p.ipic.vip/2k4ydr.png)

In any **stable** system, the average arrival rate = average departure rate.

**Little's Law**: the number of "things" in a system is equal to the bandwidth times the latency (on average)  *N(jobs) = $\lambda$ (jobs/s) $\times$ L(s)* 

Can be applied to an entire system: including the queues, the processing stages, parallelism, whatever.

The maximum service rate $\mu_{max}$ is a property of the system. The request rate is $\lambda$. So the utilization is $\rho = \frac{\lambda}{\mu_{max}}$.

![Screenshot 2023-07-03 at 7.06.11 PM](https://p.ipic.vip/5omyrd.png)

The green line is the realistic situation when the tasks arrive deterministically (i.e. arrives periodically).

### Bottleneck Analysis

![Screenshot 2023-07-03 at 7.09.06 PM](https://p.ipic.vip/et16hv.png)

Each state has its own queue and maximum service rate.

Suppose the green stage is the bottleneck, the bottleneck stage dictates the maximum service rate $\mu_{max}$. We will look at the whole process as a single queue with a service rate of $\mu_{max,3}$.

The latency (response time) here is calculated by queuing time + service time. Service time depends on the underlying operation. For CPU stage, how much computation. For I/O stage, characteristics of the hardware.

What happens when request rate ($\lambda$) exceeds max service rate ($\mu_{max}$)?

Short bursts can be absorbed by the queue

* If on average $\lambda < \mu$, it will drain eventually

Prolonged $\lambda > \mu$ → queue will grow without bound

**Same average arrival time, but almost all of the requests experience large queue delays (even though average utilization is low)**

![Screenshot 2023-07-03 at 7.33.57 PM](https://p.ipic.vip/114nc8.png)

![Screenshot 2023-07-03 at 7.33.57 PM](https://p.ipic.vip/xbwgcr.png)

In a busty world, we model the burstiness of arrival as an exponential distribution:

<img src="https://p.ipic.vip/smlzh1.png" alt="Screenshot 2023-07-03 at 7.51.26 PM" style="zoom:50%;" />

And the operation time changing with regrads to request rate is like:

<img src="https://p.ipic.vip/5jxxdw.png" alt="Screenshot 2023-07-03 at 7.53.13 PM" style="zoom:50%;" />

"**Half-Power Point**": load at which system delivers half of peak performance.

### Some Results from Queueing Theory

Assumptions: system in equilibrium, no limit to the queue, time between successive arrivals is random and memoryless.

![Screenshot 2023-07-03 at 7.43.00 PM](https://p.ipic.vip/qpi798.png)

$\rho$ cannot be greater than 1. The response will grows out of bounds when $\rho$ is approaching 1.

![Screenshot 2023-07-03 at 7.43.25 PM](https://p.ipic.vip/oogurn.png)

### How do we Hide I/O  Latency?

**Blocking Interface**: “Wait” When request data (*e.g.,* `read()` system call), put process to sleep until data is ready. When write data (*e.g.,* `write()` system call), put process to sleep until device is ready for data

**Non-blocking Interface**: “Don’t Wait” Returns quickly from read or write request with count of bytes successfully transferred to kernel. Read may return nothing, write may write nothing

**Asynchronous Interface**: “Tell Me Later”. When requesting data, take pointer to user’s buffer, return immediately; later kernel fills buffer and notifies user. When sending data, take pointer to user’s buffer, return immediately; later kernel takes data and notifies user 

# Disk Scheduling

Disk can do only one request at a time; What order do you choose to do queued requets?

**FIFO Order**

* Fair among requesters, but order of arrival may be to random spots on the disk => Very long seeks

**SSTF** 

Shortest seek time first

* Pick the request that’s closest on the disk

* Although called SSTF, today must include rotational delay in calculation, since rotation can be as long as seek

* Con: SSTF good at reducing seeks, but may lead to starvation

<img src="https://p.ipic.vip/222400.png" alt="image-20230703204314049" style="zoom:50%;" />

**SCAN**: Implements an Elevator Algorithm: take the closest request in the direction of travel. It's like travelling from the outer edge (track) to the inner edge (track), serving requests on each track.

No starvation, but retains flavor of SSTF

<img src="https://p.ipic.vip/7j1vfu.png" alt="image-20230703204932038" style="zoom:50%;" />

The read/write head is more likely to be near the center of the disk (middle tracks) than at either extreme end (innermost or outermost tracks). This is because the SCAN algorithm reverses direction as soon as it reaches either end of the disk. Therefore, tracks near the center get passed over more frequently than those at the extremes.

This could potentially result in shorter wait times for requests located near the center of the disk, because the read/write head will pass by these tracks more frequently.

This is a potential disadvantage of the SCAN algorithm, because it may result in longer average wait times for requests at the extremes of the disk. 

**C-SCAN**: Circular-Scan: only goes in one direction

* Skips any requests on the way back

* Fairer than SCAN, not biased towards pages in middle

<img src="https://p.ipic.vip/fuoqrq.png" alt="image-20230703205006700" style="zoom:50%;" />