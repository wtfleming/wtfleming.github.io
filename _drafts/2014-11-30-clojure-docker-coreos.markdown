---
layout: post
title:  "Running a Dockerized a Clojure Web App in CoreOS"
date:   2014-11-30 20:03:46
tags: clojure docker
---

In a previous post created a docker image for a clojure app
published to public docker hub

going to deploy on [CoreOS][]

[CoreOS]: https://coreos.com/

coreos-vagrant https://github.com/coreos/coreos-vagrant

https://coreos.com/blog/coreos-clustering-with-vagrant/

https://coreos.com/docs/running-coreos/platforms/vagrant/


"After the vagrant command returns it is time to ssh into one of your instances and try out a few commands. The only trick is that we will want to add the Vagrant key to our ssh-agent using ssh-add. This allows us to forward our SSH session to other machines in the cluster. You can do this with any key, such as those added via cloud-config, but our vagrant machines will already have the corresponding public key on disk."

```
$ ssh-add ~/.vagrant.d/insecure_private_key

$ vagrant ssh core-01 -- -A

$ fleetctl list-machines
MACHINE         IP              METADATA
c313e784...     172.17.8.102    -
c3ddc4fd...     172.17.8.101    -
d0f027da...     172.17.8.103    -
```



Create a file named clojure-http@.service

```
[Unit]
Description=clojure-http

[Service]
EnvironmentFile=/etc/environment
ExecStartPre=/usr/bin/docker kill clojure-http-%i
ExecStartPre=/usr/bin/docker rm clojure-http-%i
ExecStart=/usr/bin/docker run --name clojure-http-%i --rm -p 5000:5000 -e PORT=5000 wtfleming/docker-compojure-hello-world
ExecStartPost=/usr/bin/etcdctl set /app/clojure-http/%i ${COREOS_PUBLIC_IPV4}:%i
ExecStop=/usr/bin/docker stop clojure-http-%i
ExecStopPost=/usr/bin/etcdctl rm /app/clojure-http/%i

[X-Fleet]
Conflicts=clojure-http@*.service
```


```
$ fleetctl submit clojure-http@.service

$ fleetctl list-unit-files
UNIT                    HASH    DSTATE          STATE           TARGET
clojure-http@.service   aab3979 inactive        inactive        -

$ fleetctl start clojure-http@1.service
Unit clojure-http@1.service launched on c313e784.../172.17.8.102
$ fleetctl start clojure-http@2.service
Unit clojure-http@2.service launched on c3ddc4fd.../172.17.8.101

$ fleetctl list-units
UNIT                    MACHINE                         ACTIVE  SUB
clojure-http@1.service  c313e784.../172.17.8.102        active  running
clojure-http@2.service  c3ddc4fd.../172.17.8.101        active  running

$ curl http://172.17.8.102:5000
Hello World

```

ELB presence


or alternative is a proxy like nginx triggered to reload from changes in etcd
http://marceldegraaf.net/2014/04/24/experimenting-with-coreos-confd-etcd-fleet-and-cloudformation.html

