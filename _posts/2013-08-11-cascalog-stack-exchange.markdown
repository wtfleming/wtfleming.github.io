---
layout: post
title:  "Querying Stack Exchange database dumps with Cascalog"
date:   2013-08-11 20:11:46
tags: cascalog
---

---

> "[Cascalog] (https://github.com/nathanmarz/cascalog) is a fully-featured data processing and querying library for Clojure. The main use cases for Cascalog are processing "Big Data" on top of Hadoop or doing analysis on your local computer from the Clojure REPL. Cascalog is a replacement for tools like Pig, Hive, and Cascading."

---

We will use Cascalog to run some basic queries on the [Arqade](http://gaming.stackexchange.com) Stack Exchange site database dump. Arqade is a website dedicated to video game questions and answers.


Every 3 months the team at [Stack Exchange](http://stackexchange.com) provides an [anonymized data dump](http://clearbits.net/creators/146-stack-exchange-data-dump) of all creative commons licensed questions and answers from network of websites (the largest of which being [Stack Overflow](http://stackoverflow.com).


## Getting Started

The code and data for this post is available [here](https://github.com/wtfleming/wtfleming.github.io/tree/master/code/cascalog-stack-exchange). The relevant file is *queries.clj*.


I encourage you to follow along in a REPL. Run the commands that begin with:

```
user=>
```

Fire up a [leiningen](https://github.com/technomancy/leiningen) REPL in the project's directory and switch to the demo namespace:

```
user=> (use 'cascalog_stack_exchange.queries)
```

At the start of the *queries.clj* we have pulled in the following:

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

and returns

``` clojure
["3" "David Fullerton" 3272]
```

## Querying Users

Our first query will iterate over all lines in the file storing user information. Extract their id, reputation score. And finally output the results to standard out.

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

1) Indicate that this is a Cascalog query which will run immediately.

```
?<-
```

2) Specify that the results will written to standard out. It is possible to store the output in any format and wherever you want (HDFS, a relational database, Amazon S3, etc.). But for simplicity we will just be using stdout in these examples.

```
(stdout)
```

3) Tell Cascalog that we want to output the *?id* *?reputation?* and *?display-name* variables.

```
[?id ?reputation ?display-name]
```


4) We earlier defined *file-tap* as a generator for each line of text in the file *data/users.xml*. We put each of them in *?line* variable. 

```
(file-tap ?line)
```

5) Parse each line and use the :> keyword to bind them to the variables *?id*, *?display-name*, and *?reputation*.

```
(user-xml-parser ?line :> ?id ?display-name ?reputation)
```

Now lets run the query, and look at the output:

```
user=> (user-query)
RESULTS
-----------------------
3       3272    David Fullerton
4       101     Robert Cartaino
5       238     Jin
-----------------------
```

## Query with a filter

We will now run a similar query, but this time we want to only include users with more than 200 reputation.

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

Running gives us:

```
user=> (user-minimum-reputation-query)
RESULTS
-----------------------
David Fullerton 3272
Jin     238
-----------------------
``` 

## Counting with built in operations

Cascalog provides a number of [built in operations](https://github.com/nathanmarz/cascalog/wiki/Built-in-operations). Here we want to know the total number of users with a reputation greater than 200.

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

Everything looks good:

```
user=> (user-minimum-reputation-count-query)
RESULTS
-----------------------
2
-----------------------
```


## Querying Posts

Once again we need to define a function to parse XML, this time for a post (a question or answer).

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

The following query is very similar to the user-query above. But note that in this case we are using *!tags* rather than *?tags*. Variables beginning with a ? are non-nullable, Cascalog will filter out any records in which a non-nullable is bound to null.

Variables beginning with ! are nullable and will not be filtered out. Here we are demonstrating that posts with a post-type-id are answers, and do not contain tags. If you wanted to know which tags are associated with the answer it is possible to join on the answer's parent id.


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

Running the query this is what we should see:

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
### Aggregating Tags

If we wanted to see all the tags used by each user we can run a query like this.  

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

Which will output:

```
user=> (post-aggregate-query)
RESULTS
-----------------------
3       <steam><hosting><source-engine><monkey-island><steam>
4       <team-fortress-2>
5       <world-of-warcraft>
-----------------------
```

### Joining users and posts

We will now combine what we have learnt to create a query that will output the display name and list of tags used by users with more than 200 reputation.


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

Since display name is stored in users.xml and the questions are in posts.xml, we will need to join on user id, since that is in both files.

In the following code posts-line and users-line are from two different sources of data. Since they are both binding to a variable *?user-id*, behind the scenes Cascalog will using a join to resolve the query.

``` clojure
    (post-xml-parser ?posts-line :> ?user-id _ ?raw-tags)
    (user-xml-parser ?users-line :> ?user-id ?display-name ?reputation)
```

We can now run the query, and everything looks good:

```
user=> (user-tags-join-query)
RESULTS
-----------------------
David Fullerton <steam><hosting><source-engine><monkey-island><steam>
Jin     <world-of-warcraft>
-----------------------
```


