# Vercel Deployment Guide

## Environment Variables Setup

Before deploying to Vercel, configure these environment variables in the Vercel dashboard.

### Required Variables

#### Database
- `DATABASE_URL`: PostgreSQL connection string from Supabase (with pooler)
  ```
  postgresql://postgres:<password>@<region>.pooler.supabase.com:5432/postgres
  ```

#### Authentication & Security
- `JWT_SECRET`: Random 32+ byte string for JWT signing
  ```
  openssl rand -base64 32
  ```
- `AES_KEY`: Random 32+ byte string for AES-256 encryption
  ```
  openssl rand -base64 32
  ```

#### Email (Nodemailer - for password reset)
- `EMAIL_SMTP_HOST`: SMTP server hostname (e.g., smtp.gmail.com)
- `EMAIL_SMTP_USER`: SMTP username/email
- `EMAIL_SMTP_PASS`: SMTP password or app password
- `EMAIL_SMTP_PORT`: SMTP port (usually 587 for TLS, 465 for SSL)

#### URLs
- `FRONTEND_URL`: Production frontend URL (e.g., https://svgoi-appraisal.vercel.app)
- `CORS_ORIGINS`: Comma-separated CORS allowed origins (e.g., https://svgoi-appraisal.vercel.app)
- `NEXT_PUBLIC_API_URL`: Public API URL (e.g., https://api-svgoi.vercel.app/api/v1)

### Optional Variables
- `NODE_ENV`: Set to `production`

## Deployment Steps

### 1. Connect Repository to Vercel
```bash
# Via Vercel CLI
vercel login
vercel link
```

### 2. Configure Projects
Create two separate Vercel projects:
- **Frontend** (`apps/web`): Next.js web application
- **API** (`apps/api`): Express.js serverless functions

### 3. Set Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

For **both** projects:
```
DATABASE_URL = postgresql://...
JWT_SECRET = <base64-encoded-secret>
AES_KEY = <base64-encoded-key>
FRONTEND_URL = <frontend-url>
CORS_ORIGINS = <frontend-url>
```

For **Frontend only**:
```
NEXT_PUBLIC_API_URL = <api-url>/api/v1
```

For **API only**:
```
EMAIL_SMTP_HOST = smtp.gmail.com
EMAIL_SMTP_USER = your-email@gmail.com
EMAIL_SMTP_PASS = your-app-password
EMAIL_SMTP_PORT = 587
```

### 4. Deploy

#### Manual Deployment
```bash
vercel --prod
```

#### Automatic Deployment (GitHub Actions)
Push to `main` branch:
```bash
git push origin main
```

GitHub Actions workflow (`deploy.yml`) will automatically:
1. Run lint checks
2. Run typecheck
3. Build projects
4. Deploy to Vercel

### 5. Database Migrations

After first deployment, run Prisma migrations:

```bash
# Connect to production database
DATABASE_URL=<prod-url> pnpm exec prisma migrate deploy

# Or push schema
DATABASE_URL=<prod-url> pnpm exec prisma db push
```

## Monitoring & Logs

### Vercel Dashboard
- **Deployments**: View deployment history and rollbacks
- **Analytics**: Monitor CPU, memory, and request metrics
- **Functions**: View serverless function execution logs
- **Logs**: Real-time log streaming

### Check Deployment Status
```bash
vercel logs <project-name>
```

## Rollback

If deployment has issues:
```bash
vercel rollback
```

## Performance Optimization

### Database Connection Pooling
Vercel recommends using Supabase connection pooler:
- Pooler mode: Transaction
- Max clients per serverless function: 5

### Cold Start Optimization
- Prisma is pre-initialized to reduce cold start
- API routes cached at edge when possible
- Static content served via Vercel CDN

## Security Checklist

- [ ] Database credentials use IAM authentication
- [ ] JWT_SECRET is cryptographically secure
- [ ] CORS_ORIGINS restricted to known domains
- [ ] Email credentials stored as environment variables (never in code)
- [ ] HTTPS enforced on all endpoints
- [ ] Rate limiting configured
- [ ] Audit logging enabled

## Support & Troubleshooting

### Common Issues

1. **501 Bad Gateway**
   - Check function memory (increase if needed)
   - Verify DATABASE_URL is correct
   - Check serverless function timeout

2. **CORS errors**
   - Verify CORS_ORIGINS env var matches request origin
   - Check preflight requests are handled

3. **Email not sending**
   - Verify EMAIL_SMTP_* variables
   - Check SMTP credentials are correct
   - Verify firewall allows outbound SMTP

4. **Database connection timeout**
   - Ensure pooler is configured
   - Check max connections limit
   - Verify IP whitelist if applicable

For detailed logs:
```bash
vercel logs --follow
```

## References

- [Vercel Documentation](https://vercel.com/docs)
- [Prisma with Vercel](https://www.prisma.io/docs/deployment/deploy-to-vercel)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Express.js on Vercel](https://vercel.com/docs/functions/serverless-functions)
