# GitHub Actions Secrets Setup Guide

This file documents how to configure GitHub Actions secrets for CI/CD deployment.

## Secrets Required

### 1. Vercel Configuration

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID_WEB
VERCEL_PROJECT_ID_API
VERCEL_FRONTEND_URL
VERCEL_API_URL
```

**How to get these:**

1. **VERCEL_TOKEN**: Generate at https://vercel.com/account/tokens
   - Personal token with full scope
   - Never share publicly
   
2. **VERCEL_ORG_ID**: From Vercel dashboard
   - Settings → General → Team ID
   
3. **VERCEL_PROJECT_ID_WEB**: From web project
   - Project Settings → General → Project ID
   
4. **VERCEL_PROJECT_ID_API**: From API project
   - Project Settings → General → Project ID

5. **VERCEL_FRONTEND_URL**: Production frontend URL
   - e.g., `https://svgoi-appraisal.vercel.app`
   
6. **VERCEL_API_URL**: Production API URL
   - e.g., `https://api-svgoi.vercel.app`

### 2. Database Secrets

```
DATABASE_URL_PROD
```

Production PostgreSQL connection string from Supabase pooler.

### 3. Application Secrets

```
JWT_SECRET_PROD
AES_KEY_PROD
```

Use the same values as Vercel environment variables.

### 4. Email Configuration

```
EMAIL_SMTP_HOST_PROD
EMAIL_SMTP_USER_PROD
EMAIL_SMTP_PASS_PROD
EMAIL_SMTP_PORT_PROD
```

## Setting Secrets via GitHub

### Via GitHub Web UI

1. Go to repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with its value

### Via GitHub CLI

```bash
gh secret set VERCEL_TOKEN --body "your-token"
gh secret set VERCEL_ORG_ID --body "your-org-id"
gh secret set VERCEL_PROJECT_ID_WEB --body "your-project-id"
gh secret set VERCEL_PROJECT_ID_API --body "your-api-project-id"
gh secret set DATABASE_URL_PROD --body "postgresql://..."
gh secret set JWT_SECRET_PROD --body "your-jwt-secret"
gh secret set AES_KEY_PROD --body "your-aes-key"
```

## Workflow Execution

### Automatic Triggers

1. **Push to `main`** → Runs build and deploy workflows
   ```bash
   git push origin main
   ```

2. **Pull requests to `main` or `develop`** → Runs lint, typecheck, build
   ```bash
   git push origin feature-branch
   # Then create PR on GitHub
   ```

### Manual Trigger

Via GitHub Actions tab in repository:
1. Select workflow
2. Click "Run workflow"
3. Select branch
4. Click "Run workflow"

## Workflow Jobs

### Build Workflow (`build.yml`)

**Triggers**: Push to main/develop, PRs to main/develop

**Jobs**:
1. **lint**: ESLint checks
2. **typecheck**: TypeScript type checking
3. **build**: Full project build (depends on lint & typecheck)

**Artifacts**: 
- `.next` (Next.js build)
- `dist` (Express build)

### Deploy Workflow (`deploy.yml`)

**Triggers**: Push to main branch only

**Jobs**:
1. **deploy**: 
   - Runs typecheck
   - Builds projects
   - Deploys web to Vercel
   - Deploys API to Vercel
   - Posts deployment notification

**Environment**: Production

## Monitoring Deployments

### View Workflow Runs

```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch <run-id>

# View logs
gh run view <run-id> --log
```

### Check Status in GitHub

1. Repository → Actions tab
2. Select workflow run
3. View job logs and status

## Troubleshooting

### Workflow Fails

1. Check workflow logs in Actions tab
2. Common issues:
   - Missing secrets: Add in Settings → Secrets
   - Build errors: Fix code issues locally first
   - Node version mismatch: Check node-version in workflow
   - pnpm cache: Clear via Actions tab or re-run

### Deployment Fails

1. Check Vercel logs:
   ```bash
   vercel logs --follow
   ```

2. Common issues:
   - Environment variables not set
   - Database connection failed
   - Memory limit exceeded
   - Build timeout

### Re-run Failed Job

```bash
# Re-run failed jobs
gh run rerun <run-id> --failed

# Re-run entire run
gh run rerun <run-id>
```

## Security Best Practices

- [ ] Use fine-grained personal access tokens when possible
- [ ] Rotate secrets regularly
- [ ] Never commit secrets to repository
- [ ] Use environment-specific secrets
- [ ] Review action permissions in workflow
- [ ] Audit GitHub Actions logs regularly
- [ ] Use branch protection rules

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub CLI Reference](https://cli.github.com/manual)
- [Vercel GitHub Integration](https://vercel.com/docs/git/vercel-for-github)
