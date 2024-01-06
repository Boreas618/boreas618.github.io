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

**Hyperparams**

* **Bert-base**: $L=12, H=768, A=12, \#\text{params} = 110M$
* **Bert-large**: $L=24, H=1024, A=16, \#\text{params} = 340M$

## Related Work

**ELMo**: the contextual representation of each token is the concatenation of the left-to-right and right-to-left representations.

::: warning Question
Is concatenation a good pratice? Remember we concat weighted values in multi-head attention mechanisms.
:::

Melamud et al. ([2016](https://ar5iv.labs.arxiv.org/html/1810.04805?_immersive_translate_auto_translate=1#bib.bib30)) proposed learning contextual representations through a task to predict a single word from both left and right context using LSTMs. Similar to ELMo, their model is **feature-based** and **not deeply bidirectional**.

::: warning Question
What is **feature-based** approach?
:::

## Bert

Two steps in Bert framework:  **pre-training** and **fine-tuning**.

::: tip Thoughts
Both GPT and Bert are unspervised.
:::

### Input/Output Representations

A “sentence” here refers to the input token sequence to BERT, which may be a single sentence or two sentences packed together.

This work use WordPiece embeddings Wu et al. ([2016](https://ar5iv.labs.arxiv.org/html/1810.04805?_immersive_translate_auto_translate=1#bib.bib52)) with a 30,000 token vocabulary.

::: warning Question
Then what is the so-called "Bert Tokenizer" I use?
:::
