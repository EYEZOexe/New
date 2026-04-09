# Job Search Automation System — Design Spec

**Date**: 2026-03-27
**Author**: Claude + Thomas Malandris
**Status**: Draft

---

## Purpose

Automate daily/recurring job searches for junior/mid remote game development positions matching Thomas's resume (UE5, C++, Unity, C#). The system runs fully in the background with no visible windows, outputs structured markdown files with application checkboxes, and maintains an Excel tracker for deduplication and application status.

## Architecture Overview

```
Task Scheduler (every 4 hours)
    → run-job-search.vbs (hidden launcher)
        → job-search.ps1 (PowerShell, hidden window)
            → Reads job_tracker.xlsx (seen/applied jobs)
            → Builds prompt with resume context + seen jobs
            → Calls: claude -p "<prompt>" --output-format json
            → Parses structured JSON response
            → Writes: JOB_SEARCH/job-search-YYYY-MM-DD.md
            → Updates: job_tracker.xlsx (new entries appended)
            → Writes: JOB_SEARCH/logs/YYYY-MM-DD.log
```

## Components

### 1. `run-job-search.vbs` — Silent Launcher

Two-line VBS script. Its only job is to invoke PowerShell with no visible window.

```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\Users\NAT20\Desktop\JOB_SEARCH\scripts\job-search.ps1""", 0, True
```

- Window style `0` = fully hidden
- `True` = wait for completion (so Task Scheduler knows when it finishes)

### 2. `job-search.ps1` — Main Script

Location: `C:\Users\NAT20\Desktop\JOB_SEARCH\scripts\job-search.ps1`

**Flow:**

1. **Read Excel tracker** — Load `job_tracker.xlsx` using ImportExcel module. Extract list of seen job links/company+title pairs for deduplication.

2. **Read resume context** — Load a pre-written resume summary (not the PDF — a text extract stored alongside the script) so Claude has context for matching.

3. **Build Claude prompt** — Construct a detailed prompt that includes:
   - Resume summary and target criteria (junior/mid, remote, game dev, UE5/C++/Unity/C#)
   - List of already-seen job identifiers (links + company+title)
   - List of already-applied jobs
   - Search sources to check
   - Output format instructions (JSON with specific fields)

4. **Call Claude CLI** — `claude -p "<prompt>" --output-format json`
   - Non-interactive, no terminal needed
   - JSON output for reliable parsing

5. **Parse response** — Extract job entries from Claude's JSON response. Each entry has:
   - title, company, location, link, source, match_description, match_strength

6. **Deduplicate** — Filter out any jobs already in the Excel tracker (match on link OR company+title pair).

7. **Write markdown** — Append to or create `JOB_SEARCH/job-search-YYYY-MM-DD.md`:
   - If file exists for today (from earlier run), append new section with timestamp
   - If not, create new file with header
   - Format matches the existing style: `[ ] **Title** — Company` with details

8. **Update Excel** — Append new rows to `job_tracker.xlsx`:
   - Job Title, Company, Link, Date Found, Applied (No), Date Applied (blank), Location, Match Strength, Source Site, Notes

9. **Log** — Write run summary to `JOB_SEARCH/logs/YYYY-MM-DD.log`

**Search Sources:**
- remotegamejobs.com
- jobs.gamesindustry.biz
- skillshot.pl
- workwithindies.com
- Web searches for: "junior gameplay programmer remote", "UE5 developer junior", "C++ game developer junior remote", "Unity developer junior game remote"

**Target Criteria:**
- Junior or mid-level (skip senior-only 5+ years required)
- Remote preferred (open to relocation-friendly)
- Game development / interactive entertainment
- Tech stack: C++, UE4/UE5, C#, Unity, Blueprints
- Bonus: AI/gameplay systems, ARPG, custom engine work

### 3. `job_tracker.xlsx` — Excel Tracker

Location: `C:\Users\NAT20\Desktop\JOB_SEARCH\job_tracker.xlsx`

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Job Title | Text | Position title |
| Company | Text | Company name |
| Link | URL | Job listing URL |
| Date Found | Date | When the script first found this job |
| Applied | Yes/No | Whether you've applied (you mark this) |
| Date Applied | Date | When you applied (you fill this in) |
| Location | Text | Remote / City / Hybrid |
| Match Strength | Text | strong / moderate |
| Source Site | Text | Where the listing was found |
| Notes | Text | Free-form notes (you fill this in) |

**Deduplication logic:** A job is considered "seen" if:
- Its link matches an existing row, OR
- Its company + title pair matches an existing row (handles same job posted on multiple sites)

### 4. Markdown Output Format

Location: `C:\Users\NAT20\Desktop\JOB_SEARCH\job-search-YYYY-MM-DD.md`

Follows the existing format from `job-search-2026-03-24.md`:

```markdown
# Game Dev Job Search — YYYY-MM-DD
Found X new jobs (Y scanned, Z duplicates skipped)

---

## Strong Matches

- [ ] **Job Title** — Company
  - Location: Remote
  - Source: remotegamejobs.com
  - Link: https://...
  - Match: Why this matches your profile
  - Match strength: strong

## Moderate Matches
...

---

### Sources Searched
- (list of sources checked)

### Applied Jobs (from tracker)
- (list of jobs marked Applied=Yes in Excel)
```

### 5. Resume Context File

Location: `C:\Users\NAT20\Desktop\JOB_SEARCH\scripts\resume-context.txt`

A plain-text extract of the resume so the script doesn't need to parse PDF each run. Contains:
- Profile summary
- Key skills (C++, UE5, C#, Unity, etc.)
- Experience highlights (Pangea Dawn, custom engine, TIGA nomination)
- Target role criteria

### 6. Scheduled Task

- **Name**: `JobSearchAutomation`
- **Trigger**: Every 4 hours starting at 11:00 AM Athens time (EET/EEST)
- **Action**: Run `run-job-search.vbs`
- **Settings**:
  - Run only when user is logged on (no password needed)
  - Do not start new instance if already running
  - No wake-to-run

## Directory Structure

```
C:\Users\NAT20\Desktop\JOB_SEARCH\
├── scripts/
│   ├── job-search.ps1        # Main PowerShell script
│   ├── run-job-search.vbs    # Silent launcher
│   └── resume-context.txt    # Resume text extract
├── logs/
│   └── 2026-03-27.log        # Daily run logs
├── job_tracker.xlsx           # Excel tracker (master)
├── job-search-2026-03-27.md   # Daily results
└── ...
```

## Error Handling

- If Claude CLI fails (network, auth), log the error and exit gracefully
- If Excel is locked (user has it open), write to a temp file and merge on next run
- If no new jobs found, still log the run but don't create an empty markdown file
- Script has a 5-minute timeout for the Claude CLI call

## Migration

On first run, the script will:
1. Import existing entries from `job-search-2026-03-24.md` and `job-search-2026-03-23.md` into the Excel tracker
2. Mark them as "Not Applied" unless they appear in the Applied Jobs section of those files
