---
layout: post
title:  "MNIST Image Classification with Deep Learning and Keras"
date:   2019-04-21 14:05:46
tags: keras deep-learning
---


In this post we'll use Keras and implement the Hello, World of machine learning, classify a number in an image from the [MNIST](http://yann.lecun.com/exdb/mnist/index.html) database of handwritten digits, and we will achieve ~99% classification accuracy using a [convolutional neural network](https://en.wikipedia.org/wiki/Convolutional_neural_network).

Much of this is inspired by the book [Deep Learning with Python](https://www.manning.com/books/deep-learning-with-python) by François Chollet. I highly recommend reading the book if you would like to dig deeper or learn more. 

If you would like to follow along, the code is also available in a [jupyter notebook here](https://github.com/wtfleming/jupyter-notebooks-public/blob/master/mnist-keras.ipynb).


```python
from keras import models, layers
from keras.datasets import mnist
from keras.utils import to_categorical
import matplotlib.pyplot as plt
import numpy as np
```

Since working with the MNIST digits is so common, Keras provides a function to load the data. You can see a full [list of datasets](https://keras.io/datasets/) Keras has packaged up.

Let's load the data:

```python
(train_images, train_labels), (test_images, test_labels) = mnist.load_data()
```

The training set consists of 60,000 28x28 pixel images, and the test set 10,000.

```python
train_images.shape, test_images.shape
```

```text
((60000, 28, 28), (10000, 28, 28))
```

Lets look at the first ten training images. They are each 28x28 grayscale images with one color value between 0 and 255.

```python
_, ax = plt.subplots(1, 10, figsize=(10,10))

for i in range(0, 10):
    ax[i].axis('off')
    ax[i].imshow(train_images[i], cmap=plt.cm.binary)
```

![mnistDigits]({{ site.url }}images/mnist-keras/mnist-example-images.png)

And the labels representing which class the image represents.

```python
train_labels[0:10]
```

```text
array([5, 0, 4, 1, 9, 2, 1, 3, 1, 4], dtype=uint8)
```

## Build the neural network

Now build the neural network. We'll be using a number of convolutional layers. Note that we only have to specify the input shape in the first layer. The last layer provides the output. It has 10 units (one for each digit 0 to 9) and uses a softmax activation to map the output of a network to a probability distribution over the predicted output classes.

```python
model = models.Sequential()
model.add(layers.Conv2D(32, (3, 3), activation='relu', input_shape=(28, 28, 1)))
model.add(layers.MaxPooling2D((2, 2)))
model.add(layers.Conv2D(64, (3, 3), activation='relu'))
model.add(layers.MaxPooling2D((2, 2)))
model.add(layers.Conv2D(64, (3, 3), activation='relu'))
model.add(layers.Flatten())
model.add(layers.Dense(64, activation='relu'))
model.add(layers.Dense(10, activation='softmax'))

model.compile(optimizer='rmsprop', loss='categorical_crossentropy', metrics=['accuracy'])
```

One way to see what the network looks like is to use the summary() function:

```python
model.summary()
```

```text
_________________________________________________________________
Layer (type)                 Output Shape              Param #   
=================================================================
conv2d_1 (Conv2D)            (None, 26, 26, 32)        320       
_________________________________________________________________
max_pooling2d_1 (MaxPooling2 (None, 13, 13, 32)        0         
_________________________________________________________________
conv2d_2 (Conv2D)            (None, 11, 11, 64)        18496     
_________________________________________________________________
max_pooling2d_2 (MaxPooling2 (None, 5, 5, 64)          0         
_________________________________________________________________
conv2d_3 (Conv2D)            (None, 3, 3, 64)          36928     
_________________________________________________________________
flatten_1 (Flatten)          (None, 576)               0         
_________________________________________________________________
dense_1 (Dense)              (None, 64)                36928     
_________________________________________________________________
dense_2 (Dense)              (None, 10)                650       
=================================================================
Total params: 93,322
Trainable params: 93,322
Non-trainable params: 0
_________________________________________________________________
```

```python
(train_images, train_labels), (test_images, test_labels) = mnist.load_data()
```

We need to do some preprocessing of the images. We'll also use the first 50,000 training images for training, and the remaining 10,000 training examples for cross validation.

```python
train_images = train_images.reshape((60000, 28, 28, 1))
train_images= train_images.astype('float32') / 255 # rescale pixel values from range [0, 255] to [0, 1]

test_images = test_images.reshape((10000, 28, 28, 1))
test_images= test_images.astype('float32') / 255

train_labels = to_categorical(train_labels)
test_labels = to_categorical(test_labels)

validation_images = train_images[50000:]
validation_labels = train_labels[50000:]

train_images = train_images[:50000]
train_labels = train_labels[:50000]

history = model.fit(train_images, train_labels, epochs=5, batch_size=64, validation_data=(validation_images, validation_labels))
```

```text
Train on 50000 samples, validate on 10000 samples
Epoch 1/5
50000/50000 [==============================] - 20s 391us/step - loss: 0.1959 - acc: 0.9387 - val_loss: 0.0798 - val_acc: 0.9760
Epoch 2/5
50000/50000 [==============================] - 19s 380us/step - loss: 0.0509 - acc: 0.9845 - val_loss: 0.0513 - val_acc: 0.9849
Epoch 3/5
50000/50000 [==============================] - 19s 382us/step - loss: 0.0343 - acc: 0.9892 - val_loss: 0.0408 - val_acc: 0.9880
Epoch 4/5
50000/50000 [==============================] - 19s 379us/step - loss: 0.0257 - acc: 0.9918 - val_loss: 0.0448 - val_acc: 0.9874
Epoch 5/5
50000/50000 [==============================] - 19s 377us/step - loss: 0.0208 - acc: 0.9938 - val_loss: 0.0356 - val_acc: 0.9903
```

```python
test_loss, test_acc = model.evaluate(test_images, test_labels)
print('Accuracy:', test_acc)
print('Loss: ', test_loss)
```

```text
10000/10000 [==============================] - 1s 122us/step
Accuracy: 0.992
Loss:  0.027386048025220953
```

Looks pretty good we're seeing ~99% accuracy on the test set.

## Visualize training

Now lets create a function that lets us graph the accuracy and loss values during training.

```python
def plot_accuracy_and_loss(history):
    acc = history.history['acc']
    val_acc = history.history['val_acc']
    loss = history.history['loss']
    val_loss = history.history['val_loss']

    epochs = range(1, len(acc) + 1)

    plt.plot(epochs, acc, 'bo', label='Training acc')
    plt.plot(epochs, val_acc, 'b', label='Validation acc')
    plt.title('Training and validation accuracy')
    plt.legend()
    plt.show()

    plt.plot(epochs, loss, 'bo', label='Training loss')
    plt.plot(epochs, val_loss, 'b', label='Validation loss')
    plt.title('Training and validation loss')
    plt.legend()
    plt.show()

plot_accuracy_and_loss(history)
```

![plot-accuracy-loss]({{ site.url }}images/mnist-keras/plot-accuracy-loss.png)


The above looks pretty good, we appear to be starting to overfit the data as we get further in, but training and validation sets are pretty close to each other.

Now lets look at a prediction, first we'll generate predictions for the test set.

```python
preds = model.predict(test_images)
```

We'll use the network to try to figure out what the first digit in the test set is. If we manually look, it appears to be a 7.

```python
# reload the test images so it will be in a format imshow() will understand
(_, _), (test_images, _) = mnist.load_data()

plt.imshow(test_images[0], cmap=plt.cm.binary)
```
![test-prediction]({{ site.url }}images/mnist-keras/test-prediction.png)

Since the output of the network was a layer with 10 units and a softmax activation, we will get an array of length 10 with a prediction for each potential number. Here you can see that the network is 99.9% certain it is a seven.

```python
print(preds[0])
```

```text
[2.6081236e-12 1.8943378e-09 1.0174886e-08 6.8640638e-08 2.3309353e-11
 1.9539477e-10 7.4824168e-19 9.9999988e-01 4.3342949e-10 8.6599723e-09]
 ```

We can also find the class with the highest prediction score with a numpy function:

```python
np.argmax(preds[0])
```

```text
7
```

The next step would be to retrain the model with all 60,000 training examples (remember that in the model above we trained on 50,000 examples and validated on the remaining 10,000). I'll leave that as an exercise to the reader.