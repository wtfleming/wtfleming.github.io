+++
title = "Create a Clojure AWS Lambda function in Docker and deployed via AWS SAM"
[taxonomies]
tags = [ "clojure" ]
+++
 

In this post I will cover using Clojure to write an [AWS Lambda](https://aws.amazon.com/lambda/) function that will run on a schedule of once per minute. It will be deployed via the [AMS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) CLI tool and use the Docker runtime. The complete code is available at [this GitHub repo](https://github.com/wtfleming/clojure-aws-lambda-example).

I'll start with a simple Lambda function that just writes a message to stdout once per minute.

The longer term goal is to create a function that will call the [National Weather Service API](https://www.weather.gov/documentation/services-web-api), and then send me a notification if there are any alerts where I live. But that will be a project for another day.

> Note that even though Lambda supports Java as a runtime, we'll be running this function in Docker.
>
> While everything works great in the cloud, I ran into some compilation issues running the jar file locally with the sam invoke local command. I think the SAM CLI tool may be doing something unexpected with the java classpath, and could only get it to run without errors using the specific combination of Clojure 1.9 and Java 8. However by using Docker we can easily avoid issues like this.

## Project Code

I am using Leiningin for this project, so create a `project.clj` file with these contents:

```clojure
(defproject clojure-aws-lambda-example "0.1.0-SNAPSHOT"
  :dependencies [[com.amazonaws/aws-lambda-java-runtime-interface-client "2.0.0"]
                 [org.clojure/clojure "1.10.3"]
                 [org.clojure/data.json "2.4.0"]]
  :repl-options {:init-ns clojure-aws-lambda-example.core}
  :profiles {:uberjar {:aot :all}})
```

---

Now lets write our lambda function 
Create a file called `src/clojure_aws_lambda_example/core.clj` with these contents:

```clojure
(ns clojure-aws-lambda-example.core
  (:require [clojure.data.json :as json]
            [clojure.java.io :as io]
            [clojure.spec.alpha :as spec])
  (:gen-class
   :implements [com.amazonaws.services.lambda.runtime.RequestStreamHandler]))

;; -------------------- Specs --------------------
;; The json for an inbound scheduled event should look like this
;; {
;;     "version": "0",
;;     "id": "53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa",
;;     "detail-type": "Scheduled Event",
;;     "source": "aws.events",
;;     "account": "123456789012",
;;     "time": "2015-10-08T16:53:06Z",
;;     "region": "us-east-1",
;;     "resources": [
;;         "arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule"
;;     ],
;;     "detail": {}
;; }
;;
;; See https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html
(spec/def ::version string?)
(spec/def ::id string?)
(spec/def ::detail-type string?)
(spec/def ::source string?)
(spec/def ::account string?)
(spec/def ::time string?)
(spec/def ::region string?)
(spec/def ::resources (spec/coll-of string?))
(spec/def ::detail map?)

(spec/def ::scheduled-event
  (spec/keys
   :req-un [::version ::id ::detail-type ::source ::account ::time ::region ::resources ::detail]))


;; -------------------- Request handling --------------------
(defn- stream->scheduled-event
  "Transforms an input stream into a scheduled event "
  [in]
  (json/read (io/reader in) :key-fn keyword))


(defn -handleRequest
  "Implementation for RequestStreamHandler that handles a Lambda Function request"
  [_ input-stream _output-stream _context]
  (println "-handleRequest called with event:" (stream->scheduled-event input-stream)))
```

## Testing

Lets create a simple unit test. Create a file named `test/eventbridge-scheduled-event.json` with these contents.

```json
{
    "version": "0",
    "id": "53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa",
    "detail-type": "Scheduled Event",
    "source": "aws.events",
    "account": "123456789012",
    "time": "2015-10-08T16:53:06Z",
    "region": "us-east-1",
    "resources": [
        "arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule"
    ],
    "detail": {}
}
```

And a file named `test/clojure_aws_lambda_example/core_test.clj` with these contents

```clojure
(ns clojure-aws-lambda-example.core-test
  (:require [clojure.test :refer [deftest is]])
  (:require [clojure-aws-lambda-example.core :as lambda-example]
            [clojure.java.io :as io]
            [clojure.spec.alpha :as spec]))

(deftest test-stream->scheduled-event
  (let [stream (io/input-stream "./test/eventbridge-scheduled-event.json")
        event (lambda-example/stream->scheduled-event stream)]
    (is (spec/valid? ::lambda-example/scheduled-event event))))
```

In the test we:

* Load a sample event from disk.
* Pass it to the `stream->scheduled-event` function.
* Use clojure.spec to validate that the return value looks correct.

Note that rather than relying on a single json event, there is a much more we could test using spec's generative testing features, but I will leave that as an exercise for the reader.

---

## Dockerfile

We will also need a Dockerfile. We will use a `clojure:openjdk-11-slim-buster` image to build the Java jar, and then run the function inside a `eclipse-temurin:11-focal` container. By using a separate image to build our app, we can use a final image that doesn't have to ship Clojure build tools like lein with it.

Create a file named `Dockerfile`

```Dockerfile
# Docker container used to build the Clojure app
FROM clojure:openjdk-11-slim-buster as builder

WORKDIR /usr/src/app

COPY project.clj /usr/src/app/project.clj

# Cache deps so they aren't fetched every time a .clj file changes
RUN lein deps

COPY src/ /usr/src/app/src

RUN lein uberjar


# Build the docker container we will use in the lambda
FROM eclipse-temurin:11-focal

RUN mkdir /opt/app

COPY --from=builder /usr/src/app/target/clojure-aws-lambda-example-0.1.0-SNAPSHOT-standalone.jar /opt/app/app.jar

ENTRYPOINT [ "java", "-cp", "/opt/app/app.jar", "com.amazonaws.services.lambda.runtime.api.client.AWSLambda" ]

CMD ["clojure_aws_lambda_example.core::handleRequest"]
```

---

## SAM Configuration

Finally we will need a SAM template that will have all the information the SAM CLI tool needs to generate a CloudFormation template. We want to create a Lambda function and a CloudWatch event that fires every minute to trigger a run of the function.

Create a file `template.yaml` that looks like:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: >
  clojure-aws-lambda-example

  Sample SAM Template for clojure-aws-lambda-example

# More info about Globals: https://github.com/awslabs/serverless-application-model/blob/master/docs/globals.rst
Globals:
  Function:
    Timeout: 20

Resources:
  ClojureAwsLambdaExampleFunction:
    # More info about Function Resource: https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md#awsserverlessfunction
    Type: AWS::Serverless::Function
    Properties:
      PackageType: Image
      MemorySize: 256
      Architectures:
        - x86_64
      Events:
        # We want the lambda to run every minute
        # See https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-schedule.html
        MyScheduledEvent:
          Type: Schedule
          Properties:
            Schedule: rate(1 minute)
            Name: MyScheduledEvent
            Description: Event that triggers the lambda every minute
            Enabled: true
    Metadata:
      DockerTag: clojure-aws-lambda-example-v1
      DockerContext: ./
      Dockerfile: Dockerfile

Outputs:
  ClojureAwsLambdaExampleFunction:
    Description: "Hello World Lambda Function ARN"
    Value: !GetAtt ClojureAwsLambdaExampleFunction.Arn
  ClojureAwsLambdaExampleFunctionIamRole:
    Description: "Implicit IAM Role created for Hello World function"
    Value: !GetAtt ClojureAwsLambdaExampleFunctionRole.Arn
```

## Run the app locally

Prior to deploying to the cloud we'll want to run and test on our local machine.

Ensure you have installed the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) installed, and then build the app.

```sh
$ sam build
```

Run it with

```sh
$ sam local invoke --event test/eventbridge-scheduled-event.json
```

You should see output similar to

```
Invoking Container created from clojureawslambdaexamplefunction:clojure-aws-lambda-example-v1
Building image.................
Skip pulling image and use local one: clojureawslambdaexamplefunction:rapid-1.33.0-x86_64.

START RequestId: 7dfdf5e7-7580-466b-b3da-c24935837cf0 Version: $LATEST
-handleRequest called with event:  {:detail-type Scheduled Event, :time 2015-10-08T16:53:06Z, :source aws.events, :account 123456789012, :region us-east-1, :id 53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa, :version 0, :resources [arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule], :detail {}}
END RequestId: 7dfdf5e7-7580-466b-b3da-c24935837cf0
REPORT RequestId: 7dfdf5e7-7580-466b-b3da-c24935837cf0  Init Duration: 0.26 ms  Duration: 795.48 ms     Billed Duration: 796 ms Memory Size: 256 MB  Max Memory Used: 256 MB
```

## Deploy to the Cloud

The first time you deploy run this command to generate a local `samconfig.toml` file, an S3 bucket, and an ECR repository. When prompted for configuration info you can use the defaults the tool suggests

```sh
$ sam deploy --guided
```

For future deploys you can just run

```sh
$ sam deploy
```


Once the deploy has finished we can check that it is running by tailing the CloudWatch logs. 

> Use the stack-name you choose when you ran sam deploy --guided

```
$ sam logs -n ClojureAwsLambdaExampleFunction --stack-name sam-app --tail
```

After a few minutes of running you should see output similar to


```
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:00:14.729000 START RequestId: cc9f8cfd-04bf-44af-9b88-8d0349adf74e Version
: $LATEST
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:00:14.734000 -handleRequest called! with event:  {:detail-type Scheduled Event, :time 2015-10-08T16:53:06Z, :source aws.events, :account 123456789012, :region us-east-1, :id 53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa, :version 0, :resources [arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule], :detail {}}
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:00:14.736000 END RequestId: cc9f8cfd-04bf-44af-9b88-8d0349adf74e
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:00:14.736000 REPORT RequestId: cc9f8cfd-04bf-44af-9b88-8d0349adf74e  Durat
ion: 6.05 ms    Billed Duration: 2637 ms        Memory Size: 256 MB     Max Memory Used: 101 MB Init Duration: 2630.22 ms
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:01:15.451000 START RequestId: 4dfa088e-8328-411e-bf34-e70fe0f74691 Version
: $LATEST
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:01:15.457000 -handleRequest called! with event:  {:detail-type Scheduled Event, :time 2015-10-08T16:53:06Z, :source aws.events, :account 123456789012, :region us-east-1, :id 53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa, :version 0, :resources [arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule], :detail {}}
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:01:15.475000 END RequestId: 4dfa088e-8328-411e-bf34-e70fe0f74691
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:01:15.475000 REPORT RequestId: 4dfa088e-8328-411e-bf34-e70fe0f74691  Durat
ion: 18.81 ms   Billed Duration: 19 ms  Memory Size: 256 MB     Max Memory Used: 102 MB
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:02:11.605000 START RequestId: 13ae2a9c-3d0d-40eb-8427-1e7807bff399 Version
: $LATEST
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:02:11.609000 -handleRequest called! with event:  {:detail-type Scheduled Event, :time 2015-10-08T16:53:06Z, :source aws.events, :account 123456789012, :region us-east-1, :id 53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa, :version 0, :resources [arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule], :detail {}}
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:02:11.609000 END RequestId: 13ae2a9c-3d0d-40eb-8427-1e7807bff399
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:02:11.609000 REPORT RequestId: 13ae2a9c-3d0d-40eb-8427-1e7807bff399  Durat
ion: 1.06 ms    Billed Duration: 2 ms   Memory Size: 256 MB     Max Memory Used: 102 MB
2021/10/17/[$LATEST]e4f5879df90c4d2f90bf036dfc1773c7 2021-10-17T16:03:11.363000 START RequestId: 76b568e8-8fa2-446f-803e-b9252db1b9a7 Version
: $LATEST
```

## Clean up

When you are finished, you can delete the  resources associated with the stack

> Use the stack-name you choose when you ran sam deploy --guided

```
$ sam delete --stack-name sam-app
```
