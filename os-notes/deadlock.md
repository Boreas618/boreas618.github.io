# Deadlocks

<center><img src="https://p.ipic.vip/mhh6l6.png" alt="Screenshot 2023-10-29 at 10.43.39 PM" style="zoom: 33%;" /></center>

## Requirements for Deadlock

Four requirements for occurrence of Deadlock:

* **Mutual exclusion**: Only one thread at a time can use a resource.

* **Hold and wait**: Thread holding at least one resource is waiting to acquire additional resources held by other threads

* **No preemption**: Resources are released only voluntarily by the thread holding the resource, after thread is finished with it

* **Circular wait**: Having a circle doesn't mean that a dead lock exists. 

<center><img src="https://p.ipic.vip/jalu9q.png" alt="Screenshot 2023-06-23 at 1.20.00 AM" style="zoom:50%;" /></center>

## Deadlock Prevention

* **Infinite resources**: Include enough resources so that no one ever runs out of resources.

* **No Sharing of resources** (totally independent threads): Not very realistic

* **Don’t allow waiting** 
* **Make all threads request everything they’ll need at the beginning**

* **Force all threads to request resources in a particular order preventing any cyclic use of resources**

## Deadlock Detection

Given Matrices:

- **Request Matrix Q**
- **Allocation Matrix A**
- **Resource Vector**
- **Available Vector**

-----

1. **Mark each process** that has a row in the Allocation Matrix of all zeros.
2. **Initialize a temporary vector W** to equal the Available vector.
3. **Find an index i** such that process i is currently unmarked and the ith row of Q is less than or equal to W. If no such row is found, terminate the algorithm.
4. If such a row is found, **mark process i** and add (the process continues and finally releases the resources it holds) the corresponding row of the allocation matrix to W. Return to Step 3.

-------

**Mark**s mean granting the requests. We perform marks on the request matrix.

The core of this algorithm is to determine whether, **given the current situation of requests**, we can find a sequence of allocations to make. If there's no requests, the system is not deadlocked even if it is in unsafe state.

----

There are several candidate strategies for determining when to detect deadlocks.：

* To check every time a resource request is made (certain to detect deadlocks as early as possible, but potentially expensive in terms of CPU time)
* To check every $k$ minutes
* To check only when the CPU utilization has below some threshold (if enough processes are deadlocked, there will be few runnable processes)

## Deadlock Recovery

Roll back the actions of deadlocked threads

## Deadlock Avoidance

Two approaches to avoid deadlock:

* Process Initailization Denial
* Resource Allocation Denial

----

**Advantages**

* It is not necessary to preempt or roll back processes (as in deadlock detection)

- It is less restrictive than deadlock prevention

**Disadvantages**:

* Maximum resource requirement must be stated in advance

- Processes under consideration must be independent; no synchronization requirements
- There must be a fixed number of resources to allocate
- No process may exit while holding resources

-----

### Process Initialization Denial

A process $\text{P}_\text{{n+1}}$ can start only if
$$
R_i \geq C_{n+1\space i} + \sum_{k=1}^{n} C_{ki}
$$

### Resource Alloaction Denial

**Safe state**: there is **at least one** sequence that does not result in deadlock.

**Unsafe state**: a state that is not safe.

We can make sure that the system is always in a safe state to avoid deadlock. For a resource allocation request, we assume that the resource is granted and examine the state of the system after allocation. If the new state is unsafe, then we deny the request.

### Banker's Algorithm

When a process makes a request for a set of resources, assume that the request is granted. Update the system state accordingly. Then determine whether the result is a safe state. If safe, grant the request; otherwise, block the process until it is safe to grant the request.

----

**An unsafe state is not necessarily a deadlock.**

Consider a system with 12 tape drives with:

```
Process       Max Need       Current
P0:             10              5
P2:              9              3
```

This is an unsafe state. But we're not in a deadlock. There's only 4 free drives, so, for example, if P0 *does* request an additional 5, and P2 *does* request an additional 1, we will deadlock, but it hasn't happened yet. And P0 might *not* request any more drives, but might instead free up the drives it already has. The `Max need` is over all possible executions of the program, and this might not be one of the executions where we need all 10 drives in P0.

