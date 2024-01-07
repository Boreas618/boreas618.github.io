# Improving Language Understanding by Generative Pre-Training

**Hyper params (Unsupervised pre-training)**:

* **12-layer decoder-only transformer**
* **Masked self-attention heads** (768 dimensional states and 12 attention heads)
* **Position-wise feed-forward networks**: 3072 dimensional inner states
* **Optimizer**: Adam optimization with a max learning rate of 2.5e-4. The learning rate was increased linearly from zero over the first 2000 updates and annealed to 0 using a cosine schedule.
* **Epoches**: 100
* **Minibatches** of 64 randomly sampled, contiguous sequences of 512 tokens.
* Since layernorm is used extensively throughout the model, a simple **weight initialization** of $N (0, 0.02)$ was sufficient.
* A bytepair encoding (BPE) vocabulary with 40,000 merges and residual, embedding, and attention dropouts with a rate of 0.1 for **regularization**.
* A modified version of L2 **regularization**, with $\omega = 0.01$ on all non bias or gain weights.
* **Activation function**: GELU
* Used **learned position embedding**s instead of the **sinusoidal version** proposed in the original work.

****

**Hyper params (Supervised fine-tuning)**:

* **Dropout** to the classifier with a rate of 0.1
* **Lr**: 6.25e-5
* **Batch size**: 32
* **Epoches**: 3
* A linear **learning rate decay** schedule with warmup over 0.2% of training
* $\lambda = 0.5$.

----

**Datasets**:

* **BooksCorpus**: contains over 7,000 unique unpublished books from a variety of genres including Adventure, Fantasy, and Romance. Contains long stretches of contiguous text: learn long-range information.
* **1B Word Benchmark**: shuffled at a sentence level - destroying long-range structure.

**Benchmarks**:

* **GLUE multi-task benchmark**

  ::: details Background: Natural Language Inference
  The task of natural language inference (NLI), also known as recog- nizing textual entailment, involves reading a pair of sentences and judging the relationship between them from one of entailment, contradiction or neutral.
  :::

* **RACE dataset**: consisting of English passages with associated questions from middle and high school exams. For question answering task.
* **Story Cloze Test**: selecting the correct ending to multi-sentence stories from two options.

* **Microsoft Paraphrase corpus (MRPC)/Quora Question Pairs (QQP) dataset/Semantic Textual Similarity benchmark (STS-B)**: semantic similarity tasks
* **Corpus of Linguistic Acceptability (CoLA)/Stanford Sentiment Treebank (SST-2)**: text classification

## Framework

**Languague Modeling Objective**:
$$
L_1(U) = \sum_{i}\log P(u_i|u_{i−k},...,u_{i−1};\Theta)
$$
Where

* $U = \{u_1, . . . , u_n\}$ is  an unsupervised corpus of tokens.
* $k$ is the size of the context window.
* The conditional probability $P$ is modeled using a neural network with parameters $\Theta$

$$
h_0 = UW_{e1} + W_p
$$

$$
h_l = \text{transformer\_block}(h_{l-1}) \quad \forall i \in [1,n]
$$

$$
P(u) = \text{softmax}(h_n W_{e2}^T)
$$

Where $U = (u_{−k}, \ldots , u_{−1})$ is the context vector of tokens, $n$ is the number of layers, $W_e$ is the token

embedding matrix, and $W_p$ is the position embedding matrix.

------

**Supervised Fine-tuning**:

Each instance of the dataset consists of a sequence of input tokens $x^1, x^2,\ldots,x^m $ along with a label $y$.

Denote the final transformer block's activation as $h_l^m$. 

Denote the parameter of the output layer as $W_y$.
$$
P(y|x^1, \ldots, x^m) = \text{softmax}(h_l^mW_y)
$$
The objective is:
$$
L_2(C) = \sum_{(x,y)} \log P(y|x_1,...,x_m).
$$

----

Introduce **auxiliary objective** can:

* Improve generalization of the supervised model
* Accelerate convergence

Incorporate **auxiliary objective** into learning objective:
$$
L_3(C) = L_2(C) + λ * L_1(C)
$$

---

**Task-specific Input Transformations**:

We use a traversal-style approach, where we convert structured inputs into an ordered sequence that our pre-trained model can process. These input transformations allow us to avoid making extensive changes to the architecture across tasks. All transformations include adding randomly initialized start and end tokens `(⟨s⟩, ⟨e⟩)`.

<center><img src="https://p.ipic.vip/wnece5.png" style="zoom:50%;" /></center>



## Analysis

The impact of **transferring a variable number of layers** from unsupervised pre-training to the supervised target task.

**Each layer in the pre-trained model contains useful functionality for solving target tasks.**

---

**Zero shot Behaviors**: why language model pre-training of transformers is effective.

A series of heuristic solutions that use the underlying generative model to perform tasks without supervised finetuning.

<center><img src="https://p.ipic.vip/dv4xrd.png" alt="Screenshot 2024-01-07 at 5.06.14 PM" style="zoom:50%;" /></center>

---

**Ablation Studies**:

* Larger datasets benefit from the auxiliary objective but smaller datasets do not.
* LSTM only outperforms the Transformer on one dataset – MRPC.
* The lack of pre-training hurts performance across all the tasks.

