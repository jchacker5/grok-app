//! `git blame --line-porcelain` parsing — pure, unit-testable, no live repo
//! needed for the parser itself. The command wrapper (commands.rs) shells
//! out to git and soft-fails (empty vec / clear error string) the same way
//! `git_probe_work_tree` / `git_file_diff` already do for other git reads.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    pub line_number: u32,
    pub author: String,
    pub date: String,
    pub commit_short: String,
    pub summary: Option<String>,
}

/// Cached per-commit metadata — porcelain only repeats author/time/summary
/// on the first occurrence of a commit in the output; later lines for the
/// same commit only carry the `<sha> <orig> <final> [<count>]` header.
#[derive(Clone)]
struct CommitMeta {
    author: String,
    author_time: i64,
    summary: Option<String>,
}

fn is_hex_sha(s: &str) -> bool {
    s.len() >= 4 && s.chars().all(|c| c.is_ascii_hexdigit())
}

/// Parse `git blame --line-porcelain` stdout into per-line blame records.
/// Never panics on malformed input — unrecognized lines are ignored.
pub fn parse_blame_porcelain(output: &str) -> Vec<BlameLine> {
    let mut result: Vec<BlameLine> = Vec::new();
    let mut meta_cache: HashMap<String, CommitMeta> = HashMap::new();

    let mut cur_sha: Option<String> = None;
    let mut cur_final_line: u32 = 0;
    let mut cur_author: Option<String> = None;
    let mut cur_time: Option<i64> = None;
    let mut cur_summary: Option<String> = None;

    for line in output.lines() {
        if line.starts_with('\t') {
            // End of this line's header block — emit a BlameLine.
            let sha = cur_sha.clone().unwrap_or_default();
            let (author, time, summary) = if cur_author.is_some() || cur_time.is_some() {
                let a = cur_author.clone().unwrap_or_else(|| "Unknown".to_string());
                let t = cur_time.unwrap_or(0);
                let s = cur_summary.clone();
                meta_cache.insert(
                    sha.clone(),
                    CommitMeta {
                        author: a.clone(),
                        author_time: t,
                        summary: s.clone(),
                    },
                );
                (a, t, s)
            } else if let Some(cached) = meta_cache.get(&sha) {
                (cached.author.clone(), cached.author_time, cached.summary.clone())
            } else {
                ("Unknown".to_string(), 0, None)
            };

            result.push(BlameLine {
                line_number: cur_final_line,
                author,
                date: format_epoch(time),
                commit_short: short_sha(&sha),
                summary,
            });

            // Per-line accumulators always reset; a new header line always
            // precedes the next tab-content line in porcelain output.
            cur_author = None;
            cur_time = None;
            cur_summary = None;
            continue;
        }

        // Commit header: "<40-hex-sha> <orig-line> <final-line> [<count>]"
        let mut parts = line.split_whitespace();
        if let Some(first) = parts.next() {
            if is_hex_sha(first) {
                let rest: Vec<&str> = parts.collect();
                if rest.len() >= 2
                    && rest[0].chars().all(|c| c.is_ascii_digit())
                    && rest[1].chars().all(|c| c.is_ascii_digit())
                {
                    cur_sha = Some(first.to_string());
                    cur_final_line = rest[1].parse().unwrap_or(0);
                    continue;
                }
            }
        }

        if let Some(rest) = line.strip_prefix("author ") {
            cur_author = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("author-time ") {
            cur_time = rest.trim().parse().ok();
        } else if let Some(rest) = line.strip_prefix("summary ") {
            cur_summary = Some(rest.to_string());
        }
        // Everything else (author-mail, committer*, filename, previous,
        // boundary, …) is not needed for the compact gutter annotation.
    }

    result
}

fn short_sha(sha: &str) -> String {
    sha.chars().take(7).collect()
}

/// Unix epoch seconds → short `YYYY-MM-DD` string. Falls back to the raw
/// epoch string if it cannot be represented (never panics).
fn format_epoch(epoch: i64) -> String {
    match chrono::DateTime::from_timestamp(epoch, 0) {
        Some(dt) => dt.format("%Y-%m-%d").to_string(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Realistic sample: line 1 + 3 share a commit (abc123…), line 2 is a
    /// different commit. Git's porcelain format only repeats full metadata
    /// on a commit's first appearance — line 3 here is deliberately given
    /// only the header + tab line (no author/summary block) to exercise the
    /// metadata-cache reuse path.
    const SAMPLE: &str = "abc1234567890abc1234567890abc1234567890 1 1 1\nauthor Jane Doe\nauthor-mail <jane@example.com>\nauthor-time 1700000000\nauthor-tz +0000\ncommitter Jane Doe\ncommitter-mail <jane@example.com>\ncommitter-time 1700000000\ncommitter-tz +0000\nsummary Initial commit\nfilename src/main.rs\n\tfn main() {\ndef4567890def4567890def4567890def4567890 2 2 1\nauthor John Smith\nauthor-mail <john@example.com>\nauthor-time 1701000000\nauthor-tz +0000\ncommitter John Smith\ncommitter-mail <john@example.com>\ncommitter-time 1701000000\ncommitter-tz +0000\nsummary Add println\nfilename src/main.rs\n\t    println!(\"hi\");\nabc1234567890abc1234567890abc1234567890 3 3 1\nfilename src/main.rs\n\t}\n";

    #[test]
    fn parses_full_and_abbreviated_blocks() {
        let lines = parse_blame_porcelain(SAMPLE);
        assert_eq!(lines.len(), 3);

        assert_eq!(lines[0].line_number, 1);
        assert_eq!(lines[0].author, "Jane Doe");
        assert_eq!(lines[0].commit_short, "abc1234");
        assert_eq!(lines[0].summary.as_deref(), Some("Initial commit"));
        assert_eq!(lines[0].date, "2023-11-14");

        assert_eq!(lines[1].line_number, 2);
        assert_eq!(lines[1].author, "John Smith");
        assert_eq!(lines[1].commit_short, "def4567");
        assert_eq!(lines[1].summary.as_deref(), Some("Add println"));

        // Abbreviated block (no author/summary lines) — reused from cache.
        assert_eq!(lines[2].line_number, 3);
        assert_eq!(lines[2].author, "Jane Doe");
        assert_eq!(lines[2].commit_short, "abc1234");
        assert_eq!(lines[2].summary.as_deref(), Some("Initial commit"));
        assert_eq!(lines[2].date, "2023-11-14");
    }

    #[test]
    fn empty_input_yields_empty_vec() {
        assert!(parse_blame_porcelain("").is_empty());
    }

    #[test]
    fn garbage_input_does_not_panic() {
        let out = parse_blame_porcelain("not a blame output\nrandom text\n\twith a tab line");
        // No preceding valid header — falls back to "Unknown" author, no crash.
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].author, "Unknown");
    }

    #[test]
    fn single_line_file() {
        let sample = "1111111111111111111111111111111111111111 1 1 1\nauthor Solo Dev\nauthor-time 1690000000\nsummary Single line\nfilename f.txt\n\tonly line\n";
        let lines = parse_blame_porcelain(sample);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].author, "Solo Dev");
        assert_eq!(lines[0].line_number, 1);
    }
}
