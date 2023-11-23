![Screenshot 2023-11-23 at 11.49.41 PM](https://p.ipic.vip/r3ore3.png)

**Traditional Data Persistence**: Memory and disks are considered standalone components of computer systems. Applications handle the data exchange between memory and disks. **Drawback**: Crash consistency bugs and performance issues.

**Single-Level Store**: Memory and disks are considered as a whole **from the perspective of applications**. The operating system takes the responsibility for data persistence, which is transparent to applications through **checkpointing**. 

**Drawback of SLS**: 

1. Performance 

   **Mechanism**: Checkpointing ([Lab 6 of OS(H) @ Fudan University](https://github.com/Boreas618/OS-Honor-23Fall/tree/lab6))

   **Reality**: There is a huge difference between memory and disks in terms of speed, volatility, and access granularity.

   **Consequence**: Low performance and risk of data loss (The low speed implies that we cannot checkpoint frequently).

2. External synchrony issue

   **Handling the API of SLS for external synchrony is non-trivial**. (e.g. `cache_sync` in [Lab 6 of OS(H) @ Fudan University](https://github.com/Boreas618/OS-Honor-23Fall/tree/lab6))

**Opportunities: The emergence of fast, byte-addressable non-volatile memory (NVM)**: Storage-like durability and DRAM-like byte-addressability and access performance. This makes it possible to perform fast and direct manipulation of persistent data (i.e., without the need for checkpointing).

**Is NVM perfect?**: CPU and device registers can still be lost upon power failures. Therefore, checkpointing is still necessary.

**Research question**:

<center><h3>Data Persistence (Checkpointing) in SLS on NVM</h3></center>
