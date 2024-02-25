# File System Implementation

**File systems**: Layer of OS that transforms block interface of disks (or other block devices) into Files, Directories, etc.

## File System Overview

<center><img src="https://p.ipic.vip/8hvl4i.png" alt="image-20230706000111552" style="zoom:50%;" /></center>

For example, in xv6, the per-process open-file table and the system wide open-file table are defined as: 

```c 
struct proc {  
  // ... 
  struct file *ofile[NOFILE]; // Open files  
  // ... 
}; 

struct {  
  struct spinlock lock;  
  struct file file[NFILE]; 
} ftable;
```

The file descriptor `struct file`, which points to an in-memory representation of inode, is defined as: 

``````c
struct file {  
  enum { FD_NONE, FD_PIPE, FD_INODE, FD_DEVICE } type;  
  int ref; // reference count  
  char readable;  
  char writable;  
  struct pipe *pipe; // FD_PIPE  
  struct inode *ip;  // FD_INODE and FD_DEVICE  
  uint off;          // FD_INODE  
  short major;       // FD_DEVICE 
}; 
``````

During the `open` system call operation, a free slot in the `ftable` is allocated to a new `file` instance. Concurrently, a slot in the `ofile` array of the process making the `open` call is set to point to this newly allocated file descriptor. The index of this slot in `ofile` is then returned by the `open` system call, effectively linking the process with the file it has opened.

## FAT (File Allocation Table)

The basic layout of a FAT disk is:

<center><img src="http://www.c-jump.com/CIS24/Slides/FAT/images/fat_layouts_compared.png" alt="FAT Layouts Compared" style="zoom:100%;" /></center>

