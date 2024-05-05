# Remote Procedure Call as a Managed System Service

**Background**: rapid and flexible visibility and control over the flow of RPCs in datacenters.

* Monitoring and control of the performance of specific types of RPCs.
* Prioritization and rate limiting to meet application-specific performance and availability goals.
* Dynamic insertion of advanced diagnostics to track user requests across a network of microservices.
* Application-specific load balancing to improve cache effectiveness.

**Current Approaches**: enforce policies in a sidecar—a separate process (service mesh) that mediates the network traffic of the application RPC library.

**Shortcomings**: 

* Inefficient - marshaling - parsing and unwraping by the sidecar -  re-marshaling.
* RDMA or DPDK precludes sidecar policy control. (the emerging trend of efficient application-level access to network hardware.)
* Marshalling is too high in the network stack and in order for the changes to take effect developers need to recompile application/sidecar.

**Proposed**: combine marshalling and policy enforcement into a single privilege and trusted system service - marshalling is done after policy processing. Can be implemented in userspace/kernel module.

**Challenges**:

* Decouple marshalling from the application RPC library.
* Design a new policy enforcement mechanism to process RPCs efficiently and securely.
* Provide a way for operators to specify/change policies and even change the underlying transport implementation without disrupting running applications.

## Overview

<center><img src="https://p.ipic.vip/zvdv56.png" alt="Screenshot 2024-03-08 at 3.46.18 PM" style="zoom:50%;" /></center>

### Initialization

