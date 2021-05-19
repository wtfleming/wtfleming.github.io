+++
title = "Writing a Kafka Producer and High Level Consumer in Clojure"
[taxonomies]
tags = [ "clojure", "kafka" ]
+++


# Introduction


Kafka is a platform for handling real-time data feeds. In some ways it is like a database that exposes semantics of a messaging system.

The [Kafka documentation][kafka-docs] provides an excellent overview which I have provided an extract from:

[kafka-docs]: https://kafka.apache.org/documentation.html


```
Kafka is a distributed, partitioned, replicated commit log service. It provides the
functionality of a messaging system, but with a unique design.

* Kafka maintains feeds of messages in categories called topics.
* We'll call processes that publish messages to a Kafka topic producers.
* We'll call processes that subscribe to topics and process the feed of published
messages consumers.
* Kafka is run as a cluster comprised of one or more servers each of which is called
a broker.

```

In this post we'll use Clojure to write a producer that periodically writes random integers to a Kafka topic, and a High Level Consumer that reads them back. I am using Kafka 0.8.1.1 and assume it and ZooKeeper are running on localhost. A [quickstart][quickstart] is available that can walk you through downloading and starting the services.

[quickstart]: http://kafka.apache.org/07/quickstart.html

The source code for this project is [available on GitHub][github-source-code].

[github-source-code]: https://github.com/wtfleming/clojure-examples/tree/master/kafka/hello-world-kafka

# Create a Project

We'll be using [Leiningen][leiningen] to build and run our app.

[leiningen]: http://leiningen.org/

Create a file called project.clj with the following contents:

```clojure
(defproject hello-world-kafka "0.1.0"
  :description "Create a kafka producer and high level consumer"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.6.0"]
                 [org.apache.kafka/kafka_2.9.2 "0.8.1.1" :exclusions [javax.jms/jms
                                                                      com.sun.jdmk/jmxtools
                                                                      com.sun.jmx/jmxri]]]
  :aot [hello-world-kafka.core]
  :main hello-world-kafka.core)
```

Next create a file /src/hello\_world\_kafka/core.clj with these contents:

```clojure
(ns hello-world-kafka.core
  (:import (kafka.consumer Consumer ConsumerConfig KafkaStream)
           (kafka.producer KeyedMessage ProducerConfig)
           (kafka.javaapi.producer Producer)
           (java.util Properties)
           (java.util.concurrent Executors))
  (:gen-class))
```

# Producer Code

```clojure
(defn- create-producer
  "Creates a producer that can be used to send a message to Kafka"
  [brokers]
  (let [props (Properties.)]
    (doto props
      (.put "metadata.broker.list" brokers)
      (.put "serializer.class" "kafka.serializer.StringEncoder")
      (.put "request.required.acks" "1"))
    (Producer. (ProducerConfig. props))))

(defn- send-to-producer
  "Send a string message to Kafka"
  [producer topic message]
  (let [data (KeyedMessage. topic nil message)]
    (.send producer data)))
```

Creating a producer and sending a message is pretty straightforward. Call the create-producer function with a list of Kafka brokers, and when you want to send a message pass the producer to the send-to-producer method along with the name of the topic and the message.

# Consumer Code

```clojure
(defrecord KafkaMessage [topic offset partition key value-bytes])

(defn- create-consumer-config
  "Returns a configuration for a Kafka client."
  []
  (let [props (Properties.)]
    (doto props
      (.put "zookeeper.connect" "127.0.0.1:2181")
      (.put "group.id" "group1")
      (.put "zookeeper.session.timeout.ms" "400")
      (.put "zookeeper.sync.time.ms" "200")
      (.put "auto.commit.interval.ms" "1000"))
    (ConsumerConfig. props)))

(defn- consume-messages
  "Continually consume messages from a Kafka topic and write message value to stdout."
  [stream thread-num]
  (let [it (.iterator ^KafkaStream stream)]
    (println (str "Starting thread " thread-num))
    (while (.hasNext it)
      (as-> (.next it) msg
            (KafkaMessage. (.topic msg) (.offset msg) (.partition msg) (.key msg) (.message msg))
            (println (str "Received on thread " thread-num ": " (String. (:value-bytes msg))))))
    (println (str "Stopping thread " thread-num))))

(defn- start-consumer-threads
  "Start a thread for each stream."
  [thread-pool kafka-streams]
  (loop [streams kafka-streams
         index 0]
    (when (seq streams)
      (.submit thread-pool (cast Callable #(consume-messages (first streams) index)))
      (recur (rest streams) (inc index)))))
```

A few things to take note of:

* The message is stored in Kafka as bytes, so in this case we need to turn the bytes into a String.

* In consume-messages the call to the KafkaStream iterator .hasNext function is reading from a single partition of it's topic and will block until a message is received. So to read from multiple partitions we will need to run multiple threads of the consume-messages function.

* The threads will run in a thread pool we later create with a java.util.concurrent.Executors

* Clojure functions implement both Runnable and Callable, but since the executor's submit function is overloaded and can accept either, we must explicitly cast the function to a Callable.


# Application code

```clojure
(defn -main
  "Pull messages from a Kafka topic using the High Level Consumer"
  [topic num-threads]
  (let [consumer (Consumer/createJavaConsumerConnector (create-consumer-config))
        consumer-map (.createMessageStreams consumer {topic (Integer/parseInt num-threads)})
        kafka-streams (.get consumer-map topic)
        thread-pool (Executors/newFixedThreadPool (Integer/parseInt num-threads))
        producer (create-producer "127.0.0.1:9092")]

    ;; Clean up on a SIGTERM or Ctrl-C
    (.addShutdownHook (Runtime/getRuntime)
                      (Thread. #(do (.shutdown consumer)
                                    (.shutdown thread-pool))))

    ;; Connect and start listening for messages on Kafka
    (start-consumer-threads thread-pool kafka-streams)

    ;; Send a random int to Kafka every 500 milliseconds
    (loop []
      (let [num (str (rand-int 1000))]
        (println (str "Sending to Kafka topic " topic ": " num))
        (send-to-producer producer topic num)
        (Thread/sleep 500)
        (recur)))))
```

The above code sets up our thread pools, creates and starts some consumers, and then sends a random integer between 0 and 999 to a topic every 500 milliseconds.

Running from the command line expects arguments like this:

```
$ lein trampoline run <topic> <num consumer threads>
```

We use lein trampoline so we can catch a SIGTERM or Control-C and clean up prior to shutting down.

If we want to send and read messages from a topic called random_numbers and use 2 threads for the consumers we can start the app like this:

```
$ lein trampoline run random_numbers 2
```

You should see output that looks something like this:

```
Starting thread 0
Starting thread 1
Sending to Kafka topic random_numbers: 753
Received on thread 1: 753
Sending to Kafka topic random_numbers: 971
Received on thread 1: 971
Sending to Kafka topic random_numbers: 56
Received on thread 1: 56
Sending to Kafka topic random_numbers: 536
Received on thread 1: 536
Sending to Kafka topic random_numbers: 589
Received on thread 1: 589
Stopping thread 0
Stopping thread 1
```
