+++
title = "Cats vs Dogs - Part 3 - 99.1% Accuracy - Binary Image Classification with PyTorch and an Ensemble of ResNet Models"
[taxonomies]
tags = [ "pytorch", "machine learning" ]
+++

In 2014 Kaggle ran a [competition](https://www.kaggle.com/c/dogs-vs-cats/overview) to determine if images contained a dog or a cat. In this series of posts we'll see how easy it is to use Keras to create a [2D convolutional neural network](https://en.wikipedia.org/wiki/Convolutional_neural_network) that potentially could have won the contest.

In [part 1](@/blog/2019-05-07-keras-cats-vs-dogs-part-1.md) we used Keras to define a neural network architecture from scratch and were able to get to 92.8% categorization accuracy.

In [part 2](@/blog/2019-05-12-keras-cats-vs-dogs-part-2.md) we used once again used Keras and a VGG16 network with transfer learning to achieve 98.6% accuracy.

In this post we'll switch gears to use [PyTorch](https://pytorch.org/) with an ensemble of ResNet models to reach 99.1% accuracy.

----

This post was inspired by the book [Programming PyTorch for Deep Learning](https://www.oreilly.com/library/view/programming-pytorch-for/9781492045342/) by Ian Pointer.

Code is available in a [jupyter notebook here](https://github.com/wtfleming/jupyter-notebooks-public/blob/master/dogs-vs-cats/dogs-vs-cats-part-3.ipynb). You will need to download the data from the [Kaggle competition](https://www.kaggle.com/c/dogs-vs-cats/data). The dataset contains 25,000 images of dogs and cats (12,500 from each class). We will create a new dataset containing 3 subsets, a training set with 16,000 images, a validation dataset with 4,500 images and a test set with 4,500 images.

### Build the networks

```python
import torch
import torch.nn as nn
import torch.optim as optim
import torch.utils.data
import torch.nn.functional as F
import torchvision
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import matplotlib.pyplot as plt
```

Download models pretrained on ImageNet with [PyTorch Hub](https://pytorch.org/hub/)

```python
model_resnet18 = torch.hub.load('pytorch/vision', 'resnet18', pretrained=True)
model_resnet34 = torch.hub.load('pytorch/vision', 'resnet34', pretrained=True)
```

Since we are doing transfer learning we want to freeze all params except the BatchNorm layers, as here they are trained to the mean and standard deviation of ImageNet and we may lose some signal.

```python
for name, param in model_resnet18.named_parameters():
    if("bn" not in name):
        param.requires_grad = False
        
for name, param in model_resnet34.named_parameters():
    if("bn" not in name):
        param.requires_grad = False
```

Next we want to replace the classifier so we can make predictions on our dataset, rather than the 1,000 classes from ImageNet the model was trained on.

```python
num_classes = 2

model_resnet18.fc = nn.Sequential(nn.Linear(model_resnet18.fc.in_features,512),
                                  nn.ReLU(),
                                  nn.Dropout(),
                                  nn.Linear(512, num_classes))

model_resnet34.fc = nn.Sequential(nn.Linear(model_resnet34.fc.in_features,512),
                                  nn.ReLU(),
                                  nn.Dropout(),
                                  nn.Linear(512, num_classes))
```

### Functions for training and loading data

Create a function we can use to train the model.

```python
def train(model, optimizer, loss_fn, train_loader, val_loader, epochs=5, device="cpu"):
    for epoch in range(epochs):
        training_loss = 0.0
        valid_loss = 0.0
        model.train()
        for batch in train_loader:
            optimizer.zero_grad()
            inputs, targets = batch
            inputs = inputs.to(device)
            targets = targets.to(device)
            output = model(inputs)
            loss = loss_fn(output, targets)
            loss.backward()
            optimizer.step()
            training_loss += loss.data.item() * inputs.size(0)
        training_loss /= len(train_loader.dataset)
        
        model.eval()
        num_correct = 0 
        num_examples = 0
        for batch in val_loader:
            inputs, targets = batch
            inputs = inputs.to(device)
            output = model(inputs)
            targets = targets.to(device)
            loss = loss_fn(output,targets) 
            valid_loss += loss.data.item() * inputs.size(0)
                        
            correct = torch.eq(torch.max(F.softmax(output, dim=1), dim=1)[1], targets).view(-1)
            num_correct += torch.sum(correct).item()
            num_examples += correct.shape[0]
        valid_loss /= len(val_loader.dataset)

        print('Epoch: {}, Training Loss: {:.4f}, Validation Loss: {:.4f}, accuracy = {:.4f}'.format(epoch, training_loss,
        valid_loss, num_correct / num_examples))
```

Next create some code to load and process our training, test, and validation images.

```python
batch_size=32
img_dimensions = 224

# Normalize to the ImageNet mean and standard deviation
# Could calculate it for the cats/dogs data set, but the ImageNet
# values give acceptable results here.
img_transforms = transforms.Compose([
    transforms.Resize((img_dimensions, img_dimensions)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],std=[0.229, 0.224, 0.225] )
    ])

img_test_transforms = transforms.Compose([
    transforms.Resize((img_dimensions,img_dimensions)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],std=[0.229, 0.224, 0.225] )
    ])

def check_image(path):
    try:
        im = Image.open(path)
        return True
    except:
        return False

train_data_path = "/home/wtf/dogs-vs-cats/train/"
train_data = torchvision.datasets.ImageFolder(root=train_data_path,transform=img_transforms, is_valid_file=check_image)

validation_data_path = "/home/wtf/dogs-vs-cats/validation/"
validation_data = torchvision.datasets.ImageFolder(root=validation_data_path,transform=img_test_transforms, is_valid_file=check_image)

test_data_path = "/home/wtf/dogs-vs-cats/test/"
test_data = torchvision.datasets.ImageFolder(root=test_data_path,transform=img_test_transforms, is_valid_file=check_image)

num_workers = 6
train_data_loader = torch.utils.data.DataLoader(train_data, batch_size=batch_size, shuffle=True, num_workers=num_workers)
validation_data_loader = torch.utils.data.DataLoader(validation_data, batch_size=batch_size, shuffle=False, num_workers=num_workers)
test_data_loader = torch.utils.data.DataLoader(test_data, batch_size=batch_size, shuffle=False, num_workers=num_workers)


if torch.cuda.is_available():
    device = torch.device("cuda") 
else:
    device = torch.device("cpu")
```

Lets verify that the numbers look correct
```python
print(f'Num training images: {len(train_data_loader.dataset)}')
print(f'Num validation images: {len(validation_data_loader.dataset)}')
print(f'Num test images: {len(test_data_loader.dataset)}')
```

Which should output:
```
Num training images: 16000
Num validation images: 4500
Num test images: 4500
```


### Train and test the models

```python
def test_model(model):
    correct = 0
    total = 0
    with torch.no_grad():
        for data in test_data_loader:
            images, labels = data[0].to(device), data[1].to(device)
            outputs = model(images)
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
    print('correct: {:d}  total: {:d}'.format(correct, total))
    print('accuracy = {:f}'.format(correct / total))
```

Train the ResNet18 model for a couple epochs. We could let it go longer (and use a larger batch size above), but I've been using a relatively ancient 6 year old GPU for this post, and not wanting to wait forever these settings are good enough for a blog post.

```python
model_resnet18.to(device)
optimizer = optim.Adam(model_resnet18.parameters(), lr=0.001)
train(model_resnet18, optimizer, torch.nn.CrossEntropyLoss(), train_data_loader, validation_data_loader, epochs=2, device=device)
```

```
Epoch: 0, Training Loss: 0.0855, Validation Loss: 0.0358, accuracy = 0.9878
Epoch: 1, Training Loss: 0.0498, Validation Loss: 0.0309, accuracy = 0.9873
```

Now check against our holdout test set

```python
test_model(model_resnet18)
```

```
correct: 4456  total: 4500
accuracy = 0.990222
```

And do the same for our ResNet34 network

```python
model_resnet34.to(device)
optimizer = optim.Adam(model_resnet34.parameters(), lr=0.001)
train(model_resnet34, optimizer, torch.nn.CrossEntropyLoss(), train_data_loader, validation_data_loader, epochs=2, device=device)
```
```
Epoch: 0, Training Loss: 0.0678, Validation Loss: 0.0239, accuracy = 0.9907
Epoch: 1, Training Loss: 0.0354, Validation Loss: 0.0317, accuracy = 0.9887
```

And test
```python
test_model(model_resnet34)
```
```
correct: 4450  total: 4500
accuracy = 0.988889
```

This gives us two models, one with 99.0% accuracy on our test set and 98.9% on the other.

### Make some predictions

Lets check a couple individual images from the test set.

```python
import os
def find_classes(dir):
    classes = os.listdir(dir)
    classes.sort()
    class_to_idx = {classes[i]: i for i in range(len(classes))}
    return classes, class_to_idx

def make_prediction(model, filename):
    labels, _ = find_classes('/home/wtf/dogs-vs-cats/test')
    img = Image.open(filename)
    img = img_test_transforms(img)
    img = img.unsqueeze(0)
    prediction = model(img.to(device))
    prediction = prediction.argmax()
    print(labels[prediction])
    
make_prediction(model_resnet34, '/home/wtf/dogs-vs-cats/test/dogs/dog.11460.jpg')
make_prediction(model_resnet34, '/home/wtf/dogs-vs-cats/test/cats/cat.12262.jpg')
```

Which outputs:

```
dogs
cats
```

Seems reasonable.

### Save and load models

Since we don't want to have to train the models again every time we start up a jupyter notebook, lets see how we can save them to disk and then reload them.

```python
torch.save(model_resnet18.state_dict(), "./model_resnet18.pth")
torch.save(model_resnet34.state_dict(), "./model_resnet34.pth")


# Remember that you must call model.eval() to set dropout and batch normalization layers to
# evaluation mode before running inference. Failing to do this will yield inconsistent inference results.

resnet18 = torch.hub.load('pytorch/vision', 'resnet18')
resnet18.fc = nn.Sequential(nn.Linear(resnet18.fc.in_features,512),nn.ReLU(), nn.Dropout(), nn.Linear(512, num_classes))
resnet18.load_state_dict(torch.load('./model_resnet18.pth'))
resnet18.eval()

resnet34 = torch.hub.load('pytorch/vision', 'resnet34')
resnet34.fc = nn.Sequential(nn.Linear(resnet34.fc.in_features,512),nn.ReLU(), nn.Dropout(), nn.Linear(512, num_classes))
resnet34.load_state_dict(torch.load('./model_resnet34.pth'))
resnet34.eval()
```

### Test with an ensemble

We'll use a very simple ensemble here. Take the prediction for each image from each model, average them to generate a new prediction for the image.


```python
# Test against the average of each prediction from the two models
models_ensemble = [resnet18.to(device), resnet34.to(device)]
correct = 0
total = 0
with torch.no_grad():
    for data in test_data_loader:
        images, labels = data[0].to(device), data[1].to(device)
        predictions = [i(images).data for i in models_ensemble]
        avg_predictions = torch.mean(torch.stack(predictions), dim=0)
        _, predicted = torch.max(avg_predictions, 1)

        total += labels.size(0)
        correct += (predicted == labels).sum().item()
        
print('accuracy = {:f}'.format(correct / total))
print('correct: {:d}  total: {:d}'.format(correct, total))
```

Which results in
```
accuracy = 0.990889
correct: 4459  total: 4500
```

The magic of ensembles is that given two models with accuracy of `0.990222` and `0.988889` we are able to make predictions and get to `0.990889`, which is higher than any individual model.

In this case we aren't seeing a dramatic increase, but ensembles can be very useful. I once had an entry in a Kaggle competition with around 4,000 entrants where my best individual model put me in the top 10%, but by combining a number of entries into an ensemble placed me in the top 2%.


### Next steps
There is a lot we didn't do here. You could try [augmenting the training images with TorchVision](https://pytorch.org/docs/stable/torchvision/transforms.html), try different ways of creating the ensemble, add a model using a different network like [VGG](https://github.com/pytorch/vision/blob/master/torchvision/models/vgg.py) from TorchHub to the ensemble, etc.
