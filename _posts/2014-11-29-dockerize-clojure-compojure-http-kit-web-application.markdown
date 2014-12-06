---
layout: post
title:  "Dockerizing a Clojure, Compojure, and HTTP Kit Web Application"
date:   2014-11-29 20:03:46
tags: clojure docker
---


[Docker][] is "an open platform for developers and sysadmins to build, ship, and run distributed applications. With Docker, developers can build any app in any language using any toolchain. Dockerized apps are completely portable and can run anywhere - colleagues’ OS X and Windows laptops, QA servers running Ubuntu in the cloud, and production data center VMs running Red Hat."


[Docker]: https://www.docker.com/

Here we will build a very simple web site using the Clojure [Compojure][] and [HTTP Kit][] libraries.
The source code for this article is also available [here][source-code].

[source-code]: https://github.com/wtfleming/docker-compojure-hello-world

[Compojure]: https://github.com/weavejester/compojure
[HTTP Kit]: http://www.http-kit.org/

# Create a Compojure Application

First create a file named *project.clj* with the following contents:

```clojure
(defproject hello-world "0.1.0"
  :description "Compojure hello world web app"
  :url "https://github.com/wtfleming/docker-compojure-hello-world"
  :min-lein-version "2.0.0"
  :dependencies [[org.clojure/clojure "1.6.0"]
                 [compojure "1.2.1"]
                 [http-kit "2.1.16"]]
  :main hello-world.core
  :aot [hello-world.core])
```

And then create a file named *src/hello\_world/core.clj* with these contents:

```clojure
(ns hello-world.core
  (:require [compojure.core :refer :all]
            [org.httpkit.server :refer [run-server]])
  (:gen-class))

(defroutes myapp
  (GET "/" [] "Hello World"))

(defn -main []
  (let [port (Integer/parseInt (or (System/getenv "PORT") "8080"))]
    (run-server myapp {:port port})
    (println (str "Listening on port " port))))
```

This is a very basic Compojure/HTTP Kit app with a single route that displays a web page with the contents "Hello World".
We also check to see if an environment variable PORT has been defined, and if so bind to it, otherwise default to port 8080.

Now build with [Leiningen][].

[Leiningen]: http://leiningen.org/

```
$ lein uberjar
```

You could now run locally like this

```
$ java -jar target/hello-world-0.1.0-standalone.jar
```

Browse to http://localhost:8080 and you should see a page that displays "Hello World".


# Create a Dockerfile

Now create a file called *Dockerfile* with these contents

```
#
# Dockerfile for a compojure hello world app
#

FROM java:openjdk-8-jre
MAINTAINER Will Fleming <wfleming77@gmail.com>
ENV REFRESHED_AT 2014-11-25

COPY target/hello-world-0.1.0-standalone.jar hello-world-0.1.0-standalone.jar

ENV PORT 4000

EXPOSE 4000

CMD ["java", "-jar", "hello-world-0.1.0-standalone.jar"]
```

The Dockerfile is a set of instructions to build a docker container.

* We copy the jar file from our file system to the docker filesystem.

* Define a environment variable PORT with the value 4000.

* Expose port 4000 to other docker containers.

* Provide a default command to be run when starting the container.

There is much more you can do, the [Dockerfile documentation][dockerfile] goes into further detail.

[dockerfile]: https://docs.docker.com/reference/builder/

# Build a Docker Image

Now lets build a Docker image.


```
$ docker build -t wtfleming/compojure-hello-world .
```

We can see that it was built:

```
$ docker images
REPOSITORY                        TAG     IMAGE ID       CREATED      VIRTUAL SIZE
wtfleming/compojure-hello-world   latest  b1c798937b9d   6 days ago   351.1 MB
```

We can use an image as the basis to launch a container.

# Run a Docker container

```
$ docker run --rm -p 4000:4000 wtfleming/compojure-hello-world
Listening on port 4000
```

In the above we:

* Start a container from the wtfleming/compojure-hello-world image.
* --rm will delete the container when it stops
* -p will publish a container's port to the host

Open a web browser to http://localhost:4000 and you will see the page.

Browse to http://localhost:4000 or if you are on a Mac or Windows using boot2docker find the ip address like

```
$ boot2docker ip
The VM's Host only interface IP address is: 192.168.59.103
```

and browse to the ip provided by boot2docker like http://192.168.59.103:4000

# Next Steps

In the next post I will [demonstrate running the container on CoreOS][coreos-post].

[coreos-post]: {% post_url 2014-12-06-run-dockerized-clojure-app-on-coreos %}