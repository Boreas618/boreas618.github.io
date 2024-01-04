<center><img src="https://p.ipic.vip/nj7wf6.png" style="zoom:100%;" /></center>

## Background of Containers Administration

* **Containers**

  Operating system-level virtualization technology provides isolated environment called containers within a common operating system. It comprises a group of one or more processes that are isolated from the rest of the system.

  > Linux kernel tools for containers: cgroups, namespaces, and chroot.

* **Container Orchestrators**

  > (Orchestrators) provide tools that help us automate the deployment, management, scaling, interconnection, and availability of our container-based applications.

  Kubernetes is an orchestrator of containers. There are other container orchestrators such as **Docker Swarm**  and **Mesos** but Kubernetes is the de facto standard.

* **Container Managers**

  **Difference between container managers (like Docker) and orchestrators (like Kubernetes)**: Container managers focus on handling containers in a limited scope, while container orchestrators are designed for broader applications, often in large, distributed systems with multiple nodes.

* **Container Runtimes**

  The container runtimes are softwares responsible for running containers. Example: LXC, RunC, CRun, or Kata.

  Containerd and CRI-O are **high-level container runtimes** (which encapsulate LXC, RunC, ...) that implement the **Open Container Initiative (OCI)**, a standard specification for image formats and runtimes re- quirements providing container portability.

  In order to be managed by Kubernets, Containerd and CRI-O both implement the **standard Container Runtime Interface (CRI)**.

The above concepts can be reflected in the following figure:

<center><img src="https://p.ipic.vip/79ll8w.png" alt="Screenshot 2023-11-15 at 12.59.47 AM" style="zoom: 50%;" /></center>

`kubelet` is the daemon component of the Kubernetes orchestrator that communicates with the high-level container runtime.

`Docker Daemon` acts as a container manager with an API that simplifies the management of the lifecycle of the containers and communicates with containerd.

* **Pod**: A pod is the basic deployment unit that can be operated and managed in the cluster.

* **Node**: A node can be a physical or virtual machine.

<center><img src="https://miro.medium.com/v2/resize:fit:1344/1*vJp5o7ABILiIapesES8j6g.png" alt="img" style="zoom:50%;" /></center>

> Using software-defined overlay networks, such as Flannel or Calico, allows K8s to assign a unique IP address to each pod and service.

**Component of Mater Nodes**: etcd, scheduler, API server and controllers.

## Scheduling: User Specifications

Workloads of a given set of nodes: **affinity**, **taint** and **toleration**.

* **Affinity** is **a property of pods** that attracts them to a set of nodes either as a preference or a hard requirement). 

* **Taint** is **a property of nodes** that repel a set of pods. 

* **Toleration** is **a property of pods** that allows the scheduler to schedule pods with matching taints.

The [kube-scheduler](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-scheduler/) uses **request** to decide which node to place the Pod on. The [kubelet](https://kubernetes.io/docs/reference/generated/kubelet) enforces those **limit**s so that the running container is not allowed to use more of that limit. The kubelet also reserves at least the **request** amount of that resource specifically for that container to use. If the node where a pod is running has enough of a resource available, it's possible (and allowed) for a container to use more resource than its `request` for that resource specifies. However, a container is not allowed to use more than its resource `limit`.

Nodes dealing with lack of resources: based on QoS class.

**Best-effort**: the pod can use as much resource above the request quota as posssible and will be evicted if the node is under resource pressure.

**Guranteed**: the pods specify a request value equal to the limit. They are guaranteed not to be killed until they exceed their limits or there are no lower-priority Pods that can be preempted from the Node.

**Burstable**: have lower-bound resource guarantees based on the request, but do not require a specific limit. If a limit is not specified, it defaults to a limit equivalent to the capacity of the Node, which allows the Pods to use as much as resource as available. These Pods are evicted after all `BestEffort` Pods are evicted.

## Scheduling: Internal Workflow

1. The request is authenticated first and validated.
2. The **API server** on the **mater node**  creates a **pod object**, without assigning it to a node, updates the information of the newly created pod in **etcd** and updated/shows us a message that a **pod** is got created.
3. The **scheduler** which is continually monitoring the **API server** gets to know that a new pod is got created with no node assigned to it.
4. The **scheduler** identifies the right node to place the new **pod** and communicate back to the **API server** (with the information of the right node for the pod)
5. The **API server** again updates the information to the **etcd** received from **Scheduler**.
6. The **API server** then passed the same information to the **kubelet agent** on the appropriate **worker node** identified by **scheduler** in the 4th step.
7. The **kubelet** then creates the pod on node and instructs the **container runtime engine** to deploy the application image/container.
8. Once done, the **kubelet** updates the information/status of the pod back to the **API server**.
9. And **API server** updates the information/data back in the **etcd**. [2]

At runtime, users can modify the resource configuration by submitting an update request of the YAML description file to the master node. 

> Note that the K8s API server uses optimistic concurrency (when the API server detects concurrent write attempts, it rejects the latter of the two write operations.) 

<center><img src="https://phoenixnap.com/kb/wp-content/uploads/2021/04/full-kubernetes-model-architecture.png" alt="Understanding Kubernetes Architecture with Diagrams" style="zoom:50%;" /></center>

### Node Selection in kube-scheduler [1]

kube-scheduler is the default scheduler for Kubernetes and runs as part of the control plane. 

kube-scheduler selects a node for the pod in a 2-step operation:

1. **Filtering** For example, the PodFitsResources filter checks whether a candidate Node has enough available resource to meet a Pod's specific resource requests.
2. **Scoring** The scheduler assigns a score to each Node that survived filtering, basing this score on the active scoring rules. The highest percentage of free CPU and memory is a commonly used ranking criterion (**LeastRequestPriority** policy)

## References

**1** Kubernetes Scheduler https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/

**2** Kubernetes Workflow for Absolute Beginners https://technos.medium.com/kubernetes-workflow-bad346c54962

