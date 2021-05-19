+++
title = "Creating an Apache Commons Daemon using Component with Clojure"
[taxonomies]
tags = [ "clojure" ]
+++


# Introduction
One way to write a long running server application that runs on the JVM with proper start/stop semantics is to the the [Apache Commons Daemon][commons-daemon]. In this post we'll see how we can do so in Clojure and also use the [Component][component] framework to structure our application.

The full source for this post is [available on Github][source-code].

[commons-daemon]: http://commons.apache.org/proper/commons-daemon/
[source-code]: https://github.com/wtfleming/clojure-examples/tree/master/apache-commons-daemon

# Component

Component describes itself as:

```
A tiny Clojure framework for managing the lifecycle and dependencies
of software components which have runtime state.

This is primarily a design pattern with a few helper functions. It can be seen as a
style of dependency injection using immutable data structures.
```

There are two concepts to be aware of:

* Components

```
A collection of functions or procedures which share some runtime state.
```

* Systems

```
Components are composed into systems. A system is a component which knows how to
start and stop other components. It is also responsible for injecting dependencies
into the components which need them.
```

I won't go into very much detail about Component in this post, to learn more the [documentation][component] is excellent.

# The Application

We will be building an app with two components and one system.

The **first component** will store application metrics and the **second component** will repeatedly print "tick" to stdout and increment a tick counter in the metrics component once a second.

The **system** will bring them together and handle the metrics component being a dependency of the tick one.



# Leiningen Project
Our *project.clj* looks like this:

```clojure
(defproject apache-commons-daemon "0.1.0-SNAPSHOT"
  :description "Example of running a daemon"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.7.0"]
                 [commons-daemon/commons-daemon "1.0.15"]
                 [com.stuartsierra/component "0.3.0"]]
  :main apache-commons-daemon.core
  :aot :all)
```

# Code
Next create a file called *src/apache\_commons\_daemon/core.clj*

Insert the following at the top of the file:

```clojure
(ns apache-commons-daemon.core
  (:require [com.stuartsierra.component :as component])
  (:import [org.apache.commons.daemon Daemon DaemonContext])
  (:gen-class
   :implements [org.apache.commons.daemon.Daemon]))
```

# Metrics Component

For simplicity the first component simply stores the number of times the other component has ticked, however we could easily store additional metrics.

We also provide a constructor and a function to increment the tick count.

```clojure
;; Application Metrics Component
(defrecord MetricsComponent [num-ticks]
  ;; Implement the Lifecycle protocol
  component/Lifecycle
  (start [component]
    (println ";; Starting MetricsComponent")
    (reset! (:num-ticks component) 0)
    component)
  (stop [component]
    (println ";; Stopping MetricsComponent")
    (println (str ";; Metric num ticks: " @(:num-ticks component)))
    component))

(defn make-metrics-component
  "Constructor for a metrics component"
  []
  (map->MetricsComponent {:num-ticks (atom 0)}))

(defn inc-num-ticks-metric [metrics-component]
  (swap! (get metrics-component :num-ticks) inc))
```

# Tick Component

At startup the tick component creates a future which repeatedly outputs "tick" to stdout for as long as the component's state is set to :running.

```clojure
;; Tick Component
(defn do-ticks
  "Print to stdout and increment the ticks metric once a second when the component
  is running"
  [state metrics-component]
  (while (= :running @state)
    (println "tick")
    (inc-num-ticks-metric metrics-component)
    (Thread/sleep 1000)))

(defrecord TickComponent [state metrics-component]
  ;; Implement the Lifecycle protocol
  component/Lifecycle
  (start [component]
    (println ";; Starting TickComponent")
    (reset! (:state component) :running)
    ;; Do some work in another thread
    (future (do-ticks (:state component) metrics-component))
    component)
  (stop [component]
    (println ";; Stopping TickComponent")
    (reset! (:state component) :stopped)
    component))

(defn make-tick-component
  "Constructor for a tick component"
  []
  (map->TickComponent {:state (atom :stopped)}))
```

# Application System

Here we have a system which creates the two components. It also indicates that the metrics component is a dependency of the tick component, so it will ensure the metrics component is started first and provide an instance of it to the tick component.

```clojure
;; Application System
(defn make-app-system []
  (component/system-map
   :metrics-component (make-metrics-component)
   :tick-component (component/using
                    (make-tick-component)
                    [:metrics-component])))
```

Now we create the system and provide functions to start and stop it. The start and stop methods make it easy to develop and test in a REPL (without the need for jsvc in that environment).

```clojure
(def app-system (make-app-system))

;; Separate start/stop functions for easier development in a REPL
(defn start []
  (alter-var-root #'app-system component/start))

(defn stop []
  (alter-var-root #'app-system component/stop))
```

# Commons Daemon

Finally we provide an implementatation of the [Daemon interface][daemon-javadoc]. This will allow us to start and stop the application with jsvc.

[daemon-javadoc]: http://commons.apache.org/proper/commons-daemon/apidocs/org/apache/commons/daemon/Daemon.html

```clojure
;; Commons Daemon implementatation
(defn -init [this ^DaemonContext context])

(defn -start [this]
  (start))

(defn -stop [this]
  (stop))

(defn -destroy [this])
```


# Running the Application

Build with Leiningen:

```bash
$ lein uberjar
```

To interact with the daemon you will need [jsvc][jsvc] as well. On Ubuntu 14.04 it is as easy as:

[jsvc]: http://commons.apache.org/proper/commons-daemon/jsvc.html

```bash
$ sudo apt-get install jsvc
```

Start/stop like this (change your java home to what is appropriate for you):

```bash
$ sudo /usr/bin/jsvc -java-home /usr/lib/jvm/java-8-oracle/jre/ \
  -cp "$(pwd)/target/apache-commons-daemon-0.1.0-SNAPSHOT-standalone.jar" \
  -outfile "$(pwd)/out.txt" \
  apache_commons_daemon.core

# Wait a few seconds...

$ sudo /usr/bin/jsvc -java-home /usr/lib/jvm/java-8-oracle/jre/ \
  -cp "$(pwd)/target/apache-commons-daemon-0.1.0-SNAPSHOT-standalone.jar" \
  -stop \
  apache_commons_daemon.core

$ sudo cat out.txt
```

You should see output that looks something like this:

```
;; Starting MetricsComponent
;; Starting TickComponent
tick
tick
tick
tick
tick
;; Stopping TickComponent
;; Stopping MetricsComponent
;; Metric num ticks: 5
```

Note that jsvc can be a bit finicky and you may need to make some changes depending on your environment. If you do not see anything in the file, try adding the **-debug** flag to the jsvc calls which will provide useful information.

# Next Steps

You will likely want to do is create a script to start the application. There is much more to jsvc than we covered here, Sheldon Neilson has written an excellent [article][jsvc-tutorial] for Debian based systems which I encourage you to read.

[jsvc-tutorial]: http://www.neilson.co.za/creating-a-java-daemon-system-service-for-debian-using-apache-commons-jsvc/
[component]: https://github.com/stuartsierra/component
