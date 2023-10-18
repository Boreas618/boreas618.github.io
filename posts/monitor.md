# Monitors, Condition Variables and Three Semantics

Semaphores and locks are powerful synchronization primitives that can help prevent race conditions to some extent. However, the use of these primitives is subtle and complex. Even slight mistakes can lead to serious concurrency issues[^1]. For example, consider the following code:

```c
sem_t empty;
sem_t mutex;
sem_t full;

void *producer(void *param) {
    item_type item;
    while (TRUE) {
        item = produce();
        
        sem_wait(&empty);
        sem_wait(&mutex);
        enqueue(&buffer, item);
        sem_post(&mutex);
        sem_post(&full);
    }
    return NULL;
}

void *consumer(void *param) {
    item_type item;
    while (TRUE) {
        sem_wait(&full);
        sem_wait(&mutex);
        dequeue(&buffer, &item);
        sem_post(&mutex);
        sem_post(&empty);
        
        consume(item);
    }
    return NULL;
}
```

This is how we address the producer/consumer problem using semaphores. Let's say a programmer mistakenly exchanges the order of `sem_wait(&empty);` and `sem_wait(&mutex);` in the producer code, and the buffer happens to be full. As a result, a deadlock can occur because the producer now holds the `mutex` and waits for `empty`, while the consumer waits for the `mutex` and cannot proceed to consume the items in the buffer.

## Monitors

To address the limited fault tolerance of locks and semaphores, Brinch Hansen (1973) and Hoare (1974) introduced a higher-level synchronization primitive known as a **monitor**[^1]. A monitor is a feature implemented by programming languages (compilers) that can reduce the likelihood of errors in concurrent programs. To avoid making the concept too abstract, we first present a Java implementation of a monitor that aims to solve the producer/consumer problem.

```java
class Monitor {
  private static final int N = 10; 
  private int[] buffer = new int[N];
  private int count = 0, lo = 0, hi = 0;
  
  public synchronized void insert(int val) {
    while (count == N)
      go_to_sleep();
    buffer[hi] = val;
    hi = (hi + 1) % N;
    count++;
    if (count == 1)
      notifyAll();
  }
  
  public synchronized int remove() {
    while (count == 0)
      go_to_sleep();
    int val = buffer[lo];
    lo = (lo + 1) % N;
    count--;
    if (count == N - 1)
      notifyAll(); 
    return val;
  }
  
  private void go_to_sleep() {
    try {
      wait();
    } catch (InterruptedException exc) {
      Thread.currentThread().interrupt();
    }
  }
}
```

This is a monitor managing the buffer between the producer and consumer. Now, let's explain monitors in detail.

A monitor is a collection of local data (`buffer`, `count`, `lo`, `hi`) and procedures (`insert`, `remove`, and `go_to_sleep`) that control access to resources shared by different threads. It provides the programmers with the basic assumption that **only one process can be active in a monitor at any given time.** The specific implementation of this assumption may vary depending on the programming languages and compilers used. In our Java example above, this assumption is achieved using the `synchronized` keyword. The keyword guarantees that only one thread can execute the synchronized method (or block) on a given object at a time.

Readers may wonder how the `synchronized` keyword ensures that only one thread can execute the synchronized method (or block) on a given object at any given time. Unfortunately, the detailed implementation is too complicated to be explained here. However, some common implementations do utilize semaphores and locks within the monitor. It may be questioned why semaphores and locks are used here, considering that we previously discussed their susceptibility to concurrency issues. It should be noted that the semaphores and locks used here are managed by programming languages and compilers, which are more reliable than fallible human programmers. Therefore, it is wise to rely on the programming language and compiler to handle semaphores and locks on our behalf.

We find that safely configured semaphores and locks are satisfactory. However, certain implementations of semaphores and locks involve spinning, which consumes a considerable amount of computing resources. Are there any better solutions?

## Condition Variables

Instead of spinning, threads can simply go to sleep in the context of condition variables. 

