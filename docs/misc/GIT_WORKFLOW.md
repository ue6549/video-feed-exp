# Git Workflow for VideoFeedApp

## Branch Structure

### Main Branches

1. **`main`** (origin/main)
   - Production-ready code
   - Manual development and releases
   - **DO NOT merge AI-assisted changes directly here**

2. **`cursor-main`** (origin/cursor-main) ⭐ **AI Development Trunk**
   - Primary branch for AI-assisted development with Cursor
   - All `cursor-<feature>` branches merge here
   - Thoroughly tested before merging to `main`
   - **Current working branch for AI development**

### Feature Branches

3. **`cursor-<feature_name>`** (e.g., `cursor-ios-caching`)
   - AI-assisted feature development branches
   - Created from `cursor-main`
   - Merged back to `cursor-main` when complete
   - Naming convention: `cursor-<descriptive-feature-name>`

4. **`feature/*`**, **`fix/*`**, **`docs/*`**
   - Manual development branches
   - Follow standard Git Flow conventions

## Current State

```
main (origin/main)
  │
  └── cursor-main (origin/cursor-main) ← AI development trunk ⭐
       │
       └── cursor-ios-caching (origin/cursor-ios-caching) [MERGED]
```

### Branch Status

| Branch | Status | Description | Tracking |
|--------|--------|-------------|----------|
| `main` | Stable | Production code | `origin/main` |
| `cursor-main` | Active | AI development trunk | `origin/cursor-main` ✅ |
| `cursor-ios-caching` | Merged | iOS caching feature | `origin/cursor-ios-caching` ✅ |

## Workflow

### For AI-Assisted Development (Cursor)

1. **Start new feature:**
   ```bash
   git checkout cursor-main
   git pull origin cursor-main
   git checkout -b cursor-<feature-name>
   ```

2. **Work on feature:**
   - Make changes, commit frequently
   - Follow commit message conventions (see `.cursorrules`)

3. **Complete feature:**
   ```bash
   # Ensure you're on cursor-main
   git checkout cursor-main
   git pull origin cursor-main
   
   # Merge feature branch (no fast-forward for clear history)
   git merge cursor-<feature-name> --no-ff -m "Merge cursor-<feature-name> into cursor-main"
   
   # Push to origin
   git push origin cursor-main
   git push origin cursor-<feature-name>  # Keep feature branch for reference
   ```

4. **Promote to main (when ready for production):**
   ```bash
   git checkout main
   git pull origin main
   git merge cursor-main --no-ff -m "Merge cursor-main: <summary of features>"
   git push origin main
   ```

### For Manual Development

1. **Create feature branch from main:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/<feature-name>
   ```

2. **Complete and merge:**
   ```bash
   git checkout main
   git merge feature/<feature-name>
   git push origin main
   ```

## Branch History

### cursor-main
- **Created:** 2025-01-11
- **Base:** `main` (bcaed3b)
- **Purpose:** AI-assisted development trunk
- **Commits:**
  - `c58c678` - Merge cursor-ios-caching into cursor-main

### cursor-ios-caching
- **Created:** 2025-01-11
- **Base:** `main` (bcaed3b)
- **Purpose:** iOS video caching implementation
- **Status:** ✅ Merged into cursor-main
- **Commits:**
  - `1516a02` - feat(iOS): Add KTVHTTPCache video caching with custom native modules
  - `2d9d9e0` - docs(security): Add TODO for securing KTVHTTPCache local proxy server

## Commit Message Format

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Build process or auxiliary tool changes

**Example:**
```
feat(VideoCard): Add load time tracking

Connected onLoad event to track video load start time.
Fixed null load time issue by properly timing from native
player setup to ready for display callback.

Resolves: Load time tracking
```

## Quick Commands

### Check current status
```bash
git status
git branch -vv  # Show all branches with tracking info
```

### View commit history
```bash
git log --oneline --graph -10
git log --oneline --graph --all -10  # All branches
```

### Compare branches
```bash
git diff main..cursor-main --stat
git log main..cursor-main --oneline
```

### Sync with remote
```bash
# Update all remote tracking branches
git fetch origin

# Pull latest changes
git pull origin cursor-main
```

### Clean up merged branches (optional)
```bash
# Delete local feature branch after merge
git branch -d cursor-<feature-name>

# Delete remote feature branch (use with caution)
git push origin --delete cursor-<feature-name>
```

## Pull Request Guidelines

### Creating PRs

1. **cursor-<feature> → cursor-main:**
   - Title: `[Feature] <Short description>`
   - Include branch summary in description
   - Link to TESTING_GUIDE.md test cases
   - Add screenshots/videos for UI changes

2. **cursor-main → main:**
   - Title: `[Release] <Version or milestone>`
   - Comprehensive changelog
   - All tests passing
   - Documentation updated

### PR Review Checklist
- [ ] TypeScript compiles without errors
- [ ] iOS build succeeds
- [ ] All manual tests pass (TESTING_GUIDE.md)
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Performance acceptable

## Remote Repository

- **GitHub Repository:** `ue6549/video-feed-exp`
- **Remote URLs:**
  ```
  origin: github.com:ue6549/video-feed-exp.git
  ```

## Branch Protection (Recommended)

Consider enabling branch protection on GitHub for:
- `main` - Require PR reviews, status checks
- `cursor-main` - Optional protection

## Notes

- Always work on `cursor-main` or feature branches, never directly on `main`
- Keep `cursor-main` in sync with testing and stable
- Use merge commits (`--no-ff`) for clear history
- Tag releases on `main`: `git tag -a v1.0.0 -m "Release 1.0.0"`
- The `.cursorrules` file contains the branch naming convention

---

**Last Updated:** 2025-01-11  
**Current Branch:** cursor-main  
**Next Feature:** TBD

