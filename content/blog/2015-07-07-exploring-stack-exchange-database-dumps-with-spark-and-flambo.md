+++
title = "Exploring Stack Exchange data with Clojure using Apache Spark and Flambo"
[taxonomies]
tags = [ "spark", "clojure" ]
+++



# Introduction
[Apache Spark](https://spark.apache.org/) is a is a fast and general engine for large-scale data processing (as in terabytes or larger data sets), and [Flambo](https://github.com/yieldbot/flambo) is a Clojure DSL for working with Spark. Stack Exchange is a network of question and answer websites with a variety of topics (the most popular one being [Stack Overflow][stack-overflow]). They periodically provide a [creative commons licensed database dump][stack-data]. We'll be using data from the [Stack Exchange Gaming Site][gaming] as a toy dataset to work with them.

First we will use Spark to convert the Stack Exchange files provided in XML into [Apache Parquet](https://parquet.apache.org/) format and then later we will use it to run some queries to find out things like which users have the highest reputation, as well as which ones like to play [Dwarf Fortress][dwarf-fortress].

[stack-exchange]: http://stackexchange.com/
[stack-overflow]: http://stackoverflow.com/
[stack-data]: https://archive.org/details/stackexchange

---

This post assumes you are using leiningen, some basic familiarity with either the Java or Scala Spark API, Spark 1.3.1 is installed in ~/bin/spark and that the March 2015 Gaming Stack Exchange Data Dump has been downloaded and extracted to ~/data/gaming-stackexchange The full code for this post is also [available on Github](https://github.com/wtfleming/clojure-examples/tree/master/apache-spark/flambo-gaming-stack-exchange).

[gaming]: http://gaming.stackexchange.com/
[spark]: https://spark.apache.org/
[flambo]: https://github.com/yieldbot/flambo
[parquet]: https://parquet.apache.org/
[gh-code]: https://github.com/wtfleming/clojure-examples/tree/master/apache-spark/flambo-gaming-stack-exchange

# Leiningen Project

Our project.clj looks like this:

```clojure
(defproject flambo-gaming-stack-exchange "0.1.0-SNAPSHOT"
  :description "Example of using Spark and Flambo"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :profiles {:uberjar {:aot :all}
             :provided {:dependencies
                        [[org.apache.spark/spark-core_2.10 "1.3.1"]]}}
  :dependencies [[org.clojure/clojure "1.7.0"]
                 [yieldbot/flambo "0.6.0"]
                 [commons-codec/commons-codec "1.10"]
                 [org.clojure/data.xml "0.0.8"]
                 [org.apache.spark/spark-sql_2.10 "1.3.1"]])
```

# Step 1: ETL Users

The Stack Exchange data is provided in XML format. While it would be possible to leave it as is and load the XML into one of Spark's [Resilient Distributed Dataset (RDD)][rdd] when we query (this might be desirable if you are building a [data lake][data-lake]), here we will be building a [data mart][data-mart] with a subset of the data, stored in Parquet format, and queried using [Spark DataFrames][data-frame].

[rdd]: https://spark.apache.org/docs/1.3.1/api/java/org/apache/spark/rdd/RDD.html
[data-frame]: https://spark.apache.org/docs/1.3.1/api/java/org/apache/spark/sql/DataFrame.html
[data-lake]: http://martinfowler.com/bliki/DataLake.html
[data-mart]: https://en.wikipedia.org/wiki/Data_mart

We want to take a line from the Stack Exchange Users.xml file that looks something like this:

```xml
  <row Id="2" Reputation="101" CreationDate="2010-07-07T16:01:11.480"
  DisplayName="Geoff Dalgas" LastAccessDate="2015-03-06T05:00:48.087"
  WebsiteUrl="http://stackoverflow.com" Location="Corvallis, OR"
  AboutMe="&lt;p&gt;Developer on the StackOverflow team." Views="98" UpVotes="20"
  DownVotes="1" Age="38" AccountId="2" />
```

And convert it into a DataFrame represented like this:

```
| id | name         | reputation|
|----+--------------+-----------|
| 2  | Geoff Dalgas | 101       |
```

We'll use the following code:


```clojure
(ns flambo-gaming-stack-exchange.etl-users
  (:require [flambo.conf :as conf]
            [flambo.api :as f]
            [flambo.sql :as sql]
            [clojure.data.xml :as xml])
  (:import [org.apache.spark.sql RowFactory]
           [org.apache.spark.sql.types StructType StructField Metadata DataTypes])
  (:gen-class))

(defn build-sql-context
  "Returns a Spark SQLContext"
  [app-name]
  (let [c (-> (conf/spark-conf)
              (conf/master "local[*]")
              (conf/app-name app-name))
        sc (f/spark-context c)]
    (sql/sql-context sc)))

(defn xml->row
  "Parse a row of user xml and return it as a Spark Row"
  [user-xml]
  (let [user (xml/parse-str user-xml)
        {{:keys [Id DisplayName Reputation]} :attrs} user]
    [(RowFactory/create (into-array Object [(Integer/parseInt Id) DisplayName  (Integer/parseInt Reputation)]))]))

"Spark function that reads in a line of XML and potentially returns a Row"
(f/defsparkfn parse-user
  [user-xml]
  (if (.startsWith user-xml  "  <row")
    (xml->row user-xml)
    []))

(def user-schema
  (StructType.
   (into-array StructField [(StructField. "id" (DataTypes/IntegerType) true (Metadata/empty))
                            (StructField. "name" (DataTypes/StringType) true (Metadata/empty))
                            (StructField. "reputation" (DataTypes/IntegerType) true (Metadata/empty))])))

(defn -main [& args]
  (let [home (java.lang.System/getenv "HOME")
        sql-ctx (build-sql-context "ETL Users")
        sc (sql/spark-context sql-ctx)
        xml-users (f/text-file sc (str home "/data/gaming-stackexchange/Users.xml"))
        users (f/flat-map xml-users parse-user)
        users-df (.createDataFrame sql-ctx users user-schema)]
    (.saveAsParquetFile users-df (str home "/data/gaming-stack-exchange-warehouse/users.parquet"))))
```


Now build and run. For simplicity in these examples we will run everything in local mode.

```sh
$ lein uberjar
$ ~/bin/spark/bin/spark-submit --class flambo_gaming_stack_exchange.etl_users \
target/flambo-gaming-stack-exchange-0.1.0-SNAPSHOT-standalone.jar
```

You should now have a directory at ~/data/gaming-stack-exchange-warehouse/users.parquet containing the user data in Parquet format.

# Step 2: ETL Posts

Next we want to load posts. This is almost identical to loading users. I'll omit most of the code here, but it is [available on GitHub][posts-etl-code]. However I will include the schema here to make following along with the queries easier.

[posts-etl-code]: https://github.com/wtfleming/clojure-examples/blob/master/apache-spark/flambo-gaming-stack-exchange/src/flambo_gaming_stack_exchange/etl_posts.clj

```clojure

(def post-schema
  (StructType.
   (into-array StructField
     [(StructField. "ownerId" (DataTypes/IntegerType) true (Metadata/empty))
      (StructField. "postType" (DataTypes/IntegerType) true (Metadata/empty))
      (StructField. "tags" (DataTypes/StringType) true (Metadata/empty))])))

```

Now ETL the posts into Parquet format.

```sh
$ ~/bin/spark/bin/spark-submit --class flambo_gaming_stack_exchange.etl_posts \
target/flambo-gaming-stack-exchange-0.1.0-SNAPSHOT-standalone.jar
```


Like with the users step, you should now have a directory at ~/data/gaming-stack-exchange-warehouse/posts.parquet containing the post data in Parquet format.

# Step 3: Query the data

Now lets run some queries. The code here will be broken up and be pseudo-Clojure for demonstration purposes. The code this is derived from is [available here at GitHub][queries-code]. And can be run like this:

```sh
$ ~/bin/spark/bin/spark-submit --class flambo_gaming_stack_exchange.core \
target/flambo-gaming-stack-exchange-0.1.0-SNAPSHOT-standalone.jar
```

[queries-code]: https://github.com/wtfleming/clojure-examples/blob/master/apache-spark/flambo-gaming-stack-exchange/src/flambo_gaming_stack_exchange/core.clj

It's worth noting that the gaming site data is not particularly large, in all likelihood you'd be better off loading the files into RAM with your programming language of choice or into a relational database and querying them that way. However if the data was significantly larger (terabytes or more) you'd be able to use the exact same code and horizontally scale your data processing over a cluster of machines.

[stack-overflow]: http://stackoverflow.com/

# Query 1 - Top users

Lets find the top 10 users by reputation who have at least a 30,000 reputation score.

```clojure
(:require [flambo.conf :as conf]
          [flambo.api :as f]
          [flambo.sql :as sql])
(:import [org.apache.spark.sql Column]
         [org.apache.commons.codec.binary Hex])

(defn build-sql-context
  "Returns a Spark SQLContext"
  [app-name]
  (let [c (-> (conf/spark-conf)
              (conf/master "local[*]")
              (conf/app-name app-name))
        sc (f/spark-context c)]
    (sql/sql-context sc)))


(let [home (java.lang.System/getenv "HOME")
      sql-ctx (build-sql-context "Stack Exchange Queries")

      ;; Read in the users Parquet file
      users (sql/parquet-file sql-ctx (string-array (str home "/data/gaming-stack-exchange-warehouse/users.parquet")))

      ;; This is one way to query a DataFrame.
      query (-> users
                (.select (column-array (.col users "name") (.col users "reputation")))
                (.filter "reputation > 30000")
                (.orderBy (column-array (-> users
                                            (.col "reputation")
                                            (.desc))))
                (.limit 10))

      ;; This is another way to run the same query, but to do it this way
      ;; we must first register any tables we will be using.
      _ (sql/register-temp-table users "users")
      sql-query (sql/sql sql-ctx "SELECT name, reputation FROM users WHERE reputation > 30000 ORDER BY reputation DESC LIMIT 10")]
    (.show sql-query))
```

Running either of the the above queries will output:

```
name             reputation
Raven Dreamer    123648
agent86          89947
z  '             54792
LessPop_MoreFizz 51582
kalina           41496
Oak              40572
tzenes           40458
StrixVaria       38108
badp             37688
fredley          35584
```

# Query 2 - Top users, names obfuscated

Next lets say we've been given the requirement that we need to obfuscate user names prior to displaying them. Here we will use a SHA-1 hash function and the [Apache Commons Hex encoder][commons-hex].

[commons-hex]: https://commons.apache.org/proper/commons-codec/apidocs/org/apache/commons/codec/binary/Hex.html

This is obviously not a good way to obfuscate the name and not how you would want to do it in a production environment, but for the purposes of demonstrating calling arbitrary functions in Spark it is "good enough" for this example.

```clojure
(defn hash-string
  "Returns a hexidecimal encoded SHA-1 hash of a string"
  [data]
  (-> (java.security.MessageDigest/getInstance "SHA-1")
      (.digest (.getBytes data))
      (Hex/encodeHexString)))

;; "Hash name in a row with the schema [name reputation], returning a
;;  vector with the name hashed."
(f/defsparkfn hash-name
  [row]
  (let [[name reputation] row
        hashed-name (hash-string name)]
    [hashed-name reputation]))

;; We can also turn a DataFrame to an RDD and use Flambo functions.
;; Here we hash the users name prior to displaying it.
rdd-query (-> sql-query
              (.toJavaRDD)
              (f/map sql/row->vec)
              (f/map hash-name)
              (f/foreach (f/fn [x] (println x))))

```

A few things to note:

* sql-query is the DataFrame from the previous query example.
* We need to turn the DataFrame into a RDD.
* At this time not all of the Spark SQL functions are wrapped in Clojure, so we have to call the Java method .toJavaRDD directly on the DataFrame object rather than a function provided by Flambo.
* We need to use Flambo's defsparkfn macro to to define the function we will be using.

Running the above code will output:

```
[74cfefcff37f81e278398e4de6ce6ada68e7c80e 123648]
[e6eaf112ecf8020e9e1d389ca1e432488bfc7476 89947]
[a8d6f6c81225d88c1797dfc0592935a879d3b626 54792]
[aaa0b19e5e4db300832368b88871e39b695693fe 51582]
[6109e96245bc6d375d942e1cd0d88da8c8172f4a 41496]
[7badddf11e798303d6321ad096d5b2b447f97293 40572]
[7572126b4fd86ccd3610c5280a116c51f186781f 40458]
[8af617f985b18b676f6d809d9b1a9615b72a187b 38108]
[e122e7f4d0fc01a52a909621b43e67ddab506889 37688]
[9f9b1f7ec647cec6f9a4477face2216a81fee0dc 35584]
```

# Query 3 - People who like to play Dwarf Fortress

Finally lets run one more query to find out which users have created the most questions about the game [Dwarf Fortress][dwarf-fortress]. In order to answer this we'll need to join users against posts and can do so like this:

[dwarf-fortress]: https://en.wikipedia.org/wiki/Dwarf_Fortress

```clojure
;; Top 10 users by number of questions asked about the
;; game Dwarf Fortress.
(let [df-query (sql/sql sql-ctx
                        "SELECT u.name, count(1) as cnt
                        FROM users u, posts p
                        WHERE p.tags LIKE '%dwarf-fortress%'
                        AND u.id = p.ownerId
                        GROUP BY u.name
                        ORDER BY cnt DESC
                        LIMIT 10")]
  (.show df-query))
```

Running the query gives us these users and how many questions they have asked:

```
name           cnt
antony.trupe   37
aslum          32
Anna           31
C. Ross        29
Paralytic      15
David Grinberg 15
user5781       14
Mechko         13
andronikus     10
Menno Gouw     9
```

# Conclusion

While this post looked mostly at Spark SQL and DataFrames, support for them in Flambo is currently a bit rudimentary. It still provides access to the underlying Java objects, and the examples above demonstrated this is not a problem. I suspect more of it may get wrapped in Clojure land in future releases.

Flambo seems to be currently geared more towards working with Resilient Distributed Datasets. There are a number of [RDD operations][flambo-rdd] we didn't touch on here. I highly recommend exploring the documentation to see more of what is available.

[flambo-rdd]:https://github.com/yieldbot/flambo#rdds
