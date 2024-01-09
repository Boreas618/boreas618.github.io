# An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale

When trained on mid-sized datasets such as ImageNet without strong regularization, transformer-based models yield modest accuracies of a few percentage points below ResNets of comparable size.

**Possible explanation**: Transformers lack some of the inductive biases inherent to CNNs, such as translation equivariance and locality

If the models are trained on larger datasets (14M-300M images), large scale training trumps inductive bias. ViT attains excellent results when pre-trained at sufficient scale and transferred to tasks with fewer datapoints.

## Related Work

Previous explorations of applying self-attention in image processing:

* Self-attention only in local neighborhoods for each query pixel.
* Sparse Transformers employ scalable approximations to global self-attention in order to be applicable to images.
* Apply self-attention in blocks of varying sizes.
* Extracts patches of size 2×2 from the input image and applies full self-attention on top.
* Combine CNN with forms of self-attention: augmenting feature maps for image classification/further processing the output of a CNN using self-attention.

This work:

* Explore image recognition at larger scales than the standard ImageNet dataset.
* Handle medium-resolution images as well small-resolution images.

## Method

<center><img src="https://ar5iv.labs.arxiv.org/html/2010.11929/assets/x1.png" alt="Refer to caption" style="zoom: 50%;" /></center>

To handle 2D images, reshape the image $x \in \mathbb{R}^{H \times W \times C}$ into a sequence of flattened 2D patches $x_p \in \mathbb{R}^{N \times (P^2 \cdot C)}$.

::: warning Questions
Will the flattening lose 2D context?
:::

A linear transformation mapping the flattened patches to $d_{model}$.

