# An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale

When trained on mid-sized datasets such as ImageNet without strong regularization, transformer-based models yield modest accuracies of a few percentage points below ResNets of comparable size.

**Possible explanation**: Transformers lack some of the inductive biases inherent to CNNs, such as translation equivariance and locality

If the models are trained on larger datasets (14M-300M images), large scale training trumps inductive bias. ViT attains excellent results when pre-trained at sufficient scale and transferred to tasks with fewer datapoints.

