# CTF Assessment Portal - Time-Locked Question Engine

A React JS assessment portal powered by a dynamic question bank with strict 20-minute OTP expiration and replay protection. Built with React 18, Vite, and Tailwind CSS.

---

## Key Features

1. **Curated 350-Question Bank**:
   - Parsed from `ctf question bank.md`.
   - Categorized into **150 Easy**, **150 Medium**, and **50 Hard** questions with 4 options (A-D) and verified answers.
2. **Coordinator Gate**:
   - Only coordinators have access to generate OTPs/tokens.
   - Protected by a Coordinator Passcode (customizable).
   - Generates unique 6-digit numeric OTPs and signed JWT-style tokens.
   - Live dashboard tracks candidate session status, remaining time, scores, and allows one-click revocation.
3. **User Screen**:
   - Simple, focused participant UI containing only the **OTP input** gate and the **Questions output** page.
   - Entering a valid OTP unlocks **5 randomized questions**:
     - **2 Easy**
     - **2 Medium**
     - **1 Hard**
4. **20-Minute Timer & Anti-Replay Expiration**:
   - An active 20:00 live countdown timer runs during the assessment.
   - Auto-submits and expires when the 20 minutes elapse.
   - Re-entering the OTP after expiration or submission is strictly blocked:
     - *"This OTP has expired (20-minute limit exceeded). You cannot reuse this OTP or get the same questions."*
5. **Zero Database Needed**:
   - Complete state, active session, and OTP registry persistence using browser `localStorage` with real-time cross-tab synchronization.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Parse Question Bank (Pre-configured)
```bash
npm run parse:questions
```
*Outputs parsed questions to `src/data/questions.json` (150 Easy, 150 Medium, 50 Hard).*

### 3. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` (or the port displayed in terminal).

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## Coordinator Access
- Click **"Coordinator Portal"** in the top navigation bar.
- Passcode: Enter your coordinator passcode (or change it anytime via the "Change Passcode" button).
- Issue an OTP and copy the 6-digit code or JWT token to provide to the candidate.
