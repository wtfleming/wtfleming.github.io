---
layout: post
title:  "Running a Dockerized Clojure Web App on CoreOS"
date:   2014-12-06 13:03:46
tags: clojure docker coreos
---

# Introduction

In the [previous post][docker-post] we created a Clojure web service and ran it in a Docker container. Here we will deploy that container on a 3 node [CoreOS][] cluster running in [Vagrant][] on a local development machine.

[docker-post]: {% post_url 2014-11-29-dockerize-clojure-compojure-http-kit-web-application %}
[Vagrant]: https://www.vagrantup.com/

# CoreOS

CoreOS is a minimal version of Linux meant for large scale server deployments.

It has a very different model than a Debian/Red Hat/etc distribution. The OS runs on a read-only partition, and applications/services run in Docker containers on a read-write filesystem.

It's web page describes it as:

```
A new Linux distribution that has been rearchitected to provide features needed
to run modern infrastructure stacks. The strategies and architectures that influence
CoreOS allow companies like Google, Facebook and Twitter to run their services at
scale with high resilience.
```

The components to be aware of are:

---

* **[CoreOS][]** - The underlying operating system.
* **[Docker][]** - CoreOS applications run in containers. At this time only Docker is supported. However, the CoreOS team recently announced a new container runtime called [Rocket][] they will also be adding support for.
* **[etcd][]** - A highly-available key value store for shared configuration and service discovery. This fulfills a role similar to ZooKeeper.
* **[fleet][]** - You will use this to start/stop containers, define a cluster topology, etc. It ties together systemd and etcd into a distributed init system. Think of it as an extension of systemd that operates at the cluster level instead of the machine level.

---

[Docker]: https://www.docker.com/
[Rocket]: https://github.com/coreos/rocket
[etcd]: https://coreos.com/using-coreos/etcd/
[fleet]: https://github.com/coreos/fleet
[CoreOS]: https://coreos.com/

We won't be really be going into etcd in this post, but there are some interesting things you can do with it. For instance, you could configure a trigger so that when a new web service comes online it can detect this and automatically change an nginx configuration to proxy traffic to it (or remove it from the rotation when the service is stopped).

# Start Vagrant

I am assuming you are on either a Linux or OS X machine, if you are on Windows you will likely need to make a few changes.

If you run into any problems there is also a guide to using Vagrant on the CoreOS [blog][] and [documentation][] which may help you troubleshoot.

[blog]: https://coreos.com/blog/coreos-clustering-with-vagrant/
[documentation]: https://coreos.com/docs/running-coreos/platforms/vagrant/


Ensure you have installed Vagrant on you development machine, then use git to clone the [coreos-vagrant repo][coreos-vagrant].

[coreos-vagrant]: https://github.com/coreos/coreos-vagrant

```
$ git clone git@github.com:coreos/coreos-vagrant.git
$ cd coreos-vagrant
```

Rename the file *config.rb.sample* to *config.rb* and change the lines:

```
#$num_instances=1
#$update_channel='alpha'
```

to

```
$num_instances=3
$update_channel='stable'
```