A **cluster** is a group of consecutive sectors. A sector is usually 512 bytes in size. A cluster typically contains 1, 2, 4, 8, 16, 32, or 64 sectors (i.e., it can range from 512 B to 32 KB). Each cluster has an address and the first cluster has an address of 2 (i.e. there's no cluster 0 and 1).

> [What ext2 calls blocks, FAT calls clusters; the concept is the same](https://unix.stackexchange.com/questions/14409/difference-between-block-size-and-cluster-size). We can use the two terms interchangeably.

Files in the FAT system are collections of these disk clusters. Each file is represented by a directory entry, which records the starting cluster of the file. The FAT maintains a map of all clusters on the disk, indicating which clusters are allocated to which files and which are free.

First sectors of data area are reserved for the Root Directory, the size of which is established at boot time. Cluster 2 starts after Root Directory.

<center><img src="https://www.sqlpassion.at/wp-content/uploads/2022/03/Picture3.png" alt="Reading Files from a FAT12 Partition – SQLpassion" style="zoom:80%;" /></center>

When we **format a FAT disk**, the clusters are zeroed and FAT entries are marked "free". However, if we want a **quick format**, only the FAT entries are marked "free".

## Unix File System

Index structure is an array of *inodes*

* File Number (inumber) is an index into the array of inodes

* Each inode corresponds to a file and contains its metadata

So, things like read/write permissions are stored with *file,* not in directory

Inode maintains a multi-level tree structure to find storage blocks for files

* Great for little and large files

* Asymmetric tree with fixed sized blocks

![image-20230706003947296](https://p.ipic.vip/gmetbs.png)

For small files, there are 12 pointers direct to data blocks. It is sufficient for files up to 48 KB. 

4KB blocks can actually hold 1024 pointers. So Dbl. Indirect pointer can hold  blocks with size of 4MB. Thripl. indirect pointer can hold blocks with size of 4GB.

## Fast File System

Same inode structure as in BSD 4.1

Optimization for Performance and Reliability:

* Distribute inodes among different tracks to be closer to data.

* Uses bitmap allocation in place of freelist.

* Attempt to allocate files contiguously.

* 10% reserved disk space.

* Skip-sector positioning.

The UNIX BSD 4.2 (FFS) distributed the inodes closer to the data blocks

* Often, inode for file stored in same “cylinder group” as parent directory of the file 
* Makes an “ls” of that directory run very fast

File system volume divided into set of block groups

* Close set of tracks

Data blocks, metadata, and free space interleaved within block group

* Avoid huge seeks between user data and system structure

Put directory and its files in common block group

<center><img src="https://p.ipic.vip/drpe3f.png" alt="image-20230706022239753" style="zoom:50%;" /></center>

**First-Free Allocation**: FFS uses a first-free allocation strategy, assigning data to the first available block.**Expanding Files**: If a file needs to grow, FFS first tries to find **successive** free blocks. If none are available, it chooses a new range of blocks on the disk. Finally, it can even go to another block group.

**Block Clustering**: In this approach, FFS leaves a few unallocated spaces at the start of **a group of blocks** (block cluster), placing larger, sequential blocks towards the end.

> When a file is stored on disk, it's broken up into these blocks. If a file doesn't fully use up a block, that remaining space becomes unusable for other files because blocks cannot be shared between files. This is called internal fragmentation, and it can waste a lot of space if not managed well.
>
> To mitigate this issue, FFS uses block clustering. This involves grouping a number of blocks together into a larger block, often known as a "cluster", and treating that larger block as a single entity.

**Sequential Layout for Large Files**: For large files, FFS stores blocks in sequential order on the disk, reducing the movement of the disk head and boosting read/write performance.

**Reserve Space**: reserve 10% free space in the block group.

### Attack of the Rotational Delay

**Issue**: Read one block, do processing, and read next block. In meantime, disk has continued turning: missed next block! Need 1 revolution/block!

**Solution1**: Skip sector positioning (“interleaving”)

Place the blocks from one file on every other block of a track: give time for processing to overlap rotation

![Screenshot 2023-07-13 at 2.01.02 PM](https://p.ipic.vip/h216ig.png)

Can be done by OS or in modern drives by the disk controller

**Solution 2**: Read ahead: read next block right after first, even if application hasn’t asked for it yet

This can be done either by OS (read ahead) 

By disk itself (track buffers) - many disk controllers have internal RAM that allows them to read a complete track

## Linux Ext2/3 Disk Layout

Disk us divided into block groups. It provides locality and each group has two block-sized bitmaps (free blocks/inodes). Block sizes are settable at format time: 1K, 2K, 4K, 8K…

The actual inode strcture is similar to 4.2 BSD.

Example: create a file1.dat under /dir1/ in Ext3

<center><img src="https://p.ipic.vip/9mj5ec.png" alt="image-20230713143347825" style="zoom:50%;" /></center>

Ext3 is Ext2 with Journaling. There are several degrees of protection with comparable overhead.

### Hard Links

Hard link: 

* Mapping from name to file number in the directory structure

* First hard link to a file is made when file created

* Create extra hard links to a file with the `link()` system call

* Remove links with `unlink()` system call

When can file contents be deleted?

* When there are no more hard links to the file

* Inode maintains reference count for this purpose

### Soft Links

Soft link or Symbolic Link or Shortcut

* Directory entry contains the path and name of the file

* Map one name to another name

Contrast these two different types of directory entries:

* Normal directory entry: `<file name, file #>`

* Symbolic link: `<file name, dest. file name>`
* Unix can create soft links with `symlink` syscall

## Windows NTFS

Variable length extents rather than fixed blocks.

Everything (almost) is a sequence of \<attribute:value\> pairs (Meta-data and data)

Each entry in MFT contains metadata and:

* File’s data directly (for small files)

* A list of *extents* (start block, size) for file’s data

* For big files: pointers to other MFT entries with *more* extent lists

### Master File Table

* Database with Flexible 1KB entries for metadata/data

* Variable-sized attribute records (data or metadata)

* Extend with variable depth tree (non-resident)

### Extents – variable length contiguous regions

* Block pointers cover runs of blocks

  NTFS uses a system where a block pointer in the MFT record points to a run of blocks that constitute an extent. This is a very efficient way to represent the location of file data, especially for large files that occupy many contiguous blocks.

* Similar approach in Linux (ext4)

* File create can provide hint as to size of file

  When a new file is created, NTFS allows for a hint to be provided regarding the expected size of the file. This allows the file system to potentially allocate an appropriate number of contiguous blocks, optimizing the layout of the file on disk for better performance.

NTFS Small files: data stored with metadata

<center><img src="https://p.ipic.vip/c2xs5j.png" alt="image-20230713151816777" style="zoom:50%;" /></center>

NTFS Medium File: Extents for File Data

![image-20230713151911932](https://p.ipic.vip/35mq4z.png)

NTFS Large File: Pointers to Other MFT Records

<center><img src="https://p.ipic.vip/s9dl0t.png" alt="image-20230713151941931" style="zoom:50%;" /></center>

NTFS Huge, Fragmented File

<center><img src="https://p.ipic.vip/9j3qt3.png" alt="image-20230713152126265" style="zoom:50%;" /></center>

### NTFS Directories

* Directories implemented as B Trees

* File's number identifies its entry in MFT

* MFT entry always has a file name attribute

  Human readable name, file number of parent dir

* Hard link? Multiple file name attributes in MFT entry

# Memory Mapped Files

Traditional I/O involves explicit transfers between buffers in process address space to/from regions of a file

* This involves multiple copies into caches in memory, plus system calls

What if we could “map” the file directly into an empty region of our address space. We implicitly “page it in” when we read it. We write it and “eventually” page it out

Executable files are treated this way when we exec the process!!

## Advantages

- Memory-mapped files allow for multiple processes to share read-only access to a common file. As a straightforward example, the C standard library (`glibc.so`) is mapped into all processes running C programs. As such, only one copy of the file needs to be loaded into physical memory, even if there are thousands of programs running.
- In some cases, memory-mapped files simplify the logic of a program by using memory-mapped I/O. Rather than using `fseek()` multiple times to jump to random file locations, the data can be accessed directly by using an index into an array.
- Memory-mapped files provide more efficient access for initial reads. When `read()` is used to access a file, the file contents are first copied from disk into the kernel’s [buffer cache](https://w3.cs.jmu.edu/kirkpams/OpenCSF/Books/csf/html/Glossary.html#term-buffer-cache). Then, the data must be copied again into the process’s user-mode memory for access. Memory-mapped files bypass the buffer cache, and the data is copied directly into the user-mode portion of memory.
- If the region is set up to be writable, memory-mapped files provide extremely fast IPC data exchange. That is, when one process writes to the region, that data is immediately accessible by the other process without having to invoke a system call. Note that setting up the regions in both processes is an expensive operation in terms of execution time; however, once the region is set up, data is exchanged immediately. [[1\]](https://w3.cs.jmu.edu/kirkpams/OpenCSF/Books/csf/html/MMap.html#f17)
- In contrast to message-passing forms of IPC (such as [pipes](https://w3.cs.jmu.edu/kirkpams/OpenCSF/Books/csf/html/Glossary.html#term-pipe)), memory-mapped files create persistent IPC. Once the data is written to the shared region, it can be repeatedly accessed by other processes. Moreover, the data will eventually be written back to the file on disk for long-term storage.

## Interface

![image-20230713154518503](https://p.ipic.vip/ri9ylu.png)

```c
#include <sys/mman.h> /* also stdio.h, stdlib.h, string.h, fcntl.h, unistd.h */

int something = 162;

int main (int argc, char *argv[]) {
  int myfd;
  char *mfile;

  printf("Data  at: %16lx\n", (long unsigned int) &something);
  printf("Heap at : %16lx\n", (long unsigned int) malloc(1));
  printf("Stack at: %16lx\n", (long unsigned int) &mfile);

  /* Open the file */
  myfd = open(argv[1], O_RDWR | O_CREAT);
  if (myfd < 0) { perror("open failed!");exit(1); }

  /* map the file */
  mfile = mmap(0, 10000, PROT_READ|PROT_WRITE, MAP_FILE|MAP_SHARED, myfd, 0);
  if (mfile == MAP_FAILED) {perror("mmap failed"); exit(1);}

  printf("mmap at : %16lx\n", (long unsigned int) mfile);

  puts(mfile);
  strcpy(mfile+20,"Let's write over it");
  close(myfd);
  return 0;
}
```

# Buffer Cache

Kernel *must* copy disk blocks to main memory to access their contents and write them back if modified

* Could be data blocks, inodes, directory contents, etc.

* Possibly dirty (modified and not written back)

**Key Idea**: Exploit locality by caching disk data in memory

* Name translations: Mapping from paths to inodes

* Disk blocks: Mapping from block address to disk content 

**Buffer Cache**: Memory used to cache kernel resources, including disk blocks and name translations

* Can contain “dirty” blocks (with modifications not on disk)

## Discussion

Implemented entirely in OS software

* Unlike memory caches and TLB

Blocks go through transitional states between free and in-use

* Being read from disk, being written to disk

* Other processes can run, etc.

Blocks are used for a variety of purposes

* inodes, data for dirs and files, freemap

* OS maintains pointers into them

Termination – e.g., process exit – open, read, write

### Replacemen policy

* Advantages:
  * Works very well for name translation
  * Works well in general as long as memory is big enough to accommodate a host’s working set of files.

* Disadvantages:

  * Fails when some application scans through file system, thereby flushing the cache with data used only once

    Example: `find . –exec grep foo {} \;`

Some systems allow applications to request other policies. Example, ‘Use Once’:File system can discard blocks as soon as they are used

### Cache Size

How much memory should the OS allocate to the buffer cache vs virtual memory?

* Too much memory to the file system cache Þ won’t be able to run many applications

* Too little memory to file system cache Þ many applications may run slowly (disk caching not effective)

* Solution: adjust boundary dynamically so that the disk access rates for paging and file access are balanced

### File System Prefetching

Read Ahead Prefetching: fetch sequential blocks early

* Key Idea: exploit fact that most common file access is sequential by prefetching subsequent disk blocks ahead of current read request

* Elevator algorithm can efficiently interleave prefetches from concurrent applications

How much to prefetch?

* Too much prefetching imposes delays on requests by other applications

* Too little prefetching causes many seeks (and rotational delays) among concurrent (which indicates a great number of processes) file requests

### Delayed Writes

Buffer cache is a writeback cache (writes are termed “Delayed Writes”)

`write()` copies data from user space to kernel buffer cache

* Quick return to user space

`read()` is fulfilled by the cache, so reads see the results of writes

* Even if the data has not reached disk

When does data from a `write` syscall finally reach disk?

* When the buffer cache is full (e.g., we need to evict something)

* When the buffer cache is flushed periodically (in case we crash)

Advantages:

* Performance advantage: return to user quickly without writing to disk!

* Disk scheduler can efficiently order lots of requests

  Elevator Algorithm can rearrange writes to avoid random seeks

* Delay block allocation: 

  May be able to allocate multiple blocks at same time for file, keep them contiguous

* Some files never actually make it all the way to disk

  Many short-lived files!
