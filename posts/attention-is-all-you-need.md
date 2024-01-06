# Attention is All You Need

Transformer is a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output.

<img src="https://ar5iv.labs.arxiv.org/html/1706.03762/assets/Figures/ModalNet-21.png" alt="Refer to caption" style="zoom: 25%;" />

**Hyperparams (Base)**:

* All sub-layers, as well as the embedding layers, produce outputs of dimension $d_{\text{model}} = 512$
* Number of encoders/decoders in one stack $N = 6$
* Number of parallel attention layers $h = 8$
* The dimension of queries and keys $d_k = d_v = \frac{d_{\text{model}}}{h} = 64$
* The dimension of inner-layer of FFN $d_{ff}=2048$.
* Adam optimizer: $\beta_1 = 0.9, \beta_2 = 0.98, \epsilon = 10^{-9}, \text{warmup\_steps} = 4000$
* Train steps: $100K$
* Dropout rate: $P_{drop} = 0.1$
* Label Smoothing: $\epsilon_{ls} = 0.1$

**Dataset**:

* **Translation**: Standard WMT 2014 English-German dataset, WMT 2014 English-French dataset
* **English Consituency Parsing**: Penn Treebank, BerkleyParser corpora

## Components

The encoder maps an input sequence of **symbol representations (tokens)** to a sequence of **continuous representations (embeddings)**.

**Encoder & Decoder blocks** have two sub-layers:

* Multi-Head Attention, Residual connection, **Layer Normalization** (On features of one sample)
* A simple, position-wise fully connected feed-forward network, Residual connection, Layer Normalization

### Attention

The weight assigned to each value is computed by a **compatibility function** of the query with the corresponding key.

**Scaled Dot-Product Attention**:
$$
\text{Attention(Q, K,V)} = \text{softmax}(\frac{QK^T}{\sqrt{d_k}})V
$$
**Motivation**: For large values of $d_k$, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients.

**Multi-Head Attention**: linearly project the queries, keys and values $h$ times with different, learned linear projections to $d_k$, $d_k$ and $d_v$ dimensions, respectively. The  $d_v$-dimensional output values are concatenated and once again projected into final values.

> **Question**: Are there any design alternatives to concatenation?

Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.

> **Question**: Are there any discussion about the impacts of the intersection of the subspaces (i.e. $\text{dim}(S_1) + \text{dim}(S_2) < \text{dim}(S_1+S_2)$) on the performance? 

$$
\text{MultiHead(Q, K, V)} = \text{Concat}(\text{head}_1, \text{head}_2, \ldots, \text{head}_n)W^O \\
\text{head}_i = \text{Attention}(QW_i^Q, KW_i^K, VW_i^V)
$$

### Position-wise Feed-Forward Networks

 Two linear transformations with a ReLU activation in between.
$$
\text{FFN}(x) = \text{max}(0, xW_1 + b_1) W_2 + b_2
$$

### Embeddings and Softmax

Share the same weight matrix between the two embedding layers and the pre-softmax linear transformation.

In the embedding layers, multiply those weights by $\sqrt{d_{\text{model}}}$ .

### Positional Encoding

Add "positional encodings" to the input embeddings at the bottoms of the encoder and decoder stacks.

> **Question**: What about add positional encodings half way along the encoder/decoder stack?

The positional encodings have the same dimension $d_{\text{model}}$ as the embeddings, so that the two can be summed.

----

There are many choices of positional encodings, learned and fixed.
$$
PE(\text{pos}, 2i) = \sin(pos / 10000^{2i/d_{\text{model}}}) \\
PE(\text{pos}, 2i+1) = \cos(pos / 10000^{2i/d_{\text{model}}})
$$
where $\text{pos}$ is the position and $i$ is the dimension. 

Choose this function because we hypothesized it would allow the model to easily learn to attend by relative positions, since for any fixed offset $k$, $PE_{pos+k}$ can be represented as a linear function of $PE_{pos}$.

> **Three Concerns Regarding Self-Attention**
>
> * Total computational complexity per layer.
> * The amount of computation that can be parallelized, as measured by the minimum number of sequential operations required.
> * The path length between long-range dependencies in the network. 
>
> ![Maximum path lengths, per-layer complexity and minimum number of sequential operations for different layer types.](https://p.ipic.vip/1034h1.png)
>
> In terms of computational complexity, self-attention layers are faster than recurrent layers when the sequence length $n$ is smaller than the representation dimensionality $d$.
>
> As side benefit, self-attention could yield more **interpretable** models.

## Training

Learn to describe the training process:

> We trained our models on one machine with 8 NVIDIA P100 GPUs. For our base models using the hyperparameters described throughout the paper, each training step took about 0.4 seconds. We trained the base models for a total of 100,000 steps or 12 hours.

**Regularization**:

* Apply dropout to the output of each sub-layer.
* Label Smoothing: this hurts perplexity, as the model learns to be more unsure, but improves accuracy and BLEU score.

## Results

**Translation**

* While single-head attention is 0.9 BLEU worse than the best setting, quality also drops off with too many heads.

* Reducing the attention key size $d_k$ hurts model quality.
* Bigger models are better, and dropout is very helpful in avoiding over-fitting. 
* Sinusoidal positional encoding tied with learned positional embeddings.

**Generalization: English Consituency Parsing**