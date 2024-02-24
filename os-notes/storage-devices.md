# Storage Devices

## Magnetic disks

* Storage that rarely becomes corrupted
* Block level random access
* Slow performance for random access
* Better performance for sequential access

<center><img src="https://p.ipic.vip/yrl6bj.png" alt="Screenshot 2023-12-23 at 9.26.08 PM" style="zoom:33%;" /></center>

### Physical Characteristics

**Fixed-head disk**: one read/write head per track (figure above). All the heads are mounted on a rigid arm that extends across all tracks.

**Movable-head**: only one head. The arm can be extended or retracted to position the head above any track.

A **nonremovable disk** is permanently mounted in the disk drive

A **removable disk** can be removed and replace with another disk

A **single platter disk** vs. A **multiple platter disk**

### Addressing

In the early days of hard drivers, the number of sectors pre track was the same for all tracks on the disk. The date density for the outer track is lower.

To make better use of the available space on the disk, hard drive manufacturers started using a technique called zone bit recording (ZBR). In ZBR, the hard drive surface is divided into different zones or regions, each of which contains a certain number of sectors per track. The outer zones, which are larger, contain more sectors per track than the inner zones. This means that more data can be stored on the outer tracks, matching their larger physical size.

<img src="https://p.ipic.vip/dkxd1t.png" alt="Screenshot 2023-12-23 at 9.23.49 PM" style="zoom: 33%;" />

------

**CHS block addressing**: an early block addressing scheme. $(\text{Cylinder No.}, \text{Head No.}, \text{Sector No.})$ This  scheme exposes cylinder, head and section to OS.

**Logical Block Addressing**: Storage devices are addressed as large one-dimensional arrays of **logical blocks**, where the logical block is the smallest unit of transfer. Each logical block maps to a physical sector or semiconductor page. The one-dimensional array of logical blocks is mapped onto the sectors or pages of the device.

### Disk Scheduling

Disk can do only one request at a time; What order do you choose to do queued requets?

-----

**Disk Performance Parameters**:

* **Seek time** $T_s$
* **Rotation time** Avg. $\frac{1}{2r}$
* **Transfer time**: $T=b/(rN)$ where $b$ is the number of bytes to be transferred, $N$ is number of bytes on a track and $r$ is the rotation speed, in revolutions per second.

$$
Ta=Ts+1/(2r)+b/(rN)
$$

-----

**FIFO**: Fair among requesters, but order of arrival may be to random spots on the disk => Very long seek

**Priority**: Short batch jobs may have higher priority. Longer jobs may have to wait excessively long times. Provide good interactive response time.

**SSTF**:  Shortest seek time (move between tracks) first

* Although called SSTF, today must include rotational delay in calculation, since rotation can be as long as seek

* SSTF is good at reducing seeks, but may lead to starvation.

<center><img src="https://p.ipic.vip/222400.png" alt="image-20230703204314049" style="zoom:50%;" /></center>

**SCAN**: Implements an Elevator Algorithm: take the closest request in the direction of travel. It's like travelling from the outer edge (track) to the inner edge (track), serving requests on each track.

No starvation, but retains flavor of SSTF

<center><img src="https://p.ipic.vip/7j1vfu.png" alt="image-20230703204932038" style="zoom:50%;" /></center>

The read/write head is more likely to be near the center of the disk (middle tracks) than at either extreme end (innermost or outermost tracks). This is because the SCAN algorithm reverses direction as soon as it reaches either end of the disk. Therefore, tracks near the center get passed over more frequently than those at the extremes.

This could potentially result in shorter wait times for requests located near the center of the disk, because the read/write head will pass by these tracks more frequently.

This is a potential disadvantage of the SCAN algorithm, because it may result in longer average wait times for requests at the extremes of the disk. 

**C-SCAN**: Circular-Scan: only goes in one direction

* Skips any requests on the way back

* Fairer than SCAN, not biased towards pages in middle

<center><img src="https://p.ipic.vip/fuoqrq.png" alt="image-20230703205006700" style="zoom:50%;" /></center>

----

With SSTF, SCAN and C-SCAN, it is possible that the arm may not move for a considerable period of time

For example, if one or a few processes have high access rates to one track, they can monopolize the entire device by repeated requests to that track.

---

**N-step-SCAN**：egments the disk request queue into subqueues of length `N`

- Subqueues are processed one at a time, using SCAN
- New requests added to other queue when queue is processed. With large values of `N`, `N`-step-SCAN approaches SCAN. With a value of N=1, it is the same as FIFO

**FSCAN**: Two queues. When a scan begins, all the requests are in one queue, with another queue empty. During the scan, all new requests are put into the other queue.

## SSD

* Storage that rarely becomes corrupted
* Capacity at intermediate cost (5-20x disk)
* Block level random access
* Good performance for reads; worse for random writes
* Erasure requirement in large blocks
* Wear patterns issue

### Access Patterns

**Read**: read 4 KB Page: ~$25$ usec . There's no seek or rotational time.

**Transfer time**: transfer a 4KB page. SATA: $300-600MB/s$ => $ \frac{4\times 10^3 b}  {400 \times 10^6 bps} \approx 10 us$
$$
T = T_{\text{Queuing}} + T_{\text{Controller}} + T_{\text{Transfer}}
$$


**Highest Bandwidth**: Both Sequential and Random reads

----

**Write**: Writing is adding electrons and erasing is removing electrons. Can only write empty pages in a block

Erasing a block takes $~1.5$ ms. 

Controller maintains pool of empty blocks by coalescing used pages (read, erase, write), also reserves some % of capacity.

We can only erase in big chunks:

<center><img src="https://p.ipic.vip/8oqs2i.png" alt="image-20230703000834471" style="zoom:50%;" /></center>

Eeasure are 10 times slower than writes and writes are 10 times slower than reads.

**Why not just erase and rewrite new version of entire 256KB block?**

* Erasure is very slow (milliseconds)
* Each block has a finite lifetime, can only be erased and rewritten about 10K times
* Heavily used blocks likely to wear out quickly

----

Two principles:

* **Layer of Indirection**: Maintain a *Flash Translation Layer (FTL)* in SSD. Map virtual block numbers (which OS uses) to physical page numbers (which flash memory controller uses)
* **Copy on Write**: Don’t overwrite a page when OS updates its data. Instead, write new version in a free page. Update FTL mapping to point to new location.

There's no need to erase and rewrite entire 256KB block when making small modifications. SSD controller can assign mappings to spread workload across pages.

What to do with old versions of pages? *Garbage Collection* in background. Erase blocks with old pages, add to free list.
