# **BERT**: Pre-training of Deep Bidirectional Transformers for Language Understanding

Two existing strategies for applying pre-trained language representations to downstream tasks:

* **Feature-based approach**: uses task-specific architectures that include the pre-trained representations as additional features.
* **Fine-tuning approach**: introduces minimal task-specific parameters, and is trained on the downstream tasks by simply fine-tuning all pre-trained parameters.

::: warning Question
> The two approaches share the same objective function during pre-training, where they use **unidirectional language model**s to learn general language representations.

What is unidirectional language model?
:::

Current techniques restrict the power of the pre-trained representations, especially for the fine-tuning approaches.

Standard language models are **unidirectional**, and this limits the choice of architectures that can be used during pre-training.

::: tip Example
In OpenAI GPT, the authors use a left-to-right architecture, where every token can only attend to previous tokens
:::

----

**Hyperparams**:

* **Bert-base**: $L=12, H=768, A=12, \#\text{params} = 110M$
* **Bert-large**: $L=24, H=1024, A=16, \#\text{params} = 340M$

**Datasets**:

* **Pre-training corpus**: BooksCorpus, English Wikipedia

::: warning
It is critical to use a document-level corpus rather than a shuffled sentence-level corpus such as the Billion Word Benchmark in order to extract long contiguous sequences.
:::

**Benchmarks**:

* **General Language Understanding Evaluation (GLUE)**: a collection of diverse natural language understanding tasks.
* **Stanford Question Answering Dataset (SQuAD v1.1)**:  a collection of 100k crowdsourced question/answer pairs.
* **Stanford Question Answering Dataset (SQuAD v2.0)**:  extends the SQuAD 1.1 by allowing for the possibility that no short answer exists in the provided paragraph
* **Situations With Adversarial Generations (SWAG)**: given a sentence, the task is to choose the most plausible continuation among four choices.
* **CoNLL**: For featured-based approach with BERT.

## Related Work

**ELMo**: the contextual representation of each token is the concatenation of the left-to-right and right-to-left representations.

::: warning Question
Is concatenation a good pratice? Remember we concat weighted values in multi-head attention mechanisms.
:::

