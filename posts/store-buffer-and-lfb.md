# Store Buffer and LFB

This post is modified from the answers in[How do the store buffer and Line Fill Buffer interact with each other?](https://stackoverflow.com/questions/61129773/how-do-the-store-buffer-and-line-fill-buffer-interact-with-each-other)

The **store buffer** is used to track stores, in order, both before they retire and after they retire but before they commit to the L1 cache.

The **line fill buffer** primary deals with both loads and stores that miss in the L1 cache. Essentially, it is the path from the L1 cache to the rest of the memory subsystem and deals in cache line sized units.

**How a store would pass the store buffer and LFB**

1. A store instructions gets decoded and split into store-data and store-address uops, which are renamed, scheduled and have a store buffer entry allocated for them.

2. The store uops execute in any order or simultaneously (the two sub-items can execute in either order depending mostly on which has its dependencies satisfied first).

   1. The store data uop writes the store data into the store buffer.
   2. The store address uop does the V-P translation and writes the address(es) into the store buffer.

3. At some point when all older instructions have retired, the store instruction *retires*. This means that the instruction is no longer speculative and the results can be made visible. At this point, the store remains in the store buffer and is called a *senior* store.

4. The store now waits until it is at the head of the store buffer (it is the oldest not committed store), at which point it will commit (become globally observable) into the L1, if the associated cache line is present in the L1 in MESIF Modified or Exclusive state. (i.e. this core owns the line)

5. If the line is not present in the required state (either missing entirely, i.e,. a cache miss, or present but in a non-exclusive state), permission to modify the line and the line data (sometimes) must be obtained from the memory subsystem: this allocates an LFB for the entire line, if one is not already allocated. This is a so-called *request for ownership* (RFO), which means that the memory hierarchy should [return the line](https://en.wikipedia.org/wiki/MESI_protocol) in an exclusive state suitable for modification, as opposed to a shared state suitable only for reading (this invalidates copies of the line present in any other private caches).

   An RFO to convert Shared to Exclusive still has to wait for a response to make sure all other caches have invalidated their copies. The response to such an invalidate doesn't need to include a copy of the data because this cache already has one. It can still be called an RFO; the important part is gaining ownership before modifying a line.

6. In the miss scenario the LFB eventually comes back with the full contents of the line, which is committed to the L1 and the pending store can now commit.
