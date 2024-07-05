+++
title = "Rust benchmarking with Criterion"
[taxonomies]
tags = [ "rust" ]
+++

I was recently looking into benchmarking some Rust code and thought I would write up how to do so with the [criterion](https://github.com/bheisler/criterion.rs) library. Code for this post is available [here at GitHub](https://github.com/wtfleming/rust_benchmarking_example).

For this toy example we'll be writing code to determine the distance between 2 points. This is relatively easy to do with the [pythagorean theorem](https://en.wikipedia.org/wiki/Pythagorean_theorem), but the downside is you will need to use a relatively slow square root calculation to do so.

Many times you don't need the exact distance. Say you have a point and a vector of points and want to know which one in the vector is the closest - in this case what you care about is the relative distance each point is, and can skip the square root and use distance squared.

So how much faster would it be to use squared distance? Lets find out.


### Create a library

Lets create a library and add criterion as a dependency.

```
$ cargo new --lib rust_benchmarking_example
$ cd rust_benchmarking_example
```

Now lets add `criterion` as a dev-dependency

```
cargo add criterion --dev --features html_reports
```


Your `Cargo.toml` file should now look something like this
```
[package]
name = "rust_benchmarking_example"
version = "0.1.0"
edition = "2021"

[dependencies]

[dev-dependencies]
criterion = { version = "0.5.1", features = ["html_reports"] }

```

### Code

Open `src/lib.rs` and add the following code


```rust
pub struct Vector2 {
    pub x: f64,
    pub y: f64,
}

impl Vector2 {
    pub fn new(x: f64, y: f64) -> Vector2 {
        Vector2 { x, y }
    }

    pub fn distance(&self, rhs: &Vector2) -> f64 {
        let x = self.x - rhs.x;
        let y = self.y - rhs.y;
        (x * x + y * y).sqrt()
    }

    pub fn distance_squared(&self, rhs: &Vector2) -> f64 {
        let x = self.x - rhs.x;
        let y = self.y - rhs.y;
        x * x + y * y
    }
}
```

### Unit tests
Lets make sure everything is working as expected, add the following tests to `src/lib.rs`.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn approximately(lhs: f64, rhs: f64) -> bool {
        (lhs - rhs).abs() < f64::EPSILON
    }

    #[test]
    fn distance_test() {
        let a = Vector2::new(1.0, 5.0);
        let b = Vector2::new(-2.0, 1.0);

        let result = a.distance(&b);
        assert!(approximately(result, 5.0), "{result} was not equal to 5.0");

        let result = b.distance(&a);
        assert!(approximately(result, 5.0), "{result} was not equal to 5.0");
    }

    #[test]
    fn distance_squared_test() {
        let a = Vector2::new(0.0, 0.0);
        let b = Vector2::new(3.0, 4.0);

        let result = a.distance_squared(&b);
        assert!(
            approximately(result, 25.0),
            "{result} was not equal to 25.0"
        );

        let result = b.distance_squared(&a);
        assert!(
            approximately(result, 25.0),
            "{result} was not equal to 25.0"
        );
    }
}
```

### Create a benchmark
Now lets create a benchmark with criterion, these files are put outside of the `src` directory in a directory called `benches` that you will need to create. Lets do that and also create a file in it called distance.rs

At this point your directory structure should look like this

```bash
$ tree
.
├── Cargo.lock
├── Cargo.toml
├── benches
│   └── distance.rs
├── src
│   └── lib.rs
```


Add the following to your `Cargo.toml` file.

```toml
[[bench]]
name = "distance"
harness = false
```

and the following code to `benches/distance.rs`

```rust
use criterion::{criterion_group, criterion_main, Criterion};
use rust_benchmarking_example::*;

pub fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("distance", |bench| {
        bench.iter(|| {
            let a = Vector2::new(0.0, 0.0);
            let b = Vector2::new(3.0, 4.0);
            a.distance(&b);
        })
    });
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
```

You can then run the benchmark from the command like with `cargo bench` which will run the code a number of times

In the output look for a line like:

```bash
distance                time:   [934.09 ps 935.48 ps 937.28 ps]
```

Which tells you

- 934.09 ps - fastest benchmark
- 935.48 ps - average benchmark
- 937.28 ps - slowest benchmark


The results are cached, so if you run `cargo bench` again it will compare the results against the most recently run ones, here we can see that there was no real change detected - which makes sense as other than some background noise on your computer we are running it on the same code.

```bash
distance                time:   [934.73 ps 935.46 ps 936.38 ps]
                        change: [-0.1119% +0.0493% +0.2134%] (p = 0.55 > 0.05)
                        No change in performance detected.
```

And since we enabled the html_reports feature we can see them by opening `target/criterion/report/index.html` in a web browser, where you should see something that looks like this


![image](/images/rust-benchmarking-criterion/rust-criterion-distance.jpg)


### Benchmark squared distance implementation
Now lets benchmark our distance squared code, change

```rust
    c.bench_function("distance", |bench| {
        bench.iter(|| {
            let a = Vector2::new(0.0, 0.0);
            let b = Vector2::new(3.0, 4.0);
            a.distance(&b);
        })
    });
```

to 
```rust
    c.bench_function("distance", |bench| {
        bench.iter(|| {
            let a = Vector2::new(0.0, 0.0);
            let b = Vector2::new(3.0, 4.0);
            a.distance_squared(&b);
        })
    });
```

and run `cargo bench` again. On my machine I get this error


> Benchmarking distance: AnalyzingCriterion.rs ERROR: At least one measurement of benchmark distance took zero time per iteration. This should not be possible. If using iter_custom, please verify that your routine is correctly measured.

It appears that the `distance_squared()` implementation is so fast it effectively takes zero time to run and can't be measured. Which I suppose makes sense as the much slower version using a square root took picoseconds to run.


If you really want to have this complete you could artificially make it slower by disabling compiler optimizations when benchmarking by adding this to your `Cargo.toml`

```
[profile.bench]
opt-level = 0
```

but you generally wouldn't want to do so since taking measurements on a dev build won't be very useful. If you were to do so, you would see output like

```
distance                time:   [9.9843 ns 10.000 ns 10.017 ns]


distance                time:   [9.3626 ns 9.3730 ns 9.3848 ns]
                        change: [-6.2155% -6.0317% -5.8404%] (p = 0.00 < 0.05)
                        Performance has improved.
```

Alternatively you could also do a benchmark run where only the the `a.distance(&b);` call happens and another where it calls that and `a.distance_squared(&b);` and you can see that the distance_squared call does not add any noticeable overhead.

But realistically the code in this toy example is probably so fast that it is not a great candidate for benchmarking.