Condition variables are equipped with two operations: `wait` and `signal`. They are similar to `P` and `V` in semaphores. The potential difference is that when the condition is not met, `wait` will put the current process to sleep. (I'm not entirely sure whether the semaphore is meant to spin or sleep. I have seen both versions.)

In this blog, we present a demo code that utilizes condition variables[^2]. Similar ideas can be adapted for implementing monitors.

```c
int done = 0;
pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t c = PTHREAD_COND_INITIAILIZER;

void thread_exit() {
  pthread_mutex_lock(&m); // Notes 2
  done = 1; // Notes 1
  pthread_cond_signal(&c); // Notes 2
  pthread_mutex_unlock(&m); // Notes 2
}

void *child(void *arg) {
  printf("child\n");
  thread_exit();
  return NULL;
}

void thread_join() {
  pthread_mutex_lock(&m); // Notes 2
  while (done == 0) // Notes 1 & 3
    pthread_cond_wait(&c, &m); // Notes 2
  pthread_mutex_unlock(&m);// Notes 2
}

int main(int argc, char *argv[]) {
  printf("parent: begin\n");
  pthread_t p;
  pthread_create(&p, NULL, child, NULL);
  thread_join();
  printf("parent: end\n");
  return 0;
}
```

**Notes**:

1. Use `done` to construct a condition is necessary.

   ```c
   void thread_exit() {
     pthread_mutex_lock(&m);
     pthread_cond_signal(&c);
     pthread_mutex_unlock(&m);
   }
   
   void thread_join() {
     pthread_mutex_lock(&m);
     pthread_cond_wait(&c, &m);
     pthread_mutex_unlock(&m);
   }
   ```

   If `thread_exit()` is called before `thread_join()`, the parent thread will never wake up because there will be no thread signaling the condition variable.

2. To hold a lock when signaling and waiting is necessary.

   ```c
   void thread_exit() {
     done = 1;
     pthread_signal(&c);
   }
   
   void thread_join() {
     if (done == 0)
       pthread_cond_wait(&c);
   }
   ```

   Imagine a situation where the parent is about to call `pthread_cond_wait`, and the child, which calls `thread_exit` and does not wake up any threads, is scheduled. When the parent is eventually rescheduled, it will sleep indefinitely because there will be no threads to wake it up by signaling.

   However, the lock for wait ensures that the child will be scheduled only after the parent is put to sleep. In other words, the operation of "releasing the mutex and being put to sleep" is atomic.

3. The `while` loop is necessary.

   Spurious wakeups can occur. This means that `pthread_cond_wait()` can return even if no thread explicitly signaled the condition variable. 

   More importantly, in Mesa semantics, a thread being woken up will not run immediately. When the thread is about to run, the condition may have already changed. Therefore, a `while` loop is needed because we need to double (or more) check the condition.

To summarize, three rules should be followed:

- Construct an explicit condition (`done == 1` in this case).
- Hold a lock when signaling and waiting.
- Use `pthread_cond_wait()` inside a loop.

## Three Semantics

Looking back at what we have explored, we were curious about the underlying implementation of monitors, so we introduced the concept of `synchronized`. Then, we became curious about the underlying implementation of `synchronized`, which led us to the introduction of condition variables. Finally, we wanted to understand the internal workings of condition variables, and here it is.

Consider the following scenario:

> A is `wait`ing for the buffer. B now `signal`s the buffer. Now, what's to run next? A or B?

There are three semantics to model this possible exection sequence[^3]:

* Mesa Semantics
* Brinch Hansen Semantics
* Hoare Semantics

<img src="https://dengzuoheng.github.io/images/monitor_mesa.jpg" alt="Mesa" style="zoom:50%;" />

<img src="https://dengzuoheng.github.io/images/monitor_bh.jpg" alt="Brinch Hansen" style="zoom:50%;" />

<img src="https://cseweb.ucsd.edu/classes/sp16/cse120-a/applications/ln/monitor_hoare.jpg" alt="img" style="zoom:50%;" />

Compared to Mesa Semantics, in the context of Brinch Hansen Semantics, thread B signals on the buffer only after it has left the monitor.

In the context of Hoare Semantics, thread A is immediately brought back to the monitor after thread B signals on the buffer. At the same time, B is put into the signal queue to wait for thread A to leave the monitor.

> **For students who take COMP130110.03 @ Fudan University**
>
> The pseudo code on page 107 of the slides from chapter 5 of COMP130110.03 is an implementation of Hoare Semantics for condition variables:
>
> ```c
> void* wait() {
>   condcount = condcount + 1;
>   if (urgentcount > 0)
>     signal(urgent);
>   else
>     signal(mutex);
>   wait(condsem);
>   condcount = condcount - 1;
> }
> 
> void* signal() {
>   urgentcount = urgentcount + 1;
>   if(condcount > 0) {
>     signal(condsem);
>     wait(urgent);
>   }
>   urgentcount = urgentcount - 1;
> }
> ```

# References

[^1]: Andrew, S. T., & Herbert, B. (2015). *Modern operating systems*. Pearson Education.
[^2]: Arpaci-Dusseau, R. H., & Arpaci-Dusseau, A. C. (2018). *Operating systems: Three easy pieces*. Arpaci-Dusseau Books, LLC.
[^3]: Gregory Kesden, [Monitors and Condition Variables](https://cseweb.ucsd.edu/classes/sp16/cse120-a/applications/ln/lecture9.html)