Melamud et al. ([2016](https://ar5iv.labs.arxiv.org/html/1810.04805?_immersive_translate_auto_translate=1#bib.bib30)) proposed learning contextual representations through a task to predict a single word from both left and right context using LSTMs. Similar to ELMo, their model is **feature-based** and **not deeply bidirectional**.

::: warning Question
What is **feature-based** approach?
:::

## BERT

Two steps in Bert framework:  **pre-training** and **fine-tuning**.

::: tip Thoughts
GPT and Bert are semi-supervised approaches (i.e. unsupervised pre-training and supervised fine-tuning).
:::

----

**Input/Output Representations**: A “sentence” here refers to the input token sequence to BERT, which may be a single sentence or two sentences packed together.

This work use WordPiece embeddings Wu et al. ([2016](https://ar5iv.labs.arxiv.org/html/1810.04805?_immersive_translate_auto_translate=1#bib.bib52)) with a 30,000 token vocabulary.

::: warning Question
Then what is the so-called "Bert Tokenizer" I use?
:::

<center><img src="https://ar5iv.labs.arxiv.org/html/1810.04805/assets/x2.png" alt="Refer to caption" style="zoom:50%;" /></center>

### Pre-training BERT

The paper mentioned the **intuition**: a deep bidirectional model is strictly more powerful than either a left-to-right model (GPT) or the shallow concatenation of a left-to-right and a right-to-left model (ELMo).

---

**Task #1: Masked LM**

Mask 15% of all WordPiece tokens in each sequence at random.

**Problem**:  the [MASK] token does not appear during fine-tuning: a mismatch between pre-training and fine-tuning

**Solution**: The training data generator chooses 15% of the token positions at random for prediction.

If the $i$-th token is chosen, we replace the $i$-th token with

* The `[MASK]` token 80% of the time
* A random token 10% of the time
* The unchanged $i$-th token 10% of the time. 

----

**Task #2: Next Sentence Prediction (NSP)**

When choosing the sentences A and B for each pre-training example

* 50% of the time B is the actual next sentence that follows A (labeled as IsNext)
* 50% of the time it is a random sentence from the corpus (labeled as NotNext).

C (the final hidden vector of the special `[CLS]` token) is used for NSP

### Fine-tuning BERT

Plug in the task-specific inputs and outputs into BERT and fine-tune all the parameters end-to-end.

At the output

* The token representations are fed into an output layer for token-level tasks
* The `[CLS]` representation is fed into an output layer for classification

## Experiments

BERT fine-tuning results on 11 NLP tasks.

### GLUE

Compute a standard classification loss $\log⁡(\text{softmax}(CW^T))$.

::: details **Hyperparameters**
Batch size: 32
Epoches: 3
Lr: selected the best fine-tuning learning rate (among 5e-5, 4e-5, 3e-5, and 2e-5) on the Dev set
:::

### SQuAD

The probability of word $i$ being the start of the answer span is computed as a dot product between $T_i$ and $S$ followed by a softmax over all of the words in the paragraph:
$$
P_i = \frac{e^{S\cdot T_i}}{\sum_j e^{S\cdot T_j}}
$$
The score of a candidate span from position $i$ to position $j$ is defined as $S\cdot T_i + E \cdot T_j$, and the maximum scoring span where $j≥i$ is used as a prediction.

::: details **Hyperparameters**
Batch size: 32
Epoches: 3
Lr: 5e-5
:::

For SQuAD v2.0, we treat questions that do not have an answer as having an answer span with start and end at the [CLS] token.

For prediction, we compare the score of the no-answer span: $S_{\text{null}}=S \cdot C + E \cdot C$ to the score of the best non-null span $s_{i,j} = \max_{j \geq i} S \cdot T_i + E \cdot T_j$. We predict a non-null answer when $s_{i,j} > s_{null} + \tau$, where the threshold $\tau$ is selected on the dev set to maximize F1. 

::: details **Hyperparameters**
Batch size: 48
Epoches: 2
Lr: 5e-5
:::

### SWAG

The only task-specific parameters introduced is a vector whose dot product with the [CLS] token representation $C$ denotes a score for each choice which is normalized with a softmax layer.

::: details **Hyperparameters**
Batch size: 16
Epoches: 3
Lr: 2e-5
:::

## Ablation Studies

* **No NSP**: A bidirectional model which is trained with MLM without NSP task.

* **LTR & No NSP**: A left-context-only model which is trained using a standard Left-to-Right (LTR) LM, rather than an MLM. Also applied at fine-tuning.

  ::: danger Attention
  Align the pre-training and finetuning task.
  :::
  
  No NSP $\rightarrow$ Directly comparable to OpenAI GPT.

<center><img src="https://p.ipic.vip/ajefgi.png" alt="Screenshot 2024-01-07 at 12.40.16 AM" style="zoom:50%;" /></center>

**Model size:** the authors believe that this is the first work to demonstrate convincingly that scaling to extreme model sizes also leads to **large improvements on very small scale tasks**, provided that the model has been sufficiently pre-trained.

<center><img src="https://p.ipic.vip/e7bskp.png" alt="Screenshot 2024-01-07 at 12.43.53 AM" style="zoom:50%;" /></center>

**Feature-based Approach with BERT**: Apply the feature-based approach by extracting the activations from one or more layers **without** fine-tuning any parameters of BERT. These contextual embeddings are used as input to a randomly initialized two-layer 768-dimensional BiLSTM before the classification layer.

<center><img src="https://p.ipic.vip/bm13em.png" alt="Screenshot 2024-01-07 at 12.49.43 AM" style="zoom:50%;" /></center>