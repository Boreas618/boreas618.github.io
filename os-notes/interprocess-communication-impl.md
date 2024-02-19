# Interprocess Communication Implementation

| IPC Mechanism | Data Type     | Participants       | Communication Mode | Kernel Implementation             |
| ------------- | ------------- | ------------------ | ------------------ | --------------------------------- |
| Pipe          | Byte Stream   | Two Processes      | Unidirectional     | FIFO Buffer (Anonymous/Named)     |
| Message Queue | Message       | Multiple Processes | Uni/Bidirectional  | Message Queue                     |
| Semaphore     | Counter       | Multiple Processes | Uni/Bidirectional  | Shared Counter                    |
| Shared Memory | Memory Region | Multiple Processes | Uni/Bidirectional  | Memory Allocation                 |
| Signal        | Signal Code   | Multiple Processes | Unidirectional     | Signal Queue & Process Group      |
| Socket        | Datagram      | Two Processes      | Uni/Bidirectional  | Network Stack (IP+Port/File Path) |

## Pipe

* Use `pipe(pipefds)` to generate two pipe descriptors (only one underlying file).

  ```c
  // Create a pipe
  if (pipe(pipefds) == -1) {
    perror("pipe");
    exit(EXIT_FAILURE);
  }
  ```

* The pipe in unidirectional, the read end is `pipefds[0]` and the write end is `pipefds[1]` for all processes which can see the pipe.

* One process closes one end and performs action on the other end.

  ```c
  // Child process
  // Close the unused read end
  close(pipefds[0]);
  
  // Write a message to the pipe
  char *msg = "Hello from child";
  write(pipefds[1], msg, strlen(msg));
          
  // Close the write end and exit
  close(pipefds[1]);
  exit(EXIT_SUCCESS);
  ```

> It's OK but NOT RECOMMENDED to do none of the `close`s above.

**Possible Cases**:

* If no one is at the write end, the readers simply stop reading.
* If someone is at the write end but the buffer is empty, the readers block until the buffer is not empty.

### Implementation

```c
SYSCALL_DEFINE2(pipe2, int __user *, fildes, int, flags)
{
	return do_pipe2(fildes, flags);
}

static int do_pipe2(int __user *fildes, int flags)
{
	struct file *files[2];
	int fd[2];
	int error;
  
	// Create the buffer area.
	error = __do_pipe_flags(fd, files, flags);
  
	if (!error) {
		if (unlikely(copy_to_user(fildes, fd, sizeof(fd)))) {
			fput(files[0]);
			fput(files[1]);
			put_unused_fd(fd[0]);
			put_unused_fd(fd[1]);
			error = -EFAULT;
		} else {
			fd_install(fd[0], files[0]);
			fd_install(fd[1], files[1]);
		}
	}
	return error;
}
```

The (simplified) in-memory description of pipe is:
```c
struct pipe_inode_info {
	struct mutex mutex;
	wait_queue_head_t rd_wait, wr_wait;
	unsigned int head;
	unsigned int tail;
	unsigned int readers;
	unsigned int writers;
	struct pipe_buffer *bufs;
};
```

The `bufs` array in `pipe_inode_info` consists of multiple instances of the `struct pipe_buffer`. Each instance of this structure includes a `struct page` and its corresponding operations.

When accessing a `buf`, the underlying data is identified by `pipe_buffer.offset` (the starting point) and `pipe_buffer.len` (the length). For instance, in order to read from the pipe, the kernel copies `[pipe_buffer.offset, pipe_buffer.offset + pipe_buffer.len]` to user space.

Generally, the "byte stream" of a pipe consists of an array of `pipe_buffer`s, which is essentially an array of pages.

---

The pipe created using the `pipe` function is known as an **anonymous pipe** and is identified by file descriptors. Anonymous pipes can be shared between processes through forking. However, if we want to establish a pipe between two distant processes, we need to use the `mkfifo` function to create **named pipes**.

## Shared Memory

In Linux kernel, the abstraction for shared memory is `shmid_kernel`:

```c
struct shmid_kernel /* private to the kernel */
{
	struct kern_ipc_perm	shm_perm;
	struct file		*shm_file;
	unsigned long		shm_nattch;
	unsigned long		shm_segsz;
	time64_t		shm_atim;
	time64_t		shm_dtim;
	time64_t		shm_ctim;
	struct pid		*shm_cprid;
	struct pid		*shm_lprid;
	struct ucounts		*mlock_ucounts;

	/*
	 * The task created the shm object, for
	 * task_lock(shp->shm_creator)
	 */
	struct task_struct	*shm_creator;

	/*
	 * List by creator. task_lock(->shm_creator) required for read/write.
	 * If list_empty(), then the creator is dead already.
	 */
	struct list_head	shm_clist;
	struct ipc_namespace	*ns;
} __randomize_layout;
```

* `shm_perm`: the standard IPC permission set. This structure is used to control access to the shared memory segment.
* `file`: the file that backs the shared memory segment. Ultimately, `file` points to a set of memory pages, which is the actual shared memory segment.
* `shm_nattach`:  the number of current attaches to the shared memory segment.
* `shm_segsz`: size of the shared memory segment in bytes.
* `time64_t shm_atim, shm_dtim, shm_ctim`: `shm_atim` is the last attach time, `shm_dtim` is the last detach time, and `shm_ctim` is the last change time. 
* `shm_cprid, shm_lprid`: representing the creator PID (process ID) and last operator PID. 
* `shm_clist`: This is a list head used to link all shared memory segments created by a single task. It's part of a linked list data structure.
* `ns`: the shared memory segment is visible only within this IPC namespace.
* `__randomize_layout`: This is a marker used in the kernel to indicate that the layout of this structure should be randomized in memory. This is a security feature to prevent certain types of attacks that rely on knowing the memory layout of kernel structures.

Each process sharing the memory segment has a VMA (Virtual Memory Area) that points to the `file` structure, which in turn points to the physical pages of the memory-mapped file. We use a `struct file *` instead of a direct pointer to the shared memory because we want to utilize the memory-mapped file mechanism.

----

Utilizing shared memory involves solving a producer-consumer problem. In the context of IPC, the `send` and `receive` operations can be implemented by addressing the producer-consumer problem within the shared memory.

## Message Queue

```c
struct msg_queue {
	struct kern_ipc_perm q_perm;
	time64_t q_stime;		/* last msgsnd time */
	time64_t q_rtime;		/* last msgrcv time */
	time64_t q_ctime;		/* last change time */
	unsigned long q_cbytes;		/* current number of bytes on queue */
	unsigned long q_qnum;		/* number of messages in queue */
	unsigned long q_qbytes;		/* max number of bytes on queue */
	struct pid *q_lspid;		/* pid of last msgsnd */
	struct pid *q_lrpid;		/* last receive pid */

	struct list_head q_messages;
	struct list_head q_receivers;
	struct list_head q_senders;
} __randomize_layout;
```

System calls:

```c
#include <sys/msg.h>

// Attach to a existing message queue or create a new message queue.
int msgget(key_t key, int msgflg);
int msgsnd(int msqid, const void *msgp, size_t msgsz, int msgflg);
ssize_t msgrcv(int msqid, void *msgp, size_t msgsz, long msgtyp, int msgflg);

// Control the message queue. Managing the permissions, deleting the message queue, ...
int msgctl(int msqid, int cmd, struct msqid_ds *buf);
```



