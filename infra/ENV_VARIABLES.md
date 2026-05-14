# Environment Variables Template

This file documents all required and optional environment variables for the SVGOI Appraisal System.

## Development Setup

Copy `.env.local.example` files to `.env.local` in each app directory:

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.local.example apps/api/.env.local
```

## Database

```
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Format**: PostgreSQL connection string

**For Supabase**:

```
DATABASE_URL=postgresql://postgres:<password>@<region>.pooler.supabase.com:5432/postgres
```

**For Neon** (recommended for serverless):

```
DATABASE_URL=postgresql://user:password@<project>.neon.tech/database?sslmode=require
```

## Authentication

### JWT Configuration

```
JWT_SECRET=<base64-encoded-32-byte-secret>
```

Generate with:

```bash
openssl rand -base64 32
```

### AES Encryption Key

```
AES_KEY=<base64-encoded-32-byte-key>
```

Generate with:

```bash
openssl rand -base64 32
```

**Usage**:

- Signs JWT tokens for access control
- Encrypts sensitive data (passwords, reset tokens)
- Must be kept secure and rotated periodically

## Email Configuration

**SMTP Provider** (e.g., Gmail, SendGrid, AWS SES)

```
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-app-password
EMAIL_FROM_ADDRESS=noreply@svgoi-appraisal.com
```

**Gmail Setup**:

1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password in `EMAIL_SMTP_PASS`

## Frontend URLs

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
FRONTEND_URL=http://localhost:3000
```

**Production values**:

```
NEXT_PUBLIC_API_URL=https://api-svgoi.vercel.app/api/v1
FRONTEND_URL=https://svgoi-appraisal.vercel.app
```

## CORS Configuration

```
CORS_ORIGINS=http://localhost:3000,https://svgoi-appraisal.vercel.app
```

Comma-separated list of allowed origins for CORS requests.

## Node Environment

```
NODE_ENV=development
```

Values: `development`, `staging`, `production`

## Logging

```
LOG_LEVEL=debug
```

Values: `debug`, `info`, `warn`, `error`

## Optional: Redis (Future)

```
REDIS_URL=redis://localhost:6379
```

For caching and session management.

## Google Drive Upload Storage

Faculty profile documents and appraisal evidence are stored in Google Drive and tracked in Prisma as `Document` rows.

### Required Variables

```
GOOGLE_DRIVE_FOLDER_ID=<parent-folder-id>
GOOGLE_DRIVE_CLIENT_EMAIL=<service-account-email>
GOOGLE_DRIVE_PRIVATE_KEY=<service-account-private-key>
```

You can also provide the service account as one JSON blob instead of separate keys:

```
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON={"client_email":"...","private_key":"..."}
```

### Setup Steps

1. Enable the Google Drive API in your Google Cloud project.
2. Create a service account for the app and download its credentials.
3. Share the target Drive folder with the service account email as a reader/editor.
4. Copy the folder ID from the Drive URL into `GOOGLE_DRIVE_FOLDER_ID`.
5. Set either `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` or the `GOOGLE_DRIVE_CLIENT_EMAIL` and `GOOGLE_DRIVE_PRIVATE_KEY` pair.
6. Restart the API server after changing the variables.

### Notes

- The backend uses the folder ID as the default upload destination for faculty profile and appraisal documents.
- The service account must have permission to create files in the target folder.
- Private keys from `.env` files usually need escaped newlines, and the backend normalizes `\n` to real newlines at runtime.

## Development vs Production

### Development

```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/appraisal
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
FRONTEND_URL=http://localhost:3000
```

### Production (Vercel)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@region.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_API_URL=https://api-svgoi.vercel.app/api/v1
FRONTEND_URL=https://svgoi-appraisal.vercel.app
CORS_ORIGINS=https://svgoi-appraisal.vercel.app
```

## Security Notes

- **Never commit** `.env.local` or `.env` files to version control
- Store secrets in:
  - Local development: `.env.local` (not in git)
  - Production: Vercel Environment Variables (dashboard or CLI)
  - CI/CD: GitHub Secrets
- Rotate secrets regularly (JWT_SECRET, AES_KEY)
- Use strong, cryptographically secure values for secrets
- Enable IP whitelisting for database access in production

## Vercel Integration

Set environment variables via Vercel dashboard or CLI:

```bash
# Set single variable
vercel env add DATABASE_URL

# Set multiple for specific environment
vercel env add JWT_SECRET --environment production

# View all variables
vercel env ls
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full Vercel setup instructions.
