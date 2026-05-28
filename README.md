# SkillBridge — AI-Powered Career Platform

SkillBridge is a modern AI-driven career platform designed to help college students bridge the gap between learning and getting placed.
It provides personalized roadmaps, real-world projects, mentorship, and a job readiness score — all in one system.

---

## Problem Statement

> 75% of graduates don’t get relevant jobs — not because they lack intelligence, but because they lack direction.

Students often:

* Follow random courses without structure
* Don’t know what skills are required for real jobs
* Lack proof of skills (portfolio/projects)
* Feel confused and overwhelmed

---

## Solution — SkillBridge

SkillBridge transforms the journey into a **clear, structured system**:

* Personalized AI Career Roadmaps
* Skill Gap Analysis based on industry data
* Daily Task Engine (what to learn, daily)
* Real-world Project Building
* Mentorship Support
*Job Readiness Score
* placement 
---

## Key Features

###  AI-Powered Roadmap

* Customized learning path based on your goal (e.g., Frontend, ML, etc.)
* Step-by-step progression system

###  Skill Gap Analyzer

* Identifies missing skills
* Suggests what to learn next

### Daily Task Engine

* No more confusion
* Clear daily tasks aligned with your roadmap

###  Project-Based Learning

* Build real projects instead of passive learning
* Track progress visually

### Job Readiness Score

* Single metric showing how job-ready you are
* Updates dynamically

###  Mentorship (Planned / Optional)

* Feedback from experienced developers
* Guidance on improvement

---

##  Dashboard Features

* Interactive AI roadmap visualization
* Progress tracking (skills, projects, readiness)
* Weekly activity heatmap
* Skill progress bars
* Project management system
* Clean, modern SaaS UI (cream + emerald theme)

---

##  Authentication (Supabase)

* Email/Password Login
* Google OAuth
* GitHub OAuth
* Secure user data storage
* Profile auto-creation via database trigger

---

## Tech Stack

### Frontend

* HTML, CSS, JavaScript
* Modern UI (Glassmorphism + Cream Theme)

### Backend / Services

* Supabase (Auth + Database)

### APIs / AI

* Google AI Studio (planned integration)
* External roadmap / skill APIs

---

## Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/skillbridge.git
cd skillbridge
```

### 2. Setup Supabase

* Create a project on Supabase
* Add:

  * `SUPABASE_URL`
  * `SUPABASE_ANON_KEY`

### 3. Run Locally

```bash
npx serve .
```

OR

```bash
python -m http.server 3000
```

Open:

```
http://localhost:3000
```

---

## Database Schema

### profiles

* id (uuid)
* email
* full_name
* created_at

### Additional Tables

* roadmaps
* project_submissions
* mentor_sessions

---

## Future Improvements

* AI Chat Assistant for doubts
* Downloadable roadmap PDFs
* Smarter skill recommendation engine
* Advanced analytics dashboard
* Full backend integration

---

## Project Goal

This project is built as a **portfolio-level SaaS product** to demonstrate:

* UI/UX design skills
* Full-stack integration (Auth + DB)
* Problem-solving mindset
* Real-world product thinking

---

## Contact

* GitHub:github.com/user-Rishabh/SKillBridge
* Email: rishabmishra075@gmail.com

---
