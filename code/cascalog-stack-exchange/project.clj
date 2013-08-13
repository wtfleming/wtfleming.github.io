(defproject cascalog-stack-exchange "0.1.0-SNAPSHOT"
  :description "Cascalog example queries for a stack exchange site"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.5.1"]
                 [cascalog "1.10.2"]
		 [org.clojure/data.xml "0.0.7"]]
  :profiles { :dev {:dependencies [[org.apache.hadoop/hadoop-core "1.0.4"]]}})
