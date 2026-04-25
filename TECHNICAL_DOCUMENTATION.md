# X-Ray Sourcer Technical Documentation

## 1) System Overview

`x-ray-sourcer` is a frontend-only recruiting workflow built with React + Vite.  
The application takes a job description (or sourcing prompt), extracts structured hiring requirements with an LLM, discovers candidate profiles using Google X-Ray queries across selected sources, and ranks candidates with structured AI scoring.

Current active search sources:

- LinkedIn
- GitHub
- X/Twitter

Core technical characteristics:

- Browser-executed API calls (OpenAI, SerpApi, Apollo)
- Incremental pipeline UX (fetch -> parse -> score -> results)
- Streaming candidate scoring (partial results visible while remaining profiles are still being scored)
- Explicit present-vs-missing requirement comparison per candidate

---

## 2) End-to-End Flow

### Step A: Requirement Extraction (JD/Prompt -> Structured Requirements)

Entry point: `src/components/dashboard/SearchDashboard.jsx`

Input:

- Raw JD text (`inputKind="jd"`) or sourcing prompt (`inputKind="prompt"`)

Output object (`extracted`):

- `jobTitle`
- `designation`
- `experienceYears`
- `location`
- `education`
- `primarySkills`
- `secondarySkills`
- `requiredSkills` (backward-compatible mirror of `primarySkills`)
- `niceToHaveSkills` (backward-compatible mirror of `secondarySkills`)
- `certifications`
- `searchSummary`

Prompt behavior enforces:

- explicit skill extraction (JD mode)
- primary vs secondary split
- skill normalization and atomic entries
- filtering of non-searchable/irrelevant terms

### Step B: Multi-Source X-Ray Query Generation

Entry point: `src/lib/linkedinXRayPipeline.js` in `runLinkedInXRaySearch()`

The LLM generates one Google X-Ray query per enabled source key:

- `linkedin`
- `github`
- `twitter`

### Step C: Serp Retrieval + Profile Parsing

Entry point: `searchGoogleAndParseCandidates()`

For each source query:

1. Fetch organic Google rows from SerpApi
2. Filter rows with platform-aware URL rules
3. Batch parse rows with OpenAI into candidate records
4. Fallback to title-based heuristic parsing if AI parsing fails
5. Deduplicate candidates across all sources

Candidate shape produced by parsing:

- `name`
- `title`
- `company`
- `location`
- `skills`
- `profileUrl`
- `source`
- `sourcePlatform`

### Step D: Candidate Scoring

Entry point: `src/components/steps/CandidateResults.jsx`

Scoring modes:

- Batch scoring (primary path)
- Per-candidate streaming scoring (active for source results view)
- Parallel chunk fallback if batch fails

Each scored candidate includes:

- `skillsMatch`
- `experienceMatch`
- `roleFit`
- `overallMatchScore`
- `primarySkillsMet`
- `primarySkillsMissing`
- `strengths`
- `gaps`
- `reasoning`
- `summary`
- `scoreExplanation`
- `estimatedYears`

### Step E: Recruiter Review UI

Entry point: `src/components/ui/CandidateCard.jsx`

Candidate cards include:

- Circular score ring
- Inner matched-vs-missing mini pie
- Tooltip for matched/missing counts
- Requirement comparison table:
  - Primary skills (present/missing)
  - Secondary skills (present/missing)
  - Location (present/missing)
  - Experience (present/missing)
- AI summary + rationale bullets
- Apollo enrichment action

---

## 3) Key Modules and Responsibilities

## `src/components/dashboard/SearchDashboard.jsx`

- Collects recruiter input
- Runs extraction LLM call
- Maintains user-facing analysis summary
- Displays extracted requirement table (role/experience/skills/location)

## `src/lib/linkedinXRayPipeline.js`

- Query generation for active sources
- Serp result fetch orchestration
- Platform-specific profile URL validation
- Batch parse and dedupe
- Emits incremental callbacks for progress UI

## `src/components/dashboard/SourceResultsView.jsx`

- Drives a source run lifecycle
- Connects pipeline output to scoring view
- Persists search history metadata

## `src/components/steps/CandidateResults.jsx`

- Owns scoring orchestration
- Supports streaming score updates
- Merges scored and unscored rows for live UX
- Controls pipeline progress presentation (horizontal/vertical context layout)

## `src/components/ui/CandidateCard.jsx`

- Candidate-level presentation
- Visual score ring + pie
- Requirement comparison table
- Contact enrichment and profile modal integration

## `src/components/ui/RankedPipelineProgress.jsx`

- Displays pipeline status
- Supports `horizontal` and `vertical` orientation
- Shows fetch/analysis/scoring/results counts and states

---

## 4) Data Contracts

### 4.1 Extracted Requirement Contract (frontend state)

```json
{
  "jobTitle": "Data Engineer",
  "designation": "Senior Engineer",
  "experienceYears": "4 to 8 years",
  "location": "Pune, Bangalore, Hyderabad",
  "education": "B.Tech / BE",
  "primarySkills": ["Python", "PySpark", "BigQuery"],
  "secondarySkills": ["Airflow", "Kafka"],
  "requiredSkills": ["Python", "PySpark", "BigQuery"],
  "niceToHaveSkills": ["Airflow", "Kafka"],
  "certifications": [],
  "searchSummary": "You are searching for..."
}
```

### 4.2 Parsed Candidate Contract

```json
{
  "name": "Candidate Name",
  "title": "Data Engineer",
  "company": "Company",
  "location": "City, Country",
  "skills": ["Python", "SQL"],
  "profileUrl": "https://...",
  "source": "linkedin",
  "sourcePlatform": "linkedin"
}
```

### 4.3 Scored Candidate Extension

```json
{
  "skillsMatch": 78,
  "experienceMatch": 70,
  "roleFit": 82,
  "overallMatchScore": 77,
  "primarySkillsMet": ["Python", "BigQuery"],
  "primarySkillsMissing": ["PySpark"],
  "strengths": ["..."],
  "gaps": ["..."],
  "reasoning": "...",
  "summary": "...",
  "scoreExplanation": ["..."],
  "estimatedYears": 5
}
```

---

## 5) Progress and Rendering Behavior

Pipeline phases:

- `queries`
- `search`
- `scoring`
- `done`

UI behavior:

- Before candidate rows exist: progress shown horizontally on top
- After candidate rows start rendering: progress moves to left vertical panel and candidate list renders on right
- Scoring streams candidate-by-candidate so completed scores appear immediately

---

## 6) Environment and External Services

Configured in `.env`:

- `VITE_OPENAI_API_KEY`
- `VITE_OPENAI_MODEL` (optional)
- `VITE_SERP_API_KEY`
- `VITE_APOLLO_API_KEY`
- `VITE_APOLLO_WEBHOOK_URL` (optional)

Integrations:

- OpenAI: extraction, parsing, scoring
- SerpApi: Google result retrieval
- Apollo: contact enrichment

---

## 7) Known Constraints

- Frontend-only architecture means API keys are client-exposed (acceptable for internal/demo use, not production-hardening)
- Candidate experience years are estimated by model when explicit profile chronology is unavailable
- URL-based profile filtering is heuristic and source-dependent

---

## 8) Recommended Next Improvements

- Add server-side proxy/backend for key security and observability
- Add structured telemetry for query quality and score drift
- Introduce source-level result quality weighting (LinkedIn/GitHub/Twitter)
- Add deterministic parsing fallback for known source URL/title formats
- Add configurable scoring rubric sliders for recruiter-specific weighting

