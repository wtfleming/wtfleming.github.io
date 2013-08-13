---
layout: post
title:  "Querying Stack Exchange data dumps with Cascalog"
date:   2013-08-11 20:11:46
categories: cascalog hadoop
---


> "[Cascalog] (https://github.com/nathanmarz/cascalog) is a fully-featured data processing and querying library for Clojure. The main use cases for Cascalog are processing "Big Data" on top of Hadoop or doing analysis on your local computer from the Clojure REPL. Cascalog is a replacement for tools like Pig, Hive, and Cascading."

> "[Stack Exchange](http://stackexchange.com) is a fast-growing network of 105 question and answer sites on diverse topics from software programming to cooking to photography and gaming. We build libraries of high-quality questions and answers, focused on the most important topics in each area of expertise. From our core of Q&A, to community blogs and real-time chat, we provide experts with the tools they need to make The Internet a better place."

Every 3 months Stack Exchange [provides a anonymized data dump](http://clearbits.net/creators/146-stack-exchange-data-dump) of all creative commons questions and answers from their websites (the largest of which being [Stack Overflow](http://stackoverflow.com).

In this post we will get started using Cascalog to query the [Arqade](http://gaming.stackexchange.com) data dump, the site dedicated to video game questions and answers.


## Getting Started

The code and data for this post is available [here](https://github.com/wtfleming/wtfleming.github.io/tree/master/code/cascalog-stack-exchange).


If you are going to follow along, run the commands that begin with:

```
user=>
```

Now fire up a [leiningen](https://github.com/technomancy/leiningen) REPL in the project's directory and switch to the demonstration namespace:

```
user=> (use 'cascalog_stack_exchange.queries)
```

At the start of the *queries.clj* file we have pulled in the following:

``` clojure
(ns cascalog_stack_exchange.queries
  (:use cascalog.api)
  (:require [cascalog.ops :as ops]
            [clojure.data.xml :as xml]
            [clojure.string :as str]))
```

This provides everything we will need to run the queries.

# Parsing the XML

In *queries.clj* we have defined a function that will parse a line of XML representing a user, and extract the user id, display name, and reputation.

``` clojure
{% raw %}
(defmapop user-xml-parser [user-xml]
  "Parse a line of xml representing a stack exchange user."
  (try
    (let [user (xml/parse-str user-xml)
          {{:keys [Id DisplayName Reputation]} :attrs} user]
      [Id DisplayName (Integer/parseInt Reputation)])
    (catch Exception _ [nil nil nil])))
{% endraw %}
```


It takes input that looks like this

``` xml
<row Id="3" Reputation="3272" CreationDate="2010-07-07T16:10:54.360"
DisplayName="David Fullerton" LastAccessDate="2013-06-02T00:58:32.237"
WebsiteUrl="http://careers.stackoverflow.com/dfullerton" Location="New York, NY"
AboutMe="&lt;p&gt;Stack Exchange &lt;a href=&quot;http://meta.stackoverflow.com/
a/121542/146719&quot;&gt;VP of Engineering&lt;/a&gt;.&lt;/p&gt;&#xA;&#xA;&lt;p&gt;"
Views="106" UpVotes="2163" DownVotes="18" Age="28"
EmailHash="7ec7e363b18de72c5ac1f3931b9d56ba" />
```

and returns ["3" "David Fullerton" 3272].

## Querying Users

``` clojure
(defn user-query
  "Run a query that outputs user id, reputation, and display name."
  []
  (let [file-tap (hfs-textline "data/users.xml")]
    (?<- 
      (stdout)
      [?id ?reputation ?display-name]
      (file-tap ?line)
      (user-xml-parser ?line :> ?id ?display-name ?reputation))))
```


```
user=> (user-query)
RESULTS
-----------------------
3       3272    David Fullerton
4       101     Robert Cartaino
5       238     Jin
-----------------------
```


``` clojure
(defn user-minimum-reputation-query
  "Run a query showing users with a reputation greater than 200."
  []
  (let [file-tap (hfs-textline "data/users.xml")]
    (?<- 
      (stdout)
      [?display-name ?reputation]
      (file-tap ?line)
      (user-xml-parser ?line :> _ ?display-name ?reputation)
      (> ?reputation 200))))
```


```
user=> (user-minimum-reputation-query)
RESULTS
-----------------------
David Fullerton 3272
Jin     238
-----------------------
```


``` clojure
(defn user-minimum-reputation-count-query
  "Run a query counting the number of users with a reputation greater than 200."
  []
  (let [file-tap (hfs-textline "data/users.xml")]
    (?<- 
      (stdout)
      [?count]
      (file-tap ?line)
      (user-xml-parser ?line :> _ ?display-name ?reputation)
      (> ?reputation 200)
      (ops/count :> ?count))))
```

```
user=> (user-minimum-reputation-count-query)
RESULTS
-----------------------
2
-----------------------
```


``` clojure
{% raw %}
(defmapop post-xml-parser [post-xml]
  "Parse a line of xml representing a stack exchange post."
  (try
    (let [post (xml/parse-str post-xml)
          {{:keys [OwnerUserId PostTypeId Tags]} :attrs} post]
      [OwnerUserId PostTypeId Tags])
    (catch Exception _ [nil nil nil])))
{% endraw %}
```

``` clojure
(defn post-query
  "Run a query that outputs post owner-id, type-id, and tags"
  []
  (let [file-tap (hfs-textline "data/posts.xml")]
    (?<-
     (stdout)
     [?owner-user-id ?post-type-id !tags]
     (file-tap ?line)
     (post-xml-parser ?line :> ?owner-user-id ?post-type-id !tags))))
```

```
user=> (post-query)
RESULTS
-----------------------
4       1       <team-fortress-2>
3       1       <steam><hosting><source-engine>
3       1       <monkey-island><steam>
4       2       null
5       1       <world-of-warcraft>
4       2       null
-----------------------
```

``` clojure
(defbufferop aggregate-tags
  "Function to combine string containing tags"
  [tuples]
  [(reduce str (map first tuples))])


(defn post-aggregate-query
  "Run a query to get a list of all tags by each user"
  []
  (let [file-tap (hfs-textline "data/posts.xml")]
    (?<-
     (stdout)
     [?owner-user-id ?tags]
     (file-tap ?line)
     (post-xml-parser ?line :> ?owner-user-id _ ?tags1)
     (aggregate-tags ?tags1 :> ?tags))))
```

```
user=> (post-aggregate-query)
RESULTS
-----------------------
3       <steam><hosting><source-engine><monkey-island><steam>
4       <team-fortress-2>
5       <world-of-warcraft>
-----------------------
```

``` clojure
(defn user-tags-join-query
  "Run a query on users and posts that joins on user id and output user
  display name and tags by all users with more than 200 reputation."
  []
  (let [users-tap (hfs-textline "data/users.xml")
        posts-tap (hfs-textline "data/posts.xml")]

    (?<-
     (stdout)
     [?display-name ?tags]

     (posts-tap ?posts-line)
     (post-xml-parser ?posts-line :> ?user-id _ ?raw-tags)
     (aggregate-tags ?raw-tags :> ?tags)
     
     (users-tap ?users-line)
     (user-xml-parser ?users-line :> ?user-id ?display-name ?reputation)
     (> ?reputation 200))))

```


```
user=> (user-tags-join-query)
RESULTS
-----------------------
David Fullerton <steam><hosting><source-engine><monkey-island><steam>
Jin     <world-of-warcraft>
-----------------------
```

