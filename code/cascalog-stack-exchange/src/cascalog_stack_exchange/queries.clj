(ns cascalog_stack_exchange.queries
  (:use cascalog.api)
  (:require [cascalog.ops :as ops]
            [clojure.data.xml :as xml]
            [clojure.string :as str]))


(defmapop post-xml-parser [post-xml]
  "Parse a line of xml representing a stack exchange post."
  (try
    (let [post (xml/parse-str post-xml)
          {{:keys [OwnerUserId PostTypeId Tags]} :attrs} post]
      [OwnerUserId PostTypeId Tags])
    (catch Exception _ [nil nil nil])))


(defmapop user-xml-parser [user-xml]
  "Parse a line of xml representing a stack exchange user."
  (try
    (let [user (xml/parse-str user-xml)
          {{:keys [Id DisplayName Reputation]} :attrs} user]
      [Id DisplayName (Integer/parseInt Reputation)])
    (catch Exception _ [nil nil nil])))



(defn tags-to-set
  "Convert a string of delimited tags into a seq"
  [tags]
  (let [tab-delimited (str/replace tags #"><|<|>" "\t")]
    (set (str/split (str/trim tab-delimited) #"\t"))))




(defn user-query
  "Run a query that outputs user id, reputation, and display name."
  []
  (let [file-tap (hfs-textline "data/users.xml")]
    (?<- 
      (stdout)
      [?id ?reputation ?display-name]
      (file-tap ?line)
      (user-xml-parser ?line :> ?id ?display-name ?reputation))))

(defn user-minimum-reputation-query
  "Run a query showing users with a reputation greater than 200."
  []
  (let [file-tap (hfs-textline "data/users.xml")]
;  (let [file-tap (hfs-textline "data/gaming.stackexchange.com/Users.xml")]
    (?<- 
      (stdout)
      [?display-name ?reputation]
      (file-tap ?line)
      (user-xml-parser ?line :> _ ?display-name ?reputation)
      (> ?reputation 200))))
;      (> ?reputation 30000))))


(defn user-minimum-reputation-count-query
  "Run a query counting the number of users with a reputation greater than 200."
  []
  (let [file-tap (hfs-textline "data/users.xml")]
;  (let [file-tap (hfs-textline "data/gaming.stackexchange.com/Users.xml")]
    (?<- 
      (stdout)
      [?count]
      (file-tap ?line)
      (user-xml-parser ?line :> _ ?display-name ?reputation)
      (> ?reputation 200)
      (ops/count :> ?count))))





(defn post-query
  "Run a query that outputs post owner-id, type-id, and tags"
  []
  (let [file-tap (hfs-textline "data/posts.xml")]
    (?<-
     (stdout)
     [?owner-user-id ?post-type-id !tags]
     (file-tap ?line)
     (post-xml-parser ?line :> ?owner-user-id ?post-type-id !tags))))





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




(defn user-tags-join-query
  "Run a query on users and posts that joins on user id and output user
  display name and tags by all users with more than 200 reputation."
  []
  (let [users-tap (hfs-textline "data/users.xml")
        posts-tap (hfs-textline "data/posts.xml")]
;  (let [users-tap (hfs-textline "data/gaming.stackexchange.com/Users.xml")
;        posts-tap (hfs-textline "data/gaming.stackexchange.com/Posts.xml")]


    (?<-
     (stdout)
     [?display-name ?tags]

     (posts-tap ?posts-line)
     (post-xml-parser ?posts-line :> ?user-id _ ?raw-tags)
     (aggregate-tags ?raw-tags :> ?tags)
     
     (users-tap ?users-line)
     (user-xml-parser ?users-line :> ?user-id ?display-name ?reputation)
     (> ?reputation 200))))



