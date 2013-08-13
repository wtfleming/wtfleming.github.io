---
layout: post
title:  "Cascalog Stack Exchange Queries"
date:   2013-08-11 20:11:46
categories: jekyll update draft
---




Cascalog is a fully-featured data processing and querying library for Clojure. The main use cases for Cascalog are processing "Big Data" on top of Hadoop or doing analysis on your local computer from the Clojure REPL. Cascalog is a replacement for tools like Pig, Hive, and Cascading.



```
$ lein repl
```

```
user=> (use 'cascalog_stack_exchange.queries)
```


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
(user-query)
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
(user-minimum-reputation-query)
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
(user-minimum-reputation-count-query)
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
(post-query)
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
(post-aggregate-query)
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
(user-tags-join-query)
RESULTS
-----------------------
David Fullerton <steam><hosting><source-engine><monkey-island><steam>
Jin     <world-of-warcraft>
-----------------------
```

