# Transactional Memory

```
@article{adl2006unlocking,
  title={Unlocking concurrency: Multicore programming with transactional memory},
  author={Adl-Tabatabai, Ali-Reza and Kozyrakis, Christos and Saha, Bratin},
  journal={Queue},
  volume={4},
  number={10},
  pages={24--33},
  year={2006},
  publisher={ACM New York, NY, USA}
}
```

# Background

**Drawbacks of the current lock-based synchronization**: 

* Simplistic coarse-grained locking does not scale well.

* Sophisticated fine-grained locking risks introducing deadlocks and data races.

* Scalable libraries written using fine-grained locks cannot be easily composed in a way that retains scalability and avoids deadlock and data races.

  > **Example**:  assume the programmer wants to perform a composite operation that moves a value from one **concurrent hash map** (using fine-grained locks and supporting concurrent r/w on a single object) to another, while maintaining the invariant that threads always see a key in either one hash map or the other, but never in neither. Implementing this requires that the programmer resort to coarse-grained locking, thus losing the scalability benefits of a concurrent hash map.

* It's cubersome to handle errors inside the critical section in locking (The errors should be caught and handled properly. Also, the global state should be restored).

<img src="https://p.ipic.vip/gus48b.png" alt="Screenshot 2023-11-29 at 3.38.14 PM" style="zoom: 33%;" />

**Concepts of transactional memory**:

* Commit/Abort
* Isolation: as if other threads are suspended

**Why transactional memory can provide good scalability?**

* Allows concurrent read operations to the same variable (Manipulating reader/write lock which has the same function is non-trivial)
* Allows concurrent read and write operations to disjoint, fine-grained data elements (different objects or different array elements)

# Theory: Mechanisms and Strategies

**Mechanism: Data Versioning**

* **Eager Versioning**: a write access within a transaction immediately writes to memory the new data version. The old version is buffered in an undo log.

  > **Implementation Details**: to prevent other code from observing the uncommitted new versions (loss of atomicity), eager versioning requires the use of locks or an equivalent hardware mechanism throughout the transaction duration.

* **Lazy Versioning**: stores all new data versions in a write buffer until the transaction completes.

  > **Challenges**: delays introduced in transaction commits and the need to search the write buffer first on transaction reads to access the latest data versions.

**Mechanism: Conflict Dectection**

Tracking read set and write set for each transaction.

* **Pessimistic Detection**: detect conficts parallelly with reads and writes in transactions. Resolve conficts either by pausing or aborting one transaction. Deadlock is possible.

* **Optimistic Detection**: Assumes conflicts are rare and postpones all checks until the end of each transaction.

  **Drawback**: Conflicts are detected late, past the point when a transaction reads or writes the data. Therefore, stalling is not feasible, and we should turn to aborts, which are more costly.

  **Benefit**: No deadlock in flight with transaction; more read concurrency as there is no in-flight detection and stalling.

  **Not Work with Eager Versioning**

**Strategy: Granularity of Conflict Detection**

* **Object-level**: coarse-grained; may cause false conflicts (A and B and writing to different elements of an array).
* **Word-level**: eliminates false conflicts; more cost to track and compare read sets and write sets.
* **Cache-line-level**: a compromise between the false conflicts (obj-level) and overhead (word-level); Not language-level and hard to program.

**Strategy: Handling Nested Transactions**

* **Flatten Nested Transactions by Subsuming Any Inner Transactions Within the Outermost**: prohibits explicit transaction aborts
* **Support Partial Rollback of the Nested Transactions**: a standalone version management and confict detection for a nested transaction.

**Hybrid strategies**:

* Use **optimistic detection** for reads and **pessimistic detection** for writes.
* Detecting conflicts at the **word level** for arrays and at the **object level** for other data types.

# Implementation

Two directions: software and hardware.

## Software Transactional Memory

An STM implementation uses read and write barriers (that is, inserts instrumentation) for all shared memory reads and writes inside transactional code blocks.

```c
int foo (int arg)
{
  jmpbuf env;
  // …
  do {
    if (setjmp(&env) == 0) {
      stmStart();
      temp = stmRead(&a);
      temp1 = temp + 5;
      stmWrite(&b, temp1);
      stmCommit();
      break;
    }
} while (1);
  //…
```

On an abort, the STM library rolls back all the updates performed by the transaction, uses a longjmp to restore the context saved at the beginning of the transaction, and reexecutes the transaction.

> **Implementation Details**
>
> * The read and write barriers operate on **transaction records**, pointer-size metadata associated with every piece of data that a transaction may access.
>
> * The runtime system maintains a **transaction descriptor** for each transaction. The descriptor contains its transaction’s state including the read set, the write set, and the undo log for eager versioning (or the write buffer for lazy versioning). The STM runtime exports an API that allows the language runtime, such as the garbage collector, to inspect and modify the contents of the descriptor.
>
> * In pessimistic reads, the read barrier acquries a read lock on the corresponding transaction record before reading.
>
>   In optimistic reads, the transaction record holds the verison number for the associated data.

**Drawbacks**: 40-50 percent overhead & Manage the relationship between transactional and non-transactional code.

## Hardware Transactional Memory

Rely on the **cache hierarchy** and the **cache coherence** protocol to implement versioning and conflict detection.

Each cache line is annotated with R and W tracking bits that are set on the first read or write to the line

* **Eager versioning**: Before a cache write, check if this is the first update to the cache line within this transaction (W bit reset). In this case, the cache line and its address are added to the undo log using additional writes to the cache. If the transaction aborts, a hardware or software mechanism must traverse the log and restore the old data versions.
* **Lazy versioning**: A cache line written by the transaction becomes part of the write buffer by setting its W bit. If the transaction aborts, the write buffer is instantaneously flushed by invalidating all cache lines with the W bit set. If the transaction commits, the data in the write buffer becomes instantaneously visible to the rest of the system by resetting the W bits in all cache lines.
* **Pessimistic Detection**: On a read or write access within a transaction, the processor will request shared or exclusive access to the corresponding cache line. A conflict is signaled if a remote cache has a copy of the same line with the R bit set (for an exclusive access request) or the W bit set (for either request type). 

* **Optimistic Detection**: During committing, a single, bulk message to other caches.

**Drawbacks**: Caches have finite capacity.

**Fix**

* **Hybrid HTM-STM**Transactions start using the HTM mode. If hardware resources are exceeded, the transactions are rolled back and restarted in the STM mode.

  > **Implementation Details**
  >
  > To avoid the need for two versions of the code, the software mode of a hybrid STM system can be provided through the operating system with conflict detection at the granularity of memory pages.
  >
  > **My Thoughts**
  >
  > A cache line may be of 32-512 bytes. The granularity for STM should be larger than this number. A page is convenient to maintain.

* **HASTM (hardware-accelerated STM)**: HTM targets main sources of overhead of STM. Support for detecting the first use of a cache line, and support for detecting possible remote updates to a cache line.