Next rename the file *user-data.sample* to *user-data* and then browse to [https://discovery.etcd.io/new][etcd-new-token] and copy the what was on the page then uncomment and insert it on the the line that looks like this:

[etcd-new-token]: https://discovery.etcd.io/new

```
#discovery: https://discovery.etcd.io/<token>
```

Every time you start a new cluster you will need a new token. If you do not want to use the discovery service you can instead include the network addresses of the machines that will be running etcd yourself. The CoreOS team provide the discovery.etcd.io service as a convenience to make it easier to bootstrap a cluster, but you are not required to use it.

Now run this command:

```
$ vagrant up
```

and Vagrant will launch 3 VirtualBox machines running CoreOS.

```
$ vagrant status
Current machine states:
core-01                   running (virtualbox)
core-02                   running (virtualbox)
core-03                   running (virtualbox)
```

As you can see, there are 3 machines running.

# SSH to your cluster

In order to forward your SSH session to other machines in the cluster you will need to use a key that is installed on all machines. In this case one from Vagrant will already be installed on the machines and we can add it like this:

```
$ ssh-add ~/.vagrant.d/insecure_private_key
```

Now SSH into one of the boxes with agent forwarding:

```
$ vagrant ssh core-01 -- -A

```

We'll use the fleetctl tool to control our cluster. First lets see that we can see all 3 machines:

```
$ fleetctl list-machines
MACHINE         IP              METADATA
c313e784...     172.17.8.102    -
c3ddc4fd...     172.17.8.101    -
d0f027da...     172.17.8.103    -
```

You should see something like the above. We haven't defined any metadata, but you could do something like tag a machine backed by a SSD drive, and then when you launch a service like PostgreSQL tell fleet that it should only run on a machine with that metadata.

# Create A Service File

CoreOS runs applications as Docker containers. We will be running a simple web server written in Clojure that just displays the text "Hello World". The source code is [available on GitHub][source-code] and the Docker container is also [published at Docker Hub][docker-hub].


[docker-hub]: https://registry.hub.docker.com/u/wtfleming/docker-compojure-hello-world/
[source-code]: https://github.com/wtfleming/docker-compojure-hello-world

Ensure that you are logged onto a machine in the cluster via SSH and create a file named *clojure-http@.service*. The file format is a [systemd][] service file.

[systemd]: http://freedesktop.org/wiki/Software/systemd/

```
[Unit]
Description=clojure-http

[Service]
ExecStart=/usr/bin/docker run --name clojure-http-%i --rm -p 5000:5000 -e PORT=5000 wtfleming/docker-compojure-hello-world
ExecStop=/usr/bin/docker stop clojure-http-%i

[X-Fleet]
Conflicts=clojure-http@*.service
```

This file provides the instructions about how the service should run. There are a few things to note:

* We are running a docker container and exposing port 5000.
* The wtfleming/docker-compojure-hello-world container is publicly hosted on Docker Hub, it will be automatically downloaded to the CoreOS cluster.
* The %i refers to the string between the @ and the suffix when we start the service (which we will do shortly, and should make sense then).
* The X-Fleet directive indicates that this service should only one instance of the service on a machine. Since we've bound to port 5000 if we start up a second copy of this service we don't want it here, fleet will launch it on another machine in the cluster.

Now submit the service file and check that it registered:

```
$ fleetctl submit clojure-http@.service

$ fleetctl list-unit-files
UNIT                    HASH    DSTATE          STATE           TARGET
clojure-http@.service   aab3979 inactive        inactive        -
```

If you see the file listed we are ready to move on.

# Start the Web Services

We will be running 2 copies of the service, lets start them:

```
$ fleetctl start clojure-http@1.service
Unit clojure-http@1.service launched on c313e784.../172.17.8.102

$ fleetctl start clojure-http@2.service
Unit clojure-http@2.service launched on c3ddc4fd.../172.17.8.101
```

You can check the status of running units:

```
$ fleetctl list-units
UNIT                    MACHINE                         ACTIVE  SUB
clojure-http@1.service  c313e784.../172.17.8.102        active  running
clojure-http@2.service  c3ddc4fd.../172.17.8.101        active  running
```

You can view logs like this:

```
$ fleetctl journal clojure-http@1.service
Dec 03 04:44:48 core-02 systemd[1]: Starting clojure-http...
Dec 03 04:44:48 core-02 systemd[1]: Started clojure-http.
Dec 03 04:44:52 core-02 docker[711]: Listening on port 5000
```

Finally lets view each of the pages:

```
$ curl http://172.17.8.101:5000
Hello World

$ curl http://172.17.8.102:5000
Hello World
```

Hopefully you'll have gotten output similar to above.

# Stop the Services and Clean Up

Lets stop the services:

```
$ fleetctl stop clojure-http@1.service
Unit clojure-http@1.service loaded on c313e784.../172.17.8.102

$ fleetctl stop clojure-http@2.service
Unit clojure-http@2.service loaded on c3ddc4fd.../172.17.8.101
```

Notice that they have now entered a failed state, but remain listed.

```
$ fleetctl list-units
UNIT                    MACHINE                         ACTIVE  SUB
clojure-http@1.service  c313e784.../172.17.8.102        failed  failed
clojure-http@2.service  c3ddc4fd.../172.17.8.101        failed  failed
```

We could restart them, but instead we will remove them like this:

```
$ fleetctl destroy clojure-http@1.service
Destroyed clojure-http@1.service

$ fleetctl destroy clojure-http@2.service
Destroyed clojure-http@2.service

$ fleetctl list-units
UNIT    MACHINE ACTIVE  SUB
```

Now lets remove our service file.

```
$ fleetctl destroy clojure-http@.service
Destroyed clojure-http@.service

$ fleetctl list-unit-files
UNIT    HASH    DSTATE  STATE   TARGET
```

Now exit the cluster, shut it down, and clean up Vagrant.

```
$ exit

$ vagrant halt
==> core-03: Attempting graceful shutdown of VM...
==> core-02: Attempting graceful shutdown of VM...
==> core-01: Attempting graceful shutdown of VM...

$ vagrant destroy
...
```

And we're done!

# Next Steps

So far we created a CoreOS cluster and ran a web server on it, but we have just barely scratched the surface of what is possible.

In a production environment you would want expose the web services to the world. If you are on EC2 you might want to register the services with an Elastic Load Balancer. One way to do that is with a ["sidekick" container][sidekick-container] for each web service.

[sidekick-container]: https://coreos.com/docs/launching-containers/launching/launching-containers-fleet/#run-a-simple-sidekick

The CoreOS team provides [code to create a container on github][elb-presence] that will register a service with an ELB, and [example of how to use it][elb-presence-example].


[elb-presence]: https://github.com/coreos/elb-presence
[elb-presence-example]: https://github.com/coreos/unit-examples/tree/master/blog-fleet-intro

Marcel de Graaf has also [written about running on EC2 and using nginx to proxy][de-graaf]. If you want to know more, I highly recommend taking the time to read his post and the CoreOS documentation, they both go into much greater detail about what is possible and issues you should be aware of running a service in a production setting.

[de-graaf]: http://marceldegraaf.net/2014/04/24/experimenting-with-coreos-confd-etcd-fleet-and-cloudformation.html
