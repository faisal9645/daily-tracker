# Security Specification & Threat Model (Firestore Rules)

This document maps potential threat vectors and declares zero-trust security constraints to ensure robust data isolation.

## 1. Data Invariants
- **Identity Isolation**: A user can access and modify ONLY their own profile and task data.
- **Strict Fields**: Tasks must contain exact keys (no ghost/injected fields) and fit validated types and boundary sizes.
- **Validated Priority**: The `priority` field is limited to standard tags: `low`, `medium`, or `high`.
- **Verified Emails**: Access requires authenticated emails (`request.auth.token.email_verified == true`).

## 2. The "Dirty Dozen" Rogue Payloads
These payloads attempt to bypass identity constraints, inject bloated data, spoof timestamps, or alter other users' data.

1. **User Spoofing (Create path `/users/attackerId` with user field `userId: 'victimId'`)**
2. **Task Spoofing (Create path `/users/attackerId/tasks/taskId` with task field `title` but targeting victim fields)**
3. **Ghost Field Injection (Create task with unexpected field `isSuperAdmin: true`)**
4. **Invalid Priority Value (Task priority set to `'ultra'`)**
5. **Bloated Title (Title size exceeding 200 characters)**
6. **Task Cross-Ownership Reading (Retrieve `/users/victimId/tasks/taskId` while authenticated as attacker)**
7. **Negative/Bloated Duration Check (Duration set to `-100` or `10000000`)**
8. **Spoofed CreatedAt (Client-provided string for `createdAt` instead of `request.time`)**
9. **Blanket Query Read bypass (Attackers attempting collection group listing or unfiltered queries)**
10. **Incomplete Update-Gap Bypass (Triggering structural field modifications bypassing validation)**
11. **Malicious ID Poisoning (Document ID containing special characters or exceeding 128 characters)**
12. **Unverified email registration (User attempting to modify profiles without matching verified credentials)**

## 3. Threat Matrix & Verifications
All rogue attempts described above must be strictly rejected at the database border, returning a flat `PERMISSION_DENIED` error.
